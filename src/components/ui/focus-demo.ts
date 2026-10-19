/**
 * `/dev/tokens` harus memperlihatkan state fokus tanpa memaksa pengguna menekan
 * Tab pada elemen tertentu. Atribut ini memakai cincin fokus yang sama dengan
 * `:focus-visible`, bukan menduplikasi nilai warna.
 */
export const demoFocusRing =
  'data-[demo-focus=true]:outline data-[demo-focus=true]:outline-2 data-[demo-focus=true]:outline-offset-2 data-[demo-focus=true]:outline-accent-ink'
