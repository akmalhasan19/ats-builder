import { memo } from 'react'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** §5.5 — stabilo di atas kertas; satu-satunya warna hangat di antarmuka. */
export const KeywordMark = memo(function KeywordMark({ children }: { children: string }) {
  return (
    <mark className="rounded-mark bg-highlighter-wash px-px [box-decoration-break:clone]">
      {children}
    </mark>
  )
})

function splitByKeywords(
  text: string,
  keywords: readonly string[],
): (string | { keyword: string })[] {
  if (keywords.length === 0 || text === '') return [text]
  const lowered = keywords.map((keyword) => keyword.toLowerCase()).filter(Boolean)
  if (lowered.length === 0) return [text]
  const pattern = new RegExp(`(${lowered.map(escapeRegExp).join('|')})`, 'gi')
  return text
    .split(pattern)
    .map((part) => (lowered.includes(part.toLowerCase()) ? { keyword: part } : part))
}

export const MarkedText = memo(function MarkedText({
  text,
  keywords,
  showMarks,
}: {
  text: string
  keywords: readonly string[]
  showMarks: boolean
}) {
  if (!showMarks || keywords.length === 0) return <>{text}</>
  return (
    <>
      {splitByKeywords(text, keywords).map((part, index) =>
        typeof part === 'string' ? (
          <span key={index}>{part}</span>
        ) : (
          <KeywordMark key={index}>{part.keyword}</KeywordMark>
        ),
      )}
    </>
  )
})
