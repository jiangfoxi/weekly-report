import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '周报生成器',
  description: '自动从 Obsidian、GitHub 和备忘录生成每周工作报告',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </body>
    </html>
  )
}
