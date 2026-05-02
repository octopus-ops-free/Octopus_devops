#!/usr/bin/env bash
set -euo pipefail

docker buildx build \
  --push \
  -t octopusops/octopus-ops:latest \
  --cache-from type=registry,ref=octopusops/octopus-ops:buildcache \
  --cache-to type=registry,ref=octopusops/octopus-ops:buildcache,mode=max \
  .
