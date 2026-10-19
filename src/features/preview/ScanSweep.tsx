/**
 * §5.5 — satu sapuan garis scan ke bawah lembar A4 saat Check ATS dijalankan.
 * Dipakai sekali lalu hilang; `pointer-events-none` agar tidak menangkap klik.
 */
export function ScanSweep() {
  return (
    <div
      aria-hidden="true"
      data-probe="scan-sweep"
      className="ats-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-full"
    >
      <div className="from-accent/0 via-accent to-accent/0 absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b" />
      <div className="bg-accent absolute inset-x-0 top-0 h-0.5" />
    </div>
  )
}
