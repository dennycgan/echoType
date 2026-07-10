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
  value       = local.web_origin

  tags = {
    Name = "${var.project}-web-origin"
  }
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name        = "/${var.project}/COGNITO_USER_POOL_ID"
  description = "Cognito User Pool ID for EchoType auth (API + web build)."
  type        = "String"
  value       = aws_cognito_user_pool.main.id

  tags = {
    Name = "${var.project}-cognito-user-pool-id"
  }
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name        = "/${var.project}/COGNITO_CLIENT_ID"
  description = "Cognito app client ID (public SPA client, no secret)."
  type        = "String"
  value       = aws_cognito_user_pool_client.web.id

  tags = {
    Name = "${var.project}-cognito-client-id"
  }
}

resource "aws_ssm_parameter" "cognito_region" {
  name        = "/${var.project}/COGNITO_REGION"
  description = "AWS region hosting the Cognito User Pool."
  type        = "String"
  value       = var.region

  tags = {
    Name = "${var.project}-cognito-region"
  }
}

resource "aws_ssm_parameter" "cognito_domain_prefix" {
  name        = "/${var.project}/COGNITO_DOMAIN_PREFIX"
  description = "Cognito Hosted UI domain prefix for OAuth (echotype-ink)."
  type        = "String"
  value       = var.cognito_domain_prefix

  tags = {
    Name = "${var.project}-cognito-domain-prefix"
  }
}

resource "aws_ssm_parameter" "sentry_dsn_web" {
  name        = "/${var.project}/SENTRY_DSN_WEB"
  description = "Sentry DSN for echotype-web; baked into Vite build via deploy-web.yml."
  type        = "String"
  value       = var.sentry_dsn_web

  tags = {
    Name = "${var.project}-sentry-dsn-web"
  }
}

resource "aws_ssm_parameter" "sentry_dsn_api" {
  name        = "/${var.project}/SENTRY_DSN_API"
  description = "Sentry DSN for echotype-api; read by EC2 at deploy time."
  type        = "SecureString"
  value       = var.sentry_dsn_api

  tags = {
    Name = "${var.project}-sentry-dsn-api"
  }
}
