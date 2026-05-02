# OverviewPage 运维大屏替换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不新增路由的前提下，替换现有 `OverviewPage` 为高还原深色运维大屏首页，首版直接接入真实后端数据，并支持资源拓扑全交互与实时推送自动重连。

**Architecture:** 保持 `routes` 的 index 路由（`/ui`）不变，仅重构 `frontend/src/features/overview` 模块。数据层采用“快照 API + 实时流增量更新”双通道：首次加载通过现有 REST API 聚合，随后通过 WebSocket 优先、SSE 兜底持续更新。图表与拓扑统一采用 ECharts 一栈，拓扑使用 graph 系列实现节点/链路交互和筛选高亮。

**Tech Stack:** React 19 + TypeScript + React Router + ECharts + 原生 WebSocket/EventSource + Vitest + Testing Library + ESLint

---

## 0. 现状定位（已确认）

- `OverviewPage`：`frontend/src/features/overview/OverviewPage.tsx`（当前为静态展示，内联样式）
- 路由入口：`frontend/src/app/routes.tsx`（`/ui` index 仍绑定 `OverviewPage`，无需新增路由）
- 布局容器：`frontend/src/features/shell/Layout.tsx`（顶部、侧栏、主内容容器已可承载大屏）
- API 封装：`frontend/src/lib/api.ts`（统一 token、401 刷新、异常处理，可直接复用）
- 相关页面（数据来源参考）：
  - `frontend/src/features/alerts/AlertsPage.tsx`
  - `frontend/src/features/monitoring/MonitoringPage.tsx`
  - `frontend/src/features/resources/ResourcesPage.tsx`
- 后端 API（可直接用于大屏聚合）：
  - `/api/monitoring/metrics`, `/api/monitoring/collect`
  - `/api/alerts/events`, `/api/alerts/events/history`, `/api/alerts/triggers`
  - `/api/resources/processes`, `/api/resources/ports`
  - `/api/logs/sources`, `/api/logs/files`, `/api/logs/tail`
- 图标资产：`frontend/src/assets/icon-library-named/*` + `manifest.csv`（优先使用）

---

### Task 1: 安装依赖并建立 Overview 模块骨架

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/features/overview/types.ts`
- Create: `frontend/src/features/overview/services/overviewApi.ts`
- Create: `frontend/src/features/overview/services/overviewRealtime.ts`
- Create: `frontend/src/features/overview/hooks/useOverviewData.ts`
- Create: `frontend/src/features/overview/components/`
- Modify: `frontend/src/features/overview/OverviewPage.tsx`

- [ ] **Step 1: 安装图表依赖（ECharts 一栈）**

Run:

```powershell
cd frontend
npm install echarts
```

Expected: `package.json` 中新增 `echarts`，安装成功无 `ERR!`.

- [ ] **Step 2: 创建 overview 目录结构（按职责拆分）**

Run:

```powershell
mkdir src/features/overview/components
mkdir src/features/overview/services
mkdir src/features/overview/hooks
```

Expected: 目录创建成功，后续任务可直接按模块落文件。

- [ ] **Step 3: 基线校验（确保当前分支可构建）**

Run:

```powershell
npm run build
npm run lint
```

Expected: 构建/检查通过；若现存非本任务错误，记录在任务备注并继续后续开发。

---

### Task 2: 定义大屏数据契约与 REST 聚合层（真实数据首版）

**Files:**
- Create: `frontend/src/features/overview/types.ts`
- Create: `frontend/src/features/overview/services/overviewApi.ts`
- Modify: `frontend/src/features/overview/OverviewPage.tsx`
- Test: `frontend/src/features/overview/services/overviewApi.test.ts`

- [ ] **Step 1: 在 `types.ts` 固化页面模型**

定义以下明确类型（非占位）：
- `OverviewKpi`
- `OverviewTrendPoint`
- `OverviewAlertItem`
- `OverviewResourceNode`
- `OverviewResourceLink`
- `OverviewSnapshot`
- `OverviewFilters`（主机、级别、资源类型、时间窗）

Expected: `OverviewPage` 与子组件仅消费 `OverviewSnapshot`，避免直接耦合后端字段。

- [ ] **Step 2: 在 `overviewApi.ts` 实现真实接口聚合**

实现并导出：
- `fetchOverviewSnapshot(filters: OverviewFilters): Promise<OverviewSnapshot>`
- `fetchResourceTopology(filters: OverviewFilters): Promise<{ nodes: OverviewResourceNode[]; links: OverviewResourceLink[] }>`

聚合来源固定为现有 API：
- 监控趋势：`/api/monitoring/metrics`
- 告警：`/api/alerts/events`, `/api/alerts/events/history`
- 资源：`/api/resources/processes`, `/api/resources/ports`
- 日志热度：`/api/logs/sources`（按 source 数量/活跃度转换）

Expected: 页面首次加载可以只依赖这两个函数拿到完整首屏数据。

- [ ] **Step 3: 编写聚合层测试（mock `api()`）**

Run:

```powershell
npx vitest run src/features/overview/services/overviewApi.test.ts
```

Expected: 至少覆盖 3 个场景：正常聚合、部分接口失败降级、空数据兜底结构。

---

### Task 3: 实时数据层（WebSocket 优先 + SSE 兜底 + 自动重连）

**Files:**
- Create: `frontend/src/features/overview/services/overviewRealtime.ts`
- Create: `frontend/src/features/overview/hooks/useOverviewData.ts`
- Modify: `frontend/src/features/overview/types.ts`
- Test: `frontend/src/features/overview/services/overviewRealtime.test.ts`

- [ ] **Step 1: 在 `overviewRealtime.ts` 实现通道管理器**

实现并导出：
- `createOverviewRealtimeClient(options)`
- 内部策略：优先连接 WebSocket（例如 `/api/overview/ws`，可配置），失败后退化到 SSE（例如 `/api/overview/events`）
- 重连策略：指数退避（1s/2s/4s/8s，最大 30s）+ jitter
- 事件模型：`snapshot`, `delta`, `heartbeat`, `error`

Expected: 客户端具备 `connect() / disconnect() / subscribe()`，并输出统一事件数据。

- [ ] **Step 2: 在 `useOverviewData.ts` 建立“快照+增量”状态机**

处理流程固定为：
1. `fetchOverviewSnapshot` 首屏加载
2. 连接实时通道
3. `delta` 事件应用到本地状态
4. 断连时保留旧数据并标记 `reconnecting`
5. 重连成功后增量追平或刷新快照

Expected: 页面任何时刻都有可展示数据，不会因短时断线白屏。

- [ ] **Step 3: 运行实时层单测**

Run:

```powershell
npx vitest run src/features/overview/services/overviewRealtime.test.ts
```

Expected: 覆盖“首选 WS、SSE 回退、自动重连、手动关闭不重连”四个行为。

---

### Task 4: 图标映射层（优先 `icon-library-named`）

**Files:**
- Create: `frontend/src/features/overview/assets/iconMap.ts`
- Modify: `frontend/src/features/overview/types.ts`
- Test: `frontend/src/features/overview/assets/iconMap.test.ts`

- [ ] **Step 1: 从 `icon-library-named` 建立语义映射**

固定映射分组（至少）：
- 资源类：`主机`, `云主机`, `物理机`, `容器`, `K8s集群`, `数据库`, `中间件`, `网络`, `存储`
- 状态类：`成功`, `失败`, `警告`, `运行中`, `已暂停`
- 操作类：`搜索`, `筛选`, `关联`, `树形结构`, `分组`

Expected: 提供 `getOverviewIcon(name: string): string` 与 `getStatusIcon(level: string): string`。

- [ ] **Step 2: 增加缺失回退规则**

规则：
- 优先 `icon-library-named`
- 未命中回退到 `icon-library`
- 再未命中回退默认 `主机.png`

Expected: 拓扑节点与 KPI 永不出现 broken image。

- [ ] **Step 3: 运行图标映射测试**

Run:

```powershell
npx vitest run src/features/overview/assets/iconMap.test.ts
```

Expected: 命中/回退路径均通过。

---

### Task 5: ECharts 基础图表组件（统一渲染栈）

**Files:**
- Create: `frontend/src/features/overview/components/KpiCards.tsx`
- Create: `frontend/src/features/overview/components/TrendLineChart.tsx`
- Create: `frontend/src/features/overview/components/AlertDistributionChart.tsx`
- Create: `frontend/src/features/overview/components/PanelFrame.tsx`
- Create: `frontend/src/features/overview/components/useEChart.ts`
- Test: `frontend/src/features/overview/components/TrendLineChart.test.tsx`

- [ ] **Step 1: 封装 `useEChart`（实例创建、resize、dispose）**

Expected: 所有图表组件共享同一生命周期逻辑，避免重复代码与泄漏。

- [ ] **Step 2: 实现 KPI 与趋势图组件**

要求：
- KPI 卡片支持状态色、同比/环比文案
- 趋势图支持时间窗切换（15m/1h/24h）
- 深色主题风格与大屏一致（高对比、低噪点网格）

Expected: 首屏 KPI + 趋势能完全由 `OverviewSnapshot` 驱动。

- [ ] **Step 3: 实现告警分布图（同栈 ECharts）**

建议图形：环形图 + 柱状趋势子图（同组件内切换）。

Expected: 告警级别结构清晰，支持 hover tooltip。

- [ ] **Step 4: 运行组件测试**

Run:

```powershell
npx vitest run src/features/overview/components/TrendLineChart.test.tsx
```

Expected: 至少验证渲染、数据更新触发 `setOption`、卸载释放实例。

---

### Task 6: 资源拓扑组件（全交互：缩放/拖拽/筛选/链路高亮）

**Files:**
- Create: `frontend/src/features/overview/components/ResourceTopologyGraph.tsx`
- Modify: `frontend/src/features/overview/services/overviewApi.ts`
- Modify: `frontend/src/features/overview/hooks/useOverviewData.ts`
- Test: `frontend/src/features/overview/components/ResourceTopologyGraph.test.tsx`

- [ ] **Step 1: 用 ECharts graph 实现拓扑基础渲染**

固定能力：
- 节点拖拽（`draggable: true`）
- 画布缩放/平移（`roam: true`）
- 资源类型图标（来自 `iconMap.ts`）

Expected: 节点/链路可见且布局稳定（初版可使用 `force` 或 `none` + 固定坐标）。

- [ ] **Step 2: 实现筛选与链路高亮**

交互规则：
- 类型筛选：主机/容器/K8s/数据库/网络
- 级别筛选：正常/告警/故障
- 节点 hover 或 click 时，高亮相关链路，弱化无关元素

Expected: 操作响应 < 100ms（本地常规数据量下）。

- [ ] **Step 3: 运行拓扑交互测试**

Run:

```powershell
npx vitest run src/features/overview/components/ResourceTopologyGraph.test.tsx
```

Expected: 至少覆盖筛选状态变化与高亮状态变化。

---

### Task 7: 重构 `OverviewPage` 组装层（替换原首页，不改路由）

**Files:**
- Modify: `frontend/src/features/overview/OverviewPage.tsx`
- Create: `frontend/src/features/overview/OverviewPage.css`（或 `OverviewPage.module.css`）
- Modify: `frontend/src/features/shell/Layout.tsx`（仅最小必要：顶部标题动态化）
- Test: `frontend/src/features/overview/OverviewPage.test.tsx`

- [ ] **Step 1: 用新组件替换旧静态内容**

页面分区固定：
- 顶部：全局 KPI + 实时状态（在线/重连中）
- 中部左：监控趋势 + 告警分布
- 中部右：资源拓扑（主视觉）
- 底部：最新告警 + 日志活动 + 关键资源表

Expected: `routes` 保持 index 指向 `OverviewPage`，访问 `/ui` 直接看到新大屏。

- [ ] **Step 2: 接入 `useOverviewData` 并处理状态**

状态必须覆盖：
- `loading`
- `ready`
- `partial-error`（部分数据失败）
- `reconnecting`

Expected: 即使实时链路断开，页面仍保留快照并显示状态提示。

- [ ] **Step 3: 运行页面测试**

Run:

```powershell
npx vitest run src/features/overview/OverviewPage.test.tsx
```

Expected: 通过“首屏渲染 + 数据更新 + 重连提示”三个核心断言。

---

### Task 8: 验收与回归（构建、lint、关键页面冒烟）

**Files:**
- Modify: `frontend/src/features/overview/*.test.ts*`（补齐缺口）
- Modify: `frontend/src/features/monitoring/MonitoringPage.test.tsx`（如需同步契约）
- Modify: `frontend/src/features/alerts/AlertsPage.test.tsx`（如需同步契约）
- Modify: `frontend/src/features/resources/ResourcesPage.test.tsx`（如需同步契约）

- [ ] **Step 1: 运行 Overview 相关测试集**

Run:

```powershell
npx vitest run src/features/overview
```

Expected: Overview 模块测试全部通过。

- [ ] **Step 2: 运行关键页面回归测试**

Run:

```powershell
npx vitest run src/features/monitoring/MonitoringPage.test.tsx src/features/alerts/AlertsPage.test.tsx src/features/resources/ResourcesPage.test.tsx
```

Expected: 相关页面在 API 复用后无回归失败。

- [ ] **Step 3: 全量质量门禁**

Run:

```powershell
npm run lint
npm run build
```

Expected: ESLint 与 TypeScript/Vite 构建通过。

---

### Task 9: 本地联调验收脚本（可交付给执行子代理）

**Files:**
- Create: `docs/superpowers/plans/overview-dashboard-acceptance-checklist.md`

- [ ] **Step 1: 记录手工验收步骤（固定清单）**

清单必须包含：
- `/ui` 首屏渲染时间与可视完整性
- 拓扑缩放/拖拽/筛选/链路高亮
- WS 断线重连（手动断网或关闭后端）与 SSE 兜底
- 图标加载完整性（无 broken icon）
- 数据正确性抽样（与 alerts/monitoring/resources/logs 页面关键数字比对）

Expected: 执行者按清单可重复验收，不依赖口头说明。

- [ ] **Step 2: 启动与联调命令模板**

Run:

```powershell
# terminal 1: backend
cd G:\Cursor_fiie_path\Octopus_devops
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

# terminal 2: frontend
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npm run dev
```

Expected: 打开 `http://localhost:5173/ui` 可完成全部手工验收项。

---

## 执行顺序与依赖关系

1. `Task 1`（依赖安装 + 模块骨架）  
2. `Task 2`（类型与 REST 聚合，为所有 UI 提供数据）  
3. `Task 3`（实时层，依赖 Task 2 的类型）  
4. `Task 4`（图标映射，供 KPI/拓扑复用）  
5. `Task 5`（基础图表组件，依赖 Task 2/4）  
6. `Task 6`（拓扑全交互，依赖 Task 2/3/4/5）  
7. `Task 7`（OverviewPage 最终组装替换，依赖 Task 3/5/6）  
8. `Task 8`（自动化验收与回归）  
9. `Task 9`（手工验收脚本与交付）

---

## 风险与前置说明（执行前确认）

- 当前仓库 `frontend/src/app/routes.tsx` 引用了 `LogsPage`，但源码中未发现对应文件；若执行阶段触发编译错误，需先补齐 `LogsPage` 或调整导入后再推进本计划。
- 实时通道后端端点（WS/SSE）若尚未提供，前端先按可配置 URL 落地客户端并保持“无实时通道时仅快照模式可用”。
- 本计划只覆盖首页替换，不改现有路由结构，不触达登录/鉴权策略。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-overview-replacement-dashboard.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

