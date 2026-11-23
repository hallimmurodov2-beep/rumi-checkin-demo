import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorCode, supabase } from '../lib/supabase'
import { ArrowLeft, Brand, Spinner } from '../ui'
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

  const changeMode = (next: Mode) => {
    setMode(next)
    setPassword('')
    setMsg(null)
  }

  const titles: Record<Mode, string> = {
    signin: 'Sign in',
    signup: 'Create a staff account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="relative isolate hidden min-h-dvh flex-col justify-between overflow-hidden bg-forest-deep p-10 text-cream lg:flex xl:p-14">
        <img
          src="/gallery/entrance.webp"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-forest-deep/90 via-forest-deep/25 to-forest-deep/95" aria-hidden="true" />
        <Brand tone="light" />
        <p className="max-w-[10ch] border-t border-gold-light/50 pt-5 font-serif text-[clamp(3rem,6.5vw,6.25rem)] leading-[0.9] tracking-[-0.025em]">
          Front desk
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-forest hover:underline">
            <ArrowLeft className="h-4 w-4" /> Check-in home
          </Link>
          <div className="lg:hidden"><Brand size="sm" /></div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 items-center py-8">
          <div className="w-full rounded-2xl border border-line bg-paper p-6 shadow-[0_18px_60px_-44px_rgb(14_59_46/0.35)] sm:p-9">
            <h1 key={mode} className="text-4xl leading-none text-forest sm:text-5xl">{titles[mode]}</h1>
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
                    <button type="button" className="min-h-11 cursor-pointer font-medium text-forest underline-offset-4 hover:underline" disabled={busy} onClick={() => changeMode('signup')}>
                      Create an account
                    </button>
                    <button type="button" className="min-h-11 cursor-pointer text-muted underline-offset-4 hover:underline" disabled={busy} onClick={() => changeMode('forgot')}>
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <button type="button" className="min-h-11 cursor-pointer font-medium text-forest underline-offset-4 hover:underline" disabled={busy} onClick={() => changeMode('signin')}>
                    Back to sign in
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
