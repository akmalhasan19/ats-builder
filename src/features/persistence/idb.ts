import { get, set } from 'idb-keyval'

export const DOC_KEY = 'ats:doc:v1'
export const PREFS_KEY = 'ats:prefs:v1'
export const FIRST_RUN_KEY = 'ats:firstRun'

export const corruptKey = (timestamp: number): string => `ats:doc:corrupt:${timestamp}`

export async function readValue<T>(key: string): Promise<T | undefined> {
  return get(key) as Promise<T | undefined>
}

export async function writeValue(key: string, value: unknown): Promise<void> {
  await set(key, value)
}

export async function quarantineCorruptDoc(raw: unknown): Promise<void> {
  await set(corruptKey(Date.now()), raw)
}
