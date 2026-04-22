import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import TurndownService from 'turndown'

const execAsync = promisify(exec)
const turndown = new TurndownService()

export type Note = {
  title: string
  body: string
  modifiedAt: string
  folder: string
}

export async function fetchWeekNotes(start: Date, end: Date): Promise<Note[]> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch-notes.applescript')

  // How many days back to ask AppleScript to pre-filter (add 7-day buffer)
  const daysBack = Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)) + 7

  let stdout: string
  try {
    const result = await execAsync(`osascript "${scriptPath}" ${daysBack}`, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    })
    stdout = result.stdout
  } catch (err) {
    const error = err as { stderr?: string; message?: string }
    if (error.stderr?.includes('not allowed')) {
      throw new Error(
        'Apple Notes access denied. Please grant Terminal/Node automation permission in ' +
        'System Settings → Privacy & Security → Automation.'
      )
    }
    throw new Error(`Failed to fetch Apple Notes: ${error.message}`)
  }

  const FIELD_SEP = '\x1c'
  const REC_SEP = '\x1e'

  const notes: Note[] = []

  const records = stdout.split(REC_SEP).filter((r) => r.trim())
  for (const record of records) {
    const parts = record.split(FIELD_SEP)
    if (parts.length < 3) continue

    const [title, rawBody, modifiedAt, folder = ''] = parts

    const modTime = new Date(modifiedAt).getTime()
    if (modTime < start.getTime() || modTime > end.getTime()) continue

    let body = ''
    try {
      body = turndown.turndown(rawBody.trim())
    } catch {
      body = rawBody.replace(/<[^>]+>/g, '').trim()
    }

    notes.push({ title: title.trim(), body, modifiedAt, folder: folder.trim() })
  }

  return notes
}
