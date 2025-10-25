output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.main.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.this.name
}

output "rds_endpoint" {
  description = "Endpoint for the PostgreSQL instance."
  value       = aws_db_instance.portal.address
}

output "rds_port" {
  description = "Port for the PostgreSQL instance."
  value       = aws_db_instance.portal.port
}

output "ecr_repositories" {
  description = "ECR repository URLs used for images."
  value = {
    ecomos  = aws_ecr_repository.ecomos.repository_url
    wms     = aws_ecr_repository.wms.repository_url
    xplan   = aws_ecr_repository.xplan.repository_url
    website = aws_ecr_repository.website.repository_url
  }
}
