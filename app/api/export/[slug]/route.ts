import { NextRequest, NextResponse } from 'next/server'
import { readReport } from '@/lib/storage/reports'
import matter from 'gray-matter'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params
    const format = req.nextUrl.searchParams.get('format') ?? 'md'
    const rawMarkdown = await readReport(slug)

    if (format === 'md') {
      return new Response(rawMarkdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}.md"`,
        },
      })
    }

    if (format === 'pdf') {
      const { content } = matter(rawMarkdown)
      const pdf = await renderPdf(slug, content)
      return new Response(pdf as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${slug}.pdf"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format. Use ?format=md or ?format=pdf' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function renderPdf(weekKey: string, markdown: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.default.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const html = await buildHtml(weekKey, markdown)
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      printBackground: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

async function buildHtml(weekKey: string, markdown: string): Promise<string> {
  const { marked } = await import('marked')
  const body = await marked(markdown, { gfm: true })

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>周报 ${weekKey}</title>
<style>
  body { font-family: -apple-system, 'PingFang SC', sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; }
  h2 { font-size: 1.3em; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 1.1em; color: #555; margin-top: 16px; }
  ol, ul { padding-left: 1.5em; }
  li { margin: 4px 0; }
  strong { font-weight: 600; }
  a { color: #0070f3; text-decoration: none; }
  hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  details summary { cursor: pointer; color: #888; font-size: 0.9em; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 0.85em; }
  code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  p { margin: 6px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`
}
