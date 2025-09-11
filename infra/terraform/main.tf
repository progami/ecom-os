terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  required_version = ">= 1.0"
}

provider "aws" { region = var.aws_region }

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter { name = "name" values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"] }
  filter { name = "virtualization-type" values = ["hvm"] }
}

resource "aws_security_group" "mono_sg" {
  name_prefix = "${var.instance_name}-sg-"
  description = "Security group for Ecom OS mono EC2"

  ingress { description = "SSH" from_port = 22 to_port = 22 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "HTTP" from_port = 80 to_port = 80 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "HTTPS" from_port = 443 to_port = 443 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  # App ports (website:3000, wms:3001, fcc:3003, hrms:3006)
  ingress { description = "App 3000" from_port = 3000 to_port = 3000 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "App 3001" from_port = 3001 to_port = 3001 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "App 3003" from_port = 3003 to_port = 3003 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "App 3006" from_port = 3006 to_port = 3006 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }

  egress { from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = ["0.0.0.0/0"] }

  tags = { Name = "${var.instance_name}-sg" }
}

resource "aws_iam_role" "mono_role" {
  name = "${var.instance_name}-instance-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" } }]
  })
}

resource "aws_iam_instance_profile" "mono_profile" { name = "${var.instance_name}-profile" role = aws_iam_role.mono_role.name }

resource "aws_instance" "mono" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  vpc_security_group_ids      = [aws_security_group.mono_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.mono_profile.name
  associate_public_ip_address = true
  user_data                   = file("${path.module}/user_data_minimal.sh")

  root_block_device { volume_size = 30 volume_type = "gp3" }

  tags = { Name = var.instance_name, Environment = var.environment }
}

resource "aws_eip" "mono_eip" { instance = aws_instance.mono.id domain = "vpc" }

output "public_ip" { value = aws_eip.mono_eip.public_ip }
output "instance_id" { value = aws_instance.mono.id }

