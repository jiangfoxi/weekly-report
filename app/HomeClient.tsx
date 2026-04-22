'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReportMeta } from '@/lib/storage/reports'

type Step = 'idle' | 'fetching-github' | 'fetching-notes' | 'generating' | 'saving' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  'fetching-github': '抓取 GitHub commits...',
  'fetching-notes': '读取备忘录笔记...',
  generating: 'AI 生成周报...',
  saving: '保存报告...',
  done: '完成！',
  error: '生成失败',
}

function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getLastWeekRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + diffToMonday)
  thisMonday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)

  return { startDate: toDateInput(lastMonday), endDate: toDateInput(lastSunday) }
}

export default function HomeClient({ initialReports }: { initialReports: ReportMeta[] }) {
  const router = useRouter()
  const [reports, setReports] = useState<ReportMeta[]>(initialReports)
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const lastWeek = getLastWeekRange()
  const [startDate, setStartDate] = useState(lastWeek.startDate)
  const [endDate, setEndDate] = useState(lastWeek.endDate)

  async function handleGenerate(useCustomRange: boolean) {
    setStep('fetching-github')
    setErrorMsg('')

    try {
      setStep('fetching-notes')
      await new Promise((r) => setTimeout(r, 300))
      setStep('generating')

      const body = useCustomRange
        ? { startDate, endDate }
        : {}

      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await resp.json()) as { weekKey?: string; error?: string }

      if (!resp.ok || data.error) {
        throw new Error(data.error ?? 'Unknown error')
      }

      setStep('saving')
      await new Promise((r) => setTimeout(r, 200))
      setStep('done')

      const listResp = await fetch('/api/reports')
      const updated = (await listResp.json()) as ReportMeta[]
      setReports(updated)

      if (data.weekKey) {
        router.push(`/reports/${data.weekKey}`)
      }
    } catch (err) {
      setStep('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDelete(weekKey: string) {
    if (!confirm(`确认删除 ${weekKey} 的周报？`)) return
    await fetch(`/api/reports/${weekKey}`, { method: 'DELETE' })
    setReports((prev) => prev.filter((r) => r.weekKey !== weekKey))
  }

  const isGenerating = step !== 'idle' && step !== 'done' && step !== 'error'

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">周报生成器</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          自动从 Obsidian、GitHub 和苹果备忘录生成每周工作报告
        </p>
      </header>

      <div className="mb-10 space-y-4">
        {/* 本周 */}
        <div>
          <button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
          >
            {isGenerating ? '生成中...' : '生成本周周报'}
          </button>
        </div>

        {/* 自定义日期范围 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">自定义：</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isGenerating}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 disabled:opacity-50"
          />
          <span className="text-sm text-gray-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isGenerating}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 disabled:opacity-50"
          />
          <button
            onClick={() => { setStartDate(lastWeek.startDate); setEndDate(lastWeek.endDate) }}
            disabled={isGenerating}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            上一周
          </button>
          <button
            onClick={() => handleGenerate(true)}
            disabled={isGenerating || !startDate || !endDate}
            className="px-5 py-2 text-sm bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            生成
          </button>
        </div>

        {/* 进度 / 错误 */}
        {step !== 'idle' && (
          <div className="flex items-center gap-3">
            {isGenerating && (
              <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span
              className={
                step === 'error'
                  ? 'text-red-600 dark:text-red-400 text-sm'
                  : step === 'done'
                  ? 'text-green-600 dark:text-green-400 text-sm'
                  : 'text-gray-600 dark:text-gray-400 text-sm'
              }
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        )}

        {step === 'error' && errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">历史周报</h2>

        {reports.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm">还没有生成过周报</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li
                key={r.weekKey}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div>
                  <span className="font-medium">{r.displayKey}</span>
                  <span className="ml-3 text-xs text-gray-400">
                    {new Date(r.generatedAt).toLocaleString('zh-CN')}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {r.commitsCount} commits · {r.notesCount} 笔记
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/reports/${r.weekKey}`}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    查看
                  </Link>
                  <a
                    href={`/api/export/${r.weekKey}?format=pdf`}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    PDF
                  </a>
                  <button
                    onClick={() => handleDelete(r.weekKey)}
                    className="px-3 py-1 text-sm bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
