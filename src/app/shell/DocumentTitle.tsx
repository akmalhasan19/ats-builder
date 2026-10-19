import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useDocStore } from '@/store/docStore'
import { t } from '@/lib/i18n'

/** §5.2 — Enter simpan, Esc batal, blur simpan; kosong → revert + toast. */
export function DocumentTitle() {
  const title = useDocStore((state) => state.doc.title)
  const setTitle = useDocStore((state) => state.setTitle)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const display = title.trim() === '' ? t('doc.untitled') : title

  const startEditing = () => {
    setDraft(title)
    setEditing(true)
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    if (next === '') {
      toast(t('topbar.titleEmpty'))
    } else {
      setTitle(next)
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(title)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={t('topbar.titleLabel')}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
        className="text-input border-accent-ink focus-visible:shadow-focus h-8 w-full min-w-0 max-w-[240px] border-0 border-b bg-transparent px-0 outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={t('topbar.titleEdit')}
      className="group hover:bg-hover text-input flex h-8 min-w-0 max-w-[240px] items-center gap-1.5 rounded-md px-1.5"
    >
      <span className="truncate">{display}</span>
      <Pencil
        aria-hidden="true"
        className="text-ink-tertiary group-hover:text-accent-ink size-3 shrink-0 opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <span className="sr-only">{t('topbar.titleEdit')}</span>
    </button>
  )
}
