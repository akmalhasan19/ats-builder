import { describe, expect, it } from 'vitest'
import { scrollToFirstInvalidField } from '@/features/editor/scrollToFirstInvalidField'

describe('scrollToFirstInvalidField (T3.7)', () => {
  it('mengembalikan null dan tidak melakukan apa pun bila tidak ada field invalid', () => {
    document.body.innerHTML = '<div id="pane"><input id="a" /></div>'
    expect(scrollToFirstInvalidField(document.body)).toBeNull()
  })

  it('mengembalikan field aria-invalid pertama supaya export bisa menggulir ke sana', () => {
    document.body.innerHTML =
      '<div id="pane"><input id="ok" /><input id="bad" aria-invalid="true" /></div>'
    const bad = document.getElementById('bad')
    const scrolled: string[] = []
    if (bad) {
      bad.scrollIntoView = (() => {
        scrolled.push('yes')
      }) as unknown as typeof bad.scrollIntoView
    }
    const result = scrollToFirstInvalidField(document.body)
    expect(result?.id).toBe('bad')
    expect(document.activeElement?.id).toBe('bad')
    expect(scrolled).toEqual(['yes'])
  })
})
