/** `DIPERIKSA 14.32` — jam & menit lokal, bukan timestamp ISO. */
export const clockLabel = (at: number): string => {
  const date = new Date(at)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}.${pad(date.getMinutes())}`
}
