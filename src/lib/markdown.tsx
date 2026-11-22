import type { ReactNode } from 'react'

// A deliberately small Markdown renderer for the hotel policy: headings, paragraphs, bullet and
// numbered lists, bold, italic, horizontal rules. It builds React elements and never injects raw
// HTML, so an uploaded file cannot run scripts on the tablet. Anything it doesn't know is shown
// as plain text.

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'hr' }

function parse(md: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const t = line.trim()
    let m: RegExpMatchArray | null
    if (!t) {
      flushPara()
      flushList()
    } else if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara()
      flushList()
      blocks.push({ kind: 'h', level: Math.min(3, m[1].length) as 1 | 2 | 3, text: m[2].replace(/\s+#+$/, '') })
    } else if (/^([-*_])(\s*\1){2,}$/.test(t)) {
      flushPara()
      flushList()
      blocks.push({ kind: 'hr' })
    } else if ((m = t.match(/^[-*+]\s+(.*)$/)) || (m = t.match(/^\d+[.)]\s+(.*)$/))) {
      flushPara()
      const kind = /^\d/.test(t) ? 'ol' : 'ul'
      if (!list || list.kind !== kind) {
        flushList()
        list = { kind, items: [] }
      }
      list.items.push(m[1])
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ' ' + t // continuation of a list item
    } else {
      flushList()
      para.push(t)
    }
  }
  flushPara()
  flushList()
  return blocks
}

/** **bold**, __bold__, *italic*, _italic_ inside a line. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(m[1] ? <strong key={k++} className="font-semibold text-ink">{m[2]}</strong> : <em key={k++}>{m[4]}</em>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {parse(source).map((b, i) => {
        if (b.kind === 'h') {
          const cls = b.level === 1 ? 'font-serif text-2xl font-semibold text-forest' : b.level === 2 ? 'font-serif text-xl font-semibold text-forest' : 'font-semibold text-ink'
          return b.level === 1 ? <h3 key={i} className={cls}>{inline(b.text)}</h3> : <h4 key={i} className={cls}>{inline(b.text)}</h4>
        }
        if (b.kind === 'hr') return <hr key={i} className="border-line" />
        if (b.kind === 'p') return <p key={i}>{inline(b.text)}</p>
        const items = b.items.map((it, j) => <li key={j}>{inline(it)}</li>)
        return b.kind === 'ul' ? (
          <ul key={i} className="list-disc space-y-1 pl-5">{items}</ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-5">{items}</ol>
        )
      })}
    </div>
  )
}
