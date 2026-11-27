import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {PointerEvent as ReactPointer} from 'react'
import './guest-rules.css'

type Lang='ru'|'en'|'tg'
type Point=[number,number]
type Text={title:string;intro:string;sections:[string,string][];confirm:string;guest:string;arrival:string}
type Copy={edition:string;textHash:string;text:Text}
type Packet={language?:Lang|null;request:string;until:number;name:string;arrival:string;texts:Record<Lang,Copy>}
const languages:Lang[]=['ru','en','tg']
const labels={
 ru:{next:'Перейти к подписи',back:'Прочитать ещё раз',sign:'Подписать и передать на ресепшен',clear:'Очистить подпись',line:'Поставьте подпись пальцем в поле ниже',sent:'Подписанный документ сохранён',offline:'Связь прервалась. Проверяем сохранение…',retry:'Не удалось сохранить. Нажмите кнопку ещё раз.',wrong:'Если имя указано неверно, обратитесь на ресепшен до подписания.',signTitle:'Подтверждение ознакомления',signedHint:'Спасибо. Планшет вернётся на главный экран.'},
 en:{next:'Continue to signature',back:'Read the rules again',sign:'Sign and send to the front desk',clear:'Clear signature',line:'Sign with your finger in the box below',sent:'Your signed document has been saved',offline:'Connection interrupted. Checking the document…',retry:'Could not save. Please try the button again.',wrong:'If this is not your name, please speak to the front desk before signing.',signTitle:'Acknowledgement',signedHint:'Thank you. The tablet will return to its home screen.'},
 tg:{next:'Гузариш ба имзо',back:'Қоидаҳоро боз хондан',sign:'Имзо кардан ва ба қабулгоҳ фиристодан',clear:'Пок кардани имзо',line:'Дар майдони поён бо ангушт имзо гузоред',sent:'Ҳуҷҷати имзошуда нигоҳ дошта шуд',offline:'Алоқа канда шуд. Сабти ҳуҷҷат санҷида мешавад…',retry:'Сабт нашуд. Лутфан тугмаро бори дигар пахш кунед.',wrong:'Агар ном нодуруст бошад, пеш аз имзо ба қабулгоҳ муроҷиат кунед.',signTitle:'Тасдиқи шиносоӣ',signedHint:'Ташаккур. Планшет ба саҳифаи асосӣ бармегардад.'}
}
const tokenKey='rumi-folio-station-v1'
function device(){try{return localStorage.getItem(tokenKey)||''}catch{return ''}}
async function call(op:string,token:string,body:object,signal?:AbortSignal){
 const response=await fetch('https://menu.therumihotel.com:8844/wifi/folio/rules-'+op,{method:'POST',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal})
 if(!response.ok)throw Error(String(response.status))
 return response.json()
}
function initialLanguage():Lang{
 const lang=(document.querySelector<HTMLElement>('.kiosk[lang], .kiosk [lang]')?.lang||document.documentElement.lang||navigator.language).slice(0,2)
 return languages.includes(lang as Lang)?lang as Lang:'en'
}
export function GuestRules(){
 const [packet,setPacket]=useState<Packet|null>(null),[thanks,setThanks]=useState<Lang|null>(null)
 const [lang,setLang]=useState<Lang>(initialLanguage),[reviewed,setReviewed]=useState(false),[ack,setAck]=useState(false)
 const [ink,setInk]=useState<Point[][]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const current=useRef<Packet|null>(null),version=useRef(''),tokenRef=useRef(''),langRef=useRef(lang),active=useRef<number|null>(null),draft=useRef<Point[][]>([]),sent=useRef(false),signController=useRef<AbortController|null>(null)
 const scroll=useRef<HTMLDivElement>(null)
 const dialog=useRef<HTMLDialogElement>(null)
 const showing=Boolean(packet)
 useLayoutEffect(()=>{const el=dialog.current;if(!showing||!el)return;el.showModal();return ()=>el.close()},[showing])
 function erase(){active.current=null;draft.current=[];setInk([])}
 function reset(){erase();setAck(false);setReviewed(false);setError('');sent.current=false;setBusy(false)}
 function clear(){signController.current?.abort();current.current=null;version.current='';setPacket(null);reset()}
 function complete(){const l=langRef.current;clear();setThanks(l)}
 useEffect(()=>{langRef.current=lang},[lang])
 useEffect(()=>{scroll.current?.scrollTo(0,0)},[reviewed,packet?.request,lang])
 useEffect(()=>{if(!thanks)return;const id=setTimeout(()=>setThanks(null),2800);return()=>clearTimeout(id)},[thanks])
 useEffect(()=>{
  let alive=true,timer=0,expiry=0,controller:AbortController|undefined,lastGood=0
  const hide=()=>{controller?.abort();clearTimeout(expiry);clear();setThanks(null);tokenRef.current=''}
  async function poll(){
   if(!alive)return
   const token=device()
   if(token!==tokenRef.current){hide();tokenRef.current=token}
   if(token&&!document.hidden){
    controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),3500)
    const requested=version.current
    try{
     const r=await call('read',token,{seen:requested},controller.signal)
     if(!alive||document.hidden||token!==device()||requested!==version.current)return
     lastGood=Date.now();setError(prev=>prev==='offline'?'':prev)
     if(!r.request){if(requested&&r.confirmed===requested)complete();else if(current.current)clear()}
     else if(r.request!==requested){
      if(!r.texts||typeof r.name!=='string'||!r.until)return
      reset();setThanks(null);version.current=r.request;current.current=r;setPacket(r);setLang(languages.includes(r.language)?r.language:initialLanguage())
     }
     clearTimeout(expiry)
     if(r.request)expiry=window.setTimeout(hide,Math.max(0,Math.min(15000,Number(r.remainingMs))))
    }catch{if(alive&&current.current){if(Date.now()-lastGood>14000)hide();else setError('offline')}}
    finally{clearTimeout(timeout)}
   }
  }
  const loop=async()=>{try{await poll()}finally{if(alive)timer=window.setTimeout(loop,document.hidden?3000:current.current?1800:750)}}
  const visibility=()=>{if(document.hidden)hide()}
  const onRePair=()=>hide()
  window.addEventListener('folio-pair',onRePair);document.addEventListener('visibilitychange',visibility)
  void loop()
  return()=>{alive=false;controller?.abort();signController.current?.abort();clearTimeout(timer);clearTimeout(expiry);window.removeEventListener('folio-pair',onRePair);document.removeEventListener('visibilitychange',visibility)}
 },[])
 if(!packet&&!thanks)return null
 const copy=labels[thanks||lang]
 if(!packet)return <section className="rumi-rules rumi-rules-thanks" role="status"><div><div className="rr-brand">THE RUMI HOTEL</div><h1>{copy.sent}</h1><p>{copy.signedHint}</p></div></section>
 const local=packet.texts[lang],t=local.text
 function point(e:ReactPointer<SVGSVGElement>):Point{
  const rect=e.currentTarget.getBoundingClientRect()
  return [Math.max(0,Math.min(1000,Math.round((e.clientX-rect.left)*1000/rect.width))),Math.max(0,Math.min(300,Math.round((e.clientY-rect.top)*300/rect.height)))]
 }
 function down(e:ReactPointer<SVGSVGElement>){if(busy||active.current!==null||draft.current.length>=64)return;e.preventDefault();active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);draft.current=[...draft.current,[point(e)]];setInk(draft.current)}
 function move(e:ReactPointer<SVGSVGElement>){if(active.current!==e.pointerId||busy)return;const s=draft.current[draft.current.length-1];if(!s||draft.current.reduce((n,v)=>n+v.length,0)>=2400)return;const p=point(e),last=s[s.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<2)return;draft.current=[...draft.current.slice(0,-1),[...s,p]];setInk(draft.current)}
 function up(e:ReactPointer<SVGSVGElement>){if(active.current===e.pointerId){move(e);active.current=null}}
 const drawable=ink.some(s=>s.length>2&&s.reduce((distance,p,i)=>distance+(i?Math.hypot(p[0]-s[i-1][0],p[1]-s[i-1][1]):0),0)>=12)
 async function submit(){const original=current.current,token=device();if(!original||!token||sent.current||!ack||!drawable)return;sent.current=true;setBusy(true);setError('');const ctrl=new AbortController();signController.current=ctrl;const timeout=setTimeout(()=>ctrl.abort(),8000)
  try{const r=await call('sign',token,{request:original.request,lang,textHash:local.textHash,ack:true,strokes:draft.current},ctrl.signal);if(current.current?.request===original.request&&token===device()&&r.state==='signed')complete()}
  catch{if(current.current?.request===original.request)setError('retry')}
  finally{clearTimeout(timeout);if(current.current?.request===original.request){sent.current=false;setBusy(false)}}
 }
 return <dialog ref={dialog} className="rumi-rules" onCancel={e=>e.preventDefault()} aria-modal="true" aria-label={t.title} lang={lang}>
  <header className="rr-head"><div className="rr-brand">THE RUMI HOTEL <span>· DUSHANBE</span></div><div className="rr-languages" role="group" aria-label={{ru:'Язык правил',tg:'Забони қоидаҳо',en:'Rules language'}[lang]}>{languages.map(code=><button key={code} type="button" lang={code} aria-pressed={lang===code} disabled={busy} onClick={()=>{if(code!==lang){setLang(code);reset()}}}>{{ru:'Русский',tg:'Тоҷикӣ',en:'English'}[code]}</button>)}</div></header>
  <div className="rr-scroll" ref={scroll}><main><h1>{reviewed?copy.signTitle:t.title}</h1><p className="rr-person"><strong>{packet.name}</strong><span>{t.arrival} · {packet.arrival}</span></p>
  {reviewed?<><p>{copy.wrong}</p><label className="rr-check"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/><span>{t.confirm}</span></label>
   <p className="rr-label" id="rr-sign-label">{copy.line}</p><svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="rr-ink" role="img" aria-labelledby="rr-sign-label" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={e=>{if(active.current===e.pointerId)active.current=null}}>{ink.map((s,i)=><polyline key={i} points={s.map(p=>p.join(',')).join(' ')} fill="none" stroke="#193e32" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
   <button className="rr-quiet" type="button" disabled={busy||!ink.length} onClick={erase}>{copy.clear}</button></>:<><p>{t.intro}</p>{t.sections.map(([name,body])=><section key={name}><h2>{name}</h2><p>{body}</p></section>)}</>}
  {error&&<p role="alert" className="rr-error">{error==='offline'?copy.offline:copy.retry}</p>}</main></div>
  <footer className="rr-foot">{reviewed?<><button className="rr-quiet" disabled={busy} onClick={()=>{setReviewed(false);setAck(false);erase();setError('')}}>{copy.back}</button><button className="rr-primary" disabled={busy||!ack||!drawable} onClick={()=>void submit()}>{copy.sign}</button></>:<><span>{local.edition}</span><button className="rr-primary" onClick={()=>setReviewed(true)}>{copy.next}</button></>}</footer>
 </dialog>
}
