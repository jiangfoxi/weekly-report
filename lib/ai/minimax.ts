import Anthropic from '@anthropic-ai/sdk'
import type { GithubCommit } from '../sources/github'
import type { Note } from '../sources/notes'

export type GenerateInput = {
  weekKey: string
  commits: GithubCommit[]
  notes: Note[]
  obsidianNotes: Note[]
}

export type GeneratedReport = {
  githubSummary: string
  notesSummary: string
  obsidianSummary: string
  overallSummary: string
}

export async function generateReport(input: GenerateInput): Promise<GeneratedReport> {
  const client = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  })

  const model = process.env.ANTHROPIC_MODEL ?? 'MiniMax-M2.7-highspeed'

  const commitsText = input.commits.length === 0
    ? '本周无 commits'
    : input.commits.map((c) => `- [${c.repo}] ${c.message} (${c.sha})`).join('\n')

  const notesText = input.notes.length === 0
    ? '本周无备忘录笔记'
    : input.notes.map((n) => `- 【${n.folder}】${n.title}: ${n.body.slice(0, 200)}`).join('\n')

  const obsidianText = input.obsidianNotes.length === 0
    ? '本周无 Obsidian 笔记'
    : input.obsidianNotes.map((n) => `- 【${n.folder}】${n.title}: ${n.body.slice(0, 200)}`).join('\n')

  const prompt = `你是一个周报助手。基于以下数据生成本周（${input.weekKey}）的工作总结。

【GitHub Commits】
${commitsText}

【备忘录笔记】
${notesText}

【Obsidian 笔记】
${obsidianText}

请输出四段，使用 JSON 格式：
{
  "githubSummary": "...",
  "notesSummary": "...",
  "obsidianSummary": "...",
  "overallSummary": "..."
}

要求：
- 每段 3-5 条要点，使用编号列表格式（1. 2. 3. 开头），每条单独一行
- 中文，简洁
- 总结要提炼主线，不是简单罗列
- 只输出 JSON，不要有其他内容`

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`AI response did not contain valid JSON: ${text.slice(0, 300)}`)
  }

  const result = JSON.parse(jsonMatch[0]) as GeneratedReport

  if (!result.githubSummary || !result.notesSummary || !result.obsidianSummary || !result.overallSummary) {
    throw new Error('AI response missing required fields')
  }

  return result
}
