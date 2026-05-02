#!/usr/bin/env bash
# =============================================================================
# Octopus Ops MVP 一键部署启动脚本
# 使用方式：将项目代码拉取后，在项目根目录执行 ./start.sh 或 bash start.sh
# 若报错 "cannot execute" 或 "Illegal option"：多为 CRLF 换行符，请执行：
#   sed -i 's/\r$//' start.sh
# =============================================================================

set -e

# 脚本所在目录 = 项目根目录（支持任意路径执行）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}==>${NC} $1"; }

# -----------------------------------------------------------------------------
# 1. 环境检查：Docker、Docker Compose
# -----------------------------------------------------------------------------
log_step "检查运行环境..."

check_cmd() {
    if command -v "$1" &>/dev/null; then
        log_info "已安装: $1 ($($1 --version 2>/dev/null | head -1 || true))"
        return 0
    else
        log_error "未找到 $1，请先安装后再运行本脚本"
        return 1
    fi
}

if ! check_cmd docker; then
    echo ""
    echo "Docker 安装参考: https://docs.docker.com/engine/install/"
    exit 1
fi

# 检查 Docker Compose（优先 v2: docker compose）
if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
    log_info "已安装: Docker Compose v2"
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
    log_info "已安装: Docker Compose (legacy)"
else
    log_error "未找到 Docker Compose，请先安装"
    echo "Docker Compose 安装参考: https://docs.docker.com/compose/install/"
    exit 1
fi

# 检查 Docker 是否在运行
if ! docker info &>/dev/null; then
    log_error "Docker 未运行，请先启动 Docker 服务"
    echo "  Linux: sudo systemctl start docker"
    echo "  macOS: 启动 Docker Desktop"
    exit 1
fi

# -----------------------------------------------------------------------------
# 2. 准备 .env 配置文件
# -----------------------------------------------------------------------------
log_step "准备配置文件..."

if [ ! -f .env ]; then
    log_info "首次运行，从 .env.example 创建 .env"
    cp .env.example .env
    # 生成随机 JWT_SECRET
    if command -v openssl &>/dev/null; then
        SECRET=$(openssl rand -base64 48 | tr -d '\n')
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
        else
            sed -i "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
        fi
        log_info "已自动生成 JWT_SECRET"
    else
        log_warn "未找到 openssl，请手动编辑 .env 修改 JWT_SECRET"
    fi
else
    log_info ".env 已存在，跳过创建"
fi

# -----------------------------------------------------------------------------
# 3. 创建必要目录（避免挂载报错）
# -----------------------------------------------------------------------------
mkdir -p data
mkdir -p AiOps_Agent/chroma_db AiOps_Agent/logs
# 保留 data 目录（gitignore 会忽略内容，但需存在）
touch data/.gitkeep 2>/dev/null || true

# -----------------------------------------------------------------------------
# 4. 询问是否部署 Agent（智能体）模块
# -----------------------------------------------------------------------------
log_step "是否部署 AI 智能体模块？"
echo "  Agent 提供运维助手能力（故障排查、知识检索等），需阿里百炼/通义 API Key"
echo ""
read -p "是否部署 Agent？(y/N): " DEPLOY_AGENT
DEPLOY_AGENT="${DEPLOY_AGENT:-n}"

if [[ "$DEPLOY_AGENT" =~ ^[yY](es)?$ ]]; then
    echo ""
    echo "请输入阿里百炼（DashScope）API Key："
    echo "  获取地址: https://dashscope.console.aliyun.com/"
    echo "  格式示例: sk-xxxxxxxxxxxxxxxxxxxxxxxx"
    echo ""
    read -p "DASHSCOPE_API_KEY: " DASHSCOPE_KEY

    if [ -z "$DASHSCOPE_KEY" ]; then
        log_warn "未输入 API Key，将跳过 Agent 部署"
        DEPLOY_AGENT="n"
    else
        # 写入 .env（避免 sed 对特殊字符转义，采用重写方式）
        if grep -q "^DASHSCOPE_API_KEY=" .env 2>/dev/null; then
            grep -v "^DASHSCOPE_API_KEY=" .env > .env.tmp
            echo "DASHSCOPE_API_KEY=$DASHSCOPE_KEY" >> .env.tmp
            mv .env.tmp .env
        else
            echo "DASHSCOPE_API_KEY=$DASHSCOPE_KEY" >> .env
        fi
        log_info "已写入 DASHSCOPE_API_KEY 到 .env"
    fi
fi

# -----------------------------------------------------------------------------
# 5. 构建并推送主项目镜像与远程缓存
# -----------------------------------------------------------------------------
log_step "构建并推送主项目镜像 (Octopus Ops)..."

if ! docker buildx version &>/dev/null; then
    log_error "未找到 Docker Buildx，请先升级 Docker Desktop 或启用 buildx"
    exit 1
fi

if ! docker buildx inspect octopusops-builder >/dev/null 2>&1; then
    docker buildx create --name octopusops-builder --use >/dev/null
else
    docker buildx use octopusops-builder >/dev/null
fi

docker buildx build \
    --push \
    -t octopusops/octopus-ops:latest \
    --cache-from type=registry,ref=octopusops/octopus-ops:buildcache \
    --cache-to type=registry,ref=octopusops/octopus-ops:buildcache,mode=max \
    . || { log_error "主项目构建失败"; exit 1; }

log_info "主项目镜像已构建并推送"

# -----------------------------------------------------------------------------
# 6. 启动主项目容器
# -----------------------------------------------------------------------------
log_step "拉取并启动主项目容器..."

$COMPOSE_CMD pull || { log_error "主项目镜像拉取失败"; exit 1; }
$COMPOSE_CMD up -d || { log_error "主项目启动失败"; exit 1; }

log_info "主项目已启动"

# -----------------------------------------------------------------------------
# 7. 按需启动 Agent
# -----------------------------------------------------------------------------
if [[ "$DEPLOY_AGENT" =~ ^[yY](es)?$ ]] && [ -n "$DASHSCOPE_KEY" ]; then
    log_step "构建并启动 AI 智能体 (Agent)..."

    if $COMPOSE_CMD -f docker-compose.agent.yml up -d --build; then
        log_info "Agent 已启动"
    else
        log_warn "Agent 启动失败，主项目已正常运行，可稍后手动执行: $COMPOSE_CMD -f docker-compose.agent.yml up -d --build"
    fi
fi

# -----------------------------------------------------------------------------
# 8. 输出访问信息
# -----------------------------------------------------------------------------
# 获取本机 IP（用于远程访问提示）
get_local_ip() {
    if command -v hostname &>/dev/null && hostname -I &>/dev/null; then
        hostname -I 2>/dev/null | awk '{print $1}'
    elif command -v ip &>/dev/null; then
        ip route get 1 2>/dev/null | awk '{print $7; exit}'
    else
        echo "127.0.0.1"
    fi
}

log_step "部署完成"
echo ""
echo "----------------------------------------"
echo "  Octopus Ops MVP 已就绪"
echo "----------------------------------------"
echo ""
echo "  主平台（运维控制台）:"
echo "    登录页: http://YOUR_SERVER_IP:8001/ui-login"
echo "    本地:   http://127.0.0.1:8001/ui-login"
echo ""
echo "  默认账号: admin"
echo "  默认密码: admin123"
echo ""

if [[ "$DEPLOY_AGENT" =~ ^[yY](es)?$ ]] && [ -n "$DASHSCOPE_KEY" ]; then
    echo "  AI 智能体:"
    echo "    地址:   http://YOUR_SERVER_IP:8501"
    echo "    本地:   http://127.0.0.1:8501"
    echo ""
fi

echo "  查看容器状态: docker ps"
echo "  查看主项目日志: $COMPOSE_CMD logs -f"
echo "  查看 Agent 日志: $COMPOSE_CMD -f docker-compose.agent.yml logs -f"
echo ""
echo "  请在首次登录后修改默认密码（.env 中 BOOTSTRAP_* 仅影响初次创建）"
echo ""
