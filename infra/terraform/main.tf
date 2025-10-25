terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "${var.project}-${var.environment}"
  tags = merge({
    Project     = var.project
    Environment = var.environment
  }, var.tags)

  portal_url       = "https://${var.portal_domain}"
  website_url      = "https://${var.website_domain}"
  wms_public_url   = "${local.portal_url}/wms"
  xplan_public_url = "${local.portal_url}/xplan"
  db_url_base      = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.portal.address}:${aws_db_instance.portal.port}/portal_db"
  portal_db_auth   = "${local.db_url_base}?schema=auth"
  portal_db_wms    = "${local.db_url_base}?schema=wms"
  portal_db_xplan  = "${local.db_url_base}?schema=xplan"

  ecomos_env_defaults = {
    NODE_ENV        = "production"
    PORT            = "3000"
    PORTAL_AUTH_URL = local.portal_url
    NEXTAUTH_URL    = "${local.portal_url}/api/auth"
    COOKIE_DOMAIN   = var.cookie_domain
    PORTAL_DB_URL   = local.portal_db_auth
  }

  wms_env_defaults = {
    NODE_ENV                    = "production"
    PORT                        = "3001"
    BASE_PATH                   = "/wms"
    NEXT_PUBLIC_BASE_PATH       = "/wms"
    PORTAL_AUTH_URL             = local.portal_url
    NEXT_PUBLIC_PORTAL_AUTH_URL = local.portal_url
    NEXTAUTH_URL                = "${local.portal_url}/wms/api/auth"
    NEXT_PUBLIC_APP_URL         = local.wms_public_url
    CSRF_ALLOWED_ORIGINS        = "${local.portal_url},${local.wms_public_url}"
    COOKIE_DOMAIN               = var.cookie_domain
    DATABASE_URL                = local.portal_db_wms
  }

  xplan_env_defaults = {
    NODE_ENV                    = "production"
    PORT                        = "3009"
    BASE_PATH                   = "/xplan"
    NEXT_PUBLIC_BASE_PATH       = "/xplan"
    PORTAL_AUTH_URL             = local.portal_url
    NEXT_PUBLIC_PORTAL_AUTH_URL = local.portal_url
    NEXTAUTH_URL                = "${local.portal_url}/xplan/api/auth"
    NEXT_PUBLIC_APP_URL         = local.xplan_public_url
    CSRF_ALLOWED_ORIGINS        = "${local.portal_url},${local.xplan_public_url}"
    COOKIE_DOMAIN               = var.cookie_domain
    DATABASE_URL                = local.portal_db_xplan
  }

  website_env_defaults = {
    NODE_ENV            = "production"
    PORT                = "3005"
    NEXT_PUBLIC_APP_URL = local.website_url
  }

  ecomos_env  = merge(var.ecomos_environment, local.ecomos_env_defaults)
  wms_env     = merge(var.wms_environment, local.wms_env_defaults)
  xplan_env   = merge(var.xplan_environment, local.xplan_env_defaults)
  website_env = merge(var.website_environment, local.website_env_defaults)

  image_tag          = var.image_tag
  ecomos_image_uri   = "${aws_ecr_repository.ecomos.repository_url}:${local.image_tag}"
  wms_image_uri      = "${aws_ecr_repository.wms.repository_url}:${local.image_tag}"
  xplan_image_uri    = "${aws_ecr_repository.xplan.repository_url}:${local.image_tag}"
  website_image_uri  = "${aws_ecr_repository.website.repository_url}:${local.image_tag}"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.tags, { Name = "${local.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, { Name = "${local.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each = { for idx, cidr in var.public_subnet_cidrs : idx => cidr }

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[tonumber(each.key) % length(data.aws_availability_zones.available.names)]

  tags = merge(local.tags, { Name = "${local.name_prefix}-public-${each.key}" })
}

resource "aws_subnet" "private" {
  for_each = { for idx, cidr in var.private_subnet_cidrs : idx => cidr }

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = data.aws_availability_zones.available.names[tonumber(each.key) % length(data.aws_availability_zones.available.names)]

  tags = merge(local.tags, { Name = "${local.name_prefix}-private-${each.key}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(local.tags, { Name = "${local.name_prefix}-public-rt" })
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_db_subnet_group" "portal" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = merge(local.tags, { Name = "${local.name_prefix}-db-subnets" })
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "ALB security group"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name_prefix}-alb-sg" })
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "ECS instances security group"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name_prefix}-ecs-sg" })
}

resource "aws_security_group_rule" "ecs_from_alb_portal" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Portal traffic from ALB"
}

resource "aws_security_group_rule" "ecs_from_alb_wms" {
  type                     = "ingress"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
  description              = "WMS traffic from ALB"
}

resource "aws_security_group_rule" "ecs_from_alb_xplan" {
  type                     = "ingress"
  from_port                = 3009
  to_port                  = 3009
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
  description              = "X-Plan traffic from ALB"
}

resource "aws_security_group_rule" "ecs_from_alb_website" {
  type                     = "ingress"
  from_port                = 3005
  to_port                  = 3005
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Website traffic from ALB"
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "RDS security group"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name_prefix}-rds-sg" })
}

resource "aws_ecr_repository" "ecomos" {
  name                 = "${var.project}-ecomos"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, { Service = "ecomos" })
}

resource "aws_ecr_repository" "wms" {
  name                 = "${var.project}-wms"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, { Service = "wms" })
}

resource "aws_ecr_repository" "xplan" {
  name                 = "${var.project}-x-plan"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, { Service = "x-plan" })
}

resource "aws_ecr_repository" "website" {
  name                 = "${var.project}-website"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, { Service = "website" })
}

resource "aws_cloudwatch_log_group" "ecomos" {
  name              = "/ecs/${local.name_prefix}/ecomos"
  retention_in_days = 7
  tags              = merge(local.tags, { Service = "ecomos" })
}

resource "aws_cloudwatch_log_group" "wms" {
  name              = "/ecs/${local.name_prefix}/wms"
  retention_in_days = 7
  tags              = merge(local.tags, { Service = "wms" })
}

resource "aws_cloudwatch_log_group" "xplan" {
  name              = "/ecs/${local.name_prefix}/xplan"
  retention_in_days = 7
  tags              = merge(local.tags, { Service = "x-plan" })
}

resource "aws_cloudwatch_log_group" "website" {
  name              = "/ecs/${local.name_prefix}/website"
  retention_in_days = 7
  tags              = merge(local.tags, { Service = "website" })
}

resource "aws_lb" "main" {
  name               = substr("${local.name_prefix}-alb", 0, 32)
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for s in aws_subnet.public : s.id]

  tags = merge(local.tags, { Name = "${local.name_prefix}-alb" })
}

resource "aws_lb_target_group" "ecomos" {
  name        = substr("${local.name_prefix}-ecomos", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 4
    timeout             = 5
    interval            = 30
  }

  tags = merge(local.tags, { Service = "ecomos" })
}

resource "aws_lb_target_group" "wms" {
  name        = substr("${local.name_prefix}-wms", 0, 32)
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = var.wms_health_check_path
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 4
    timeout             = 5
    interval            = 30
  }

  tags = merge(local.tags, { Service = "wms" })
}

resource "aws_lb_target_group" "xplan" {
  name        = substr("${local.name_prefix}-xplan", 0, 32)
  port        = 3009
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = var.xplan_health_check_path
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 4
    timeout             = 5
    interval            = 30
  }

  tags = merge(local.tags, { Service = "x-plan" })
}

resource "aws_lb_target_group" "website" {
  name        = substr("${local.name_prefix}-website", 0, 32)
  port        = 3005
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 4
    timeout             = 5
    interval            = 30
  }

  tags = merge(local.tags, { Service = "website" })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecomos.arn
  }
}

resource "aws_lb_listener_rule" "website" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.website.arn
  }

  condition {
    host_header {
      values = [var.website_domain]
    }
  }
}

resource "aws_lb_listener_rule" "wms" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.wms.arn
  }

  condition {
    host_header {
      values = [var.portal_domain]
    }
  }

  condition {
    path_pattern {
      values = ["/wms*", "/wms/*"]
    }
  }
}

resource "aws_lb_listener_rule" "xplan" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.xplan.arn
  }

  condition {
    host_header {
      values = [var.portal_domain]
    }
  }

  condition {
    path_pattern {
      values = ["/xplan*", "/xplan/*"]
    }
  }
}

resource "aws_iam_role" "ecs_instance" {
  name               = "${local.name_prefix}-ecs-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_instance_assume.json
  tags               = merge(local.tags, { Name = "${local.name_prefix}-ecs-instance-role" })
}

data "aws_iam_policy_document" "ecs_instance_assume" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "${local.name_prefix}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance.name
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
  tags               = merge(local.tags, { Name = "${local.name_prefix}-ecs-execution-role" })
}

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_ami" "ecs" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_launch_template" "ecs" {
  name_prefix   = "${local.name_prefix}-ecs-"
  image_id      = data.aws_ami.ecs.id
  instance_type = var.ecs_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance.name
  }

  user_data = base64encode(<<-EOT
              #!/bin/bash
              echo ECS_CLUSTER=${aws_ecs_cluster.this.name} >> /etc/ecs/ecs.config
              EOT
  )

  network_interfaces {
    security_groups             = [aws_security_group.ecs.id]
    associate_public_ip_address = true
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(local.tags, { Name = "${local.name_prefix}-ecs" })
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "ecs" {
  name                = "${local.name_prefix}-ecs-asg"
  min_size            = var.ecs_min_size
  max_size            = var.ecs_max_size
  desired_capacity    = var.ecs_desired_capacity
  vpc_zone_identifier = [for s in aws_subnet.public : s.id]
  health_check_type   = "EC2"
  force_delete        = false

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-ecs"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(local.tags, { Name = "${local.name_prefix}-cluster" })
}

resource "aws_ecs_capacity_provider" "asg" {
  name = "${local.name_prefix}-cp"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs.arn
    managed_termination_protection = "DISABLED"

    managed_scaling {
      status                    = "ENABLED"
      target_capacity           = 80
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 2
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = aws_ecs_cluster.this.name

  capacity_providers = [aws_ecs_capacity_provider.asg.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.asg.name
    weight            = 1
  }
}

resource "aws_db_instance" "portal" {
  identifier                 = "${local.name_prefix}-portal"
  allocated_storage          = var.db_allocated_storage
  engine                     = "postgres"
  engine_version             = var.db_engine_version
  instance_class             = var.db_instance_class
  db_name                    = "portal_db"
  username                   = var.db_username
  password                   = var.db_password
  multi_az                   = false
  publicly_accessible        = false
  storage_encrypted          = true
  deletion_protection        = false
  auto_minor_version_upgrade = true
  backup_retention_period    = var.db_backup_retention
  apply_immediately          = true
  skip_final_snapshot        = var.db_skip_final_snapshot
  db_subnet_group_name       = aws_db_subnet_group.portal.name
  vpc_security_group_ids     = [aws_security_group.rds.id]

  tags = merge(local.tags, { Name = "${local.name_prefix}-portal-db" })
}

resource "aws_ecs_task_definition" "ecomos" {
  family                   = "${local.name_prefix}-ecomos"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "ecomos"
      image     = local.ecomos_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        for key, value in local.ecomos_env : {
          name  = key
          value = tostring(value)
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecomos.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = merge(local.tags, { Service = "ecomos" })
}

resource "aws_ecs_task_definition" "wms" {
  family                   = "${local.name_prefix}-wms"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "wms"
      image     = local.wms_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        }
      ]
      environment = [
        for key, value in local.wms_env : {
          name  = key
          value = tostring(value)
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.wms.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = merge(local.tags, { Service = "wms" })
}

resource "aws_ecs_task_definition" "xplan" {
  family                   = "${local.name_prefix}-xplan"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "xplan"
      image     = local.xplan_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3009
          hostPort      = 3009
          protocol      = "tcp"
        }
      ]
      environment = [
        for key, value in local.xplan_env : {
          name  = key
          value = tostring(value)
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.xplan.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = merge(local.tags, { Service = "x-plan" })
}

resource "aws_ecs_task_definition" "website" {
  family                   = "${local.name_prefix}-website"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "website"
      image     = local.website_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3005
          hostPort      = 3005
          protocol      = "tcp"
        }
      ]
      environment = [
        for key, value in local.website_env : {
          name  = key
          value = tostring(value)
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.website.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = merge(local.tags, { Service = "website" })
}

resource "aws_ecs_service" "ecomos" {
  name            = "${local.name_prefix}-ecomos"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.ecomos.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.asg.name
    weight            = 1
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecomos.arn
    container_name   = "ecomos"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http]

  tags = merge(local.tags, { Service = "ecomos" })
}

resource "aws_ecs_service" "wms" {
  name            = "${local.name_prefix}-wms"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.wms.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.asg.name
    weight            = 1
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.wms.arn
    container_name   = "wms"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener_rule.wms]

  tags = merge(local.tags, { Service = "wms" })
}

resource "aws_ecs_service" "xplan" {
  name            = "${local.name_prefix}-xplan"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.xplan.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.asg.name
    weight            = 1
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.xplan.arn
    container_name   = "xplan"
    container_port   = 3009
  }

  depends_on = [aws_lb_listener_rule.xplan]

  tags = merge(local.tags, { Service = "x-plan" })
}

resource "aws_ecs_service" "website" {
  name            = "${local.name_prefix}-website"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.website.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.asg.name
    weight            = 1
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.website.arn
    container_name   = "website"
    container_port   = 3005
  }

  depends_on = [aws_lb_listener_rule.website]

  tags = merge(local.tags, { Service = "website" })
}
