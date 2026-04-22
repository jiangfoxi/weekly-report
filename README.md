# 周报生成器

自动从 Obsidian、GitHub 和苹果备忘录抓取本周工作内容，调用 AI 生成结构化周报，支持 Markdown 归档与导出。

> 仅支持 macOS（备忘录依赖 AppleScript）

## 功能

- 一键生成本周（周一～周日）工作周报
- 三路数据源并行抓取：Obsidian 笔记 / GitHub commits / 苹果备忘录
- AI 提炼要点，编号列表格式输出
- 支持自定义日期范围重新生成
- 周报本地存储为 Markdown 文件，支持复制 / 下载 / PDF 导出 / 删除

## 技术栈

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Anthropic SDK（接 MiniMax 兼容协议）
- Octokit（GitHub API）
- AppleScript（苹果备忘录）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_AUTH_TOKEN=sk-xxx
ANTHROPIC_MODEL=MiniMax-M2.7-highspeed

# Obsidian vault 目录（可选）
OBSIDIAN_VAULT_PATH=~/Documents/Obsidian/MyVault

# 周报存储目录（默认 ~/Desktop/weekly-reports）
REPORTS_DIR=~/Desktop/weekly-reports
```

### 3. 配置 GitHub Token

在 `~/.github/config.json` 中填写：

```json
{
  "token": "ghp_xxx",
  "githubBaseUrl": "https://api.github.com"
}
```

Token 需要 `repo` 权限，在 [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) 创建。

### 4. 授权苹果备忘录（首次使用）

首次运行时，macOS 会弹出授权对话框，需在**系统设置 → 隐私与安全 → 自动化**中允许终端访问备忘录。

### 5. 启动

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 周报结构

每份周报包含四个章节，按以下优先级排列：

1. **Obsidian 笔记摘要** — 本周修改的 vault 文件提炼
2. **GitHub 工作记录** — 本周 commits 汇总
3. **备忘录摘要** — 苹果备忘录本周修改内容
4. **本周总体总结** — AI 综合三路数据提炼主线

原始数据以折叠形式附在报告末尾。

## 项目结构

```
app/
├── api/
│   ├── generate/       # POST 触发生成
│   ├── reports/        # GET 列表 / GET 单篇 / DELETE
│   └── export/         # 下载 .md / .pdf
├── reports/[slug]/     # 周报详情页
lib/
├── sources/
│   ├── github.ts       # GitHub commits 抓取
│   ├── notes.ts        # 苹果备忘录抓取
│   └── obsidian.ts     # Obsidian vault 读取
├── ai/minimax.ts       # AI 调用封装
├── storage/reports.ts  # 本地 Markdown 读写
└── week.ts             # 周时间范围工具
scripts/
└── fetch-notes.applescript
```
