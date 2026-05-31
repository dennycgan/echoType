# Stable public IP so the EC2 address survives instance rebuilds / re-applies.
# Associated with a running instance, so it does not incur the unassociated-EIP charge.
# (Note: AWS bills every public IPv4 hourly regardless; an EIP replaces the
# auto-assigned IPv4 rather than adding a second one.)
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = {
    Name = "${var.project}-eip"
  }

  depends_on = [aws_internet_gateway.main]
}
