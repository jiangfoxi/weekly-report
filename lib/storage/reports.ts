import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { GeneratedReport } from '../ai/minimax'
import type { GithubCommit } from '../sources/github'
import type { Note } from '../sources/notes'
import { formatDateRange, getWeekRangeByKey } from '../week'

const REPORTS_DIR = (process.env.REPORTS_DIR ?? '~/Desktop/weekly-reports')
  .replace(/^~/, process.env.HOME ?? '')

export type ReportMeta = {
  weekKey: string
  generatedAt: string
  commitsCount: number
  notesCount: number
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

function reportPath(weekKey: string): string {
  return path.join(REPORTS_DIR, `${weekKey}.md`)
}

export async function saveReport(
  weekKey: string,
  report: GeneratedReport,
  raw: { commits: GithubCommit[]; notes: Note[]; obsidianNotes: Note[] }
): Promise<string> {
  ensureReportsDir()

  const { start, end } = getWeekRangeByKey(weekKey)
  const dateRange = formatDateRange(start, end)
  const generatedAt = new Date().toISOString()

  const commitsRaw = raw.commits
    .map((c) => `- [${c.repo}] [${c.sha}](${c.url}) ${c.message} (${c.date.slice(0, 10)})`)
    .join('\n')

  const notesRaw = raw.notes
    .map((n) => `- 【${n.folder}】**${n.title}** (${n.modifiedAt.slice(0, 10)})\n  ${n.body.slice(0, 300)}`)
    .join('\n\n')

  const obsidianRaw = raw.obsidianNotes
    .map((n) => `- 【${n.folder}】**${n.title}** (${n.modifiedAt.slice(0, 10)})\n  ${n.body.slice(0, 300)}`)
    .join('\n\n')

  const markdown = matter.stringify(
    `# 周报 ${weekKey} (${dateRange})

## Obsidian 笔记摘要

${report.obsidianSummary}

## GitHub 工作记录

${report.githubSummary}

## 备忘录摘要

${report.notesSummary}

## 本周总体总结

${report.overallSummary}

---

<details>
<summary>原始数据</summary>

### Commits (${raw.commits.length} 条)

${commitsRaw || '无'}

### 备忘录 (${raw.notes.length} 条)

${notesRaw || '无'}

### Obsidian (${raw.obsidianNotes.length} 条)

${obsidianRaw || '无'}

</details>`,
    {
      weekKey,
      generatedAt,
      commitsCount: raw.commits.length,
      notesCount: raw.notes.length,
      obsidianCount: raw.obsidianNotes.length,
    }
  )

  fs.writeFileSync(reportPath(weekKey), markdown, 'utf-8')
  return markdown
}

export async function listReports(): Promise<ReportMeta[]> {
  ensureReportsDir()

  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.md'))

  const metas = files.map((file) => {
    const content = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8')
    const { data } = matter(content)
    return {
      weekKey: data.weekKey as string,
      generatedAt: data.generatedAt as string,
      commitsCount: data.commitsCount as number,
      notesCount: data.notesCount as number,
    }
  })

  return metas.sort((a, b) => b.weekKey.localeCompare(a.weekKey))
}

export async function readReport(weekKey: string): Promise<string> {
  const filePath = reportPath(weekKey)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Report ${weekKey} not found`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

export async function deleteReport(weekKey: string): Promise<void> {
  const filePath = reportPath(weekKey)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Report ${weekKey} not found`)
  }
  fs.unlinkSync(filePath)
}
