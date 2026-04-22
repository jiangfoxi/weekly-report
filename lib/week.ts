export type WeekRange = {
  start: Date
  end: Date
  weekKey: string
}

export function getCurrentWeekRange(): WeekRange {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const start = new Date(now)
  start.setDate(now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  const weekKey = formatWeekKey(start)
  return { start, end, weekKey }
}

export function getWeekRangeFromDates(startDate: string, endDate: string): WeekRange {
  // Parse YYYY-MM-DD as local time to avoid UTC offset shifting the date
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
  const end = new Date(ey, em - 1, ed, 23, 59, 59, 999)
  const weekKey = formatWeekKey(start)
  return { start, end, weekKey }
}

export function getWeekRangeByKey(weekKey: string): WeekRange {
  const [year, week] = weekKey.split('-W').map(Number)
  const start = isoWeekToDate(year, week)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end, weekKey }
}

function formatWeekKey(monday: Date): string {
  const year = monday.getFullYear()
  const week = getISOWeek(monday)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isoWeekToDate(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (week - 1) * 7)
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0)
}

export function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日`
  return `${fmt(start)} - ${fmt(end)}`
}

export function formatCompactDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(start)}-${fmt(end)}`
}
