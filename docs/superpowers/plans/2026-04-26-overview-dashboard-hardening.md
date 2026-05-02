# Overview Dashboard Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不做大范围重构的前提下，修复 Overview 大屏已确认的接口连通、状态语义、导航语义与测试缺口问题，确保 `/ui` 首屏稳定可用。

**Architecture:** 保持现有 `overview` 模块与 `Layout` 结构，只做“局部修复 + 测试补强”。数据层沿用 `snapshot + realtime`，补齐初次快照重试与状态机语义；展示层统一修正状态文案与可访问性；统计层修复 `alertCount` 时间序列构造逻辑。所有改动均限制在 `frontend/src/features/overview` 与 `frontend/src/features/shell` 相关文件。

**Tech Stack:** React 19 + TypeScript + React Router + Vitest + Testing Library + Vite

---

## File Structure (Scope-Locked)

- `frontend/src/features/overview/services/overviewRealtime.ts`：实时通道 URL/回退与重连行为修复。
- `frontend/src/features/overview/hooks/useOverviewData.ts`：默认筛选、初次快照重试、连接状态机一致性。
- `frontend/src/features/overview/services/overviewApi.ts`：告警趋势计算修复（`alertCount` 时间序列）。
- `frontend/src/features/overview/OverviewPage.tsx`：状态视觉语义对齐（`snapshot-only/disconnected/reconnecting`）。
- `frontend/src/features/shell/Layout.tsx`：导航语义与可访问性修正。
- `frontend/src/features/overview/services/*.test.ts`、`frontend/src/features/overview/*.test.tsx`、`frontend/src/features/shell/Layout.test.tsx`：新增/补齐测试。

---

### Task 1: 修复实时端点与回退链路（404/WS 连通性）

**Files:**
- Modify: `frontend/src/features/overview/services/overviewRealtime.ts`
- Test: `frontend/src/features/overview/services/overviewRealtime.test.ts`

- [ ] **Step 1: 先补失败用例，锁定端点与回退预期**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/overview/services/overviewRealtime.test.ts -t "events endpoint fallback"
```

Expected: FAIL（当前实现未覆盖 `/api/overview/events` 404 与 WS 失败回退预期）。

- [ ] **Step 2: 最小实现修复**

执行要点：
- 保持默认 WS 地址仍为 `/api/overview/ws`。
- 明确 SSE 地址为 `/api/overview/events`，并在 WS early failure/abnormal close 时稳定进入 SSE。
- SSE 出错后继续按既有指数退避重连，不产生重复定时器。

Run:

```powershell
npx vitest run src/features/overview/services/overviewRealtime.test.ts
```

Expected: PASS；已有“优先 WS / SSE 回退 / 重连梯度 / 手动断开不重连”场景全部通过。

- [ ] **Step 3: 用浏览器开发环境复验连接行为**

Run:

```powershell
npm run dev
```

Expected: 打开 `/ui` 后不出现无限重连风暴；若 `/api/overview/events` 不存在，仅显示受控重连状态，不抛未捕获异常。

---

### Task 2: 加固 `useOverviewData` 初次加载（默认 host 与 HTTP 重试）

**Files:**
- Modify: `frontend/src/features/overview/hooks/useOverviewData.ts`
- Test: `frontend/src/features/overview/hooks/useOverviewData.test.ts`（若不存在则创建）

- [ ] **Step 1: 补 hook 状态机失败用例（默认 host + 首次失败重试）**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/overview/hooks/useOverviewData.test.ts
```

Expected: FAIL；至少暴露两个问题：默认 `host='local'` 导致资源采集长期空、首次快照失败直接终止。

- [ ] **Step 2: 实现最小修复（不改架构）**

执行要点：
- 将默认筛选从固定 `'local'` 改为唯一默认值 `'1'`（不使用空值降级策略）。
- 为 `fetchOverviewSnapshot` 增加初次加载重试：固定最多重试 2 次（共 3 次尝试），退避固定为 `300ms`、`900ms`，仅用于首屏启动阶段。
- 重试耗尽后进入 `disconnected`，但若已有快照则保持数据并标记可恢复状态。

Run:

```powershell
npx vitest run src/features/overview/hooks/useOverviewData.test.ts
```

Expected: PASS；状态机覆盖 `loading -> snapshot-only -> connected` 与失败后 `reconnecting/disconnected` 分支。

- [ ] **Step 3: 回归页面测试**

Run:

```powershell
npx vitest run src/features/overview/OverviewPage.test.tsx
```

Expected: PASS；页面在重试与弱网状态下依旧可渲染快照，不白屏。

---

### Task 3: 统一状态视觉语义（snapshot-only/disconnected/reconnecting）

**Files:**
- Modify: `frontend/src/features/overview/OverviewPage.tsx`
- Modify: `frontend/src/features/overview/types.ts`（仅当状态枚举需收敛时）
- Test: `frontend/src/features/overview/OverviewPage.test.tsx`

- [ ] **Step 1: 先写断言，明确三种状态的 UI 文案与样式语义**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/overview/OverviewPage.test.tsx -t "status semantics"
```

Expected: FAIL；当前页面语义存在混用或不一致。

- [ ] **Step 2: 最小改动统一映射**

执行要点：
- `snapshot-only`：明确为“快照模式（离线）”。
- `reconnecting`：明确为“重连中（保留上次数据）”。
- `disconnected`：明确为“连接中断（仅展示缓存/空态）”。
- 状态文案采用唯一映射：`snapshot-only -> 快照模式（离线）`、`reconnecting -> 重连中（保留上次数据）`、`disconnected -> 连接中断（仅展示缓存/空态）`，禁止同一状态出现多套文案。
- 文案组合不冲突：当状态为 `snapshot-only` 或 `disconnected` 时，不显示“在线”；当状态为 `reconnecting` 时，可显示“重连中”但不得同时显示“连接中断”。

Run:

```powershell
npx vitest run src/features/overview/OverviewPage.test.tsx
```

Expected: PASS；可断言以下指标：
- 状态值到文案为 1:1 映射（测试中逐一断言 3 个状态各只对应 1 条文案）。
- 任意时刻页面不会同时出现“在线”与“快照模式（离线）”。
- 任意时刻页面不会同时出现“重连中（保留上次数据）”与“连接中断（仅展示缓存/空态）”。

---

### Task 4: 修复告警趋势算法（`alertCount` 改为时间序列）

**Files:**
- Modify: `frontend/src/features/overview/services/overviewApi.ts`
- Test: `frontend/src/features/overview/services/overviewApi.test.ts`
- Test: `frontend/src/features/overview/components/TrendLineChart.test.tsx`（若趋势展示依赖行为需补测）

- [ ] **Step 1: 为 `buildTrend` 增加失败用例**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/overview/services/overviewApi.test.ts -t "alertCount time series"
```

Expected: FAIL；当前 `alertCount` 为常量，不随时间点变化。

- [ ] **Step 2: 仅修复趋势构造逻辑**

执行要点：
- 按 `created_at` 将告警映射到时间桶（与 metrics 时间粒度对齐或近邻归并）。
- 每个趋势点输出“该时间桶内新增告警数”（固定窗口内计数口径，不使用累计口径），并在测试中写死断言。
- 不修改 KPI 与告警列表现有聚合逻辑。

Run:

```powershell
npx vitest run src/features/overview/services/overviewApi.test.ts src/features/overview/components/TrendLineChart.test.tsx
```

Expected: PASS；趋势线中的 `alertCount` 呈真实时序变化。

---

### Task 5: 修正 Layout 导航语义与可访问性

**Files:**
- Modify: `frontend/src/features/shell/Layout.tsx`
- Test: `frontend/src/features/shell/Layout.test.tsx`（新建）

- [ ] **Step 1: 新增 Layout 测试，锁定标题与导航语义**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/shell/Layout.test.tsx
```

Expected: FAIL；至少暴露“自动化中心”路由语义不一致或标题映射不准确问题。

- [ ] **Step 2: 最小修复可访问性与语义**

执行要点：
- 对齐“自动化中心”文案与实际路由职责（保留路径不变，修正文案/标题映射即可）。
- 为导航区与关键图标补必要语义属性（如 `aria-label`、可读文本），避免空 `alt` 造成可访问性缺口。
- 不调整全局布局结构与视觉体系。

Run:

```powershell
npx vitest run src/features/shell/Layout.test.tsx src/app/App.test.tsx
```

Expected: PASS；导航标题与路由一致，基础可访问性断言通过。

---

### Task 6: 补齐关键测试缺口（hook 状态机 / layout 标题 / alert 分布）

**Files:**
- Modify: `frontend/src/features/overview/hooks/useOverviewData.test.ts`（若 Task 2 新建则继续补全）
- Modify: `frontend/src/features/overview/components/AlertDistributionChart.test.tsx`（若不存在则创建）
- Modify: `frontend/src/features/overview/OverviewPage.test.tsx`
- Modify: `frontend/src/features/shell/Layout.test.tsx`

范围声明：本任务仅补测试护栏，不新增功能、不调整运行时逻辑。

- [ ] **Step 1: 补 `AlertDistributionChart` 数据分布断言**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/overview/components/AlertDistributionChart.test.tsx
```

Expected: FAIL -> PASS；验证 critical/warning/info 分布及空数据兜底。

- [ ] **Step 2: 统一执行 Overview+Layout 相关测试集**

Run:

```powershell
npx vitest run src/features/overview src/features/shell/Layout.test.tsx
```

Expected: PASS；覆盖本计划涉及的状态机、语义与图表分布核心场景。

---

### Task 7: 最终质量门禁与联调验收（仅验证，不提交）

**Files:**
- Modify: `docs/superpowers/plans/2026-04-26-overview-dashboard-hardening.md`（若执行中有命令差异再回填）

- [ ] **Step 1: 运行 lint/build 质量门禁**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npm run lint
npm run build
```

Expected: 均通过；若存在既有无关失败，记录在执行日志并标注“非本计划引入”。

- [ ] **Step 2: 本地联调复验已确认问题**

Run:

```powershell
# Terminal 1
cd G:\Cursor_fiie_path\Octopus_devops
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 2
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npm run dev
```

前提：以上命令需在两个并行终端分别执行，且两侧服务均启动成功后再访问 `/ui` 验证。
停止命令：

```powershell
# Terminal 1 / Terminal 2 分别执行
Ctrl + C
```

Expected:
- `/ui` 可正常加载，状态提示语义一致；
- `/api/overview/ws` 异常时重连节奏受控（连续 60 秒内重连尝试次数 <= 10 次）；
- 导航“自动化中心”标题/语义与实际页面一致。

- [ ] **Step 3: 明确本计划不做提交**

Run:

```powershell
git status --short
```

Expected: 仅保留工作区修改，不执行 `git commit`。

---

## Recommended Execution Order

1. Task 1（先稳住实时链路，避免噪音）
2. Task 2（修复首屏初始化可用性）
3. Task 3（统一状态语义，降低误判）
4. Task 4（修复趋势数据正确性）
5. Task 5（修正导航语义与 a11y）
6. Task 6（补齐测试护栏）
7. Task 7（质量门禁与联调收尾）

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-overview-dashboard-hardening.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
