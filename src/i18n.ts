import { createContext, useContext } from 'react'
import { translations, type Key, type Lang } from './translations'

export const LangContext = createContext<Lang>('en')

/** Lets any tablet screen switch the guest's language (set by the kiosk page). */
export const SetLangContext = createContext<((l: Lang) => void) | null>(null)

export function useLang(): Lang {
  return useContext(LangContext)
}

export function useT() {
  const lang = useContext(LangContext)
  return (key: Key, vars?: Record<string, string | number>) => {
    let s: string = translations[lang][key] ?? translations.en[key]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
    return s
  }
}
