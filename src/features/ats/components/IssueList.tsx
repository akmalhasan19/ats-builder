import { useState } from 'react'
import { AlertOctagon, AlertTriangle, Check, ChevronRight, Info } from 'lucide-react'
import { cn } from 'cn'
import { t } from '@/lib/i18n'
import type { AtsIssue, AtsSeverity, AtsTarget } from '../types'

/**
 * §5.6 — isu terkelompok: Wajib diperbaiki → Sebaiknya → Sudah baik. `info`
 * digabung ke kelompok Sebaiknya karena sama-sama advisori.
 */

const GROUPS: readonly {
  id: string
  labelId: 'ats.group.bad' | 'ats.group.warn' | 'ats.group.ok'
  severities: readonly AtsSeverity[]
  open: boolean
}[] = [
  { id: 'bad', labelId: 'ats.group.bad', severities: ['bad'], open: true },
  { id: 'warn', labelId: 'ats.group.warn', severities: ['warn', 'info'], open: true },
  { id: 'ok', labelId: 'ats.group.ok', severities: ['ok'], open: false },
]

const GLYPH: Record<AtsSeverity, { icon: typeof Check; wash: string; color: string }> = {
  bad: { icon: AlertOctagon, wash: 'bg-bad-wash', color: 'text-signal-bad' },
  warn: { icon: AlertTriangle, wash: 'bg-warn-wash', color: 'text-signal-warn' },
  info: { icon: Info, wash: 'bg-accent-wash', color: 'text-accent-ink' },
  ok: { icon: Check, wash: 'bg-ok-wash', color: 'text-signal-ok' },
}

export type IssueListProps = {
  issues: readonly AtsIssue[]
  onFix: (target: AtsTarget | undefined) => void
}

export function IssueList({ issues, onFix }: IssueListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.filter((group) => !group.open).map((group) => [group.id, true])),
  )

  return (
    <div data-probe="ats-issues">
      {GROUPS.map((group) => {
        const items = issues.filter((issue) => group.severities.includes(issue.severity))
        if (items.length === 0) return null
        const isCollapsed = collapsed[group.id] === true
        return (
          <section key={group.id} data-probe={`ats-group-${group.id}`}>
            <h3>
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [group.id]: prev[group.id] !== true }))
                }
                className="hover:bg-hover flex w-full items-center gap-1.5 px-4 py-2 text-left"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    'text-ink-tertiary size-3.5 transition-transform duration-[var(--dur-fast)]',
                    !isCollapsed && 'rotate-90',
                  )}
                />
                <span className="text-button-strong text-ink">{t(group.labelId)}</span>
                <span className="text-data text-ink-tertiary">
                  {t('ats.group.count', { count: items.length })}
                </span>
              </button>
            </h3>

            {isCollapsed ? null : (
              <ul className="list-none">
                {items.map((issue) => {
                  const glyph = GLYPH[issue.severity]
                  const Icon = glyph.icon
                  return (
                    <li
                      key={issue.id}
                      data-probe="ats-issue"
                      data-issue-id={issue.id}
                      className="border-rule flex gap-2.5 border-b px-4 py-3"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded',
                          glyph.wash,
                          glyph.color,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-rail-label text-ink font-semibold">
                          {t(issue.titleId, issue.params)}
                        </p>
                        <p className="text-caption text-ink-secondary mt-0.5">
                          {t(issue.detailId, issue.params)}
                        </p>
                        {issue.target ? (
                          <button
                            type="button"
                            data-probe="ats-fix"
                            onClick={() => onFix(issue.target)}
                            className="text-caption text-accent-ink hover:bg-accent-wash mt-1.5 inline-flex rounded px-1 py-0.5 font-semibold"
                          >
                            {t('ats.fix')}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
