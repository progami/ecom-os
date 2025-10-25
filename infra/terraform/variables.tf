variable "aws_region" {
  description = "AWS region to deploy resources into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment identifier (e.g., prod, staging)."
  type        = string
  default     = "prod"
}

variable "project" {
  description = "Project name used for tagging and resource prefixes."
  type        = string
  default     = "ecom-os"
}

variable "tags" {
  description = "Additional tags to apply to all resources."
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets."
  type        = list(string)
  default     = ["10.40.1.0/24", "10.40.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "List of CIDR blocks for private subnets (used by RDS)."
  type        = list(string)
  default     = ["10.40.11.0/24", "10.40.12.0/24"]
}

variable "portal_domain" {
  description = "Primary domain serving the portal (e.g., ecomos.targonglobal.com)."
  type        = string
}

variable "website_domain" {
  description = "Domain serving the marketing site (e.g., www.targonglobal.com)."
  type        = string
}

variable "cookie_domain" {
  description = "Cookie domain shared across apps."
  type        = string
  default     = ".targonglobal.com"
}

variable "ecs_instance_type" {
  description = "Instance type backing the ECS cluster."
  type        = string
  default     = "t3.medium"
}

variable "ecs_min_size" {
  description = "Minimum number of ECS instances."
  type        = number
  default     = 1
}

variable "ecs_max_size" {
  description = "Maximum number of ECS instances."
  type        = number
  default     = 2
}

variable "ecs_desired_capacity" {
  description = "Desired number of ECS instances."
  type        = number
  default     = 1
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.small"
}

variable "db_allocated_storage" {
  description = "Allocated storage (GB) for the RDS instance."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.4"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL."
  type        = string
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL."
  type        = string
  sensitive   = true
}

variable "db_backup_retention" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 3
}

variable "db_skip_final_snapshot" {
  description = "Whether to skip the final snapshot on destroy."
  type        = bool
  default     = true
}

variable "image_tag" {
  description = "Docker image tag to deploy."
  type        = string
  default     = "latest"
}


variable "ecomos_environment" {
  description = "Additional environment variables for the portal container."
  type        = map(string)
  default     = {}
}

variable "wms_environment" {
  description = "Additional environment variables for the WMS container."
  type        = map(string)
  default     = {}
}

variable "xplan_environment" {
  description = "Additional environment variables for the X-Plan container."
  type        = map(string)
  default     = {}
}

variable "website_environment" {
  description = "Additional environment variables for the website container."
  type        = map(string)
  default     = {}
}

variable "wms_health_check_path" {
  description = "Health check path for the WMS target group."
  type        = string
  default     = "/wms/api/health"
}

variable "xplan_health_check_path" {
  description = "Health check path for the X-Plan target group."
  type        = string
  default     = "/xplan"
}
