# Private S3 bucket holding the built frontend. Never public: CloudFront reads it
# through Origin Access Control (OAC). Bucket name must be globally unique, so we
# suffix it with the account id.
resource "aws_s3_bucket" "web" {
  bucket = "${var.project}-web-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project}-web"
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allow ONLY this CloudFront distribution (via OAC) to read objects.
data "aws_iam_policy_document" "web_bucket" {
  statement {
    sid       = "AllowCloudFrontOACRead"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_bucket.json
}
