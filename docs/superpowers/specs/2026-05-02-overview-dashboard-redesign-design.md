# 概览首页（React）改版设计

**日期**：2026-05-02  
**范围**：`frontend/src/features/overview/*` 与支撑 API；底部「快速入口」与 `frontend/src/features/shell/Layout.tsx` 对齐主导航。  
**排除**：`app/ui/index.html` 旧静态页（本次不改）。

---

## 0. 文档流程（固定）

后续同类需求按此顺序执行，避免设计与实现脱节：

1. **编写 / 更新本 Spec**（唯一需求来源，路径：`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`）。
2. **用户回复「spec 确认」** 后，对 Spec 做 **receiving-code-review 式技术审查**（对照代码与数据模型，查歧义、缺口、与现状冲突；不通过则改 Spec 再确认）。
3. 审查通过后，使用 **writing-plans** 生成 `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` 实现计划。
4. 按计划实现；大改动优先 **subagent-driven-development** 或 **executing-plans**（与计划文档头部说明一致）。

---

## 1. 背景与目标

将首页布局对齐参考图一（上 KPI、中三栏、下三栏、底快速入口），并完成：

- **告警趋势**：折线图，可选 **近 24 小时 / 近 7 天 / 近 30 天**，展示告警随时间分布（与告警等级配色一致）。
- **告警分布 + 最近告警合并**（参考图二思路）：同一卡片内左侧分布（环形/柱状二选一可保留）、右侧列表；列表按 **等级** 排序：`critical > high > warning > medium > info > low`，**同等级内按时间倒序**。
- **资源健康状态**：保持现有 **CPU / 内存 / 磁盘** 监测能力（沿用当前趋势数据来源与展示逻辑）；增加一行小字：**当前检测主机：{IP}**（与现有被监控主机一致，例如 `123.207.215.86`）；字号与卡片标题/边距适配，不抢主视觉。
- **定时任务（原「自动化执行任务」）**：数据从 **当前被监控主机** 经后端 SSH 拉取（与监控采集同源：`Host` + `ssh_exec`）；展示 **成功 / 失败 / 运行中 / 跳过** 统计 + **24h / 7d / 30d** 切换；卡片角标备注 **主机：{IP}**。
- **作业执行记录**：占位面板（空表 +「后续接入作业功能」说明），为后续功能预留。
- **快速入口**：与侧边栏 `Layout.tsx` 中 `navItems` **逐项一致**（路径与文案一致），替换当前写死的 6 个按钮。

---

## 2. 实现路径对比（已选型）

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A（推荐）** | 新/扩 FastAPI：`host_id` + `window`，SSH `crontab -l` + 可选解析 cron 执行日志；概览聚合接口或独立接口 + 前端 ECharts | 真实数据、与现有 SSH 模式一致 | 需约定日志解析与降级 |
| B | 仅前端 mock | 快 | 不符合「A 真实数据」 |
| C | 仅 `crontab -l` 行数当「任务数」 | 实现极简 | 无法得到成功/失败等执行态 |

**结论**：采用 **方案 A**；执行态以远端可解析的 cron 日志为主（见 §4.3），不可用时明确降级 UI。

---

## 3. 页面信息架构（对齐图一）

### 3.1 顶部

- 保留 **KpiCards** + 连接状态条（现有 `useOverviewData`）。

### 3.2 中部（三列 `grid-template-columns: 1fr 1fr 1fr`）

| 左 | 中 | 右 |
|----|----|----|
| **资源健康状态**（`TrendLineChart` 演进：标题与副标题展示主机 IP；时间窗与图一一致时可改为 24h/7d/30d 与全局一致） | **告警趋势**（新组件：多折线，按等级或按 critical/warning/info 聚合） | **告警概览**（合并原 `AlertDistributionChart` + 「最新告警」列表） |

### 3.3 底部（三列）

| 左 | 中 | 右 |
|----|----|----|
| **定时任务执行概况**（环形图：成功/失败/运行中/跳过） | **作业执行记录**（占位） | **资源拓扑**（保留 `ResourceTopologyGraph`） |

### 3.4 最底栏

- `Layout.tsx` 中 `footerBar`：根据 `navItems` 生成链接/按钮，`NavLink` 至相同 `to`，文案与侧边栏一致。

---

## 4. 数据与 API

### 4.1 当前检测主机与 IP

- 概览默认 `useOverviewData` 使用 `DEFAULT_FILTERS.host`（当前实现为字符串，常见为 **主机在库中的 id 字符串**，如 `'1'`，用于 `resources` 等按 id 调用的接口）。
- **与监控数据对齐（重要）**：`HostMetric.host` 存的是 **`Host.name`**（见 `save_remote_linux_metrics`），`/api/monitoring/metrics?host=` 的 `host` 查询参数必须与库中 `Host.name` 一致。实现上须：**由当前选中的 Host 记录解析出 `name`（metrics）、`ip`（展示）、`id`（SSH 扩展接口）**，禁止把数字 id 直接当作 `metrics` 的 `host` 传参除非该主机 `name` 恰好为该字符串。
- 展示 IP：复用 `GET /api/hosts`（已有）或按 id 查库；将 **`monitoredHostIp`**、**`monitoredHostName`** 写入 `OverviewSnapshot`（或并行请求后由前端持有），供资源健康、定时任务卡片副标题使用。
- 若无法解析 IP：副标题显示 `主机：未知`；metrics 仍使用已解析的 `Host.name`，解析失败时回退 `local` 并在 `degradedSources` 中标记（与现网行为一致）。

### 4.2 告警趋势（24h / 7d / 30d）

- **现状**：`/api/alerts/events` 与 `/api/alerts/events/history` 仅有 `limit`，无 `since` / 无按 `host` 过滤；库中 `AlertEvent.level` 与前端展示级别需经现有映射统一。
- **目标接口**：新增 **`GET /api/alerts/trend?window=24h|7d|30d&host=`**（`host` 可选，与告警事件 `AlertEvent.host` 字符串一致；未传则全量）。服务端合并活动+历史（或单表按 `resolved` 区分）在 `created_at >= now - window` 范围内 **按时间桶聚合**，返回 `{ buckets: { start: ISO8601, counts: Record<levelKey, number> }[] }`，避免前端拉全量再聚合。
- 折线系列：至少 **critical / warning / info**（与告警规则页一致）；`high`/`medium`/`low` 可合并为 **「其他」** 一条线或单独系列（实现选定一种并在响应中固定字段名）。

### 4.3 定时任务统计（真实 SSH）

- **入口**：`GET /api/hosts/{host_id}/cron/summary?window=24h|7d|30d`（路径名以路由文件惯例为准）。
- **行为**：
  1. 根据 `Host` 使用 `ssh_run` / `ssh_run_with_key_path`（与 `monitoring.py` 一致）。
  2. **`crontab -l`**：解析有效 cron 行数（非注释、非空），作为「已配置任务数」基线。
  3. **执行结果**：在 Linux 常见环境下尝试 **只读** 拉取 cron 相关日志（例如 `journalctl -u cron` 或 `grep CRON /var/log/syslog` 等，**具体命令在实现阶段按发行版做最小集 + 超时**），在时间窗内归类：
     - **成功**：日志表明正常完成且 exit 0（解析规则在实现中单元测试固化样例）。
     - **失败**：非 0 或明确 error。
     - **运行中**：若日志无法区分，**显示 0** 并在卡片脚注说明「cron 日志未提供运行中态」。
     - **跳过**：仅当日志可识别（如 anacron skip）；否则 **0**。
- **失败降级**：SSH 失败或无日志权限时，返回 `degraded: true` + 仅 `crontab` 行数；前端环形图显示「仅配置」或禁用失败扇区并展示提示文案。
- **安全**：不返回完整私钥；不记录密钥内容；仅返回聚合数字与可选匿名错误码。

### 4.4 合并列表排序

- 列表数据：与 **4.2 同一时间窗** 内的事件合并后，**先按等级权重降序**（`critical > high > warning > medium > info > low`），**再按 `createdAt` 降序**。
- 分布图：与列表 **同一批过滤后的事件** 计算等级分布（环形/柱状），保证图与表一致。
- **UI 状态**：告警趋势图与「告警概览」合并卡片 **共享 `window`（24h / 7d / 30d）**；`OverviewPage` 提升 state 或提取 `useOverviewAlertWindow()`，避免两处不同步。

---

## 5. 前端组件调整清单

| 组件/文件 | 变更 |
|-----------|------|
| `OverviewPage.tsx` | 栅格重组；移除底栏三格中「日志活动」「关键资源表」或降级为二级页入口（本次以图一为准：**删除或移出首屏**，避免与图一冲突）。 |
| `OverviewPage.css` | 中/下三列响应式；小屏改为单列堆叠。 |
| `TrendLineChart.tsx` / 类型 | 标题改为「资源健康状态」；副标题 `当前检测主机：{ip}`；时间窗扩展 `7d`/`30d`（与类型 `OverviewTimeWindow` 一致扩展）。 |
| `AlertDistributionChart.tsx` | 与列表合并为新组件 `AlertOverviewPanel.tsx`（或同级扩展），内含分布 + 排序列表。 |
| **新** `AlertTrendChart.tsx` | 折线图 + 24h/7d/30d。 |
| **新** `CronTaskSummaryPanel.tsx` | 环形图 + 时间窗 + 主机备注 + 降级提示。 |
| `Layout.tsx` | 快速入口数据驱动 `navItems`。 |
| `overviewApi.ts` / `types.ts` | 扩展 snapshot 或并行请求；`metricLimit`/monitoring query 支持长窗。 |

---

## 6. 非目标与风险

- **作业执行记录**：仅占位，不接 API。
- **Cron 执行态**：强依赖远端日志格式与权限；需在实现与验收中列出「支持矩阵」与降级文案。
- **性能**：7d/30d 告警聚合由后端完成，避免前端拉全表。

---

## 7. 验收要点

1. 首页布局与图一结构一致（中三、下三、底栏），窄屏可纵向滚动无横向溢出。
2. 告警合并卡片：等级排序 + 同等级时间倒序；与告警趋势时间窗联动一致。
3. 资源健康：仍展示 CPU/内存/磁盘曲线；可见 **当前检测主机：{IP}**。
4. 定时任务：数据来自选中主机的 SSH；切换 24h/7d/30d 有请求与 UI 更新；无权限时有明确降级。
5. 快速入口与侧边栏 **路径、名称、数量** 一致。
6. 无密钥、无 token 写入仓库与文档。

---

## 8. 后续

用户确认本设计后，使用 **writing-plans** 产出实现计划（含 API 契约、文件列表、测试清单）。

---

## 9. Spec 技术审查记录（receiving-code-review）

**审查日期**：2026-05-02  
**对照物**：`app/api/alerts.py`、`app/api/monitoring.py`、`app/services/monitoring.py`、`app/api/hosts.py`、`frontend/src/features/overview/hooks/useOverviewData.ts`、`frontend/src/features/overview/services/overviewApi.ts`

| 项 | 结论 |
|----|------|
| Spec 原写「`GET /api/hosts/{id}`」 | `hosts` 路由已有列表 `GET /api/hosts`，无单独 `GET /api/hosts/{id}`；实现以列表或单次 `db.get(Host, id)` 服务内解析即可，Spec §4.1 已改为不依赖不存在的路径。 |
| `metrics?host=` 与「host id」 | 代码层面 `HostMetric.host` 使用 **`Host.name`**；Spec 已明确 id 与 name 的解析关系，避免静默查不到曲线。 |
| 告警接口缺 `since` | 与 Spec 目标一致；**须新增聚合接口**（§4.2 已改为 `/api/alerts/trend`），不能仅依赖增大 `limit` 在前端聚合（性能与正确性不达标）。 |
| `AlertEvent.level` 与 UI `info/warning/critical` | 并存多种历史取值；聚合与排序须复用或对齐 `overviewApi.mapAlertLevel` 同一套归一化规则。 |
| `/api/overview/ws` | 前端已连接；后端是否存在不影响本 Spec 范围，但若改 `OverviewSnapshot` 形状，须同步任何推送 snapshot 的生成端（若有）。本迭代以 **REST 扩展 + 前端拉取** 为主。 |

**审查结论**：Spec 经上述修正后可作为实现依据；无阻塞项。
