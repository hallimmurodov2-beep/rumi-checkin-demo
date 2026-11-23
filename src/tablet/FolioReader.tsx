import { useLayoutEffect, useRef, useState } from 'react'
import { LangContext, SetLangContext, useLang } from '../i18n'
import { translations, type Lang } from '../translations'
import { ArrowLeft, ArrowRight, Brand, ExpandIcon } from '../ui'
import { LangSwitch } from './Shell'
import './folio.css'

/** Reception owns the invoice's lifetime. Only the currently selected page is decoded. */
export function FolioReader({ pages, zoom, onZoom }: { pages: string[]; zoom: boolean; onZoom: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const preferredLang = useLang()
  const [lang, setLang] = useState<Lang>(() => {
    const selected = document.querySelector<HTMLElement>('.kiosk[lang], .kiosk [lang]')?.lang
    return selected === 'ru' || selected === 'tg' ? selected : preferredLang
  })
  const t = translations[lang]

  useLayoutEffect(() => {
    const el = dialog.current!
    el.showModal()
    return () => el.close()
  }, [])
  useLayoutEffect(() => {
    viewport.current?.scrollTo(0, 0)
  }, [page, zoom])

  return (
    <dialog ref={dialog} data-kiosk-invoice lang={lang} className="folio-reader" aria-labelledby="folio-title"
      onCancel={(e) => e.preventDefault()}>
      <header className="folio-header">
        <div className="folio-brand"><Brand tone="light" size="sm" /></div>
        <h1 id="folio-title">{t.folioTitle}</h1>
        <LangContext.Provider value={lang}>
          <SetLangContext.Provider value={setLang}><LangSwitch tone="dark" /></SetLangContext.Provider>
        </LangContext.Provider>
      </header>
      <div ref={viewport} className={`folio-paper ${zoom ? 'folio-enlarged' : ''}`} tabIndex={0} aria-label={t.folioTitle}>
        <img src={'data:image/png;base64,' + pages[page]} alt={`${t.folioTitle} · ${t.folioPage} ${page + 1}`} draggable={false} />
      </div>
      <footer className="folio-tools">
        <div className="folio-pagination">
          {pages.length > 1 && <button type="button" aria-label={t.folioPrevious} onClick={() => setPage(page - 1)} disabled={page === 0}><ArrowLeft /></button>}
          <span role="status">{t.folioPage} <b>{page + 1}</b> / {pages.length}</span>
          {pages.length > 1 && <button type="button" aria-label={t.folioNext} onClick={() => setPage(page + 1)} disabled={page + 1 >= pages.length}><ArrowRight /></button>}
        </div>
        <button type="button" className="folio-zoom" onClick={onZoom} aria-pressed={zoom}><ExpandIcon />{zoom ? t.folioFit : t.folioEnlarge}</button>
      </footer>
    </dialog>
  )
}
