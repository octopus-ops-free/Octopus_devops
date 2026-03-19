$ErrorActionPreference = "Stop"

# 为了兼容不同 PowerShell 版本，这里不用 param，而是手动从 $args 解析参数：
# 用法：powershell -ExecutionPolicy Bypass -File .\ssh_check.ps1 <Host> <User> <KeyPath> [Port]
if ($args.Count -lt 3) {
  Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\ssh_check.ps1 <Host> <User> <KeyPath> [Port]" -ForegroundColor Yellow
  Write-Host "Example: powershell -ExecutionPolicy Bypass -File .\ssh_check.ps1 123.207.215.86 ubuntu C:\Users\me\.ssh\octopus_ed25519 22"
  exit 1
}

$TargetHost = $args[0]
$TargetUser = $args[1]
$TargetKeyPath = $args[2]
if ($args.Count -ge 4) {
  $TargetPort = [int]$args[3]
} else {
  $TargetPort = 22
}

Write-Host "== Octopus SSH check ==" -ForegroundColor Cyan
Write-Host ("Host: {0}  Port: {1}  User: {2}" -f $TargetHost, $TargetPort, $TargetUser)
Write-Host ("Key:  {0}" -f $TargetKeyPath)
Write-Host ""

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "ssh not found. Please install Windows Optional Feature: OpenSSH Client."
}
if (-not (Get-Command ssh-keygen -ErrorAction SilentlyContinue)) {
  throw "ssh-keygen not found. Please install Windows Optional Feature: OpenSSH Client."
}
if (-not (Test-Path -LiteralPath $TargetKeyPath)) {
  throw ("Private key file not found: {0}" -f $TargetKeyPath)
}

Write-Host "[1/4] Check private key header..." -ForegroundColor Yellow
$firstLine = (Get-Content -LiteralPath $TargetKeyPath -TotalCount 1)
Write-Host "First line: $firstLine"
if ($firstLine -notmatch "BEGIN .*PRIVATE KEY") {
  Write-Host "WARNING: This does not look like a private key. Expected '-----BEGIN OPENSSH PRIVATE KEY-----' or '-----BEGIN RSA PRIVATE KEY-----'." -ForegroundColor Red
}

Write-Host "[2/4] Read key fingerprint (ssh-keygen -lf)..." -ForegroundColor Yellow
ssh-keygen -lf $TargetKeyPath

Write-Host "[3/4] Export public key (ssh-keygen -y)..." -ForegroundColor Yellow
$pub = ssh-keygen -y -f $TargetKeyPath
Write-Host "Public key (append this ONE line to Linux ~/.ssh/authorized_keys):" -ForegroundColor Green
Write-Host $pub

Write-Host ""
Write-Host "[4/4] Test SSH login (hostname; uname -a)..." -ForegroundColor Yellow
$cmd = "hostname; uname -a"
ssh -i $TargetKeyPath -p $TargetPort -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL "$TargetUser@$TargetHost" $cmd

Write-Host ""
Write-Host "OK: SSH login works. You can add this host in Octopus UI now." -ForegroundColor Cyan

