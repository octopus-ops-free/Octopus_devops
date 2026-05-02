# Skills 快速命令清单（可复制）

> 重点覆盖：`systematic-debugging` + `context7-mcp`

---

## 1) Debug 常用指令

### 1.1 先根因分析（不改代码）

```text
使用 systematic-debugging 排查这个问题。先不要改代码，先完成：
1) 复现路径
2) 关键报错/堆栈解读
3) 最近改动关联分析
4) 根因结论
最后给出最小修复方案。
```

### 1.2 根因明确后再修复

```text
基于刚才的根因分析，按最小改动修复问题。
要求：
- 只改根因相关代码
- 补充一个能复现该问题的测试（失败->通过）
- 给出修复前后差异说明
```

### 1.3 调试 + 回归验证

```text
使用 systematic-debugging 继续：
- 先跑目标测试验证修复
- 再跑相关回归测试
- 输出验证结果摘要（通过/失败、失败项原因）
```

### 1.4 CI 报错排查

```text
使用 fix-ci + systematic-debugging 排查 CI 失败。
先定位第一个真实失败点，不要一次性改很多处。
给出：根因、修复、验证命令、预防建议。
```

---

## 2) Context7 文档查询指令

### 2.1 查询最新官方用法（通用）

```text
使用 context7-mcp 查询 <技术名> <版本号> 的官方文档。
问题：<你的问题>
要求：
- 基于官方文档回答
- 给最小可运行示例
- 标注版本差异和常见坑
```

示例：

```text
使用 context7-mcp 查询 Next.js 15 的 middleware 官方文档。
问题：如何做基于 cookie 的鉴权重定向？
要求：基于官方文档给最小可运行示例，并标注 Next.js 14/15 差异。
```

### 2.2 Prisma v7 查询模板

```text
使用 context7-mcp 查询 Prisma v7 官方文档。
问题：driver adapters + prisma.config.ts + env 加载的标准配置是什么？
请给：
1) package 安装命令
2) schema.prisma 示例
3) prisma.config.ts 示例
4) 常见错误与修复
```

### 2.3 React/TypeScript 查询模板

```text
使用 context7-mcp 查询 React 19 + TypeScript 最新文档。
问题：<具体 API/模式>
请输出：官方推荐写法、反例、迁移建议。
```

---

## 3) Debug + Context7 组合流程（推荐）

### 3.1 先定位，再查文档，再修复

```text
先使用 systematic-debugging 做根因定位；
然后使用 context7-mcp 查该技术栈对应官方修复建议；
最后给出最小修复补丁并补测试。
```

### 3.2 复杂问题一条龙

```text
按以下顺序处理：
1) systematic-debugging：定位根因
2) context7-mcp：查询官方最新推荐
3) test-driven-development：先失败测试再修复
4) verification-before-completion：验证后再宣称完成
```

---

## 4) GitHub 操作常用指令（你当前环境可用）

### 4.1 检查登录状态

```powershell
gh auth status
```

### 4.2 检查 token 环境变量（不打印 token 值）

```powershell
if ($env:GITHUB_PERSONAL_ACCESS_TOKEN) { "SET" } else { "EMPTY" }
```

### 4.3 提交并推送（示例）

```powershell
git add docs/skills_quick_reference.md
git commit -m "docs: add skills quick command reference"
git push
```

---

## 5) 你可以直接复制的高频请求

### 高频 1：排错

```text
使用 systematic-debugging 排查这个报错，先给根因，不要直接改代码。
```

### 高频 2：查最新文档

```text
使用 context7-mcp 查询 <库名> <版本> 官方文档，并给最小可运行示例。
```

### 高频 3：从问题到修复

```text
先 systematic-debugging 定位根因，再 context7-mcp 查官方方案，最后最小改动修复并补测试。
```
