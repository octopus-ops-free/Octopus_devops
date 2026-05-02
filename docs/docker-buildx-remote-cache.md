# Docker buildx 远程缓存构建流程

本项目的标准构建方式使用 BuildKit 的 registry cache：

```bash
docker buildx build \
  --push \
  -t octopusops/octopus-ops:latest \
  --cache-from type=registry,ref=octopusops/octopus-ops:buildcache \
  --cache-to type=registry,ref=octopusops/octopus-ops:buildcache,mode=max \
  .
```

## 工作方式

- `--push`：把镜像推送到远程仓库
- `--cache-from`：优先从远程 registry 读取历史构建缓存
- `--cache-to`：把本次构建的缓存写回远程 registry
- `mode=max`：保留更完整的缓存记录，提升后续命中率

## 本地缓存清理

构建完成后，可以清理本地 BuildKit 缓存：

```bash
docker buildx prune -af
```

如果还想清理无用镜像，可以再执行：

```bash
docker system prune -af
```

注意不要默认加 `--volumes`，否则可能误删数据库卷。

## 推荐使用方式

1. 先执行 `./build-and-push.sh`
2. 再执行 `docker compose pull && docker compose up -d`
3. 本地空间紧张时，再运行 `docker buildx prune -af`

## Windows PowerShell

如果你在 Windows 上执行：

```powershell
bash .\build-and-push.sh
```

或者直接复制脚本里的 `docker buildx build` 命令执行。
