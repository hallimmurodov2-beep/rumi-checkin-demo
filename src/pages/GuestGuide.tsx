import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneIcon } from '../ui'
import { LANGS, translations, type Lang } from '../translations'

const mapUrl = 'https://www.google.com/maps/search/?api=1&query=The+Rumi+Hotel+and+Residences%2C+10+Mirzo+Tursunzoda%2C+Dushanbe'

export default function GuestGuide() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('lang') ?? navigator.language.split('-')[0]
  const lang: Lang = selected === 'ru' || selected === 'tg' ? selected : 'en'
  const t = translations[lang]

  useEffect(() => {
    const originalTitle = document.title
    const originalLang = document.documentElement.lang
    document.title = `${t.guideTitle} · The Rumi`
    document.documentElement.lang = lang
    return () => {
      document.title = originalTitle
      document.documentElement.lang = originalLang
    }
  }, [lang, t.guideTitle])

  const facilities = [
    { photo: 'buffet-bar', title: t.guideFood, hours: '07:00–11:00', detail: t.guideFoodInfo },
    { photo: 'pool', title: t.guidePool, hours: t.guideAlways, detail: t.guideLowerFloor },
    { photo: 'gym', title: t.guideGym, hours: t.guideAlways, detail: t.guideLowerFloor },
  ]

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-paper pb-12 text-forest">
      <header className="relative isolate flex min-h-56 flex-col justify-between overflow-hidden bg-forest-deep px-6 py-6 text-white sm:min-h-72 sm:px-10">
        <img src="/gallery/lobby-atrium.webp" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-deep via-forest-deep/45 to-forest-deep/75" />
        <div className="flex items-center gap-3 text-gold-light">
          <img src="/emblem.svg" alt="" className="h-9 w-9" />
          <span lang="en" className="font-serif text-2xl tracking-[.12em]">THE RUMI</span>
        </div>
        <h1 className="mt-10 text-5xl leading-none sm:text-6xl">{t.guideTitle}</h1>
      </header>
      <div className="px-5 sm:px-10">
        <div role="group" aria-label={t.chooseLanguage} className="my-5 flex flex-wrap gap-1 rounded-xl bg-cream p-1">
          {LANGS.map(({ code, label }) => (
            <button key={code} lang={code} aria-pressed={code === lang} onClick={() => setParams({ lang: code }, { replace: true })}
              className="min-h-11 flex-1 cursor-pointer rounded-lg px-2 font-medium aria-pressed:bg-forest aria-pressed:text-white">
              {label}
            </button>
          ))}
        </div>
        <section className="mb-6 flex items-start gap-3 rounded-xl bg-forest px-4 py-4 text-white">
          <PhoneIcon className="mt-1 h-5 w-5 shrink-0 text-gold-light" />
          <div>
            <h2 className="text-2xl leading-tight">{t.guideReception}</h2>
            <p className="mt-1 text-sm leading-relaxed">{t.guideReceptionInfo}</p>
          </div>
        </section>
        <section>
          <h2 className="text-3xl">{t.guideStay}</h2>
          <ul className="mt-2 divide-y divide-line">
            {facilities.map(({ photo, title, hours, detail }) => (
              <li key={photo} className="flex items-center gap-4 py-4">
                <img src={`/gallery/thumbs/${photo}.webp`} alt="" width="104" height="80" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                <div>
                  <h3 className="text-2xl leading-tight">{title}</h3>
                  <p className="mt-1 font-semibold">{hours}</p>
                  <p className="mt-1 text-sm text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="my-5 rounded-2xl bg-cream p-5">
          <h2 className="text-3xl">{t.guideDeparture}</h2>
          <h3 className="mt-4 text-xl">{t.guideCheckout}</h3>
          <p className="mt-1 text-muted">{t.guideCheckoutInfo}</p>
          <h3 className="mt-4 text-xl">{t.guideShuttle}</h3>
          <p className="mt-1 text-muted">{t.guideShuttleInfo}</p>
        </section>
        <section className="pt-2">
          <h2 className="text-3xl">{t.guideContact}</h2>
          <address className="mt-2 not-italic">
            <p>{t.guideAddress}</p>
            <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={mapUrl}>{t.guideDirections} ↗</a>
            <p><a className="inline-flex min-h-11 items-center font-semibold" href="tel:+992446107744">{t.guideCall} · +992 44 610 77 44</a></p>
            <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="mailto:info@therumihotel.com">info@therumihotel.com</a>
          </address>
        </section>
      </div>
    </main>
  )
}
