# DATABASE_URL lives in SSM Parameter Store (SecureString), not in GitHub.
# The instance reads it at deploy time using its instance-profile permissions,
# so no DB credentials are ever stored in GitHub Secrets.
resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.project}/DATABASE_URL"
  description = "DATABASE_URL for the EchoType API; read by the instance at deploy time."
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}"

  tags = {
    Name = "${var.project}-database-url"
  }
}

# Public origin (the CloudFront HTTPS URL) used as the API's CORS WEB_ORIGIN.
# Not secret -- plain String. Read by the instance at deploy time and by the
# backend workflow's health check.
resource "aws_ssm_parameter" "web_origin" {
  name        = "/${var.project}/WEB_ORIGIN"
  description = "CloudFront HTTPS URL; API CORS allow-origin and CI health-check base."
  type        = "String"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"

  tags = {
    Name = "${var.project}-web-origin"
  }
}
