import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Note } from './notes'

function walkDir(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(full, results)
    } else if (entry.name.endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}

export async function fetchObsidianNotes(start: Date, end: Date): Promise<Note[]> {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH
  if (!vaultPath) return []

  const resolved = vaultPath.replace(/^~/, process.env.HOME ?? '')
  if (!fs.existsSync(resolved)) return []

  const files = walkDir(resolved)
  const notes: Note[] = []

  for (const filePath of files) {
    const stat = fs.statSync(filePath)
    if (stat.mtimeMs < start.getTime() || stat.mtimeMs > end.getTime()) continue

    const raw = fs.readFileSync(filePath, 'utf-8')
    const { content, data } = matter(raw)

    const rel = path.relative(resolved, filePath)
    const folder = path.dirname(rel) === '.' ? 'root' : path.dirname(rel)
    const title = (data.title as string | undefined) ?? path.basename(filePath, '.md')
    const modifiedAt = stat.mtime.toISOString()

    notes.push({ title, body: content.trim(), modifiedAt, folder })
  }

  return notes
}
