import { listReports } from '@/lib/storage/reports'
import HomeClient from './HomeClient'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let reports: Awaited<ReturnType<typeof listReports>> = []
  try {
    reports = await listReports()
  } catch {
    // reports dir may not exist yet
  }

  return <HomeClient initialReports={reports} />
}
