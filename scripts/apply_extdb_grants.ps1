param(
  [SecureString]$RootPassword,
  [string]$DbHost = 'host.docker.internal',
  [int]$Port = 3306
)

if (-not $RootPassword) {
  Write-Error 'Bruk: ./apply_extdb_grants.ps1 -RootPassword (Read-Host -AsSecureString) [-DbHost host.docker.internal] [-Port 3306]'
  exit 1
}

$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($RootPassword))
$cmd = "mysql -h $DbHost -P $Port -u root -p$plain --protocol=tcp < /workspace/scripts/grant_extdb.sql"

docker run --rm -i `
  -v "${PWD}:/workspace" `
  mariadb:10.6 sh -lc "$cmd"
