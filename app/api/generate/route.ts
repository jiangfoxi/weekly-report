import { NextRequest, NextResponse } from 'next/server'
import { getCurrentWeekRange, getWeekRangeFromDates } from '@/lib/week'
import { fetchWeekCommits } from '@/lib/sources/github'
import { fetchWeekNotes, type Note } from '@/lib/sources/notes'
import { fetchObsidianNotes } from '@/lib/sources/obsidian'
import { generateReport } from '@/lib/ai/minimax'
import { saveReport } from '@/lib/storage/reports'

export async function POST(req: NextRequest) {
  try {
    let range: ReturnType<typeof getCurrentWeekRange>

    const body = await req.json().catch(() => ({})) as { startDate?: string; endDate?: string }

    if (body.startDate && body.endDate) {
      range = getWeekRangeFromDates(body.startDate, body.endDate)
    } else {
      range = getCurrentWeekRange()
    }

    const { start, end, weekKey } = range

    const [commits, notes, obsidianNotes] = await Promise.all([
      fetchWeekCommits(start, end),
      fetchWeekNotes(start, end).catch((): Note[] => []),
      fetchObsidianNotes(start, end).catch((): Note[] => []),
    ])

    const report = await generateReport({ weekKey, commits, notes, obsidianNotes })
    const markdown = await saveReport(weekKey, report, { commits, notes, obsidianNotes })

    return NextResponse.json({ weekKey, markdown })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
