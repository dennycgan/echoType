output "ec2_public_ip" {
  value       = aws_eip.app.public_ip
  description = "Stable Elastic IP of the EC2 instance (use this as EC2_HOST)."
}

output "ec2_public_dns" {
  value       = aws_eip.app.public_dns
  description = "Public DNS of the Elastic IP."
}

output "ssh_command" {
  value       = "ssh -i ~/.ssh/echotype_ec2 ec2-user@${aws_eip.app.public_ip}"
  description = "Ready-to-use SSH command."
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "RDS endpoint (host:port)."
}

output "rds_address" {
  value       = aws_db_instance.main.address
  description = "RDS hostname."
}

output "database_url" {
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}"
  description = "DATABASE_URL to put in the EC2 deploy/.env."
  sensitive   = true
}
