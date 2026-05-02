# Skills / MCP / GitHub 使用说明（Octopus_devops）

## 1. 目标

本文档用于：
- 说明你当前仓库里 `skills` 如何使用
- 说明 `context7` MCP 的使用方式
- 说明如何打通 GitHub MCP（含 Token 配置）
- 说明如何把 `https://github.com/octopus-ops-free` 作为可操作目标仓库

---

## 2. 当前配置现状

你的 `.cursor/mcp.json` 已配置以下 MCP：
- `context7`（已保留不改）
- `github`
- `mcp-docker`
- `memory`
- `sequential-thinking`
- `fetch`
- `git`
- `fetch-browser`

其中 `github` 配置依赖环境变量：
- `GITHUB_PERSONAL_ACCESS_TOKEN`

**目前你反馈“未配置 token”，所以 GitHub MCP 现在无法真正访问 GitHub API。**

---

## 3. 如何使用本地 Skills（@skills）

你已把 skills 目录复制到工作台。使用方式：

### 3.1 对话中直接触发
在聊天中明确写：
- `使用 context7-mcp 查一下 Next.js middleware 最新写法`
- `使用 systematic-debugging 排查这个报错`
- `使用 writing-plans 先出执行计划`

### 3.2 按任务类型触发（推荐）
- 调试问题：`systematic-debugging`
- 功能开发：`test-driven-development` + `writing-plans`
- 文档协作：`doc-coauthoring`
- MCP 开发：`mcp-builder`
- MCP 安全审计：`mcp-security-audit`

### 3.3 触发建议
- 任务开始就声明“用哪个 skill”效果最好
- 一个任务可组合多个 skill（例如：先 `brainstorming`，再 `writing-plans`，再执行）

---

## 4. Context7 MCP 怎么用

`context7` 的定位：
- 查询**库/框架/API 的最新文档**，避免使用过时知识

### 推荐流程
1. 给出库名与问题（例如：`React 19 useTransition 用法`）
2. 先解析库 ID（resolve library）
3. 再按问题检索文档（query docs）
4. 用检索到的文档生成答案/代码

### 使用建议
- 问题里带版本号（如 Next.js 15、React 19）
- 优先官方库 ID
- 回答时标注版本和关键差异

> 说明：本次会话里外网检索超时，未能在线拉取额外官方页面，但你本地 `context7-mcp` skill 规则已经完整可用。

---

## 5. 打通 GitHub MCP（关键步骤）

你的目标仓库：
- `https://github.com/octopus-ops-free`

要让我“直接操作 GitHub”，你必须先在本机提供有效 token。

### 5.1 生成 GitHub Personal Access Token
建议创建 **Fine-grained PAT**（推荐）或 classic PAT。

最少建议权限：
- Repository contents: Read and write
- Pull requests: Read and write
- Issues: Read and write（如需）
- Metadata: Read-only
- Actions: Read and write（如果要改 CI/workflow）

### 5.2 在 Windows PowerShell 注入环境变量
临时（当前终端有效）：

```powershell
$env:GITHUB_PERSONAL_ACCESS_TOKEN="你的新PAT"
```

永久（用户级）：

```powershell
setx GITHUB_PERSONAL_ACCESS_TOKEN "你的新PAT"
```

> 执行 `setx` 后，重开 Cursor/终端才生效。

### 5.3 验证是否生效
建议先在终端验证：

```powershell
echo $env:GITHUB_PERSONAL_ACCESS_TOKEN
```

如果返回非空（不需要展示完整 token），说明注入成功。

然后重启 Cursor，让 `github` MCP 容器读取到该变量。

---

## 6. 推荐的 GitHub 绑定与操作流程

1. 先配置 PAT（见上）
2. 重启 Cursor
3. 我帮你做一次连通性检查（读仓库信息）
4. 连通后可执行：
   - 创建/切换分支
   - 提交并推送
   - 创建 PR
   - 读取/回复 PR 评论
   - 同步 docs 到 GitHub 仓库

---

## 7. 安全建议（强烈）

- 不要把 PAT 明文写进 `.cursor/mcp.json`
- 已暴露 token 时，立刻 revoke 并重发
- 建议把敏感文件加入 `.gitignore`（按你团队规范决定）

---

## 8. 下一步（你只需做一件事）

请先在本机设置：

```powershell
setx GITHUB_PERSONAL_ACCESS_TOKEN "你的新PAT"
```

然后重启 Cursor。完成后告诉我“已完成”，我将继续：
- 验证 GitHub MCP 可用
- 将 docs 内容对接到你的 GitHub 仓库工作流（分支/提交/PR）
