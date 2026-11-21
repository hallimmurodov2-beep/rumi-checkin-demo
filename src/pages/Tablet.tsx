import { useCallback, useEffect, useState } from 'react'
import { LangContext } from '../i18n'
import { translations, type Lang } from '../translations'
import { actions } from '../store'
import { Welcome } from '../tablet/Welcome'
import { Checkout, CheckoutDone } from '../tablet/Checkout'
import { Confirm, DetailsStep, Done, NotMine, Passport, SignatureStep, emptyDetails, type Details } from '../tablet/Steps'

type Step = 'welcome' | 'passport' | 'confirm' | 'notmine' | 'details' | 'signature' | 'done' | 'checkout' | 'checkoutDone'

const IDLE_LIMIT = 60
const IDLE_WARN = 10

export default function Tablet() {
  const [step, setStep] = useState<Step>('welcome')
  const [lang, setLang] = useState<Lang>('en')
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [idleLeft, setIdleLeft] = useState(IDLE_LIMIT)

  const reset = useCallback(() => {
    setStep('welcome')
    setLang('en')
    setDetails(emptyDetails)
  }, [])

  const goWelcome = useCallback(() => {
    setStep('welcome')
    setDetails(emptyDetails)
  }, [])

  // Idle reset: any step except Welcome returns to Welcome after 60 s without touch.
  useEffect(() => {
    if (step === 'welcome') return
    let last = Date.now()
    const touch = () => {
      last = Date.now()
      setIdleLeft(IDLE_LIMIT)
    }
    const evts = ['pointerdown', 'pointermove', 'keydown', 'touchstart']
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    setIdleLeft(IDLE_LIMIT)
    const id = window.setInterval(() => {
      const left = IDLE_LIMIT - Math.floor((Date.now() - last) / 1000)
      if (left <= 0) reset()
      else setIdleLeft(left)
    }, 500)
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(id)
    }
  }, [step, reset])

  const t = (k: keyof typeof translations.en, n: number) => translations[lang][k].replace('{n}', String(n))

  return (
    <LangContext.Provider value={lang}>
      <div className="h-dvh w-full select-none overflow-hidden bg-cream" lang={lang}>
        {step === 'welcome' && (
          <Welcome lang={lang} setLang={setLang} onStart={() => setStep('passport')} onCheckout={() => setStep('checkout')} />
        )}
        {step === 'passport' && <Passport onBack={goWelcome} onFound={() => setStep('confirm')} />}
        {step === 'confirm' && (
          <Confirm onBack={() => setStep('passport')} onYes={() => setStep('details')} onNo={() => setStep('notmine')} />
        )}
        {step === 'notmine' && <NotMine onBack={() => setStep('confirm')} onStart={goWelcome} />}
        {step === 'details' && (
          <DetailsStep value={details} onChange={setDetails} onBack={() => setStep('confirm')} onNext={() => setStep('signature')} />
        )}
        {step === 'signature' && (
          <SignatureStep
            onBack={() => setStep('details')}
            onNext={() => {
              actions.addCheckin('Sample Guest', 'Booking.com', 'Deluxe Double, 305')
              setStep('done')
            }}
          />
        )}
        {step === 'done' && <Done onFinish={reset} />}
        {step === 'checkout' && (
          <Checkout
            onBack={goWelcome}
            onComplete={(rating, feedback) => {
              actions.addCheckout('Sample Guest', 'Deluxe Double, 305', rating, feedback)
              setStep('checkoutDone')
            }}
          />
        )}
        {step === 'checkoutDone' && <CheckoutDone onFinish={reset} />}

        {step !== 'welcome' && idleLeft <= IDLE_WARN && (
          <div
            role="alert"
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-ink px-8 py-4 text-center text-cream shadow-xl"
          >
            <p className="text-xl font-semibold">{t('idleWarn', idleLeft)}</p>
            <p className="text-sm text-gold-light">{t('idleTouch', 0)}</p>
          </div>
        )}
      </div>
    </LangContext.Provider>
  )
}
