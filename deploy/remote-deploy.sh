#!/usr/bin/env bash
# Runs ON the EC2 instance, invoked by SSM Run Command (as root).
# The workflow has already checked out the target commit before calling this.
# It reads DATABASE_URL from SSM Parameter Store, writes deploy/.env, and
# (re)builds + starts the API container. No secrets are passed over the wire.
#
# Usage: bash deploy/remote-deploy.sh <aws-region> <public-ip>
set -euo pipefail

REGION="${1:?usage: remote-deploy.sh <aws-region> <public-ip>}"
PUBLIC_IP="${2:?usage: remote-deploy.sh <aws-region> <public-ip>}"

# Resolve repo root from this script's location (deploy/ -> repo root).
cd "$(dirname "$0")/.."

# AWS CLI ships with AL2023, but self-heal in case this is an older instance.
command -v aws >/dev/null 2>&1 || dnf install -y awscli

DB_URL="$(aws ssm get-parameter \
  --name "/echotype/DATABASE_URL" \
  --with-decryption \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)"

# WEB_ORIGIN = the CloudFront HTTPS URL (set by Terraform). Fall back to the
# instance IP only if the parameter is missing (e.g. before CloudFront exists).
WEB_ORIGIN="$(aws ssm get-parameter \
  --name "/echotype/WEB_ORIGIN" \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "http://${PUBLIC_IP}")"

COGNITO_USER_POOL_ID="$(aws ssm get-parameter \
  --name "/echotype/COGNITO_USER_POOL_ID" \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)"

COGNITO_CLIENT_ID="$(aws ssm get-parameter \
  --name "/echotype/COGNITO_CLIENT_ID" \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)"

COGNITO_REGION="$(aws ssm get-parameter \
  --name "/echotype/COGNITO_REGION" \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)"

SENTRY_DSN="$(aws ssm get-parameter \
  --name "/echotype/SENTRY_DSN_API" \
  --with-decryption \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)"

SENTRY_RELEASE="$(git -C "$(dirname "$0")/.." rev-parse HEAD)"

cat > deploy/.env <<ENV
DATABASE_URL=${DB_URL}
API_PORT=3001
WEB_ORIGIN=${WEB_ORIGIN}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
COGNITO_REGION=${COGNITO_REGION}
SENTRY_DSN=${SENTRY_DSN}
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=${SENTRY_RELEASE}
ENV

docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/.env up -d --build
docker image prune -f
