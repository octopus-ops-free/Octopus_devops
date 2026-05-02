$ErrorActionPreference = 'Stop'

$Image = 'octopusops/octopus-ops:latest'
$VersionTag = 'octopusops/octopus-ops:2026-05-01'
$CacheRef = 'octopusops/octopus-ops:buildcache'

docker buildx build `
  --push `
  -t $Image `
  -t $VersionTag `
  --cache-from type=registry,ref=$CacheRef `
  --cache-to type=registry,ref=$CacheRef,mode=max `
  .
