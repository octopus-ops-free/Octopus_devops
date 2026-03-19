FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

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

COPY . .

# SQLite 数据目录（可挂载到宿主机）
RUN mkdir -p /app/data

EXPOSE 8001

# 生产环境推荐在 .env 中覆盖这些配置
ENV ENV=prod \
    LOG_LEVEL=INFO \
    SQLITE_PATH=./data/octopus.db

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

