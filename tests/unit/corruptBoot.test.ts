import 'fake-indexeddb/auto'
import { keys } from 'idb-keyval'
import { describe, expect, it, vi } from 'vitest'
import { id } from '@/dictionaries/id'
import { initPersistence } from '@/features/persistence/init'
import { DOC_KEY, writeValue } from '@/features/persistence/idb'
import { useDocStore } from '@/store/docStore'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: toastMock }))

describe('boot saat dokumen korup', () => {
  it('karantina salinan, muat dokumen contoh, tampilkan penjelasan — bukan layar kosong', async () => {
    await writeValue(DOC_KEY, 'isi-berkas-rusak-total')

    await initPersistence()

    const doc = useDocStore.getState().doc
    expect(doc.schemaVersion).toBe(1)

    const profile = doc.sections.find((section) => section.kind === 'profile')
    if (!profile || profile.kind !== 'profile') throw new Error('dokumen contoh tanpa profil')
    expect(profile.data.fullName).toBe('Alex Morgan')

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith(id['persist.corrupt.restored'])

    const allKeys = (await keys()) as string[]
    expect(allKeys.some((key) => String(key).startsWith('ats:doc:corrupt:'))).toBe(true)
    expect(allKeys).toContain(DOC_KEY)
  })
})
