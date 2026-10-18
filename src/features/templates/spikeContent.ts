export type SpikeEntry = {
  title: string
  org: string
  location: string
  dateLabel: string
  bullets: string[]
}

export type SpikeSection = {
  heading: string
  entries: SpikeEntry[]
}

export type SpikeContent = {
  name: string
  headline: string
  contact: string[]
  sections: SpikeSection[]
}

export type SpikeRenderOptions = {
  /** Menguji prop `fixed` @react-pdf: header berulang di tiap halaman. */
  repeatHeader: boolean
}

export const defaultRenderOptions: SpikeRenderOptions = { repeatHeader: false }

const ENTRY: SpikeEntry = {
  title: 'Software Engineer',
  org: 'Tech Nusantara Corp',
  location: 'Jakarta',
  dateLabel: 'Mar 2022 – Sekarang',
  bullets: [
    'Membangun 12 microservice Go yang melayani 40 juta request per hari dengan uptime 99,98%.',
    'Memangkas latensi API pencarian dari 820 ms menjadi 210 ms lewat index komposit dan cache Redis.',
    'Membimbing 4 engineer junior; tiga di antaranya memimpin modul produksi dalam enam bulan.',
  ],
}

export const spikeContent: SpikeContent = {
  name: 'Alex Morgan',
  headline: 'Software Engineer',
  contact: [
    'alex@mail.com',
    '+62 812 3456 7890',
    'Jakarta, Indonesia',
    'linkedin.com/in/alexmorgan',
  ],
  sections: [{ heading: 'Experience', entries: [ENTRY] }],
}

/** 60 bullet → memaksa wrap & page-break otomatis (T0.4). */
export const makeLongSpikeContent = (bulletCount: number): SpikeContent => {
  const bullets = Array.from({ length: bulletCount }, (_, i) => {
    const n = i + 1
    return `Bullet ${String(n).padStart(2, '0')} — menurunkan biaya infrastruktur ${n}% dengan memindahkan beban kerja batch ke spot instance dan menambahkan antrian berbasis prioritas.`
  })
  return {
    ...spikeContent,
    sections: [{ heading: 'Experience', entries: [{ ...ENTRY, bullets }] }],
  }
}
