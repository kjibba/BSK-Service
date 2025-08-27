param(
  [string]$Host = "<hetzner-ip>",
  [string]$User = "root",
  [string]$Branch = "feature/visit-workflow",
  [int]$HttpPort = 80,
  [int]$HttpsPort = 443,
  [string]$AdminEmail,
  [string]$AdminUsername,
  [string]$AdminName,
  [string]$AdminPassword,
  [string]$AdminRole
)

$remoteCmd = @"
set -e
export BRANCH=$Branch
export HTTP_PORT=$HttpPort
export HTTPS_PORT=$HttpsPort
$(if ($AdminEmail) {"export ADMIN_EMAIL=$AdminEmail"})
$(if ($AdminUsername) {"export ADMIN_USERNAME=$AdminUsername"})
$(if ($AdminName) {"export ADMIN_NAME=$AdminName"})
$(if ($AdminPassword) {"export ADMIN_PASSWORD=$AdminPassword"})
$(if ($AdminRole) {"export ADMIN_ROLE=$AdminRole"})
curl -fsSL https://raw.githubusercontent.com/kjibba/BSK-Service/$Branch/scripts/deploy_hetzner.sh -o /root/deploy.sh
chmod +x /root/deploy.sh
/root/deploy.sh
"@

ssh -o StrictHostKeyChecking=no "$User@$Host" "$remoteCmd"
