/* Profiling sementara Fase 8 — long tasks, layout shift, FCP/LCP pada build produksi.
 * Jalankan: node scripts/profile-perf.mjs (butuh `vite preview --port 4199`). */
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4199'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1350, height: 940 } })
const page = await context.newPage()

await page.addInitScript(() => {
  window.__longTasks = []
  window.__shifts = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__longTasks.push({
        start: Math.round(entry.startTime),
        dur: Math.round(entry.duration),
      })
    }
  }).observe({ entryTypes: ['longtask'] })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue
      const sources = (entry.sources ?? []).map((s) => {
        const node = s.node
        const tag = node
          ? `${node.nodeType === 1 ? node.tagName.toLowerCase() : node.nodeName}${node.id ? '#' + node.id : ''}${node.className && typeof node.className === 'string' ? '.' + node.className.split(' ').slice(0, 3).join('.') : ''}`
          : '(null)'
        return { tag, prev: s.previousRect, curr: s.currentRect }
      })
      window.__shifts.push({ time: Math.round(entry.startTime), value: entry.value, sources })
    }
  }).observe({ entryTypes: ['layout-shift'] })
})

await page.goto(`${BASE}/`, { waitUntil: 'load' })
await page.waitForTimeout(3500)

const data = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paint = performance.getEntriesByType('paint')
  const lcp = performance.getEntriesByType('largest-contentful-paint').at(-1)
  const tasks = window.__longTasks ?? []
  tasks.sort((a, b) => b.dur - a.dur)
  const shifts = window.__shifts ?? []
  return {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
    fcp: Math.round(paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? -1),
    lcp: lcp
      ? {
          time: Math.round(lcp.startTime),
          size: lcp.size,
          url: lcp.url || '(element)',
          id: lcp.id,
          cls: lcp.element?.outerHTML?.slice(0, 120),
        }
      : null,
    clsTotal: Math.round(shifts.reduce((acc, s) => acc + s.value, 0) * 10000) / 10000,
    shifts: shifts.slice(0, 8),
    taskCount: tasks.length,
    taskTotalMs: tasks.reduce((acc, t) => acc + t.dur, 0),
    topTasks: tasks.slice(0, 12),
  }
})
console.log(JSON.stringify(data, null, 2))
writeFileSync('artifacts/fase8-profile.json', JSON.stringify(data, null, 2))
await browser.close()
