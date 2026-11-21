import { useState, type FormEvent } from 'react'
import { errorCode, supabase } from '../lib/supabase'
import { Brand, COLORS, Emblem, Spinner } from '../ui'
import { Btn, Field, errorText } from './kit'

type Mode = 'signin' | 'signup' | 'forgot' | 'reset'

export function Login({ recovery, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<Mode>(recovery ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const redirect = `${window.location.origin}/staff`
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: redirect },
        })
        if (error) throw error
        if (!data.session) setMsg({ tone: 'ok', text: 'Account created. Check your email and open the confirmation link, then sign in.' })
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect })
        if (error) throw error
        setMsg({ tone: 'ok', text: 'If that email has an account, a reset link is on its way.' })
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMsg({ tone: 'ok', text: 'Password updated.' })
        onRecovered?.()
      }
    } catch (err) {
      const code = errorCode(err)
      const raw = (err as { message?: string })?.message ?? ''
      setMsg({ tone: 'error', text: code === 'unknown_error' && raw ? raw : errorText(code) })
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Mode, string> = {
    signin: 'Sign in',
    signup: 'Create a staff account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }

  return (
    <div className="flex min-h-dvh bg-cream">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-forest p-12 text-cream lg:flex">
        <Emblem color={COLORS.goldLight} className="pointer-events-none absolute -bottom-32 -right-32 h-[520px] w-[520px] opacity-[0.07]" />
        <Brand tone="light" size="lg" />
        <div className="rise relative">
          <p className="text-sm font-semibold tracking-[0.2em] text-gold-light">FRONT DESK</p>
          <h1 className="mt-3 text-6xl leading-[1.05]">Self check-in, managed from one screen.</h1>
          <p className="mt-5 max-w-md text-lg text-cream/80">Arrivals, tablet check-ins, passport review, check-outs and guest feedback, live.</p>
        </div>
        <p className="relative text-sm text-cream/60">The Rumi Hotel &amp; Residences · Dushanbe</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h2 key={mode} className="fade-in text-4xl text-forest">{titles[mode]}</h2>
          {mode === 'signup' && (
            <p className="mt-2 text-sm text-muted">The first account becomes the administrator. Later accounts need approval from an administrator.</p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
            {mode !== 'reset' && (
              <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            )}
            {mode !== 'forgot' && (
              <Field
                label={mode === 'reset' ? 'New password' : 'Password'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={mode === 'signin' ? undefined : 8}
                hint={mode === 'signin' ? undefined : 'At least 8 characters.'}
                required
              />
            )}
            {msg && (
              <p role={msg.tone === 'error' ? 'alert' : 'status'} className={`fade-in rounded-lg px-3 py-2.5 text-sm ${msg.tone === 'error' ? 'bg-[#FDF1EC] text-danger' : 'bg-forest/10 text-forest'}`}>
                {msg.text}
              </p>
            )}
            <Btn type="submit" tone="primary" className="w-full !min-h-12 !text-base" disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />}
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save password'}
            </Btn>
          </form>
          {mode !== 'reset' && (
            <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
              {mode === 'signin' ? (
                <>
                  <button type="button" className="min-h-11 cursor-pointer font-medium text-forest underline-offset-4 hover:underline" onClick={() => setMode('signup')}>
                    Create an account
                  </button>
                  <button type="button" className="min-h-11 cursor-pointer text-muted underline-offset-4 hover:underline" onClick={() => setMode('forgot')}>
                    Forgot password?
                  </button>
                </>
              ) : (
                <button type="button" className="min-h-11 cursor-pointer font-medium text-forest underline-offset-4 hover:underline" onClick={() => { setMode('signin'); setMsg(null) }}>
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
