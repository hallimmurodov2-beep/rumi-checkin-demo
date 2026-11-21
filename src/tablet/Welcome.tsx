import { useT } from '../i18n'
import { LANGS, type Lang } from '../translations'
import { Button, DemoBadge } from '../ui'

export function Welcome({
  lang,
  setLang,
  onStart,
  onCheckout,
}: {
  lang: Lang
  setLang: (l: Lang) => void
  onStart: () => void
  onCheckout: () => void
}) {
  const t = useT()
  return (
    <div className="flex h-full">
      <section className="relative flex w-[46%] flex-col items-center justify-center overflow-hidden bg-forest px-12 text-center text-cream">
        <img
          src="/emblem-light.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 h-[460px] w-[460px] opacity-[0.07]"
        />
        <img src="/emblem-light.png" alt="The Rumi emblem" className="relative h-44 w-44" />
        <p className="relative mt-5 font-serif text-xl font-semibold tracking-[0.4em] text-gold-light">THE RUMI</p>
        <p className="relative mt-1 text-[11px] font-medium tracking-[0.24em] text-gold-light">HOTEL AND RESIDENCES</p>
        <div className="relative mt-10 space-y-2">
          <h1 className="text-6xl leading-none text-cream">Welcome</h1>
          <p lang="ru" className="font-serif text-4xl font-semibold text-gold-light">Добро пожаловать</p>
          <p lang="tg" className="font-serif text-4xl font-semibold text-gold-light">Хуш омадед</p>
        </div>
      </section>

      <section className="relative flex flex-1 flex-col justify-center px-16">
        <div className="absolute right-6 top-5">
          <DemoBadge />
        </div>
        <p className="text-sm font-semibold tracking-[0.18em] text-label">{t('chooseLanguage').toUpperCase()}</p>
        <div className="mt-4 grid grid-cols-3 gap-3" role="group" aria-label={t('chooseLanguage')}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={lang === l.code}
              onClick={() => setLang(l.code)}
              className={`min-h-16 cursor-pointer rounded-xl border-2 px-3 text-lg font-medium transition ${
                lang === l.code
                  ? 'border-forest bg-forest text-cream'
                  : 'border-line bg-white text-ink hover:border-forest'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Button className="mt-10 min-h-20 text-2xl" onClick={onStart}>
          {t('startCheckIn')}
        </Button>
        <Button variant="secondary" className="mt-4" onClick={onCheckout}>
          {t('checkOut')}
        </Button>
      </section>
    </div>
  )
}
