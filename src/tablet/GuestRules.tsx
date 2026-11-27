import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {PointerEvent as ReactPointer} from 'react'
import './guest-rules.css'

type Lang='en'|'ru'|'tg'|'de'|'fr'|'es'|'it'|'tr'|'ar'|'fa'|'ja'|'ko'|'zh-Hans'|'zh-Hant'
type Point=[number,number]
type Text={title:string;intro:string;sections:[string,string][];confirm:string;guest:string;arrival:string}
type Copy={edition:string;textHash:string;text:Text}
type Packet={preview?:boolean;language?:Lang|null;request:string;until:number;name:string;arrival:string;texts:Record<Lang,Copy>}
const languages:Lang[]=["en","ru","tg","de","fr","es","it","tr","ar","fa","ja","ko","zh-Hans","zh-Hant"]
const awaitingName:Record<Lang,string>={
  "en": "You can sign here as soon as reception confirms your name.",
  "ru": "Здесь можно будет подписать правила, как только на стойке подтвердят ваше имя.",
  "tg": "Пас аз тасдиқи номи шумо дар қабулгоҳ, метавонед дар ин ҷо имзо гузоред.",
  "de": "Sobald die Rezeption Ihren Namen bestätigt, können Sie hier unterschreiben.",
  "fr": "Vous pourrez signer ici dès que la réception aura confirmé votre nom.",
  "es": "Podrá firmar aquí cuando recepción confirme su nombre.",
  "it": "Potrà firmare qui quando la reception avrà confermato il suo nome.",
  "tr": "Resepsiyon adınızı doğruladığında burada imza atabilirsiniz.",
  "ar": "يمكنك التوقيع هنا بعد أن يؤكد موظف الاستقبال اسمك.",
  "fa": "پس از تأیید نام شما در پذیرش، می‌توانید اینجا امضا کنید.",
  "ja": "フロントでお名前の確認ができましたら、こちらで署名できます。",
  "ko": "프런트에서 성함을 확인하면 여기에서 서명하실 수 있습니다.",
  "zh-Hans": "前台确认您的姓名后，您就可以在此签名。",
  "zh-Hant": "櫃檯確認您的姓名後，您就可以在此簽名。"
}
const names: Record<Lang,string>={"en":"English","ru":"Русский","tg":"Тоҷикӣ","de":"Deutsch","fr":"Français","es":"Español","it":"Italiano","tr":"Türkçe","ar":"العربية","fa":"فارسی","ja":"日本語","ko":"한국어","zh-Hans":"简体中文","zh-Hant":"繁體中文"}
const labels={
 ...{
  "de": {
    "next": "Zur Unterschrift",
    "back": "Regeln erneut lesen",
    "sign": "Unterschreiben und an die Rezeption senden",
    "clear": "Unterschrift löschen",
    "line": "Unterschreiben Sie mit dem Finger im Feld unten.",
    "sent": "Ihr unterschriebenes Dokument wurde gespeichert.",
    "offline": "Verbindung unterbrochen. Speicherung wird geprüft …",
    "retry": "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.",
    "wrong": "Ist der Name falsch, wenden Sie sich vor der Unterschrift an die Rezeption.",
    "signTitle": "Bestätigung",
    "signedHint": "Vielen Dank. Das Tablet kehrt zum Startbildschirm zurück."
  },
  "fr": {
    "next": "Passer à la signature",
    "back": "Relire le règlement",
    "sign": "Signer et envoyer à la réception",
    "clear": "Effacer la signature",
    "line": "Signez avec le doigt dans le cadre ci-dessous.",
    "sent": "Votre document signé a été enregistré.",
    "offline": "Connexion interrompue. Vérification en cours…",
    "retry": "Échec de l’enregistrement. Veuillez réessayer.",
    "wrong": "Si le nom est incorrect, adressez-vous à la réception avant de signer.",
    "signTitle": "Confirmation",
    "signedHint": "Merci. La tablette va revenir à l’accueil."
  },
  "es": {
    "next": "Continuar a la firma",
    "back": "Volver a leer las normas",
    "sign": "Firmar y enviar a recepción",
    "clear": "Borrar la firma",
    "line": "Firme con el dedo en el recuadro de abajo.",
    "sent": "El documento firmado se ha guardado.",
    "offline": "Conexión interrumpida. Comprobando el guardado…",
    "retry": "No se pudo guardar. Inténtelo de nuevo.",
    "wrong": "Si el nombre es incorrecto, consulte a recepción antes de firmar.",
    "signTitle": "Confirmación",
    "signedHint": "Gracias. La tableta volverá a la pantalla de inicio."
  },
  "it": {
    "next": "Vai alla firma",
    "back": "Rileggi il regolamento",
    "sign": "Firma e invia alla reception",
    "clear": "Cancella la firma",
    "line": "Firma con il dito nel riquadro qui sotto.",
    "sent": "Il documento firmato è stato salvato.",
    "offline": "Connessione interrotta. Verifica del salvataggio…",
    "retry": "Salvataggio non riuscito. Riprova.",
    "wrong": "Se il nome è errato, rivolgiti alla reception prima di firmare.",
    "signTitle": "Conferma",
    "signedHint": "Grazie. Il tablet tornerà alla schermata iniziale."
  },
  "tr": {
    "next": "İmzaya geç",
    "back": "Kuralları tekrar oku",
    "sign": "İmzala ve resepsiyona gönder",
    "clear": "İmzayı temizle",
    "line": "Aşağıdaki alana parmağınızla imza atın.",
    "sent": "İmzalı belgeniz kaydedildi.",
    "offline": "Bağlantı kesildi. Kayıt kontrol ediliyor…",
    "retry": "Kaydedilemedi. Lütfen tekrar deneyin.",
    "wrong": "İsim yanlışsa imzalamadan önce resepsiyona başvurun.",
    "signTitle": "Onay",
    "signedHint": "Teşekkürler. Tablet ana ekrana dönecektir."
  },
  "ar": {
    "next": "الانتقال إلى التوقيع",
    "back": "قراءة القواعد مرة أخرى",
    "sign": "التوقيع والإرسال إلى الاستقبال",
    "clear": "مسح التوقيع",
    "line": "وقّع بإصبعك داخل المربع أدناه.",
    "sent": "تم حفظ المستند الموقّع.",
    "offline": "انقطع الاتصال. جارٍ التحقق من الحفظ…",
    "retry": "تعذر الحفظ. يُرجى المحاولة مجدداً.",
    "wrong": "إذا كان الاسم غير صحيح، يُرجى مراجعة الاستقبال قبل التوقيع.",
    "signTitle": "الموافقة",
    "signedHint": "شكراً لك. سيعود الجهاز إلى الشاشة الرئيسية."
  },
  "fa": {
    "next": "رفتن به بخش امضا",
    "back": "خواندن دوبارهٔ مقررات",
    "sign": "امضا و ارسال به پذیرش",
    "clear": "پاک کردن امضا",
    "line": "با انگشت در کادر زیر امضا کنید.",
    "sent": "سند امضاشدهٔ شما ذخیره شد.",
    "offline": "ارتباط قطع شد. در حال بررسی ذخیره‌سازی…",
    "retry": "ذخیره نشد. لطفاً دوباره تلاش کنید.",
    "wrong": "اگر نام درست نیست، پیش از امضا با پذیرش تماس بگیرید.",
    "signTitle": "تأیید",
    "signedHint": "سپاسگزاریم. دستگاه به صفحهٔ اصلی بازمی‌گردد."
  },
  "ja": {
    "next": "署名に進む",
    "back": "もう一度読む",
    "sign": "署名してフロントに送信",
    "clear": "署名を消す",
    "line": "下の枠に指でご署名ください。",
    "sent": "署名済みの文書を保存しました。",
    "offline": "接続が切れました。保存状況を確認しています…",
    "retry": "保存できませんでした。もう一度お試しください。",
    "wrong": "お名前が違う場合は、署名前にフロントにお知らせください。",
    "signTitle": "同意の確認",
    "signedHint": "ありがとうございます。まもなくホーム画面に戻ります。"
  },
  "ko": {
    "next": "서명으로 이동",
    "back": "수칙 다시 읽기",
    "sign": "서명하여 프런트에 보내기",
    "clear": "서명 지우기",
    "line": "아래 칸에 손가락으로 서명해 주세요.",
    "sent": "서명한 문서가 저장되었습니다.",
    "offline": "연결이 끊어졌습니다. 저장 여부를 확인 중입니다…",
    "retry": "저장하지 못했습니다. 다시 시도해 주세요.",
    "wrong": "이름이 다르면 서명 전에 프런트에 알려 주세요.",
    "signTitle": "동의 확인",
    "signedHint": "감사합니다. 잠시 후 홈 화면으로 돌아갑니다."
  },
  "zh-Hans": {
    "next": "前往签名",
    "back": "重新阅读规定",
    "sign": "签名并发送至前台",
    "clear": "清除签名",
    "line": "请用手指在下方框内签名。",
    "sent": "您签署的文件已保存。",
    "offline": "连接中断，正在检查保存状态…",
    "retry": "未能保存，请重试。",
    "wrong": "如姓名有误，请在签名前联系前台。",
    "signTitle": "确认同意",
    "signedHint": "谢谢。平板电脑即将返回主屏幕。"
  },
  "zh-Hant": {
    "next": "前往簽名",
    "back": "重新閱讀規定",
    "sign": "簽名並傳送至櫃檯",
    "clear": "清除簽名",
    "line": "請用手指在下方方框內簽名。",
    "sent": "您簽署的文件已儲存。",
    "offline": "連線中斷，正在確認儲存狀態…",
    "retry": "未能儲存，請重試。",
    "wrong": "如姓名有誤，請於簽名前聯絡櫃檯。",
    "signTitle": "確認同意",
    "signedHint": "謝謝。平板電腦即將返回主畫面。"
  }
},
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
export function GuestRules(){
 const [packet,setPacket]=useState<Packet|null>(null),[thanks,setThanks]=useState<Lang|null>(null)
 const [lang,setLang]=useState<Lang>("en"),[reviewed,setReviewed]=useState(false),[ack,setAck]=useState(false)
 const [ink,setInk]=useState<Point[][]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const current=useRef<Packet|null>(null),version=useRef(''),tokenRef=useRef(''),langRef=useRef(lang),active=useRef<number|null>(null),draft=useRef<Point[][]>([]),sent=useRef(false),signController=useRef<AbortController|null>(null)
 const dismissal=useRef<{token:string;id:string}|null>(null)
 const wakeReader=useRef<(()=>void)|null>(null)
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
  let running=false,wakePending=false
  const hide=()=>{controller?.abort();clearTimeout(expiry);clear();setThanks(null);tokenRef.current=''}
  async function poll(){
   if(!alive)return
   const token=device()
   if(token!==tokenRef.current){hide();tokenRef.current=token}
   if(token&&!document.hidden){
    controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8500)
    const requested=version.current
    const dismissed=dismissal.current?.token===token?dismissal.current.id:undefined
    try{
     const r=await call('read',token,{seen:requested,dismissed,waitMs:5000},controller.signal)
     if(!alive||document.hidden||token!==device()||requested!==version.current)return
     if(dismissed&&r.request===dismissed)return
     if(dismissed&&dismissal.current?.id===dismissed)dismissal.current=null
     lastGood=Date.now();setError(prev=>prev==='offline'?'':prev)
     if(!r.request){if(requested&&r.confirmed===requested)complete();else if(current.current)clear()}
     else if(r.request!==requested){
      if(!r.texts||typeof r.name!=='string'||!r.until)return
      reset();setThanks(null);version.current=r.request;current.current=r;setPacket(r);setLang(languages.includes(r.language)&&r.texts[r.language as Lang]?r.language:'en')
     }
     clearTimeout(expiry)
     if(r.request)expiry=window.setTimeout(hide,Math.max(0,Math.min(15000,Number(r.remainingMs))))
     return r.supportsWait===true
    }catch{if(alive&&!wakePending&&current.current){if(Date.now()-lastGood>14000)hide();else setError('offline')}}
    finally{clearTimeout(timeout);controller=undefined}
   }
  }
  const loop=async()=>{
   running=true;wakePending=false
   let waitSupported=false
   try{waitSupported=await poll()===true}finally{
    running=false
    if(alive)timer=window.setTimeout(loop,document.hidden?3000:wakePending?0:waitSupported?40:current.current?1800:750)
   }
  }
  const wake=()=>{clearTimeout(timer);if(running){wakePending=true;controller?.abort()}else void loop()}
  wakeReader.current=wake
  const visibility=()=>{if(document.hidden)hide();else wake()}
  const onRePair=()=>{hide();wake()}
  window.addEventListener('folio-pair',onRePair);document.addEventListener('visibilitychange',visibility)
  void loop()
  return()=>{alive=false;wakeReader.current=null;controller?.abort();signController.current?.abort();clearTimeout(timer);clearTimeout(expiry);window.removeEventListener('folio-pair',onRePair);document.removeEventListener('visibilitychange',visibility)}
 },[])
 useEffect(()=>{
  const el=dialog.current
  if(!el||!packet)return
  let count=0,lastTap=0,press:{id:number;x:number;y:number;at:number}|null=null
  const resetTaps=()=>{count=0;press=null}
  function down(e:PointerEvent){
   const target=e.target
   if(!e.isPrimary||e.button!==0||sent.current||!(target instanceof Element)||target.closest('button,select,input,label,a,.rr-ink')){resetTaps();return}
   press={id:e.pointerId,x:e.clientX,y:e.clientY,at:e.timeStamp}
  }
  function move(e:PointerEvent){
   if(press&&press.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>12)resetTaps()
  }
  function up(e:PointerEvent){
   move(e)
   if(!press||press.id!==e.pointerId||e.timeStamp-press.at>350){resetTaps();return}
   press=null
   count=e.timeStamp-lastTap<=500?count+1:1
   lastTap=e.timeStamp
   if(count<4||sent.current||!packet||current.current?.request!==packet.request)return
   dismissal.current={token:tokenRef.current,id:packet.request}
   clear()
   wakeReader.current?.()
  }
  el.addEventListener('pointerdown',down)
  el.addEventListener('pointermove',move)
  el.addEventListener('pointerup',up)
  el.addEventListener('pointercancel',resetTaps)
  el.addEventListener('scroll',resetTaps,true)
  return ()=>{
   el.removeEventListener('pointerdown',down)
   el.removeEventListener('pointermove',move)
   el.removeEventListener('pointerup',up)
   el.removeEventListener('pointercancel',resetTaps)
   el.removeEventListener('scroll',resetTaps,true)
  }
 },[packet])
 if(!packet&&!thanks)return null
 const copy=labels[thanks||lang]
 if(!packet)return <section className="rumi-rules rumi-rules-thanks" role="status" lang={thanks || lang} dir={thanks==="ar"||thanks==="fa"?"rtl":"ltr"}><div><div className="rr-brand">THE RUMI HOTEL</div><h1>{copy.sent}</h1><p>{copy.signedHint}</p></div></section>
 const local=packet.texts[lang],t=local.text
 function point(e:ReactPointer<SVGSVGElement>):Point{
  const rect=e.currentTarget.getBoundingClientRect()
  return [Math.max(0,Math.min(1000,Math.round((e.clientX-rect.left)*1000/rect.width))),Math.max(0,Math.min(300,Math.round((e.clientY-rect.top)*300/rect.height)))]
 }
 function down(e:ReactPointer<SVGSVGElement>){if(busy||active.current!==null||draft.current.length>=64)return;e.preventDefault();active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);draft.current=[...draft.current,[point(e)]];setInk(draft.current)}
 function move(e:ReactPointer<SVGSVGElement>){if(active.current!==e.pointerId||busy)return;const s=draft.current[draft.current.length-1];if(!s||draft.current.reduce((n,v)=>n+v.length,0)>=2400)return;const p=point(e),last=s[s.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<2)return;draft.current=[...draft.current.slice(0,-1),[...s,p]];setInk(draft.current)}
 function up(e:ReactPointer<SVGSVGElement>){if(active.current===e.pointerId){move(e);active.current=null}}
 const drawable=ink.some(s=>s.length>2&&s.reduce((distance,p,i)=>distance+(i?Math.hypot(p[0]-s[i-1][0],p[1]-s[i-1][1]):0),0)>=12)
 async function submit(){const original=current.current,token=device();if(!original||original.preview||!token||sent.current||!ack||!drawable)return;sent.current=true;setBusy(true);setError('');const ctrl=new AbortController();signController.current=ctrl;const timeout=setTimeout(()=>ctrl.abort(),8000)
  try{const r=await call('sign',token,{request:original.request,lang,textHash:local.textHash,ack:true,strokes:draft.current},ctrl.signal);if(current.current?.request===original.request&&token===device()&&r.state==='signed')complete()}
  catch{if(current.current?.request===original.request)setError('retry')}
  finally{clearTimeout(timeout);if(current.current?.request===original.request){sent.current=false;setBusy(false)}}
 }
 return <dialog ref={dialog} className="rumi-rules" onCancel={e=>e.preventDefault()} aria-modal="true" aria-label={t.title} lang={lang} dir={lang==="ar"||lang==="fa"?"rtl":"ltr"}>
  <header className="rr-head"><div className="rr-brand">THE RUMI HOTEL <span>· DUSHANBE</span></div><label className="rr-language-picker"><span aria-hidden="true">◎</span><select aria-label={names[lang]} value={lang} disabled={busy} onChange={e=>{const chosen=e.target.value as Lang;if(chosen!==lang){setLang(chosen);reset()}}}>{languages.filter(code=>packet.texts[code]).map(code=><option key={code} lang={code} value={code}>{names[code]}</option>)}</select></label></header>
  <div className="rr-scroll" ref={scroll}><main><h1>{reviewed?copy.signTitle:t.title}</h1>{!packet.preview&&<p className="rr-person"><strong>{packet.name}</strong><span>{t.arrival} · {packet.arrival}</span></p>}
  {reviewed?<><p>{copy.wrong}</p><label className="rr-check"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/><span>{t.confirm}</span></label>
   <p className="rr-label" id="rr-sign-label">{copy.line}</p><svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="rr-ink" direction="ltr" role="img" aria-labelledby="rr-sign-label" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={e=>{if(active.current===e.pointerId)active.current=null}}>{ink.map((s,i)=><polyline key={i} points={s.map(p=>p.join(',')).join(' ')} fill="none" stroke="#193e32" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
   <button className="rr-quiet" type="button" disabled={busy||!ink.length} onClick={erase}>{copy.clear}</button></>:<><p>{t.intro}</p>{t.sections.map(([name,body])=><section key={name}><h2>{name}</h2><p>{body}</p></section>)}</>}
  {error&&<p role="alert" className="rr-error">{error==='offline'?copy.offline:copy.retry}</p>}</main></div>
  <footer className="rr-foot">{reviewed?<><button className="rr-quiet" disabled={busy} onClick={()=>{setReviewed(false);setAck(false);erase();setError('')}}>{copy.back}</button><button className="rr-primary" disabled={busy||!ack||!drawable} onClick={()=>void submit()}>{copy.sign}</button></>:<><span role="status">{packet.preview?awaitingName[lang]:local.edition}</span><button className="rr-primary" disabled={packet.preview} onClick={()=>setReviewed(true)}>{copy.next}</button></>}</footer>
 </dialog>
}
