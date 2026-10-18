import 'fake-indexeddb/auto'
import { delMany, keys } from 'idb-keyval'
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPendingWrite, startAutosave } from '@/features/persistence/autosave'
import {
  corruptKey,
  DOC_KEY,
  FIRST_RUN_KEY,
  quarantineCorruptDoc,
  readValue,
  writeValue,
} from '@/features/persistence/idb'
import { createEmptyDoc, createSampleDoc, migrate } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { useSyncStore } from '@/store/syncStore'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout menunggu kondisi')
    await sleep(20)
  }
}

beforeEach(async () => {
  flushPendingWrite()
  await sleep(20)
  await delMany([DOC_KEY, FIRST_RUN_KEY])
  useSyncStore.getState().setStatus('saved-local')
  useDocStore.getState().loadDoc(createEmptyDoc())
})

describe('integration: IndexedDB (fake-indexeddb)', () => {
  it('tulis → baca ulang → migrate → data identik', async () => {
    const doc = createSampleDoc()
    await writeValue(DOC_KEY, doc)

    const raw = await readValue(DOC_KEY)
    const reloaded = migrate(raw)

    expect(reloaded).toEqual(doc)
    expect(reloaded.sections.map((section) => section.kind)).toEqual(
      doc.sections.map((section) => section.kind),
    )
  })

  it('flush memaksa tulis sekarang: status saving → saved-local, data masuk IDB', async () => {
    startAutosave()
    useDocStore.getState().setTitle('CV Pendingin')
    expect(useSyncStore.getState().status).toBe('saving')

    flushPendingWrite()
    await waitFor(() => useSyncStore.getState().status === 'saved-local')

    const stored = (await readValue(DOC_KEY)) as { title: string } | undefined
    expect(stored?.title).toBe('CV Pendingin')
  })

  it('tanpa flush, tulis tertunda lewat debounce lalu sampai', async () => {
    startAutosave()
    useDocStore.getState().setTitle('Tertunda')

    expect(useSyncStore.getState().status).toBe('saving')
    await sleep(120)
    expect(await readValue(DOC_KEY)).toBeUndefined()

    await sleep(600)
    const stored = (await readValue(DOC_KEY)) as { title: string } | undefined
    expect(stored?.title).toBe('Tertunda')
    expect(useSyncStore.getState().status).toBe('saved-local')
  })

  it('dokumen korup dikarantina ke ats:doc:corrupt:<timestamp>', async () => {
    await writeValue(DOC_KEY, 'bukan-dokumen')
    await quarantineCorruptDoc('bukan-dokumen')

    const allKeys = (await keys()) as string[]
    const corruptKeys = allKeys.filter(
      (key) => typeof key === 'string' && key.startsWith('ats:doc:corrupt:'),
    )
    expect(corruptKeys).toHaveLength(1)
    expect(await readValue(corruptKeys[0]!)).toBe('bukan-dokumen')
    expect(corruptKeys[0]).toBe(corruptKey(Number(corruptKeys[0]!.split(':').pop())))
  })
})
