$ErrorActionPreference = 'Stop'

# 命中远程 registry 中的 BuildKit 缓存（与 docs/docker-buildx-remote-cache.md 一致）
$Image = 'octopusops/octopus-ops:latest'
$CacheRef = 'octopusops/octopus-ops:buildcache'

Write-Host "buildx: cache-from registry $CacheRef -> load $Image" -ForegroundColor Cyan

docker buildx build `
  --cache-from "type=registry,ref=$CacheRef" `
  -t $Image `
  --load `
  .

Write-Host "Done. Next: docker compose up -d octopus" -ForegroundColor Green
