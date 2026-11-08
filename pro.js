/* =========================================================
   KI-COACH · Trading Journal
   Claude analysiert deine Trades (inkl. Strategie-Ranking)
   Einbinden: <script src="pro.js"></script> direkt vor </body>
   ========================================================= */
(function(){
'use strict';
if(typeof S==='undefined'||typeof render!=='function')return;

const FN='https://amqjsrhbomwenkhueehm.supabase.co/functions/v1/ai-coach';
const PUB='sb_publishable_FxLMPFgWxoYqNzQdBtQ2hA_94RN51-4';
const PS={busy:false,msg:'',cr:'w0'};

/* Analysen liegen in S.notes._pro.coach und werden mit synchronisiert */
function P(){let p=S.notes._pro;if(!p||typeof p!=='object'||Array.isArray(p))p=S.notes._pro={};if(!Array.isArray(p.coach))p.coach=[];return p;}
const pfTxt=pf=>pf>=99?'∞':pf.toFixed(2);
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const openTs=t=>t.bg&&t.bg.open?Number(t.bg.open):null;
const holdMin=t=>t.bg&&t.bg.open&&t.bg.close?(t.bg.close-t.bg.open)/6e4:null;
const hm=ts=>new Date(ts).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
const holdBucket=t=>{const m=holdMin(t);return m<5?'unter 5 min':m<30?'5–30 min':m<120?'30 min – 2 h':m<480?'2–8 h':'über 8 h';};

/* ---------- Zeiträume ---------- */
function isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=x.getUTCDay()||7;
x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y0)/864e5+1)/7);}
function weekOf(off){const n=new Date();n.setHours(12,0,0,0);n.setDate(n.getDate()-((n.getDay()+6)%7)-7*off);
const e=new Date(n);e.setDate(e.getDate()+6);return{from:isoOf(n),to:isoOf(e),kw:isoWeek(n)};}
function rangeTrades(rk){
if(rk==='all')return S.trades.slice();
if(rk==='w0'||rk==='w1'){const w=weekOf(+rk[1]);return S.trades.filter(t=>t.date>=w.from&&t.date<=w.to);}
const d=new Date();d.setDate(d.getDate()-Number(rk));const f=isoOf(d);return S.trades.filter(t=>t.date>=f);
}
function rLabel(rk){
if(rk==='all')return 'alle Trades';
if(rk==='w0'||rk==='w1'){const w=weekOf(+rk[1]);return 'KW '+w.kw+' ('+deDate(w.from)+' – '+deDate(w.to)+')';}
return 'letzte '+rk+' Tage';
}

/* ---------- Prompt ---------- */
function buildPrompt(rk){
const L=rangeTrades(rk).sort((a,b)=>a.date.localeCompare(b.date)||((a.bg&&a.bg.close)||a.id)-((b.bg&&b.bg.close)||b.id));
const m=metrics(L),o=[];
const gs=(title,rows)=>rows.length?'\n'+title+':\n'+rows.map(r=>'- '+r.k+': '+r.n+' Trades, Netto '+sgn(r.net,0)+', Treffer '+r.wr.toFixed(0)+'%, PF '+pfTxt(r.pf)+(r.avgR!=null?', Ø R '+r.avgR.toFixed(2):'')).join('\n'):'';
o.push('Du bist mein Trading-Coach. Analysiere mein Trading-Journal ehrlich, konkret und mit Zahlen. Ich trade Krypto-Futures (Bitget USDT-M Perps), vor allem BTC und ETH. Antworte auf Deutsch, locker (du), in Markdown mit genau diesen Abschnitten:\n'+
'## Kurzfazit (2–3 Sätze)\n'+
'## Strategie-Ranking (jede Strategie/Setup mit Trades, Netto, Trefferquote, Profit-Faktor; klarer Sieger und Verlierer; Empfehlung pro Strategie: behalten, anpassen oder pausieren – und warum)\n'+
'## Was funktioniert (3 Punkte mit Zahlen)\n## Wo du Geld verlierst (3 Punkte mit Zahlen)\n'+
'## Muster & Auffälligkeiten (Zeiten, Haltedauer, Setups, Tags, Notizen, Gebühren)\n'+
'## 3 Regeln für nächste Woche (konkret und messbar)\n## Fokus der Woche (1 Satz)\n'+
'Erfinde nichts – nur was die Daten hergeben. Wenn die Datenbasis zu klein für eine Aussage ist, sag das. Trades mit Setup „Kein Modell“ sind keiner Strategie zugeordnet. Beträge in $.');
o.push('\n# Überblick ('+rLabel(rk)+')');
o.push('Trades: '+m.t.length+' ('+m.nw+' Gewinner, '+m.nl+' Verlierer) · Netto: '+sgn(m.net)+' · Trefferquote: '+m.winRate.toFixed(1)+'% · Profit-Faktor: '+pfTxt(m.pf)+
' · Ø Gewinn: '+usd(m.avgWin)+' · Ø Verlust: '+usd(m.avgLoss)+' · Max. Drawdown: '+usd(m.maxDD)+' · Gewinntage: '+m.dayWin.toFixed(0)+'% · Regeltreue: '+m.adherence.toFixed(0)+'%');
const b=L.filter(t=>t.bg&&t.bg.fees!=null);
if(b.length){const cost=b.reduce((s,t)=>s-Number(t.bg.fees||0),0),net=b.reduce((s,t)=>s+t.pnl,0);
o.push('Gebühren+Funding (Bitget): Brutto '+sgn(net+cost)+', Kosten '+usd(cost)+', Netto '+sgn(net)+', Ø '+usd(cost/b.length)+' pro Trade.');}
o.push(gs('Nach Strategie/Setup',groupStats(L,t=>t.model)));
o.push(gs('Nach Session',groupStats(L,t=>t.session)));
o.push(gs('Nach Symbol',groupStats(L,t=>t.symbol)));
o.push(gs('Nach Richtung',groupStats(L,t=>t.dir)));
o.push(gs('Nach Wochentag',groupStats(L,t=>WEEKDAYS[new Date(t.date+'T12:00:00').getDay()])));
o.push(gs('Nach Ausführungs-Note',groupStats(L,t=>t.grade)));
o.push(gs('Nach Uhrzeit (Entry, 2h-Blöcke)',groupStats(L.filter(openTs),t=>{const h=new Date(openTs(t)).getHours();return (h-h%2)+'–'+(h-h%2+2)+' Uhr';})));
o.push(gs('Nach Haltedauer',groupStats(L.filter(t=>holdMin(t)!=null),holdBucket)));
const tg=TAGS.map(x=>{const l=L.filter(t=>(t.tags||[]).indexOf(x)>=0);return{k:x,n:l.length,net:l.reduce((s,t)=>s+t.pnl,0)};}).filter(r=>r.n);
if(tg.length)o.push('\nFehler-/Qualitäts-Tags:\n'+tg.map(r=>'- '+r.k+': '+r.n+'×, Netto '+sgn(r.net,0)).join('\n'));
o.push('\n# Einzelne Trades (Datum;Uhrzeit;Symbol;Richtung;P&L;R;Note;Setup;AmPlan;Tags;Haltedauer_min;Warum)');
L.slice(-150).forEach(t=>{const h=holdMin(t);
o.push([t.date,openTs(t)?hm(openTs(t)):'',t.symbol,t.dir,t.pnl,t.r==null?'':t.r,t.grade,t.model,t.plan?'ja':'nein',(t.tags||[]).join('|'),
h==null?'':Math.round(h),(t.why&&t.why!==NOTE_FALLBACK?t.why:'').replace(/\s+/g,' ').replace(/;/g,',').slice(0,180)].join(';'));});
const first=L.length?L[0].date:'0000',last=L.length?L[L.length-1].date:'9999';
const notes=Object.keys(S.notes).filter(k=>/^\d{4}-\d\d-\d\d$/.test(k)&&k>=first&&k<=last&&typeof S.notes[k]==='string').sort();
if(notes.length)o.push('\n# Tagesnotizen\n'+notes.slice(-40).map(k=>'- '+k+': '+S.notes[k].replace(/\s+/g,' ').slice(0,300)).join('\n'));
return o.filter(Boolean).join('\n');
}

/* ---------- Claude aufrufen ---------- */
function token(){
try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k));const s=v&&(v.access_token?v:v.currentSession);if(s&&s.access_token)return s.access_token;}}}catch(e){}
return null;
}
const rr=()=>{render();startTicker();};
async function runCoach(){
if(PS.busy)return;
if(!rangeTrades(PS.cr).length){PS.msg='⚠️ Keine Trades in diesem Zeitraum.';rr();return;}
const tok=token();
if(!tok){PS.msg='⚠️ Erst in den Einstellungen einloggen (Synchronisierung).';rr();return;}
PS.busy=true;PS.msg='Claude analysiert deine Trades … das dauert ca. 20–60 Sekunden.';rr();
try{
const r=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':PUB},body:JSON.stringify({prompt:buildPrompt(PS.cr)})});
const j=await r.json().catch(()=>({}));
if(!r.ok)throw new Error(j.error||j.msg||j.message||('HTTP '+r.status));
if(!j.text)throw new Error('Leere Antwort');
const p=P();p.coach.unshift({ts:Date.now(),rk:PS.cr,lbl:rLabel(PS.cr),text:j.text});p.coach=p.coach.slice(0,8);
PS.msg='';save();
}catch(e){
const msg=e.message||String(e);
PS.msg='⚠️ '+msg+(/404|not found|Failed to fetch|Load failed/i.test(msg)?' – ist die Edge Function „ai-coach“ deployed? Bis dahin: „Prompt kopieren“.':'');
}finally{PS.busy=false;rr();}
}
function copyPrompt(){
const p=buildPrompt(PS.cr);
const fallback=()=>{showModal('<div class="sec">Prompt für Claude</div><div class="sm muted" style="margin:6px 0 10px">Alles markieren, kopieren und in Claude einfügen.</div><textarea id="px-prompt" rows="14" readonly>'+esc(p)+'</textarea>'+
'<div style="display:flex;gap:8px;margin-top:12px"><button class="btn" data-action="closeModal">Schließen</button></div>');
const ta=document.getElementById('px-prompt');if(ta){ta.focus();ta.select();}};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(p).then(function(){PS.msg='✓ Prompt kopiert – jetzt in Claude einfügen.';rr();},fallback);
else fallback();
}

/* ---------- Anzeige ---------- */
function md(s){
return esc(s).split('\n').map(l=>{
l=l.replace(/\*\*(.+?)\*\*/g,'<b style="color:var(--text)">$1</b>');
if(/^#{1,4} /.test(l))return '<div class="sec" style="margin:16px 0 6px;color:var(--text)">'+l.replace(/^#+ /,'')+'</div>';
if(/^\s*[-*•] /.test(l))return '<div style="display:flex;gap:8px;margin:5px 0"><span class="gold">•</span><span>'+l.replace(/^\s*[-*•] /,'')+'</span></div>';
const n=l.match(/^\s*(\d+)[.)] (.*)$/);if(n)return '<div style="display:flex;gap:8px;margin:5px 0"><span class="gold mono">'+n[1]+'</span><span>'+n[2]+'</span></div>';
if(/^\|.*\|$/.test(l.trim())){if(/^\|[\s:|-]+\|$/.test(l.trim()))return '';return '<div class="mono sm" style="display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;padding:5px 0;border-top:1px solid var(--border)">'+l.trim().slice(1,-1).split('|').map(c=>'<span>'+c.trim()+'</span>').join('')+'</div>';}
return l.trim()?'<div style="margin:5px 0">'+l+'</div>':'';
}).join('');
}
function viewCoach(){
const C=P().coach,err=/⚠/.test(PS.msg);
const ranges=[['w0','Diese Woche'],['w1','Letzte Woche'],['30','30 Tage'],['all','Alles']];
let h='<div class="sechead" style="margin:6px 2px 12px"><span class="sec">06 // KI-Coach</span><span class="sec">Claude</span></div>'+
'<div class="card" style="margin-bottom:10px">'+
'<div class="sm muted" style="line-height:1.6;margin-bottom:12px">Claude geht deine Trades, Notizen, Tags, Zeiten und Gebühren durch, sagt dir welche Strategie am besten lief und gibt dir 3 Regeln für nächste Woche.</div>'+
'<div class="seg" style="margin-bottom:10px">'+ranges.map(r=>'<button data-kc="range" data-v="'+r[0]+'" class="'+(PS.cr===r[0]?'on':'')+'">'+r[1]+'</button>').join('')+'</div>'+
'<div class="sm muted" style="margin-bottom:10px">'+esc(rLabel(PS.cr))+' · '+rangeTrades(PS.cr).length+' Trades</div>'+
'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-kc="run"'+(PS.busy?' disabled':'')+'>'+(PS.busy?'Claude denkt nach…':'🤖 Analyse starten')+'</button>'+
'<button class="btn" data-kc="copy">Prompt kopieren</button></div>'+
(PS.msg?'<div class="sm" style="margin-top:10px;line-height:1.5;color:'+(err?'var(--red)':'var(--muted)')+'">'+esc(PS.msg)+'</div>':'')+
'<div class="sm muted" style="margin-top:8px">„Prompt kopieren“ geht ohne Setup: einfach in Claude einfügen.</div></div>';
C.forEach((r,i)=>{
const head=new Date(r.ts).toLocaleDateString('de-DE',{day:'numeric',month:'short'})+' · '+(r.lbl||r.rk);
const body='<div style="color:var(--body);font-size:13.5px;line-height:1.6">'+md(r.text)+'</div>';
h+=i===0?'<div class="card" style="margin-bottom:10px"><div class="sechead"><span class="sec">Letzte Analyse · '+esc(head)+'</span></div>'+body+'</div>'
:'<details class="card" style="margin-bottom:10px"><summary class="sec" style="cursor:pointer;list-style:none">▸ '+esc(head)+'</summary><div style="margin-top:8px">'+body+'</div></details>';
});
return h;
}
/* Sonntag ab 17 Uhr / Montag: Hinweis im Dashboard */
function weekBanner(){
const n=new Date(),d=n.getDay();let rk=null;
if(d===0&&n.getHours()>=17)rk='w0';else if(d===1)rk='w1';
if(!rk)return '';
const w=weekOf(+rk[1]),p=P();
if(p.wkSeen===w.from||!rangeTrades(rk).length)return '';
return '<div class="card" style="margin:10px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-color:rgba(var(--greenrgb),.45)">'+
'<span class="sm">🤖 KW '+w.kw+' ist rum – welche Strategie lief am besten?</span>'+
'<span style="display:flex;gap:6px"><button class="btn primary" data-kc="week" data-v="'+rk+'" data-k="'+w.from+'">Analysieren</button>'+
'<button class="btn tiny" data-kc="hide" data-k="'+w.from+'">✕</button></span></div>';
}

/* ---------- Einhängen ---------- */
NAV.push(['coach','KI-Coach']);
const _render=render;
render=function(){
_render();
const tb=document.getElementById('tabs');
if(tb)tb.insertAdjacentHTML('beforeend','<button class="tab '+(S.view==='coach'?'on':'')+'" data-action="view" data-v="coach">KI</button>');
};
const _viewForm=viewForm;
viewForm=function(){return S.view==='coach'?viewCoach():_viewForm();};
const _viewDash=viewDash;
viewDash=function(m,mAll){
const h=_viewDash(m,mAll),x=weekBanner(),i=h.indexOf('<div class="ticker"');
return !x?h:i<0?x+h:h.slice(0,i)+x+h.slice(i);
};
document.head.insertAdjacentHTML('beforeend','<style>.tab{padding:9px 8px}</style>');

document.addEventListener('click',function(e){
const el=e.target.closest('[data-kc]');if(!el||el.disabled)return;
const a=el.dataset.kc;
if(a==='range'){PS.cr=el.dataset.v;rr();}
else if(a==='run')runCoach();
else if(a==='copy')copyPrompt();
else if(a==='week'){P().wkSeen=el.dataset.k;save();PS.cr=el.dataset.v;S.view='coach';window.scrollTo(0,0);rr();runCoach();}
else if(a==='hide'){P().wkSeen=el.dataset.k;save();rr();}
});

render();startTicker();
})();
