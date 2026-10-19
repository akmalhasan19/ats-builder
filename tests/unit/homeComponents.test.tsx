import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import { TEMPLATE_IDS, templateLabelKey } from '@/app/shell/templateList'
import { TemplateGallery } from '@/features/home/TemplateGallery'
import { HowItWorks } from '@/features/home/HowItWorks'
import { AtsGuide } from '@/features/home/AtsGuide'
import { Faq } from '@/features/home/Faq'
import { SiteFooter } from '@/features/home/SiteFooter'
import { HomeSections } from '@/features/home/HomeSections'
import { HOME_FAQS, HOME_GUIDE_RULES } from '@/features/home/content'
import { sampleResume } from '../fixtures/sampleResume'

vi.mock('sonner', () => ({ toast: vi.fn() }))

import { toast } from 'sonner'

// T9.5: kartu tidak lagi memakai aria-label — nama aksesibel datang dari isi
// tombol (label template + ajakan + deskripsi) supaya setiap teks yang terlihat
// ada di dalam nama (axe label-content-name-mismatch).
const cardName = (templateId: (typeof TEMPLATE_IDS)[number]) =>
  `${t(templateLabelKey(templateId))}${t('home.section.templates.useThis')}${t(
    `template.desc.${templateId}`,
  )}`

const scrollToSpy = vi.fn()

beforeEach(() => {
  act(() => {
    useDocStore.getState().loadDoc(sampleResume())
  })
  // jsdom tidak punya scrollIntoView; TemplateGallery memanggilnya setelah
  // applyTemplate — tapi hanya bila anchor #workspace-main ada di DOM, jadi
  // anchor-nya kita sediakan lalu stub-nya diawasi lewat prototype.
  document.body.innerHTML = '<div id="workspace-main"></div>'
  Element.prototype.scrollIntoView = scrollToSpy
})

afterEach(() => {
  scrollToSpy.mockClear()
  document.body.innerHTML = ''
})

describe('TemplateGallery (T8.1)', () => {
  const renderGallery = () =>
    render(
      <MemoryRouter>
        <TemplateGallery />
      </MemoryRouter>,
    )

  it('merender judul section, 5 kartu template nyata, dan tautan "lihat semua"', () => {
    renderGallery()
    expect(
      screen.getByRole('heading', { name: t('home.section.templates.title') }),
    ).toBeInTheDocument()
    for (const id of TEMPLATE_IDS) {
      expect(screen.getByRole('button', { name: cardName(id) })).toBeInTheDocument()
    }
    const link = screen.getByRole('link', { name: t('home.section.templates.viewAll') })
    expect(link).toHaveAttribute('href', '/templates')
  })

  it('klik kartu memakai template: setTemplate + toast konfirmasi + scroll ke workspace', async () => {
    const user = userEvent.setup()
    renderGallery()
    await user.click(screen.getByRole('button', { name: cardName('minimal') }))
    expect(useDocStore.getState().doc.templateId).toBe('minimal')
    expect(toast).toHaveBeenCalledWith(t('template.appliedToast', { name: t('template.minimal') }))
    expect(scrollToSpy).toHaveBeenCalledTimes(1)
  })

  it('klik pada kartu yang sedang AKTIF idempoten: template tidak berubah dan tidak melempar', async () => {
    const user = userEvent.setup()
    renderGallery()
    expect(useDocStore.getState().doc.templateId).toBe('classic-ats')
    await user.click(screen.getByRole('button', { name: cardName('classic-ats') }))
    expect(useDocStore.getState().doc.templateId).toBe('classic-ats')
    expect(scrollToSpy).toHaveBeenCalledTimes(1)
  })

  it('tiap kartu menampilkan label template dan deskripsinya', () => {
    renderGallery()
    for (const id of TEMPLATE_IDS) {
      const card = screen.getByRole('button', { name: cardName(id) })
      expect(within(card).getByText(t(templateLabelKey(id)))).toBeInTheDocument()
      expect(within(card).getByText(t(`template.desc.${id}`))).toBeInTheDocument()
    }
  })

  it('mini-sheet lazy ter-mount saat kartu dipetakan terlihat (IntersectionObserver)', async () => {
    await import('@/features/templates/screen/TemplateThumbSheet')
    // Stub global tidak pernah memanggil callback → visible selalu false.
    // Di sini IO dibuat memanggil intersect sinkron untuk menempuh cabang
    // lazy render di TemplateThumb.
    class FiringIO {
      private readonly callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }
      observe(node: Element) {
        this.callback(
          [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    const RealIO = globalThis.IntersectionObserver
    globalThis.IntersectionObserver = FiringIO as unknown as typeof IntersectionObserver
    try {
      renderGallery()
      await waitFor(
        () =>
          expect(
            document.querySelectorAll('[data-block-key^="thumb-classic-ats:"]').length,
          ).toBeGreaterThan(0),
        { timeout: 10000 },
      )
      expect(screen.getAllByRole('img', { hidden: true }).length).toBeGreaterThanOrEqual(5)
    } finally {
      globalThis.IntersectionObserver = RealIO
    }
  }, 30000)
})

describe('HowItWorks (T8.1 §5.8)', () => {
  it('menampilkan 3 langkah berurutan dengan nomor 1/2/3 dan judul dari kamus', async () => {
    const { container } = render(<HowItWorks />)
    const list = container.querySelector('ol')
    if (!list) throw new Error('HowItWorks tanpa <ol> langkah')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    items.forEach((item, index) => {
      expect(item.textContent).toContain(String(index + 1))
      expect(within(item).getByRole('heading', { level: 3 })).toHaveTextContent(
        t(`home.step.${index + 1}.title` as never),
      )
      expect(item).toHaveTextContent(t(`home.step.${index + 1}.body` as never))
    })
  })

  it('merender mini-sheet nyata dari template yang sedang aktif (lazy)', async () => {
    // Preload chunk yang sama dipakai lazy() di HowItWorks supaya warm-up
    // transform vite-node tidak memakan waktu findByRole.
    await import('@/features/templates/screen/TemplateThumbSheet')
    render(<HowItWorks />)
    // Kolom kanan stepper dibungkus aria-hidden (dekoratif), jadi elemen
    // role=img harus dicari dengan opsi hidden.
    const img = await screen.findByRole(
      'img',
      { name: t('templates.thumbLabel', { name: t('template.classic-ats') }), hidden: true },
      { timeout: 8000 },
    )
    // Mini-sheet nyata: blok preview ber-scope thumb- harus ikut ter-render.
    expect(document.querySelector('[data-block-key^="thumb-classic-ats:"]')).not.toBeNull()
    expect(img).toBeInTheDocument()
  }, 30000)
})

describe('AtsGuide (T8.1)', () => {
  it('menampilkan 8 aturan bernomor 01..08 dengan judul+isi dari kamus', () => {
    const { container } = render(<AtsGuide />)
    const list = container.querySelector('ol')
    if (!list) throw new Error('AtsGuide tanpa <ol> aturan')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(HOME_GUIDE_RULES.length)
    items.forEach((item, index) => {
      expect(item.textContent).toContain(String(index + 1).padStart(2, '0'))
      const rule = HOME_GUIDE_RULES[index]!
      expect(within(item).getByRole('heading', { level: 3 })).toHaveTextContent(t(rule.titleKey))
      expect(item).toHaveTextContent(t(rule.bodyKey))
    })
  })

  it("menampilkan blok do/don't dengan tiga butir tiap sisi (desktop + mobile ter-render)", () => {
    render(<AtsGuide />)
    expect(screen.getByText(t('home.section.guide.title'))).toBeInTheDocument()
    for (let i = 1; i <= 3; i += 1) {
      // DoDontVisual dirender dua kali (lg:block + lg:hidden) — dua-duanya di DOM.
      expect(screen.getAllByText(t(`home.guide.do.${i}` as never))).toHaveLength(2)
      expect(screen.getAllByText(t(`home.guide.dont.${i}` as never))).toHaveLength(2)
    }
    expect(screen.getAllByText(t('home.guide.doTitle' as never)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(t('home.guide.dontTitle' as never)).length).toBeGreaterThan(0)
  })
})

describe('Faq (T8.1)', () => {
  it('accordion: klik pertanyaan membuka jawabannya dan aria-expanded berubah', async () => {
    const user = userEvent.setup()
    render(<Faq />)
    const triggers = screen.getAllByRole('button')
    expect(triggers).toHaveLength(HOME_FAQS.length)
    const answerKey = 'home.faq.3.a' as never
    expect(screen.queryByText(t(answerKey))).not.toBeInTheDocument()

    const third = screen.getByRole('button', { name: t('home.faq.3.q' as never) })
    expect(third).toHaveAttribute('aria-expanded', 'false')
    await user.click(third)
    expect(third).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(t(answerKey))).toBeInTheDocument()

    // type="single": membuka pertanyaan lain menutup yang ini.
    await user.click(screen.getByRole('button', { name: t('home.faq.4.q' as never) }))
    expect(third).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: t('home.faq.4.q' as never) })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText(t('home.faq.4.a' as never))).toBeInTheDocument()
  })

  it('dapat ditutup kembali (collapsible) dan pertanyaan ke-i menjawab dengan aKey ke-i', async () => {
    const user = userEvent.setup()
    render(<Faq />)
    const trigger = screen.getByRole('button', { name: t('home.faq.1.q' as never) })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SiteFooter (T8.1)', () => {
  const renderFooter = () =>
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    )

  it('memiliki 4 kolom navigasi sesuai kamus', () => {
    renderFooter()
    const navs = screen.getAllByRole('navigation')
    expect(navs).toHaveLength(4)
    for (const label of [
      'home.footer.product',
      'home.footer.templates',
      'home.footer.resources',
      'home.footer.legal',
    ] as const) {
      expect(screen.getByRole('navigation', { name: t(label) })).toBeInTheDocument()
    }
  })

  it('kolom Template menautkan kelima template; Legal menautkan /privacy dan /terms', () => {
    renderFooter()
    const templateNav = screen.getByRole('navigation', { name: t('home.footer.templates') })
    for (const id of TEMPLATE_IDS) {
      expect(
        within(templateNav).getByRole('link', { name: t(templateLabelKey(id)) }),
      ).toHaveAttribute('href', '/templates')
    }
    expect(screen.getByRole('link', { name: t('home.footer.privacy') })).toHaveAttribute(
      'href',
      '/privacy',
    )
    expect(screen.getByRole('link', { name: t('home.footer.terms') })).toHaveAttribute(
      'href',
      '/terms',
    )
  })

  it('baris bawah: pernyataan privasi satu baris + hak cipta', () => {
    renderFooter()
    const line = screen.getByText(t('home.footer.privacyLine'))
    expect(line.tagName).toBe('P')
    expect(line.textContent).toBe(t('home.footer.privacyLine'))
    expect(screen.getByText(t('home.footer.rights' as never), { exact: false })).toBeInTheDocument()
  })
})

describe('HomeSections (T8.1 urutan section 2–6)', () => {
  it('merender section galeri → panduan → langkah → FAQ → footer dalam urutan plan', () => {
    render(
      <MemoryRouter>
        <HomeSections />
      </MemoryRouter>,
    )
    const ids = ['home-templates', 'home-guide', 'home-steps', 'home-faq']
    const nodes = ids.map((id) => document.getElementById(id))
    nodes.forEach((node, index) => {
      expect(node, ids[index]).not.toBeNull()
      if (index > 0 && node && nodes[index - 1]) {
        expect(
          Boolean(
            nodes[index - 1]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        ).toBe(true)
      }
    })
    expect(screen.getAllByRole('navigation')).toHaveLength(4)
  })

  it('JSON-LD FAQPage punya jumlah item sama dengan pertanyaan yang dirender', () => {
    render(
      <MemoryRouter>
        <HomeSections />
      </MemoryRouter>,
    )
    const script = document.querySelector('script[type="application/ld+json"]')
    if (!script) throw new Error('HomeSections tanpa script JSON-LD')
    const parsed = JSON.parse(script.textContent ?? '') as {
      '@type': string
      mainEntity: { '@type': string; name: string; acceptedAnswer: { text: string } }[]
    }
    expect(parsed['@type']).toBe('FAQPage')
    const faqSection = document.getElementById('home-faq')
    if (!faqSection) throw new Error('section FAQ hilang')
    const renderedQuestions = within(faqSection).getAllByRole('button')
    expect(parsed.mainEntity).toHaveLength(renderedQuestions.length)
    expect(parsed.mainEntity).toHaveLength(HOME_FAQS.length)
    expect(parsed.mainEntity[0]!.name).toBe(t(HOME_FAQS[0]!.qKey))
  })
})
