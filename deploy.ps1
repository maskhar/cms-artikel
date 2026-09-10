# Deploy CMS Artikel to Server
$ErrorActionPreference = 'Stop'

Write-Host "==> Syncing files to server..." -ForegroundColor Cyan
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'dist' --exclude 'build' -e ssh . maskhar@20.20.20.173:~/apps/cms-artikel/

Write-Host "
==> Building Docker image on server..." -ForegroundColor Cyan
ssh maskhar@20.20.20.173 "cd ~/apps/cms-artikel && docker compose build"

Write-Host "
==> Starting CMS container..." -ForegroundColor Cyan
ssh maskhar@20.20.20.173 "cd ~/apps/cms-artikel && docker compose up -d"

Write-Host "
==> Checking container status..." -ForegroundColor Cyan
ssh maskhar@20.20.20.173 "docker ps --filter 'name=cms-artikel'"

Write-Host "
==> Deploy complete!" -ForegroundColor Green
