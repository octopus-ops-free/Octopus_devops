# Octopus UI React 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 `app/ui/*.html` 的“纯 HTML + 原生 JS 单页”前端，逐步重构为 **React + TypeScript** 技术栈，并保持后端 FastAPI API 与现有 URL（`/ui`、`/ui-login`、`/terminal`、`/api/*`）在迁移期间可用。

**Architecture:** 在仓库新增独立的 Node 前端工程（Vite + React + TS），开发期通过 Vite 代理调用 FastAPI 的 `/api/*`；生产期由 FastAPI **直接托管** Vite 构建产物（`dist/`）并提供 SPA fallback。迁移采用“旧页面保留 + 新页面逐步替换”的增量策略，先建立 React 基础设施与部署路径，再按模块（Host/Monitoring/Alerts/Logs/Terminal…）逐块迁移。

**Tech Stack:** React 18/19（以模板默认版本为准） + TypeScript + Vite + (可选) React Router + (可选) TanStack Query + Vitest + Testing Library

---

## 0. 现状盘点（基于仓库代码）

### 0.1 当前前端技术栈（“是什么”）
- `app/ui/index.html`：单文件 HTML，内联大量 JS，通过 `fetch` 调用后端：
  - `/api/auth/*`、`/api/hosts`、`/api/monitoring/*`、`/api/alerts/*`、`/api/logs/*`、`/api/remote-users/*`、`/api/resources/*`、`/api/db/*`、`/api/security/*`、`/api/notifications/*`
- `app/ui/login.html`：登录页，`POST /api/auth/login`，token 存 `localStorage("octopus_tokens_v1")`，成功跳转 `/ui`
- `app/ui/terminal.html`：终端页，使用 CDN 的 `xterm.js`，连接 `ws(s)://{host}/api/terminal/ws`

### 0.2 当前前端如何被后端挂载（“入口在哪”）
- `app/main.py`
  - `GET /ui` → `FileResponse("app/ui/index.html")`
  - `GET /ui-login` → `FileResponse("app/ui/login.html")`
  - `GET /terminal` → `FileResponse("app/ui/terminal.html")`
  - `app.mount("/static", StaticFiles(directory="app/static"), name="static")`

### 0.3 关键约束（迁移必须满足）
- **URL 兼容**：迁移期间 `/ui`、`/ui-login`、`/terminal` 继续可用（允许逐步切到 React 版本，但不要一次性删旧页面）
- **API 不改协议**：`/api/*` 的请求/响应结构迁移期间不强制改动（优先前端适配现有 API）
- **Windows 开发优先**：计划命令提供 PowerShell 版本

---

## 1. 目标目录结构（新增/修改文件一览）

### 1.1 新增前端工程（建议）
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/app/App.tsx`
- Create: `frontend/src/app/routes.tsx`（若引入 React Router）
- Create: `frontend/src/lib/api.ts`（fetch 封装：token、refresh、错误处理）
- Create: `frontend/src/features/*`（按功能模块迁移：hosts/monitoring/alerts/logs/terminal/login…）
- Create: `frontend/src/styles/*`（如果需要抽离 CSS）
- Create: `frontend/src/__tests__/*`（Vitest + Testing Library）

### 1.2 后端托管 React 构建产物（建议最小改动）
- Modify: `app/main.py`
  - 增加对 `frontend/dist` 的静态托管（`/ui` 指向新 SPA `index.html`）
  - 保留旧的 `app/ui/*.html` 路由作为 fallback（或临时切换开关）

### 1.3 迁移期策略文件（可选但强烈建议）
- Create: `docs/ui_migration.md`（记录迁移进度、路由映射、回滚方式）

---

### Task 1: 建立 React 前端工程骨架（Vite + React + TS）

**Files:**
- Create: `frontend/`（一整套 Vite 工程）

- [ ] **Step 1: 创建前端目录**

PowerShell（在仓库根目录）：

```powershell
mkdir frontend
```

- [ ] **Step 2: 用 Vite 初始化 React+TS 项目**

在仓库根目录执行（会在 `frontend` 内生成文件）：

```powershell
cd frontend
npm create vite@latest . -- --template react-ts
npm install
```

Expected：生成 `vite.config.ts`、`tsconfig.json`、`src/main.tsx` 等，`npm install` 成功。

- [ ] **Step 3: 本地启动前端开发服务器**

```powershell
npm run dev
```

Expected：控制台输出类似 `Local: http://localhost:5173/`，浏览器打开能看到默认 Vite+React 页面。

- [ ] **Step 4: 加入最小测试框架（Vitest）**

```powershell
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

在 `frontend/vite.config.ts` 增加 test 配置（示例）：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

新增 `frontend/src/test/setup.ts`：

```ts
import "@testing-library/jest-dom";
```

新增一个最小单测 `frontend/src/app/App.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

it("renders Octopus UI shell", () => {
  render(<App />);
  expect(screen.getByText("Octopus Ops")).toBeInTheDocument();
});
```

把 `frontend/src/app/App.tsx` 改成最小可测版本（先不做功能）：

```tsx
export function App() {
  return <div>Octopus Ops</div>;
}
```

运行测试：

```powershell
npx vitest run
```

Expected：PASS。

- [ ] **Step 5: Commit**

```powershell
git add frontend
git commit -m "feat(ui): scaffold React+TS frontend with Vite and Vitest"
```

---

### Task 2: 打通开发期前后端联调（Vite proxy → FastAPI `/api`）

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: 配置 Vite 代理**

在 `frontend/vite.config.ts` 加入：

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 2: 实现最小 `api()` 封装（先只做 access token 注入）**

创建 `frontend/src/lib/api.ts`：

```ts
const TOKEN_STORAGE_KEY = "octopus_tokens_v1";

type StoredTokens = { accessToken: string; refreshToken?: string; ts?: number };

function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = loadTokens();
  const headers = new Headers(init.headers);
  if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const resp = await fetch(path, { ...init, headers });
  const data = (await resp.json()) as T;
  if (!resp.ok) {
    const detail = (data as any)?.detail ?? resp.statusText;
    throw new Error(String(detail));
  }
  return data;
}
```

- [ ] **Step 3: 用一个最小页面验证 API 可通（例如 `/api/db/health`）**

修改 `frontend/src/app/App.tsx`：

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function App() {
  const [status, setStatus] = useState<string>("loading...");

  useEffect(() => {
    api<{ ok: boolean; detail?: string }>("/api/db/health")
      .then((d) => setStatus(d.ok ? "backend ok" : `backend not ok: ${d.detail ?? ""}`))
      .catch((e) => setStatus(`backend error: ${e.message}`));
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>Octopus Ops</h1>
      <div>{status}</div>
    </div>
  );
}
```

- [ ] **Step 4: 启动后端 + 前端联调**

启动后端（仓库根目录）：

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

启动前端（`frontend/`）：

```powershell
npm run dev
```

Expected：打开 `http://localhost:5173`，页面显示 `backend ok`（或显示具体错误，便于定位）。

- [ ] **Step 5: Commit**

```powershell
git add frontend/vite.config.ts frontend/src
git commit -m "feat(ui): add Vite proxy and minimal API client"
```

---

### Task 3: 后端托管 React 构建产物（生产路径）并保持旧 UI 可回滚

**Files:**
- Modify: `app/main.py`
- (可选) Create: `app/ui_legacy/`（若想把旧 HTML 移走，但本计划默认先不动）

- [ ] **Step 1: 先定义“托管策略”**

迁移期间建议使用一个开关（环境变量）决定 `/ui` 走旧 HTML 还是 React `dist/index.html`：
- `UI_MODE=legacy`：继续返回 `app/ui/index.html`
- `UI_MODE=react`：返回 `frontend/dist/index.html`，并托管 `frontend/dist/assets/*`

（这样上线/回滚成本极低）

- [ ] **Step 2: 修改 `app/main.py` 增加 dist 静态托管与开关**

在 `app/main.py` 顶部 imports 区域补充：

```py
import os
from pathlib import Path
```

在 `app = FastAPI(...)` 后附近定义：

```py
UI_MODE = os.getenv("UI_MODE", "legacy").lower()
FRONTEND_DIST = Path("frontend/dist")
```

挂载静态资源（仅当存在 dist 时）：

```py
if FRONTEND_DIST.exists():
    app.mount("/ui-assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="ui-assets")
```

调整 `/ui` 路由（伪代码式的最小改动方向，实施时按实际代码位置插入）：

```py
@app.get("/ui", response_class=HTMLResponse, include_in_schema=False)
async def ui_page() -> FileResponse:
    if UI_MODE == "react" and FRONTEND_DIST.exists():
        return FileResponse(str(FRONTEND_DIST / "index.html"))
    return FileResponse("app/ui/index.html")
```

说明：
- 这里将 React 的静态资源前缀固定为 `/ui-assets`，需要在 Vite build 时把 `base` 指到 `/ui-assets/`（见 Task 4）
- 旧的 `/ui-login`、`/terminal` 先保持 legacy，不要在同一个提交里全切

- [ ] **Step 3: 写一个最小集成测试（验证 `/ui` 在两种模式下返回不同文件）**

如果仓库已有 pytest 体系：新增 `tests/test_ui_mode.py`（若当前没有 tests 目录，则本步骤可推迟到“建立测试框架”任务中，但不要跳过验证）。

示例（FastAPI TestClient）：

```py
import os

def test_ui_mode_defaults_to_legacy(monkeypatch):
    monkeypatch.delenv("UI_MODE", raising=False)
    # TODO: create TestClient(app) and assert response contains legacy marker
    assert True
```

（实施时根据项目现有测试结构补全。）

- [ ] **Step 4: Commit**

```powershell
git add app/main.py
git commit -m "feat(ui): allow serving React dist for /ui behind UI_MODE"
```

---

### Task 4: 配置 Vite build 产物能被 FastAPI 正确引用（`base` / 资源路径）

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 设置 build base 指向后端托管路径**

在 `frontend/vite.config.ts`：

```ts
export default defineConfig({
  plugins: [react()],
  base: "/ui-assets/",
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8001", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 2: 生成产物并用后端验证**

前端构建：

```powershell
cd frontend
npm run build
```

Expected：生成 `frontend/dist/index.html` 与 `frontend/dist/assets/*`。

后端启动并切换模式：

```powershell
cd ..
$env:UI_MODE="react"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

浏览器打开 `http://127.0.0.1:8001/ui`：
- Expected：看到 React 页面
- Network 中 `GET /ui-assets/*` 返回 200

- [ ] **Step 3: Commit**

```powershell
git add frontend/vite.config.ts
git commit -m "chore(ui): set Vite base for FastAPI-served assets"
```

---

### Task 5: 建立 React 路由与页面壳（先迁移 Login / Shell，不迁移业务细节）

**Files:**
- Create: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/app/App.tsx`
- Create: `frontend/src/features/login/LoginPage.tsx`
- Create: `frontend/src/features/shell/Layout.tsx`

- [ ] **Step 1: 引入 React Router（如果你希望最终 URL 对齐 `/ui-login` / `/ui` / `/terminal`）**

```powershell
cd frontend
npm install react-router-dom
```

创建 `frontend/src/app/routes.tsx`：

```tsx
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "../features/shell/Layout";
import { LoginPage } from "../features/login/LoginPage";

export const router = createBrowserRouter([
  { path: "/ui-login", element: <LoginPage /> },
  { path: "/ui", element: <Layout /> },
]);
```

调整 `frontend/src/main.tsx` 使用 Router（示例）：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

- [ ] **Step 2: 迁移 `login.html` 为 React 组件（逻辑不变）**

创建 `frontend/src/features/login/LoginPage.tsx`，复刻现有逻辑（token 存储键保持一致）：

```tsx
import { useState } from "react";

const TOKEN_STORAGE_KEY = "octopus_tokens_v1";
const USERNAME_STORAGE_KEY = "octopus_username_v1";

export function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    if (!username || !password) {
      setStatus("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setStatus("登录中...");
    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail ?? resp.statusText);

      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken: data.access_token, refreshToken: data.refresh_token, ts: Date.now() }));
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
      setStatus("登录成功，正在跳转...");
      window.location.href = "/ui";
    } catch (e: any) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setStatus("登录失败：" + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Octopus Ops 运维平台</h1>
      <div>
        <label>用户名</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label>密码</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button onClick={doLogin} disabled={loading}>
        登录
      </button>
      <div>{status}</div>
    </div>
  );
}
```

- [ ] **Step 3: Shell 页只做占位（不迁移业务）**

创建 `frontend/src/features/shell/Layout.tsx`：

```tsx
export function Layout() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Octopus Ops</h1>
      <div>React UI migration in progress.</div>
    </div>
  );
}
```

- [ ] **Step 4: build + FastAPI 验证 `/ui-login` 与 `/ui`**

```powershell
cd frontend
npm run build
cd ..
$env:UI_MODE="react"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Expected：
- 打开 `http://127.0.0.1:8001/ui-login` 显示 React 登录页
- 登录后跳转 `http://127.0.0.1:8001/ui` 显示占位壳

- [ ] **Step 5: Commit**

```powershell
git add frontend/src
git commit -m "feat(ui): add React routes and migrate login page"
```

---

### Task 6: 逐模块迁移（按 API 归属拆分 features；每个模块一个 PR/一组 commits）

**Files:**
- Create/Modify: `frontend/src/features/hosts/*`
- Create/Modify: `frontend/src/features/monitoring/*`
- Create/Modify: `frontend/src/features/alerts/*`
- Create/Modify: `frontend/src/features/logs/*`
- Create/Modify: `frontend/src/features/remoteUsers/*`
- Create/Modify: `frontend/src/features/resources/*`
- Create/Modify: `frontend/src/features/security/*`
- Create/Modify: `frontend/src/features/notifications/*`

**Migration order（建议按风险从低到高）：**
1) **DB Health / About**（只读、验证链路最简单）  
2) **Hosts 列表**（核心实体、UI 范围可控）  
3) **Monitoring metrics 图表**（可能需要引入图表库，单独决策）  
4) **Alerts**  
5) **Logs**  
6) **Remote Users**（写操作多、谨慎）  
7) **Resources（kill 进程）**（危险操作，必须增加确认交互）  
8) **Terminal**（最后迁移；可先继续使用 `/terminal` legacy 页面）

对每个模块都按同一模板执行：
- [ ] 写一个组件测试（render + mock fetch）
- [ ] 写一个最小实现（只覆盖最常用流程）
- [ ] 本地联调后端
- [ ] 提交（每个模块 2~6 个小提交即可，不要大杂烩）

---

### Task 7: 终端页迁移策略（保持现有 WebSocket 协议不变）

**Files:**
- Create: `frontend/src/features/terminal/TerminalPage.tsx`

迁移策略：
- 第一阶段：React 壳内用 `<iframe src="/terminal" />` 直接复用 legacy（最快交付）
- 第二阶段：React 内直接集成 `xterm.js`（从 npm 引入，不再走 CDN），复刻 `terminal.html` 逻辑并复用 `/api/terminal/ws`

---

## 自检清单（按 receiving-code-review 的“先验证后实现”思路）

- **理解一致**：每次迁移只动一个模块；先跑通最小 happy path，再补全细节
- **可回滚**：`UI_MODE=legacy` 一键回到旧 UI
- **验证优先**：每个模块都要有“能复现的验证步骤”（至少本地联调 + 1 个 Vitest 用例）
- **不做 YAGNI**：不在迁移期顺手改 API、改数据库、改鉴权协议

---

## Spec coverage（本计划覆盖了你的请求哪些点）
- “查看本项目前端技术栈”：已在 **0.1~0.2** 给出（基于 `app/ui/*.html` 与 `app/main.py`）
- “写一个计划重构成 React 技术栈”：已按 Task 1~7 给出增量迁移路线 + 文件路径 + 命令 + 预期结果
- “/context7-mcp”：本计划采用 Vite 初始化命令 `npm create vite@latest ... --template react-ts`（符合当前主流推荐做法）

---

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-04-25-react-refactor-ui.md`。两种执行方式：

1. **Subagent-Driven（推荐）**：我按 Task 逐个派子任务执行、每个任务完成后做一次小 review  
2. **Inline Execution**：我在本会话内按任务逐步实现，按检查点停下来让你看 diff

你选哪一种？

