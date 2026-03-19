# Octopus Ops MVP v1.0 (FastAPI)

轻量级自动化运维平台 MVP：本地运行、低资源占用、易扩展，适合个人/小团队在一台机器上集中管理多台 Linux 主机（监控 + 告警 + 用户/进程/日志运维）。

---

## 一、快速上手（推荐路径）

### 1. 本地或服务器安装 Docker

确保已安装：

- Docker Engine（Linux / Windows / macOS 均可）
- Docker Compose v2（一般随 Docker 一起安装）

### 2. 获取代码并进入目录

```bash
git clone https://github.com/your-name/Octopus_devops.git
cd Octopus_devops
```

> 如果你是通过压缩包/拷贝获取代码，只要保证当前目录结构与仓库一致即可。

### 3. 准备配置文件

```bash
cp .env.example .env
```

按需编辑 `.env`（至少推荐修改 `JWT_SECRET` 为随机长字符串，生产环境建议修改管理员密码）。

### 4. 一条命令启动（Docker）

```bash
docker compose up -d
```

启动完成后：

- Swagger 文档：`http://<服务器IP>:8001/docs`
- Web 控制台登录页：`http://<服务器IP>:8001/ui-login`

首次登录使用默认账号（可在 `.env` 中修改）：

- 用户名：`admin`
- 密码：`admin123`

---

## 二、本地纯 Python 运行（适合开发/调试）

### 环境要求

- Python 3.11+

### 在 Windows PowerShell 下运行

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- Swagger 文档：`http://127.0.0.1:8000/docs`  
- Web 控制台：`http://127.0.0.1:8000/ui-login`

---

## 三、默认账号 & 安全说明

- 首次启动若数据库为空，会自动创建管理员账号（来自 `.env`）：
  - username: `admin`
  - password: `admin123`
- `.env.example` 仅为示例配置，**不要在生产环境中直接使用示例中的 `JWT_SECRET`**。  
- 实际部署时请：
  - 基于 `.env.example` 创建 `.env`，并修改：
    - `JWT_SECRET` 为随机长字符串（例如使用 `secrets.token_urlsafe(48)` 生成）；
    - 如有需要，修改默认管理员密码；
  - 确保 `.env` 与 `data/` 目录 **不被提交到 Git 仓库**（仓库已提供 `.gitignore`）。

---

## 四、功能概览（MVP v1.0）

- **认证与权限**
  - 登录 / 登出 / JWT 刷新（access + refresh）
  - 平台用户：管理员 / 普通用户
  - 主机资源按 `owner_id` 做数据隔离：普通用户只能看到自己添加的主机
- **主机管理**
  - 通过 SSH 密钥批量纳管 Linux 主机（支持 Windows 侧 ssh 自检脚本）
  - 主机看板：展示已添加主机的基础信息与监控摘要
- **资源管理**
  - 远程进程列表（排序 / 分页 / 弹窗管理 / kill / kill -9）
  - 远程端口列表（基于 `netstat -ntpl` / `ss`）
- **远程用户管理**
  - 选择主机后管理该主机上的 Linux 用户：创建、删除、修改密码、主组/附加组、sudo 权限
- **监控与告警**
  - 主机 CPU / 内存 / 磁盘采集与历史曲线
  - 告警触发器（阈值 + 告警级别 + 备注），告警事件列表（完成/历史）
  - 邮件告警：SMTP 配置 + 每个触发器可独立配置收件人
- **日志与安全**
  - 日志采集：按主机+目录登记，列文件、tail 查看、关键字匹配
  - 登录历史：基于远端 `last -i`，用于排查异常登录 IP
  - 操作日志：平台操作写入 `operation_logs` 表
- **前端 UI**
  - 纯 HTML + 原生 JS 单页应用，具备侧边菜单、监控大屏、弹窗管理等交互

---

## 五、Docker 部署（详细说明）

### 1. 准备配置

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 根据需要修改 `.env`（例如 `JWT_SECRET`、默认管理员密码、`SQLITE_PATH` 等）。  
   Docker 镜像中默认使用 `ENV=prod`、`LOG_LEVEL=INFO`，SQLite 路径为 `./data/octopus.db`，已在 `Dockerfile` 与 `docker-compose.yml` 中对应。

### 2. 直接使用 Docker 运行

```bash
docker build -t octopus-ops .
docker run -d \
  --name octopus-ops \
  --env-file .env \
  -p 8001:8001 \
  -v $(pwd)/data:/app/data \
  octopus-ops
```

部署完成后（默认端口 8001）：

- API 文档：`http://127.0.0.1:8001/docs`
- Web 控制台登录页：`http://127.0.0.1:8001/ui-login`

> 说明：容器内已安装 `openssh-client`，用于通过 ssh 访问被管 Linux 主机。如需在容器内复用宿主机的私钥，可在 `docker run` 时额外挂载 `~/.ssh`（只读）：
>
> ```bash
> -v ~/.ssh:/root/.ssh:ro
> ```

### 3. 使用 docker-compose

本仓库提供了简单的 `docker-compose.yml`：

```bash
docker compose up -d
```

默认会：

- 构建镜像并启动服务；
- 暴露 `8001` 端口；
- 将宿主机 `./data` 目录挂载到容器 `/app/data`，持久化 SQLite 数据。

---

## 六、使用指引（Web 控制台）

### 1. 登录

1. 浏览器访问：`/ui-login`；
2. 输入平台账号密码（初次为 `admin/admin123`）；
3. 登录成功后会跳转到 `/ui` 主控制台，右上角显示当前用户信息，下拉可退出登录。

### 2. 添加被管主机（Linux）

1. 在左侧菜单选择 **“主机管理”**；
2. 根据页面提示，先在 Windows 或 Linux 本地通过 `ssh_check.ps1`/ssh 命令校验免密登录是否正常；
3. 在“主机管理”表单中填写：
   - 主机名、IP、端口、登录用户；
   - 云厂商（可选）；
   - SSH 私钥（粘贴）或私钥文件路径；
4. 点击“添加主机”，平台会自动：
   - 校验 SSH 连接；
   - 采集一次监控数据；
   - 将主机绑定到当前平台用户（数据隔离）。

### 3. 主机监控 & 告警

- 在左侧选择 **“主机监控”**：
  - 顶部可选择主机与历史点数；
  - 页面中部展示 CPU / 内存 / 磁盘的历史曲线与当前概览；
  - 下方是告警邮件配置、登录历史、日志采集面板。
- 在 **“告警管理”** 中：
  - 可为不同主机配置告警触发器（CPU/内存/磁盘阈值 + 告警级别 + 备注 + 收件人）；
  - 触发后写入“告警事件”，支持标记完成与查看历史。

### 4. 远程用户管理

- 左侧选择 **“用户管理”**：
  1. 先在顶部下拉选择主机；
  2. 点击“刷新用户列表”获取当前主机上的 Linux 用户；
  3. 可通过“新增用户”创建用户（可选 sudo 权限）；
  4. 点击每一行右侧的“管理”按钮，在弹窗中完成：
     - 修改密码；
     - 管理主组 / 附加组；
     - 切换 sudo 权限。

### 5. 资源管理（进程 / 端口）

- 左侧选择 **“资源管理”**：
  - 选择主机后，可：
    - 查看远程进程列表（支持按 CPU/MEM/运行时间/PID 排序、分页）；
    - 打开进程“管理”弹窗，确认后执行 `kill` / `kill -9`；
    - 查看当前监听端口列表（`netstat -ntpl`/`ss`）。

### 6. 日志采集

- 在“主机监控”页面下方的“日志采集”中：
  1. 选择日志主机；
  2. 填写日志目录（例如 `/var/log/nginx`）和备注，点击“添加日志源”；
  3. 选择日志源，列出文件，双击文件名即可 tail 查看；
  4. 右侧“关键字匹配”输入关键字后应用，可在前端高亮匹配内容。

---

## 七、目录结构

```
app/
  api/        # 路由（认证、主机管理、监控、告警、日志采集等）
  core/       # 配置、日志、通用依赖
  db/         # 数据库、模型、会话
  security/   # JWT、密码
  services/   # 业务服务（监控/告警/备份/远程用户/资源等）
  static/     # 静态资源（如 ssh 检测脚本）
  ui/         # 纯 HTML+JS 单页前端（/ui 与 /ui-login）
  main.py     # FastAPI 入口
data/         # SQLite 文件（运行时创建，可挂载卷）
tools/        # 辅助脚本（如 refactor_ui.py）
```

## 资源占用建议

- SQLite + 单进程 uvicorn（默认 1 worker）
- 监控采集按需触发（手动/定时可扩展），避免高频后台循环

