ARG NODE_BASE_IMAGE=mirror.gcr.io/library/node:20-bookworm-slim
ARG PYTHON_BASE_IMAGE=mirror.gcr.io/library/python:3.11-slim

FROM ${NODE_BASE_IMAGE} AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --include=optional --no-fund --no-audit
COPY frontend ./
RUN npm run build

FROM ${PYTHON_BASE_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

ENV ENV=prod \
    LOG_LEVEL=INFO \
    SQLITE_PATH=./data/octopus.db \
    UI_MODE=react

WORKDIR /app

# 系统依赖：
# - build-essential / libssl-dev / libffi-dev：用于 python-jose[cryptography] / bcrypt 等库编译
# - openssh-client：容器内通过 ssh 访问被管主机
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libssl-dev \
      libffi-dev \
      openssh-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY --from=frontend-builder /frontend/dist ./frontend/dist
# Keep legacy HTML fallbacks available in case the frontend is not built.
COPY app/ui ./app/ui

# SQLite 数据目录（可挂载到宿主机）
RUN mkdir -p /app/data

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
