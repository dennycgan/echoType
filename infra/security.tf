resource "aws_security_group" "ec2" {
  name = "${var.project}-ec2-sg"
  # NOTE: SG description is immutable in AWS -- changing it forces a full SG
  # replacement (which cascades to attached instance + RDS rule). We keep the
  # original string on purpose. Real state: no port 22 ingress; HTTP 80 only.
  # Shell/deploy access is via SSM, not SSH.
  description = "EC2: SSH (22) and HTTP (80) from home IP only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-ec2-sg"
  }
}

# No port 22 ingress rule by design. Shell / deploy access is via AWS Systems
# Manager (Session Manager + Run Command), which is initiated outbound by the
# SSM agent over 443 -- so port 22 is never exposed.

# AWS-managed list of CloudFront's origin-facing IP ranges. Locking port 80 to
# this means the backend can ONLY be reached through our CloudFront distribution,
# not directly over public HTTP.
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_vpc_security_group_ingress_rule" "ec2_http" {
  security_group_id = aws_security_group.ec2.id
  description       = "HTTP from CloudFront origin-facing ranges only"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "ec2_all" {
  security_group_id = aws_security_group.ec2.id
  description       = "Allow all outbound (pull images, packages, reach RDS)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-rds-sg"
  description = "RDS: PostgreSQL 5432 from the EC2 security group only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-rds-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ec2" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL from EC2 SG"
  referenced_security_group_id = aws_security_group.ec2.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "rds_all" {
  security_group_id = aws_security_group.rds.id
  description       = "Allow all outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
