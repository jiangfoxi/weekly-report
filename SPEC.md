# 周报工具 — 实施计划 (PLAN)

> 本文档为正式开发前的设计文档，需与用户 review 确认后再开工。

---

## 1. 需求概述

一个**个人本地使用**的周报生成工具：自动从 GitHub 和苹果备忘录抓取本周（周一到周日）的工作内容，调用 MiniMax 大模型生成结构化周报，支持本地 Markdown 归档与 PDF 导出。

---

## 2. 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | 全栈，含 API Routes |
| 语言 | TypeScript | 严格模式 |
| 样式 | Tailwind CSS v4 | |
| AI SDK | `@anthropic-ai/sdk` | 走 MiniMax 兼容协议 |
| GitHub | `@octokit/rest` | 官方 SDK |
| 备忘录 | Node `child_process` + `osascript` | macOS AppleScript |
| PDF 导出 | `@react-pdf/renderer` 或 `puppeteer` | 待定（见 §8） |
| 包管理 | npm | |

**运行环境**：仅 macOS（备忘录依赖 AppleScript），仅本地（`localhost:3000`）。

---

## 3. 项目结构

```
weekly-report/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # 主页（生成周报 + 历史列表）
│   ├── reports/[slug]/page.tsx   # 单篇周报详情页
│   └── api/
│       ├── generate/route.ts     # POST 触发生成
│       ├── reports/route.ts      # GET 历史列表
│       ├── reports/[slug]/route.ts  # GET 单篇 / DELETE
│       └── export/[slug]/route.ts   # GET 导出 PDF
├── lib/
│   ├── sources/
│   │   ├── github.ts             # GitHub commits 抓取
│   │   └── notes.ts              # 苹果备忘录抓取（AppleScript）
│   ├── ai/
│   │   └── minimax.ts            # AI 调用封装
│   ├── storage/
│   │   └── reports.ts            # 本地 Markdown 文件读写
│   ├── week.ts                   # 本周时间范围工具函数
│   └── config.ts                 # 读取 ~/.github/config.json
├── scripts/
│   └── fetch-notes.applescript   # 备忘录抓取脚本
├── reports/                      # 生成的周报存放目录（git 可跟踪）
│   └── 2026-W16.md
├── .env.local.example
├── .env.local                    # gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 4. 核心数据流

```
[用户点"生成本周周报"]
        ↓
POST /api/generate
        ↓
  ┌─────┴─────┐
  ↓           ↓
GitHub      备忘录
抓 commits   抓笔记
  ↓           ↓
  └─────┬─────┘
        ↓
  组装 Prompt
        ↓
  MiniMax API
        ↓
  解析三段输出
        ↓
  写入 reports/2026-Wxx.md
        ↓
  返回给前端展示
```

---

## 5. 模块设计

### 5.1 时间范围 `lib/week.ts`

```ts
function getCurrentWeekRange(): { start: Date; end: Date; weekKey: string }
// 周一 00:00 → 周日 23:59
// weekKey 格式: "2026-W16"（ISO week）
```

### 5.2 配置读取 `lib/config.ts`

```ts
function getGithubConfig(): { token: string; baseUrl: string }
// 读取 ~/.github/config.json
// { "githubBaseUrl": "...", "token": "..." }
```

### 5.3 GitHub 数据源 `lib/sources/github.ts`

```ts
type GithubCommit = {
  repo: string
  sha: string
  message: string
  url: string
  date: string
}

async function fetchWeekCommits(start: Date, end: Date): Promise<GithubCommit[]>
```

**实现思路**：
- 用 token 调 `GET /user` 拿到当前用户名
- 用 GitHub Search API：`q=author:{user}+committer-date:{start}..{end}`（覆盖所有仓库，包括私有）
- 分页拉取，去重（同一 commit 可能在多个分支）

### 5.4 备忘录数据源 `lib/sources/notes.ts`

```ts
type Note = {
  title: string
  body: string
  modifiedAt: string
  folder: string
}

async function fetchWeekNotes(start: Date, end: Date): Promise<Note[]>
```

**实现思路**：
- `child_process.exec('osascript scripts/fetch-notes.applescript ...')`
- AppleScript 输出 JSON（标题 + 正文 + 修改时间 + 所属文件夹）
- Node 端按时间窗口过滤
- 首次运行需用户在"系统设置 → 隐私与安全 → 自动化"中授权

**风险**：AppleScript 抓全量笔记可能慢（几秒到十几秒），后续可能需要做缓存。

### 5.5 AI 生成 `lib/ai/minimax.ts`

```ts
type GenerateInput = {
  weekKey: string
  commits: GithubCommit[]
  notes: Note[]
}

type GeneratedReport = {
  githubSummary: string
  notesSummary: string
  overallSummary: string
}

async function generateReport(input: GenerateInput): Promise<GeneratedReport>
```

**Prompt 结构**（中文）：
```
你是一个周报助手。基于以下数据生成本周（{weekKey}）的工作总结。

【GitHub Commits】
- repo: feat: xxx
- repo: fix: yyy
...

【备忘录笔记】
- 标题: 摘要
...

请输出三段，使用 JSON 格式：
{
  "githubSummary": "...",
  "notesSummary": "...",
  "overallSummary": "..."
}

要求：
- 每段 3-5 条要点
- 中文，简洁
- 总结要提炼主线，不是简单罗列
```

调用使用 Anthropic SDK 的 `messages.create`，base URL 指向 MiniMax。

### 5.6 存储 `lib/storage/reports.ts`

```ts
async function saveReport(weekKey: string, report: GeneratedReport, raw: { commits, notes }): Promise<string>
async function listReports(): Promise<{ weekKey: string; createdAt: string }[]>
async function readReport(weekKey: string): Promise<string>  // 返回 Markdown
async function deleteReport(weekKey: string): Promise<void>
```

**Markdown 文件格式**：
```markdown
---
weekKey: 2026-W16
generatedAt: 2026-04-17T10:00:00Z
commitsCount: 23
notesCount: 5
---

# 周报 2026-W16 (4月13日 - 4月19日)

## GitHub
{githubSummary}

## 备忘录
{notesSummary}

## 本周总体总结
{overallSummary}

---

<details>
<summary>原始数据</summary>

### Commits
- ...

### Notes
- ...

</details>
```

---

## 6. UI 设计（最小可用版本）

### 主页 `/`
- 顶部：标题 + "生成本周周报"按钮
- 中部：生成中显示进度（"抓取 GitHub..." → "读取备忘录..." → "AI 生成..."）
- 底部：历史周报列表（按周倒序），每条显示 weekKey + 生成时间 + "查看 / 导出 / 删除"

### 周报详情 `/reports/[weekKey]`
- 渲染 Markdown
- 顶部按钮：复制 Markdown / 下载 .md / 下载 .pdf / 删除 / 返回

样式：极简，深浅色都支持，主色调 Tailwind 默认。

---

## 7. API 设计

| 路由 | 方法 | 入参 | 出参 |
|------|------|------|------|
| `/api/generate` | POST | `{}` | `{ weekKey, markdown }` |
| `/api/reports` | GET | - | `[{ weekKey, generatedAt }]` |
| `/api/reports/[weekKey]` | GET | - | `{ markdown }` |
| `/api/reports/[weekKey]` | DELETE | - | `{ ok: true }` |
| `/api/export/[weekKey]?format=pdf\|md` | GET | - | 文件流 |

---

## 8. 待决策点（需要你确认）

1. **PDF 导出方案**
   - A. `puppeteer`：渲染 HTML → PDF，质量高但安装包大（~300MB）
   - B. `@react-pdf/renderer`：纯 JS 生成，包小但样式控制弱
   - C. 暂时只做 Markdown，PDF 后续再说
   - **推荐**：先做 A（puppeteer），效果最好

2. **备忘录字段名**
   - macOS 备忘录的 AppleScript 接口返回的 body 是 HTML，要不要转 Markdown？
   - **推荐**：转 Markdown（用 `turndown` 库），喂给 AI 更干净

3. **AI 失败后是否保留原始数据**
   - 抓取成功但 AI 调用失败时，是回滚还是先存原始数据等用户重试？
   - **推荐**：在前端保留 raw 数据，只让用户点"重新生成"，不写文件

4. **环境变量**
   - `.env.local` 模板：
     ```
     ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
     ANTHROPIC_AUTH_TOKEN=sk-xxx
     ANTHROPIC_MODEL=MiniMax-M2.7-highspeed
     ```
   - GitHub token 走 `~/.github/config.json`，不放 `.env.local`

---

## 9. 实施阶段

### Phase 1：脚手架 + 基础设施
- [ ] `npm create next-app` 初始化项目
- [ ] 配置 Tailwind、TypeScript 严格模式
- [ ] 写 `lib/week.ts`、`lib/config.ts`
- [ ] 写 `.env.local.example` 和 `.gitignore`

### Phase 2：数据源
- [ ] `lib/sources/github.ts` + 单元测试
- [ ] `scripts/fetch-notes.applescript` + `lib/sources/notes.ts`
- [ ] 写一个临时 CLI 脚本验证两个数据源都能跑通

### Phase 3：AI 生成
- [ ] `lib/ai/minimax.ts`：Anthropic SDK 调 MiniMax
- [ ] Prompt 调优（用真实数据跑几次）

### Phase 4：存储 + API
- [ ] `lib/storage/reports.ts`
- [ ] 5 个 API Routes 全部实现

### Phase 5：UI
- [ ] 主页（生成按钮 + 历史列表）
- [ ] 详情页（Markdown 渲染）
- [ ] 导出按钮（先 .md，后 .pdf）

### Phase 6：打磨
- [ ] 错误处理 / loading 状态
- [ ] PDF 导出
- [ ] README

---

## 10. 风险与注意事项

- ⚠️ **AppleScript 权限**：首次运行需用户授权，需在 README 中说明
- ⚠️ **GitHub Search API 限流**：未认证 10 req/min，认证 30 req/min；本场景每周 1 次，没问题
- ⚠️ **Token 安全**：`~/.github/config.json` 已经在用户家目录之外的工程不会读到，但务必让用户撤销之前对话中暴露的 token
- ⚠️ **MiniMax 协议兼容性**：Anthropic SDK 走 MiniMax 时，部分高级特性（如 tool use）可能不支持，但本项目只用基础 messages 接口，应无问题
- ⚠️ **跨平台**：Windows / Linux 用户无法使用备忘录功能，需在 README 标注"仅 macOS"

---

## 11. 开始前最后确认

请你 review 后回复：
1. 项目结构和模块划分是否 OK？
2. §8 待决策点的推荐方案是否接受？（特别是 PDF 用 puppeteer）
3. 6 个 Phase 的拆分是否合理？是否需要调整顺序或合并？
4. 还有遗漏的需求或风险吗？

确认后我就按 Phase 1 开始动工。
