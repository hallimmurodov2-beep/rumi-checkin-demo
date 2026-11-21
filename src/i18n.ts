import { createContext, useContext } from 'react'
import { translations, type Key, type Lang } from './translations'

export const LangContext = createContext<Lang>('en')

export function useT() {
  const lang = useContext(LangContext)
  return (key: Key, vars?: Record<string, string | number>) => {
    let s: string = translations[lang][key] ?? translations.en[key]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
    return s
  }
}
