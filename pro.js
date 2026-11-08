/* =========================================================
   PRO-UPGRADE · Trading Journal
   Heatmap · Gebühren · Trade Replay · MAE/MFE · Prop-Firm
   Playbook · Review-Queue · Wochen-Report · KI-Coach
   Einbinden: <script src="pro.js"></script> direkt vor </body>
   ========================================================= */
(function(){
'use strict';
if(typeof S==='undefined'||typeof render!=='function')return;

const FN='https://amqjsrhbomwenkhueehm.supabase.co/functions/v1/';
const PUB='sb_publishable_FxLMPFgWxoYqNzQdBtQ2hA_94RN51-4';
const DAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
const PS={tab:'ins',week:0,cell:null,run:false,msg:'',cBusy:false,cMsg:'',cr:'30',rv:null,skip:new Set(),lastNew:null,auto:false,ck:null};

/* ---------- Daten: liegen in S.notes._pro und werden mit synchronisiert ---------- */
function P(){
let p=S.notes._pro;
if(!p||typeof p!=='object'||Array.isArray(p))p=S.notes._pro={};
if(!Array.isArray(p.pb))p.pb=[];
if(!p.mae||typeof p.mae!=='object')p.mae={};
if(!Array.isArray(p.coach))p.coach=[];
if(!p.prop||typeof p.prop!=='object')p.prop={};
return p;
}

/* ---------- Helfer ---------- */
const col=v=>v>=0?'var(--green)':'var(--red)';
const pct=(v,d)=>(v==null||!isFinite(v))?'–':v.toFixed(d||0).replace('.',',')+' %';
const openTs=t=>t.bg&&t.bg.open?Number(t.bg.open):null;
const holdMin=t=>t.bg&&t.bg.open&&t.bg.close?(t.bg.close-t.bg.open)/6e4:null;
const fmtP=p=>Number(p).toLocaleString('de-DE',{maximumFractionDigits:p>=1000?1:p>=100?2:p>=1?4:6});
const hm=ts=>new Date(ts).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
const dur=m=>m==null?'–':m<60?Math.round(m)+' min':m<1440?(m/60).toFixed(1).replace('.',',')+' h':(m/1440).toFixed(1).replace('.',',')+' Tage';
const quant=(a,q)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.round(q*(s.length-1)))];};
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sum=l=>({n:l.length,net:l.reduce((s,t)=>s+t.pnl,0)});
const byId=id=>S.trades.find(t=>String(t.id)===String(id));
const pfTxt=pf=>pf>=99?'∞':pf.toFixed(2);
const kpi=(k,v,c,s)=>'<div class="card kpi"><div class="sec">'+k+'</div><div class="v mono" style="color:'+(c||'var(--text)')+'">'+v+'</div><div class="s mono">'+(s||'')+'</div></div>';
const card=(title,body,right)=>'<div class="card" style="margin-bottom:10px"><div class="sechead"><span class="sec">'+title+'</span>'+(right||'')+'</div>'+body+'</div>';
const bar=(p,c)=>'<div class="bar" style="height:6px"><i style="width:'+Math.max(0,Math.min(100,p||0))+'%;background:'+c+'"></i></div>';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- Styles ---------- */
document.head.insertAdjacentHTML('beforeend','<style>'+
'.tab{padding:9px 7px}'+
'.px-heat{display:grid;grid-template-columns:22px repeat(12,1fr);gap:3px}'+
'.px-hl{font:500 9px ui-monospace,Menlo,monospace;color:var(--muted);text-align:center;align-self:center}'+
'.px-hc{aspect-ratio:1;border-radius:5px;border:1px solid var(--border);font:500 9px ui-monospace,Menlo,monospace;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text)}'+
'.px-hc.on{outline:1.5px solid var(--text);outline-offset:1px}'+
'.px-ban{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-radius:14px;margin:10px 0;border:1px solid var(--border);font-size:13px;line-height:1.5}'+
'.px-gold{border-color:rgba(227,179,65,.45);background:rgba(227,179,65,.08)}'+
'.px-red{border-color:rgba(var(--redrgb),.5);background:rgba(var(--redrgb),.1)}'+
'.px-green{border-color:rgba(var(--greenrgb),.45);background:rgba(var(--greenrgb),.08)}'+
'.px-ck{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:11px 10px;margin-bottom:6px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:14px}'+
'.px-ck.on{border-color:rgba(var(--greenrgb),.5);background:rgba(var(--greenrgb),.08)}'+
'.px-box{width:20px;height:20px;border-radius:6px;border:1px solid var(--muted);display:flex;align-items:center;justify-content:center;color:var(--green);flex:none;font-size:13px}'+
'.px-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
'.px-f{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)}'+
'.px-f input{padding:9px;font-size:15px}'+
'.px-row{display:grid;grid-template-columns:62px minmax(0,1fr) 54px 54px 44px 70px;gap:6px;align-items:center;padding:9px 0;border-top:1px solid var(--border);font-size:12px;cursor:pointer}'+
'@media(max-width:520px){.px-row{grid-template-columns:52px minmax(0,1fr) 50px 50px 64px}.px-row .hm{display:none}}'+
'.px-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}'+
'details.card summary{list-style:none}details.card summary::-webkit-details-marker{display:none}'+
'</style>');

/* =========================================================
   1) INSIGHTS: Heatmap, Gebühren, Long/Short, Haltedauer
   ========================================================= */
function heatCard(list){
const timed=list.filter(openTs);
if(!timed.length)return card('Uhrzeit × Wochentag','<div class="sm muted">Braucht Trades mit Uhrzeit – kommt automatisch mit dem Bitget-Import.</div>');
const g={};
timed.forEach(t=>{const d=new Date(openTs(t)),k=((d.getDay()+6)%7)+'_'+Math.floor(d.getHours()/2);(g[k]=g[k]||[]).push(t);});
const st=k=>{const l=g[k];if(!l)return null;const net=l.reduce((s,t)=>s+t.pnl,0);return{k:k,n:l.length,net:net,wr:l.filter(t=>t.pnl>0).length/l.length*100};};
const all=Object.keys(g).map(st),max=Math.max(1,...all.map(c=>Math.abs(c.net)));
let h='<div class="px-heat"><div></div>';
for(let c=0;c<12;c++)h+='<div class="px-hl">'+(c%2?'':c*2)+'</div>';
for(let r=0;r<7;r++){
h+='<div class="px-hl" style="text-align:left">'+DAYS[r]+'</div>';
for(let c=0;c<12;c++){const k=r+'_'+c,s=st(k);
const bg=s?'rgba(var('+(s.net>=0?'--greenrgb':'--redrgb')+'),'+(.15+.75*Math.abs(s.net)/max).toFixed(2)+')':'var(--card)';
h+='<div class="px-hc'+(PS.cell===k?' on':'')+'" data-pro="cell" data-v="'+k+'" style="background:'+bg+'">'+(s?s.n:'')+'</div>';}}
h+='</div>';
const lbl=k=>{const p=k.split('_');return DAYS[p[0]]+' · '+(p[1]*2)+'–'+(p[1]*2+2)+' Uhr';};
const line=s=>'<b>'+lbl(s.k)+'</b> · '+s.n+' Trade'+(s.n>1?'s':'')+' · <span class="mono" style="color:'+col(s.net)+'">'+sgn(s.net,0)+'</span> · '+s.wr.toFixed(0)+' % Treffer';
const sel=PS.cell&&st(PS.cell);
const ok=all.filter(c=>c.n>=2).sort((a,b)=>b.net-a.net);
let foot=sel?'<div class="note"><span>◉</span><span>'+line(sel)+'</span></div>':'';
if(ok.length>=2){
if(ok[0].net>0)foot+='<div class="note"><span class="green">▲</span><span>Beste Zeit: '+line(ok[0])+'</span></div>';
if(ok[ok.length-1].net<0)foot+='<div class="note"><span class="red">▼</span><span>Schlechteste Zeit: '+line(ok[ok.length-1])+'</span></div>';}
return card('Uhrzeit × Wochentag',h+'<div class="sm muted" style="margin-top:8px">Zahl = Anzahl Trades · Farbe = Netto-P&amp;L · Zelle antippen</div>'+foot,'<span class="sec">'+timed.length+' Trades</span>');
}
function feeInfo(list){
const b=list.filter(t=>t.bg&&t.bg.fees!=null);
const raw=b.reduce((s,t)=>s+Number(t.bg.fees||0),0),sg=raw>0?1:-1;
const cost=t=>sg*Number(t.bg.fees||0);
const tc=b.reduce((s,t)=>s+cost(t),0),net=b.reduce((s,t)=>s+t.pnl,0),gross=net+tc;
const flipped=b.filter(t=>t.pnl<0&&t.pnl+cost(t)>0);
return{b:b,cost:tc,net:net,gross:gross,flipped:flipped,per:b.length?tc/b.length:0};
}
function feeCard(list){
const f=feeInfo(list);
if(!f.b.length)return card('Gebühren &amp; Funding','<div class="sm muted">Kommt automatisch mit Bitget-Trades.</div>');
let h='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'+
'<div><div class="sec">Brutto</div><div class="mono" style="font-size:17px;margin-top:4px;color:'+col(f.gross)+'">'+sgn(f.gross,0)+'</div></div>'+
'<div><div class="sec">Kosten</div><div class="mono" style="font-size:17px;margin-top:4px;color:var(--red)">'+usd(-f.cost,0)+'</div></div>'+
'<div><div class="sec">Netto</div><div class="mono" style="font-size:17px;margin-top:4px;color:'+col(f.net)+'">'+sgn(f.net,0)+'</div></div></div>';
if(f.gross>0&&f.cost<f.gross)h+='<div class="note"><span class="gold">◆</span><span>Gebühren + Funding fressen <b>'+pct(f.cost/f.gross*100,0)+'</b> deines Brutto-Gewinns.</span></div>';
else h+='<div class="note"><span class="gold">◆</span><span>Ohne Gebühren lägst du bei <b class="mono">'+sgn(f.gross,0)+'</b> statt <b class="mono">'+sgn(f.net,0)+'</b>.</span></div>';
h+='<div class="note"><span class="muted">Ø</span><span>Kosten pro Trade: <b class="mono">'+usd(f.per,2)+'</b> bei '+f.b.length+' Bitget-Trades</span></div>';
if(f.flipped.length)h+='<div class="note"><span class="red">!</span><span><b>'+f.flipped.length+'</b> Trade'+(f.flipped.length>1?'s waren':' war')+' eigentlich im Plus – erst die Gebühren haben '+(f.flipped.length>1?'sie':'ihn')+' zum Verlierer gemacht. Zu enge Ziele?</span></div>';
return card('Gebühren &amp; Funding',h);
}
function holdBucket(t){const m=holdMin(t);return m<5?'unter 5 min':m<30?'5–30 min':m<120?'30 min – 2 h':m<480?'2–8 h':'über 8 h';}
function vIns(){
const L=S.trades,hold=L.filter(t=>holdMin(t)!=null),ck=L.filter(t=>t.chk);
return reviewBanner()+heatCard(L)+feeCard(L)+
'<div class="grid gl2" style="margin-bottom:10px">'+
tableCard('Long vs. Short',groupStats(L,t=>t.dir==='SHORT'?'Short':'Long'))+
tableCard('Nach Haltedauer',groupStats(hold,holdBucket),hold.length?'':'Braucht Bitget-Trades.')+
tableCard('Nach Ausführungs-Note',groupStats(L,t=>t.grade))+
tableCard('Regeln erfüllt?',groupStats(ck,t=>t.chk.met>=t.chk.total?'Alle Regeln erfüllt':'Regeln verletzt'),ck.length?'':'Füllt sich, wenn du beim Bewerten die Playbook-Regeln abhakst.')+
'</div>';
}

/* =========================================================
   2) TRADE REPLAY + MAE/MFE (Kerzen von der Bitget-API)
   ========================================================= */
const GR=[['1m',6e4],['3m',18e4],['5m',3e5],['15m',9e5],['30m',18e5],['1H',36e5],['4H',144e5],['12H',432e5],['1D',864e5]];
const CC={};
async function candles(t){
const o=Number(t.bg.open),c=Number(t.bg.close),d=Math.max(c-o,6e4);
let g=GR[GR.length-1];
for(const x of GR){const pad=Math.max(d*.6,25*x[1]);if((d+2*pad)/x[1]<=190){g=x;break;}}
const pad=Math.max(d*.6,25*g[1]);
const start=Math.floor((o-pad)/g[1])*g[1],end=Math.min(Math.ceil((c+pad)/g[1])*g[1],Date.now());
const sym=String(t.symbol).toUpperCase().replace(/[^A-Z0-9]/g,'');
const pt=/USDC$|PERP$/.test(sym)?'USDC-FUTURES':'USDT-FUTURES';
const key=sym+g[0]+start+'-'+end;
if(CC[key])return CC[key];
const q='symbol='+sym+'&productType='+pt+'&granularity='+g[0]+'&startTime='+start+'&endTime='+end;
let rows=[];
for(const ep of [['candles',1000],['history-candles',200]]){
try{
const r=await fetch('https://api.bitget.com/api/v2/mix/market/'+ep[0]+'?'+q+'&limit='+ep[1],{cache:'no-store'});
const j=await r.json();
rows=(j.data||[]).map(a=>({t:+a[0],o:+a[1],h:+a[2],l:+a[3],c:+a[4]})).filter(k=>k.t>=start&&k.t<=end&&k.h>0).sort((a,b)=>a.t-b.t);
if(rows.length&&rows[0].t<=o)break;
}catch(e){}
}
if(!rows.length)throw new Error('Keine Kerzen von Bitget für '+sym);
return CC[key]={rows:rows,g:g[1],gl:g[0]};
}
function calcMae(t,cd){
const o=+t.bg.open,c=+t.bg.close,E=+t.bg.entry,X=+t.bg.exit,long=t.dir!=='SHORT',sz=Math.abs(+t.bg.size||0);
const inT=cd.rows.filter(k=>k.t+cd.g>o&&k.t<=c);
if(!inT.length||!(E>0)||!(X>0))return null;
const hi=Math.max(E,X,...inT.map(k=>k.h)),lo=Math.min(E,X,...inT.map(k=>k.l));
const ae=long?E-lo:hi-E,fe=long?hi-E:E-lo,real=long?X-E:E-X;
const r4=v=>Math.round(v*1e4)/1e4;
return{a:r4(ae/E*100),f:r4(fe/E*100),r:r4(real/E*100),au:Math.round(ae*sz*100)/100,fu:Math.round(fe*sz*100)/100,
e:fe>0?r4(Math.max(-1,Math.min(1,real/fe))):null,g:cd.gl};
}
function candleSvg(t,cd,m,small){
const R=cd.rows,W=640,H=small?220:300,PR=74,PT=8,PB=22,PL=2;
const E=+t.bg.entry,X=+t.bg.exit,o=+t.bg.open,c=+t.bg.close,long=t.dir!=='SHORT';
let hi=Math.max(E,X,...R.map(k=>k.h)),lo=Math.min(E,X,...R.map(k=>k.l));
const sp=(hi-lo)||hi*.002||1;hi+=sp*.06;lo-=sp*.06;
const t0=R[0].t,t1=R[R.length-1].t+cd.g,cw=W-PL-PR;
const x=ts=>PL+(ts-t0)/(t1-t0)*cw,y=p=>PT+(hi-p)/(hi-lo)*(H-PT-PB);
const bw=Math.max(1,cw/R.length*.62),f1=v=>v.toFixed(1);
let s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;border-radius:10px;background:var(--card);border:1px solid var(--border)">';
s+='<rect x="'+f1(x(o))+'" y="'+PT+'" width="'+f1(Math.max(2,x(c)-x(o)))+'" height="'+(H-PT-PB)+'" style="fill:rgba(var('+(t.pnl>=0?'--greenrgb':'--redrgb')+'),.09)"/>';
R.forEach(k=>{const cl=k.c>=k.o?'var(--green)':'var(--red)',cx=x(k.t+cd.g/2);
s+='<line x1="'+f1(cx)+'" x2="'+f1(cx)+'" y1="'+f1(y(k.h))+'" y2="'+f1(y(k.l))+'" style="stroke:'+cl+'" stroke-width="1"/>'+
'<rect x="'+f1(cx-bw/2)+'" y="'+f1(y(Math.max(k.o,k.c)))+'" width="'+f1(bw)+'" height="'+f1(Math.max(1,Math.abs(y(k.o)-y(k.c))))+'" style="fill:'+cl+'" opacity=".85"/>';});
const hl=(p,cl,lab,dash,x1,x2)=>{x1=x1==null?PL:x1;x2=x2==null?W-PR:x2;
return '<line x1="'+f1(x1)+'" x2="'+f1(x2)+'" y1="'+f1(y(p))+'" y2="'+f1(y(p))+'" style="stroke:'+cl+'" stroke-width="1.3"'+(dash?' stroke-dasharray="4 4"':'')+'/>'+
(lab?'<text x="'+(x1>PL?f1(x1+3):(W-PR+5))+'" y="'+f1(x1>PL?y(p)+(cl==='var(--red)'?13:-4):y(p)+4)+'" font-size="12" font-family="ui-monospace,Menlo,monospace" style="fill:'+cl+'">'+lab+'</text>':'');};
if(m){const mp=long?E*(1-m.a/100):E*(1+m.a/100),fp=long?E*(1+m.f/100):E*(1-m.f/100);
s+=hl(mp,'var(--red)',m.a>0.01?'MAE':'',true,x(o),x(c))+hl(fp,'var(--green)',m.f>0.01?'MFE':'',true,x(o),x(c));}
s+=hl(E,'var(--muted)',fmtP(E),true)+hl(X,'var(--gold)',fmtP(X),false);
s+='<circle cx="'+f1(x(o))+'" cy="'+f1(y(E))+'" r="5" style="fill:var(--bg);stroke:var(--text)" stroke-width="2"/>'+
'<circle cx="'+f1(x(c))+'" cy="'+f1(y(X))+'" r="5" style="fill:var(--gold)"/>';
const tl=ts=>(t1-t0>864e5?new Date(ts).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+' ':'')+hm(ts);
s+='<text x="'+(PL+4)+'" y="'+(H-6)+'" font-size="11" style="fill:var(--muted)">'+tl(t0)+'</text>'+
'<text x="'+(W-PR)+'" y="'+(H-6)+'" font-size="11" text-anchor="end" style="fill:var(--muted)">'+tl(t1)+' · '+cd.gl+'</text>';
return s+'</svg>';
}
function maeVerdicts(t,m){
const v=[];
if(t.pnl>0&&m.e!=null&&m.e<.5)v.push(['gold','Du hast nur <b>'+Math.round(m.e*100)+' %</b> der maximalen Bewegung mitgenommen – Teil-TP oder Trailing-Stop testen.']);
if(t.pnl<0&&m.f>0.05&&m.f>=Math.abs(m.r))v.push(['gold','Der Trade war zwischenzeitlich <b>+'+pct(m.f,2)+'</b> im Plus – ein Break-Even-Stop hätte ihn gerettet.']);
if(t.pnl<0&&m.f<=0.05)v.push(['red','Lief praktisch sofort gegen dich – Entry zu früh oder gegen den Trend?']);
if(t.pnl>0&&m.a>0.05&&m.a>=m.f*.8)v.push(['gold','Viel Heat: erst <b>−'+pct(m.a,2)+'</b> gegen dich, bevor er lief – Entry-Timing prüfen.']);
if(t.pnl>0&&m.e!=null&&m.e>=.75)v.push(['green','Starker Exit: <b>'+Math.round(m.e*100)+' %</b> der Bewegung mitgenommen.']);
return v.map(x=>'<div class="note"><span class="'+x[0]+'">◆</span><span>'+x[1]+'</span></div>').join('');
}
function maeStats(t,m){
if(!m)return '<div class="sm muted" style="margin-top:10px">Keine Kerzen im Trade-Zeitraum gefunden.</div>';
const st=(k,v,c,sub)=>'<div><div class="sec">'+k+'</div><div class="mono" style="margin-top:3px;color:'+(c||'var(--text)')+'">'+v+'</div>'+(sub?'<div class="sm muted mono">'+sub+'</div>':'')+'</div>';
return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px">'+
st('MAE','−'+pct(m.a,2),'var(--red)',m.au?'≈ '+usd(-m.au,0):'')+
st('MFE','+'+pct(m.f,2),'var(--green)',m.fu?'≈ '+usd(m.fu,0):'')+
st('Exit-Effizienz',m.e==null?'–':Math.round(m.e*100)+' %',m.e!=null&&m.e>=.6?'var(--green)':m.e!=null&&m.e<.4?'var(--gold)':null)+
st('Haltedauer',dur(holdMin(t)))+st('Entry',fmtP(t.bg.entry))+st('Exit',fmtP(t.bg.exit))+'</div>'+
maeVerdicts(t,m)+'<div class="sm muted" style="margin-top:8px">Näherung über '+m.g+'-Kerzen im Trade-Zeitraum.</div>';
}
async function openReplay(id){
const t=byId(id);if(!t||!t.bg||!t.bg.open)return;
showModal('<div class="sec">Trade Replay</div>'+
'<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:6px 0 10px"><span class="mono" style="font-size:22px;color:'+col(t.pnl)+'">'+sgn(t.pnl)+'</span>'+
'<b>'+esc(t.symbol)+'</b><span style="color:'+(t.dir==='LONG'?'var(--green)':'var(--red)')+'">'+t.dir+'</span>'+
'<span class="sm muted">'+deDate(t.date)+' · '+hm(t.bg.open)+'–'+hm(t.bg.close)+'</span></div>'+
'<div id="px-rp" data-id="'+esc(String(t.id))+'"><div class="sm muted" style="padding:60px 0;text-align:center">Lade Kerzen von Bitget…</div></div>'+
'<div style="display:flex;gap:8px;margin-top:14px">'+(t.bgNew?'<button class="btn primary" data-pro="rv1" data-id="'+esc(String(t.id))+'">Jetzt bewerten</button>':'')+
'<button class="btn" data-action="closeModal">Schließen</button></div>');
let html;
try{
const cd=await candles(t),m=calcMae(t,cd);
if(m&&JSON.stringify(P().mae[t.id])!==JSON.stringify(m)){P().mae[t.id]=m;save();}
html=candleSvg(t,cd,m)+maeStats(t,m);
}catch(e){html='<div class="sm" style="color:var(--red);padding:30px 0;text-align:center">⚠️ '+esc(e.message)+'</div>';}
const el=document.getElementById('px-rp');if(el&&el.dataset.id===String(t.id))el.innerHTML=html;
}
async function maeAll(){
if(PS.run)return;
const todo=S.trades.filter(t=>t.bg&&t.bg.open&&t.bg.entry>0&&!P().mae[t.id]);
PS.run=true;render();startTicker();
let ok=0,fail=0;
for(let i=0;i<todo.length;i++){
const t=todo[i];PS.msg='Analysiere '+(i+1)+' / '+todo.length+' · '+t.symbol+' '+deDate(t.date);
const el=document.getElementById('px-maemsg');if(el)el.textContent=PS.msg;
try{const m=calcMae(t,await candles(t));if(m){P().mae[t.id]=m;ok++;}else fail++;}catch(e){fail++;}
await sleep(140);
}
PS.run=false;PS.msg='✓ '+ok+' Trades analysiert'+(fail?' · '+fail+' ohne Kerzen-Daten':'');
save();render();startTicker();
}
function scatter(done,M,p80){
const W=600,H=230,PL=8,PB=20;
const xs=done.map(t=>M[t.id].a),ys=done.map(t=>t.pnl);
const xm=Math.max(.01,...xs)*1.08,ym=Math.max(1,...ys.map(Math.abs))*1.12;
const x=v=>PL+v/xm*(W-PL-12),y=v=>(H-PB)/2-v/ym*((H-PB)/2-10);
let s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">'+
'<line x1="0" x2="'+W+'" y1="'+y(0).toFixed(1)+'" y2="'+y(0).toFixed(1)+'" style="stroke:var(--border)"/>';
if(p80!=null)s+='<line x1="'+x(p80).toFixed(1)+'" x2="'+x(p80).toFixed(1)+'" y1="4" y2="'+(H-PB)+'" style="stroke:var(--gold)" stroke-dasharray="4 4"/>'+
'<text x="'+(x(p80)+5).toFixed(1)+'" y="16" font-size="12" style="fill:var(--gold)">80 % der Gewinner</text>';
done.forEach(t=>{s+='<circle data-pro="replay" data-id="'+esc(String(t.id))+'" cx="'+x(M[t.id].a).toFixed(1)+'" cy="'+y(t.pnl).toFixed(1)+'" r="5" style="fill:'+col(t.pnl)+';cursor:pointer" opacity=".8"/>';});
s+='<text x="'+PL+'" y="'+(H-4)+'" font-size="11" style="fill:var(--muted)">MAE 0 %</text><text x="'+(W-4)+'" y="'+(H-4)+'" font-size="11" text-anchor="end" style="fill:var(--muted)">'+pct(xm,2)+' gegen dich →</text>';
return s+'</svg>';
}
function vMae(){
const bgT=S.trades.filter(t=>t.bg&&t.bg.open&&t.bg.entry>0);
if(!bgT.length)return card('MAE / MFE','<div class="sm muted">Braucht Bitget-Trades (mit Entry, Exit und Uhrzeit).</div>');
const M=P().mae,done=bgT.filter(t=>M[t.id]),open=bgT.length-done.length;
let h='<div class="card" style="margin-bottom:10px"><div class="sechead"><span class="sec">MAE / MFE</span><span class="sec">'+done.length+' / '+bgT.length+' analysiert</span></div>'+
'<div class="sm muted" style="line-height:1.6;margin-bottom:10px"><b style="color:var(--text)">MAE</b> = wie weit ein Trade maximal <i>gegen</i> dich lief. <b style="color:var(--text)">MFE</b> = wie weit er maximal <i>für</i> dich lief. Daran siehst du, ob dein Stop zu eng ist und ob du zu früh rausgehst.</div>'+
(open?'<button class="btn primary" data-pro="maeAll"'+(PS.run?' disabled':'')+'>'+(PS.run?'Analysiere…':'▶ '+open+' Trade'+(open>1?'s':'')+' analysieren')+'</button>':'')+
'<div class="sm muted" id="px-maemsg" style="margin-top:8px">'+esc(PS.msg)+'</div></div>';
if(!done.length)return h;
const Wn=done.filter(t=>t.pnl>0).map(t=>M[t.id]),Ls=done.filter(t=>t.pnl<0);
const wA=Wn.map(m=>m.a),med=quant(wA,.5),p80=quant(wA,.8);
const eff=avg(Wn.filter(m=>m.e!=null).map(m=>m.e*100));
const saved=Ls.filter(t=>M[t.id].f>0.05&&M[t.id].f>=Math.abs(M[t.id].r));
h+='<div class="kgrid">'+
kpi('Gewinner · Ø MAE',Wn.length?'−'+pct(avg(wA),2):'–','var(--red)','so viel Heat halten sie aus')+
kpi('Gewinner · Ø MFE',Wn.length?'+'+pct(avg(Wn.map(m=>m.f)),2):'–','var(--green)','max. möglich')+
kpi('Exit-Effizienz',eff==null?'–':Math.round(eff)+' %',eff!=null&&eff>=60?'var(--green)':'var(--gold)','der Bewegung mitgenommen')+
kpi('Verlierer · Ø MFE',Ls.length?'+'+pct(avg(Ls.map(t=>M[t.id].f)),2):'–',null,'waren mal so weit im Plus')+'</div>';
let ins='';
if(Wn.length>=3)ins+='<div class="note"><span class="gold">◆</span><span>Deine Gewinner liefen im Median nur <b>−'+pct(med,2)+'</b> gegen dich, 80 % blieben unter <b>−'+pct(p80,2)+'</b>. Ein Stop knapp hinter '+pct(p80,2)+' hätte 80 % deiner Gewinner überlebt.</span></div>';
if(eff!=null&&Wn.length>=3)ins+='<div class="note"><span class="gold">◆</span><span>Du nimmst im Schnitt <b>'+Math.round(eff)+' %</b> der maximalen Bewegung mit.'+(eff<50?' Da bleibt viel Geld liegen – Teil-TP oder Trailing-Stop testen.':' Solide.')+'</span></div>';
if(saved.length)ins+='<div class="note"><span class="gold">◆</span><span><b>'+saved.length+' von '+Ls.length+'</b> Verlierern waren zwischenzeitlich mindestens so weit im Plus, wie sie am Ende verloren haben. Ein Break-Even-Stop ab ca. <b>+'+pct(quant(saved.map(t=>M[t.id].f),.5),2)+'</b> hätte sie gerettet.</span></div>';
h+=card('Was die Daten sagen',(ins||'<div class="sm muted">Ab ca. 3 Gewinnern und Verlierern kommen hier konkrete Hinweise.</div>')+'<div style="margin-top:12px">'+scatter(done,M,Wn.length>=3?p80:null)+'</div><div class="sm muted">Punkt antippen = Replay · rechts = viel Heat</div>');
const rows=done.slice().sort((a,b)=>(b.bg.close||0)-(a.bg.close||0)).slice(0,40);
h+=card('Trades','<div class="px-row sec" style="cursor:default;border-top:0"><span>Datum</span><span>Symbol</span><span class="r">MAE</span><span class="r">MFE</span><span class="r hm">Eff.</span><span class="r">P&amp;L</span></div>'+
rows.map(t=>{const m=M[t.id];return '<div class="px-row" data-pro="replay" data-id="'+esc(String(t.id))+'"><span class="mono muted">'+deDate(t.date).slice(0,6)+'</span>'+
'<span>'+esc(t.symbol.replace(/USDT$/,''))+' <span style="color:'+(t.dir==='LONG'?'var(--green)':'var(--red)')+'">'+(t.dir==='LONG'?'L':'S')+'</span></span>'+
'<span class="r mono red">−'+m.a.toFixed(2)+'</span><span class="r mono green">+'+m.f.toFixed(2)+'</span>'+
'<span class="r mono hm">'+(m.e==null?'–':Math.round(m.e*100)+'%')+'</span><span class="r mono" style="color:'+col(t.pnl)+'">'+usd(t.pnl,0)+'</span></div>';}).join(''));
return h;
}

/* =========================================================
   3) PROP-FIRM-MODUS
   ========================================================= */
function propState(){
const c=P().prop;if(!c.on||!(+c.size>0))return null;
const size=+c.size,dll=+c.dll||0,mdd=+c.mdd||0,tgt=+c.target||0,maxT=+c.maxT||0,own=+c.own||0;
const list=S.trades.filter(t=>(!c.start||t.date>=c.start)&&(c.src==='bg'?!!t.bg:c.src==='man'?!t.bg:true))
.sort((a,b)=>a.date.localeCompare(b.date)||((a.bg&&a.bg.close)||a.id)-((b.bg&&b.bg.close)||b.id));
let bal=size,peak=size;list.forEach(t=>{bal+=t.pnl;peak=Math.max(peak,bal);});
const td=todayISO(),tl=list.filter(t=>t.date===td),tNet=tl.reduce((s,t)=>s+t.pnl,0);
const floor=mdd?(c.trail?Math.min(peak-mdd,size):size-mdd):-Infinity;
const ddLeft=bal-floor,dayLeft=dll?dll+tNet:Infinity;
const reasons=[];
if(dll&&tNet<=-dll)reasons.push('Tagesverlust-Limit erreicht');
if(mdd&&ddLeft<=0)reasons.push('Max. Drawdown erreicht');
if(maxT&&tl.length>=maxT)reasons.push('Max. '+maxT+' Trades heute erreicht');
if(own&&tNet<=-own)reasons.push('Dein eigener Tages-Stop ist erreicht');
const level=reasons.length?'red':((dll&&-tNet>=dll*.5)||(mdd&&ddLeft<=mdd*.3))?'gold':'green';
return{c:c,size:size,dll:dll,mdd:mdd,tgt:tgt,maxT:maxT,bal:bal,peak:peak,tNet:tNet,tCount:tl.length,floor:floor,ddLeft:ddLeft,dayLeft:dayLeft,
buf:Math.min(dayLeft,ddLeft,own?own+tNet:Infinity),prog:tgt?(bal-size)/tgt*100:null,reasons:reasons,level:level};
}
function propCard(s,full){
const lc=s.level==='red'?'var(--red)':s.level==='gold'?'var(--gold)':'var(--green)';
const row=(k,v,b)=>'<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px"><span class="sm">'+k+'</span><span class="mono sm">'+v+'</span></div>'+b+'</div>';
let h='<div class="card" style="margin:10px 0;border-color:'+lc+'"><div class="sechead"><span class="sec">Prop-Firm · '+esc(s.c.name||'Account')+'</span>'+
'<span class="sec" style="color:'+lc+'">● '+(s.level==='red'?'Gesperrt':s.level==='gold'?'Vorsicht':'Im Rahmen')+'</span></div>'+
'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="mono" style="font-size:22px">'+usd(s.bal,0)+'</span>'+
'<span class="mono sm" style="color:'+col(s.bal-s.size)+'">'+sgn(s.bal-s.size,0)+' seit Start</span></div>';
if(s.dll)h+=row('Heute','<span style="color:'+col(s.tNet)+'">'+sgn(s.tNet,0)+'</span> · Puffer '+usd(Math.max(0,s.dayLeft),0),bar(Math.max(0,-s.tNet)/s.dll*100,'var(--red)'));
if(s.mdd)h+=row('Drawdown-Puffer',usd(Math.max(0,s.ddLeft),0)+' · Grenze '+usd(s.floor,0),bar(s.ddLeft/s.mdd*100,s.ddLeft<s.mdd*.3?'var(--red)':'var(--green)'));
if(s.tgt)h+=row('Profit-Ziel',pct(s.prog,0)+' von '+usd(s.tgt,0),bar(s.prog,'var(--gold)'));
if(s.maxT)h+=row('Trades heute',s.tCount+' / '+s.maxT,bar(s.tCount/s.maxT*100,'var(--muted)'));
if(!s.reasons.length&&isFinite(s.buf)&&s.buf>0)h+='<div class="note"><span class="gold">◆</span><span>Max. Risiko für den nächsten Trade: <b class="mono">'+usd(s.buf/2,0)+'</b> (½ deines kleinsten Puffers)</span></div>';
if(s.reasons.length)h+='<div class="note"><span class="red">■</span><span style="color:var(--red)">'+esc(s.reasons.join(' · '))+' – heute kein Trade mehr.</span></div>';
if(!full)h+='<div style="margin-top:10px;text-align:right"><button class="btn tiny" data-pro="go" data-v="prop">Details</button></div>';
return h+'</div>';
}
function vProp(){
const c=P().prop,s=propState();
const inp=(k,lab,ph,type)=>'<label class="px-f"><span>'+lab+'</span><input data-prop="'+k+'" type="'+(type||'number')+'"'+(type?'':' inputmode="decimal"')+' value="'+esc(c[k]==null?'':c[k])+'" placeholder="'+ph+'"></label>';
const seg=(k,opts,cur)=>'<div class="seg">'+opts.map(o=>'<button data-pro="propSet" data-k="'+k+'" data-v="'+o[0]+'" class="'+(String(cur)===o[0]?'on':'')+'">'+o[1]+'</button>').join('')+'</div>';
return (s?propCard(s,true):'')+
'<div class="card" style="margin-bottom:10px"><div class="sechead"><span class="sec">Regeln deines Funded Accounts</span>'+
'<button class="btn tiny" data-pro="propOn" style="'+(c.on?'color:var(--green);border-color:var(--green)':'')+'">'+(c.on?'Aktiv ✓':'Aus')+'</button></div>'+
'<div class="px-form">'+inp('name','Name','z. B. IQCapital 25K','text')+inp('size','Kontogröße ($)','25000')+
inp('dll','Max. Tagesverlust ($)','1250')+inp('mdd','Max. Drawdown ($)','2500')+
inp('target','Profit-Ziel ($)','2500')+inp('maxT','Max. Trades pro Tag','3')+
inp('own','Eigener Tages-Stop ($)','optional')+inp('start','Start-Datum','','date')+'</div>'+
'<div class="lbl" style="margin-top:12px">Drawdown-Art</div>'+seg('trail',[['0','Statisch'],['1','Trailing']],c.trail?'1':'0')+
'<div class="lbl" style="margin-top:12px">Welche Trades zählen?</div>'+seg('src',[['all','Alle'],['bg','Nur Bitget'],['man','Nur manuelle']],c.src||'all')+
'<div class="sm muted" style="margin-top:12px;line-height:1.6">Gerechnet wird mit geschlossenen Trades ab dem Start-Datum – offene Positionen kennt das Journal nicht, also Puffer lassen. '+
'Wird eine Regel gebrochen, sperrt das Journal den Tag: rotes Banner im Dashboard und Sperre im Positionsrechner.</div></div>';
}
function lockCalc(){
const box=document.getElementById('pc-box');if(!box)return;
let d=document.getElementById('px-lock');
if(!d){d=document.createElement('div');d.id='px-lock';box.insertBefore(d,box.children[1]||null);}
const s=propState();
d.innerHTML=s&&s.reasons.length?'<div class="px-ban px-red" style="margin:0 0 10px"><span>🛑 <b>Gesperrt:</b> '+esc(s.reasons.join(' · '))+'. Heute kein neuer Trade.</span></div>'
:(s&&isFinite(s.buf)&&s.buf>0?'<div class="sm muted" style="margin-bottom:8px">Prop-Firm: max. Risiko nächster Trade ≈ <b class="mono">'+usd(s.buf/2,0)+'</b></div>':'');
}
const pcb=document.getElementById('pc-btn');if(pcb)pcb.addEventListener('click',lockCalc);

/* =========================================================
   4) SETUP-PLAYBOOK + CHECKLISTE
   ========================================================= */
function pbStats(name){
const l=S.trades.filter(t=>(t.model||'').toLowerCase()===name.toLowerCase()),ck=l.filter(t=>t.chk);
const s=sum(l);s.wr=l.length?l.filter(t=>t.pnl>0).length/l.length*100:0;
s.ok=sum(ck.filter(t=>t.chk.met>=t.chk.total));s.bad=sum(ck.filter(t=>t.chk.met<t.chk.total));
return s;
}
function pbSection(){
const pb=P().pb;
let h='<div class="sechead" style="margin:6px 2px 12px"><span class="sec">Playbook · '+pb.length+' Setup'+(pb.length===1?'':'s')+'</span><button class="btn primary" data-pro="pbEdit">+ Setup</button></div>';
if(!pb.length)h+='<div class="card sm muted" style="margin-bottom:14px;line-height:1.6">Leg deine Setups mit festen Regeln an. Dann kannst du vor jedem Trade die Checkliste durchgehen, beim Bewerten abhaken, welche Regeln erfüllt waren, und siehst, was Regeltreue pro Setup wert ist.</div>';
pb.forEach(s=>{const st=pbStats(s.name);
h+='<div class="card" style="margin-bottom:10px"><div class="sechead" style="margin-bottom:6px"><span style="font-size:15px;font-weight:600">'+esc(s.name)+'</span>'+
'<span class="mono" style="color:'+col(st.net)+'">'+(st.n?sgn(st.net,0):'–')+'</span></div>'+
(s.desc?'<div class="sm muted" style="margin-bottom:8px;line-height:1.5">'+esc(s.desc)+'</div>':'')+
s.rules.map((r,i)=>'<div class="sm" style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--border)"><span class="mono muted">'+(i+1)+'</span><span>'+esc(r)+'</span></div>').join('')+
'<div class="sm muted" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px"><span>'+st.n+' Trades</span>'+(st.n?'<span>'+st.wr.toFixed(0)+' % Treffer</span>':'')+
(st.ok.n?'<span>Regeln erfüllt: <b class="mono" style="color:'+col(st.ok.net)+'">'+sgn(st.ok.net,0)+'</b> ('+st.ok.n+')</span>':'')+(st.bad.n?'<span>Regeln verletzt: <b class="mono" style="color:'+col(st.bad.net)+'">'+sgn(st.bad.net,0)+'</b> ('+st.bad.n+')</span>':'')+'</div>'+
'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+(s.rules.length?'<button class="btn primary" data-pro="ck" data-id="'+s.id+'">Checkliste vor dem Trade</button>':'')+
'<button class="btn" data-pro="pbEdit" data-id="'+s.id+'">Bearbeiten</button></div></div>';});
return h+'<div style="height:8px"></div>';
}
function pbEdit(id){
const s=P().pb.find(x=>x.id===id)||{id:'',name:'',rules:[],desc:''};
showModal('<div class="sec">'+(s.id?'Setup bearbeiten':'Neues Setup')+'</div>'+
'<div class="lbl" style="margin-top:12px">Name</div><input id="pb-name" value="'+esc(s.name)+'" placeholder="z. B. Liquidity Sweep + MSS">'+
'<div class="lbl" style="margin-top:12px">Regeln (eine pro Zeile)</div><textarea id="pb-rules" rows="6" placeholder="HTF-Bias klar&#10;Liquidity gesweept&#10;CRV mind. 1:2&#10;Keine High-Impact-News in 30 min">'+esc(s.rules.join('\n'))+'</textarea>'+
'<div class="lbl" style="margin-top:12px">Beschreibung (optional)</div><textarea id="pb-desc" rows="2">'+esc(s.desc||'')+'</textarea>'+
'<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" data-pro="pbSave" data-id="'+s.id+'">Speichern</button>'+
'<button class="btn" data-action="closeModal">Abbrechen</button>'+
(s.id?'<button class="btn" style="margin-left:auto;color:var(--red)" data-pro="pbDel" data-id="'+s.id+'">Löschen</button>':'')+'</div>');
}
function pbSave(id){
const name=document.getElementById('pb-name').value.trim();
if(!name){document.getElementById('pb-name').focus();return;}
const rules=document.getElementById('pb-rules').value.split('\n').map(x=>x.trim()).filter(Boolean);
const desc=document.getElementById('pb-desc').value.trim(),pb=P().pb,ex=pb.find(x=>x.id===id);
if(ex){
if(ex.name!==name)S.trades.forEach(t=>{if((t.model||'').toLowerCase()===ex.name.toLowerCase())t.model=name;});
Object.assign(ex,{name:name,rules:rules,desc:desc});
}else pb.push({id:'pb'+Date.now().toString(36),name:name,rules:rules,desc:desc});
save();closeModal();render();startTicker();
}
function ckDraw(){
const c=PS.ck,s=P().pb.find(x=>x.id===c.id);if(!s){closeModal();return;}
const n=c.met.length,left=s.rules.length-n,ps=propState(),lock=ps&&ps.reasons.length;
showModal('<div class="sec">Checkliste vor dem Trade</div><div style="font-size:19px;margin:4px 0 12px">'+esc(s.name)+'</div>'+
s.rules.map((r,i)=>{const on=c.met.indexOf(i)>=0;return '<button class="px-ck'+(on?' on':'')+'" data-pro="ckTog" data-v="'+i+'"><span class="px-box">'+(on?'✓':'')+'</span><span>'+esc(r)+'</span></button>';}).join('')+
'<div class="px-ban '+(lock?'px-red':!left?'px-green':'px-gold')+'" style="margin-top:12px"><span>'+
(lock?'🛑 <b>Gesperrt</b> – '+esc(ps.reasons.join(' · ')):!left?'✅ <b>GO</b> – alle Regeln erfüllt':'⛔ <b>NO-GO</b> – noch '+left+' Regel'+(left>1?'n':'')+' offen')+'</span></div>'+
'<div style="display:flex;gap:8px;margin-top:12px">'+(!left&&!lock?'<button class="btn primary" data-pro="ckGo">Positionsrechner öffnen</button>':'')+
'<button class="btn" data-action="closeModal">Schließen</button></div>');
}

/* =========================================================
   5) REVIEW-QUEUE: neue Bitget-Trades sofort bewerten
   ========================================================= */
const pendingList=()=>S.trades.filter(t=>t.bgNew&&!PS.skip.has(String(t.id))).sort((a,b)=>((a.bg&&a.bg.close)||a.id)-((b.bg&&b.bg.close)||b.id));
function reviewBanner(){
const n=pendingList().length;if(!n)return '';
return '<div class="px-ban px-gold"><span>⚡ <b>'+n+'</b> Trade'+(n>1?'s warten':' wartet')+' auf deine Bewertung</span><button class="btn primary" data-pro="rv">Jetzt bewerten</button></div>';
}
function openReview(id){
const t=id?byId(id):pendingList()[0];
if(!t){closeModal();PS.rv=null;return;}
PS.rv={id:t.id,grade:t.grade||'B',plan:t.plan!==false,tags:(t.tags||[]).slice(),
model:t.model==='Kein Modell'?'':(t.model||''),why:t.why===NOTE_FALLBACK?'':(t.why||''),met:t.chk&&Array.isArray(t.chk.ok)?t.chk.ok.slice():[]};
rvDraw(true);
}
function rvSync(){const r=PS.rv;if(!r)return;const w=document.getElementById('rv-why'),m=document.getElementById('rv-model');if(w)r.why=w.value;if(m)r.model=m.value;}
function rvSetup(r){const k=(r.model||'').trim().toLowerCase();return k?P().pb.find(s=>s.name.toLowerCase()===k):null;}
function rvDraw(fresh){
const r=PS.rv,t=byId(r.id);if(!t){closeModal();return;}
const sh=document.getElementById('sheet'),sc=sh?sh.scrollTop:0;
const prev=document.getElementById('rv-chart');
const chart=!fresh&&prev&&prev.dataset.id===String(t.id)?prev.innerHTML:'<div class="sm muted" style="padding:40px 0;text-align:center">'+(t.bg&&t.bg.open?'Lade Chart…':'Kein Chart (manueller Trade)')+'</div>';
const left=pendingList().filter(x=>String(x.id)!==String(r.id)).length,setup=rvSetup(r);
const models=Array.from(new Set(P().pb.map(s=>s.name).concat(S.trades.map(x=>x.model).filter(x=>x&&x!=='Kein Modell')))).slice(0,12);
const seg=(k,opts,cur)=>'<div class="seg">'+opts.map(o=>{const on=String(cur)===o[0];return '<button data-pro="rvSet" data-k="'+k+'" data-v="'+o[0]+'" class="'+(on?'on':'')+'" style="'+(on&&o[2]?'border-color:'+o[2]+';color:'+o[2]:'')+'">'+o[1]+'</button>';}).join('')+'</div>';
showModal('<div class="sechead"><span class="sec">Trade bewerten</span><span class="sec">'+(left?'danach noch '+left:'letzter')+'</span></div>'+
'<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 0 10px"><span class="mono" style="font-size:24px;color:'+col(t.pnl)+'">'+sgn(t.pnl)+'</span>'+
'<b>'+esc(t.symbol)+'</b><span style="color:'+(t.dir==='LONG'?'var(--green)':'var(--red)')+'">'+t.dir+'</span>'+
'<span class="sm muted">'+deDate(t.date)+(t.bg&&t.bg.open?' · '+hm(t.bg.open)+'–'+hm(t.bg.close)+' · '+dur(holdMin(t)):'')+'</span></div>'+
'<div id="rv-chart" data-id="'+esc(String(t.id))+'">'+chart+'</div>'+
'<div class="lbl" style="margin-top:14px">Setup</div><input id="rv-model" value="'+esc(r.model)+'" placeholder="Setup / Modell">'+
(models.length?'<div class="px-chips">'+models.map(n=>'<button class="chip '+(n.toLowerCase()===r.model.trim().toLowerCase()?'on-good':'')+'" data-pro="rvModel" data-v="'+esc(n)+'">'+esc(n)+'</button>').join('')+'</div>':'')+
(setup&&setup.rules.length?'<div class="lbl" style="margin-top:14px">Welche Regeln waren erfüllt?</div>'+
setup.rules.map((x,i)=>{const on=r.met.indexOf(i)>=0;return '<button class="px-ck'+(on?' on':'')+'" data-pro="rvMet" data-v="'+i+'"><span class="px-box">'+(on?'✓':'')+'</span><span>'+esc(x)+'</span></button>';}).join(''):'')+
'<div class="lbl" style="margin-top:14px">Ausführungs-Note</div>'+seg('grade',GRADES.map(g=>[g,g,GRADE_COLOR[g]]),r.grade)+
'<div class="lbl" style="margin-top:14px">An den Plan gehalten?</div>'+seg('plan',[['1','Ja','var(--green)'],['0','Nein','var(--red)']],r.plan?'1':'0')+
'<div class="lbl" style="margin-top:14px">Tags</div><div class="px-chips" style="margin-top:0">'+
TAGS.map(x=>{const on=r.tags.indexOf(x)>=0,good=x==='Perfekte Ausführung';return '<button class="chip '+(on?(good?'on-good':'on-bad'):'')+'" data-pro="rvTag" data-v="'+esc(x)+'">'+x+'</button>';}).join('')+'</div>'+
'<div class="lbl" style="margin-top:14px">Warum?</div><textarea id="rv-why" rows="3" placeholder="Warum der Entry, was hast du gesehen, was nimmst du mit?">'+esc(r.why)+'</textarea>'+
'<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" data-pro="rvSave">'+(left?'Speichern &amp; weiter':'Speichern')+'</button>'+
'<button class="btn" data-pro="rvSkip">Überspringen</button><button class="btn" data-pro="rvLater">Später</button></div>');
const sh2=document.getElementById('sheet');if(sh2&&!fresh)sh2.scrollTop=sc;
if(fresh)loadMini(t);
}
async function loadMini(t){
if(!t.bg||!t.bg.open)return;
let html;
try{const cd=await candles(t),m=calcMae(t,cd);if(m)P().mae[t.id]=m;
html=candleSvg(t,cd,m,true)+(m?'<div class="sm mono" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px"><span class="red">MAE −'+pct(m.a,2)+'</span><span class="green">MFE +'+pct(m.f,2)+'</span>'+(m.e!=null?'<span class="muted">Effizienz '+Math.round(m.e*100)+' %</span>':'')+'</div>':'');}
catch(e){html='<div class="sm muted" style="padding:20px 0;text-align:center">Chart nicht verfügbar</div>';}
const el=document.getElementById('rv-chart');if(el&&el.dataset.id===String(t.id))el.innerHTML=html;
}
function rvSave(){
rvSync();const r=PS.rv,t=byId(r.id);if(!t)return;
const setup=rvSetup(r);
t.grade=r.grade;t.plan=r.plan;t.tags=r.tags.slice();
t.model=r.model.trim()?(setup?setup.name:r.model.trim()):'Kein Modell';
t.why=r.why.trim()||NOTE_FALLBACK;
if(setup&&setup.rules.length){const ok=r.met.filter(i=>i<setup.rules.length);t.chk={met:ok.length,total:setup.rules.length,ok:ok};}else delete t.chk;
delete t.bgNew;
save();rvNext();
}
function rvNext(){const n=pendingList()[0];if(n)openReview(n.id);else{closeModal();PS.rv=null;render();startTicker();}}

/* =========================================================
   6) WOCHEN-REPORT (+ Bild zum Teilen)
   ========================================================= */
function isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=x.getUTCDay()||7;
x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y0)/864e5+1)/7);}
function weekOf(off){const n=new Date();n.setHours(12,0,0,0);n.setDate(n.getDate()-((n.getDay()+6)%7)-7*off);
const e=new Date(n);e.setDate(e.getDate()+6);return{from:isoOf(n),to:isoOf(e),kw:isoWeek(n)};}
const weekTrades=w=>S.trades.filter(t=>t.date>=w.from&&t.date<=w.to);
function weekData(off){
const w=weekOf(off),m=metrics(weekTrades(w)),pm=metrics(weekTrades(weekOf(off+1)));
const best=m.t.slice().sort((a,b)=>b.pnl-a.pnl)[0],worst=m.t.slice().sort((a,b)=>a.pnl-b.pnl)[0];
const days=m.curve.slice().sort((a,b)=>b.day-a.day);
const setup=groupStats(m.t.filter(t=>t.model&&t.model!=='Kein Modell'),t=>t.model)[0];
const tag=TAGS.filter(x=>x!=='Perfekte Ausführung').map(x=>{const l=m.t.filter(t=>(t.tags||[]).indexOf(x)>=0);
return{tag:x,n:l.length,net:l.reduce((s,t)=>s+t.pnl,0)};}).filter(r=>r.n&&r.net<0).sort((a,b)=>a.net-b.net)[0];
let focus;
if(!m.t.length)focus='Keine Trades in dieser Woche.';
else if(tag&&Math.abs(tag.net)>=Math.max(10,m.gl*.1))focus='„'+tag.tag+'“ hat dich '+usd(tag.net,0)+' gekostet ('+tag.n+'×). Das ist dein größter Hebel für nächste Woche.';
else if(m.adherence<80)focus='Nur '+m.adherence.toFixed(0)+' % deiner Trades waren am Plan. Nächste Woche: nur Setups aus dem Playbook.';
else if(m.net<0)focus='Rote Woche ohne klaren Fehler-Tag. Prüf, welches Setup am meisten kostet, und halbier das Risiko, bis die Kurve dreht.';
else focus='Saubere Woche. Gleiche Routine, Risiko nicht erhöhen – Konstanz schlägt Größe.';
return{w:w,m:m,pm:pm,best:best,worst:worst,bestDay:days[0],worstDay:days[days.length-1],setup:setup,tag:tag,focus:focus};
}
const wd=iso=>WEEKDAYS[new Date(iso+'T12:00:00').getDay()];
function vWeek(){
const D=weekData(PS.week),m=D.m,w=D.w;
let h='<div class="card" style="margin-bottom:10px"><div class="sechead"><button class="btn" style="padding:4px 12px" data-pro="wk" data-v="1">‹</button>'+
'<span class="sec" style="color:var(--text)">KW '+w.kw+' · '+deDate(w.from).slice(0,6)+' – '+deDate(w.to)+'</span>'+
'<button class="btn" style="padding:4px 12px'+(PS.week?'':';opacity:.3')+'" data-pro="wk" data-v="-1">›</button></div>';
if(!m.t.length)return h+'<div class="sm muted" style="padding:24px 0;text-align:center">Keine Trades in dieser Woche.</div></div>';
const dl=m.net-D.pm.net;
h+='<div class="mono" style="font-size:34px;margin:4px 0 2px;color:'+col(m.net)+'">'+sgn(m.net)+'</div>'+
'<div class="sm muted">'+(D.pm.t.length?'Vorwoche '+sgn(D.pm.net,0)+' · <span style="color:'+col(dl)+'">'+(dl>=0?'▲ ':'▼ ')+sgn(dl,0)+'</span>':'Keine Trades in der Vorwoche')+'</div>'+
'<div class="kgrid">'+kpi('Trades',m.t.length,null,m.nw+' Gewinner · '+m.nl+' Verlierer')+kpi('Trefferquote',m.winRate.toFixed(0)+' %',null,'Gewinntage '+m.dayWin.toFixed(0)+' %')+
kpi('Profit-Faktor',pfTxt(m.pf),m.pf>=1.5?'var(--green)':null,'Ø '+sgn(m.avgWin,0)+' / '+sgn(-m.avgLoss,0))+
kpi('Regeltreue',m.adherence.toFixed(0)+' %',m.adherence>=80?'var(--green)':'var(--gold)',m.planN+' von '+m.t.length+' am Plan')+'</div>'+
'<div class="sec" style="margin:4px 0 6px">P&amp;L pro Tag</div>'+barsChart(m.curve);
const r=(k,v)=>'<div class="row"><span class="sm muted">'+k+'</span><span class="sm" style="text-align:right">'+v+'</span></div>';
const pv=v=>'<span class="mono" style="color:'+col(v)+'">'+sgn(v,0)+'</span>';
h+='<div style="margin-top:10px">'+
(D.bestDay&&D.bestDay.day>0?r('Bester Tag',wd(D.bestDay.date)+' '+pv(D.bestDay.day)):'')+
(D.worstDay&&D.worstDay.day<0?r('Schlechtester Tag',wd(D.worstDay.date)+' '+pv(D.worstDay.day)):'')+
(D.best&&D.best.pnl>0?r('Bester Trade',esc(D.best.symbol)+' '+D.best.dir+' '+pv(D.best.pnl)):'')+
(D.worst&&D.worst.pnl<0?r('Schlechtester Trade',esc(D.worst.symbol)+' '+D.worst.dir+' '+pv(D.worst.pnl)):'')+
(D.setup?r('Bestes Setup',esc(D.setup.k)+' '+pv(D.setup.net)):'')+
(D.tag?r('Teuerster Fehler',esc(D.tag.tag)+' '+pv(D.tag.net)):'')+
r('Max. Drawdown','<span class="mono red">'+usd(-m.maxDD,0)+'</span>')+'</div>'+
'<div class="px-ban px-gold" style="margin-bottom:0"><span>🎯 <b>Fokus:</b> '+esc(D.focus)+'</span></div>'+
'<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" data-pro="wkImg">📸 Als Bild</button>'+
'<button class="btn" data-pro="coachWeek">🤖 KI: Welche Strategie lief am besten?</button></div></div>';
return h;
}
function weekCanvas(){
const D=weekData(PS.week),m=D.m,w=D.w;if(!m.t.length)return null;
const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;const x=cv.getContext('2d');
const G='#3DDC97',R='#F0566A',T='#E6EFEA',MU='#7C8A85',GO='#E3B341';
const F='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',MO='ui-monospace,"SF Mono",Menlo,monospace';
x.fillStyle='#050A0B';x.fillRect(0,0,1080,1350);
[[120,0],[1080,1350]].forEach(p=>{const g=x.createRadialGradient(p[0],p[1],0,p[0],p[1],820);g.addColorStop(0,'rgba(30,150,110,.30)');g.addColorStop(1,'rgba(30,150,110,0)');x.fillStyle=g;x.fillRect(0,0,1080,1350);});
x.fillStyle=MU;x.font='500 26px '+MO;x.fillText('W O C H E N - R E P O R T   ·   K W  '+w.kw,80,120);
x.fillStyle=T;x.font='italic 400 66px "Iowan Old Style",Palatino,Georgia,serif';x.fillText(S.name||'Trader',80,212);
x.fillStyle=MU;x.font='30px '+F;x.fillText(deDate(w.from)+' – '+deDate(w.to),80,262);
x.fillStyle=m.net>=0?G:R;x.font='500 124px '+MO;x.fillText(sgn(m.net),74,420);
if(D.pm.t.length){const dl=m.net-D.pm.net;x.fillStyle=MU;x.font='30px '+F;x.fillText('Vorwoche '+sgn(D.pm.net,0)+'    '+(dl>=0?'▲ ':'▼ ')+sgn(dl,0),80,478);}
const pts=[0].concat(m.curve.map(c=>c.cum)),mn=Math.min(...pts),mx=Math.max(...pts),sp=(mx-mn)||1;
const bx=80,by=530,bw=920,bh=260,px=i=>bx+i*bw/(pts.length-1),py=v=>by+bh-(v-mn)/sp*bh;
const lc=m.net>=0?G:R,gr=x.createLinearGradient(0,by,0,by+bh);gr.addColorStop(0,m.net>=0?'rgba(61,220,151,.35)':'rgba(240,86,106,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');
x.beginPath();pts.forEach((v,i)=>i?x.lineTo(px(i),py(v)):x.moveTo(px(i),py(v)));x.lineTo(px(pts.length-1),by+bh);x.lineTo(bx,by+bh);x.closePath();x.fillStyle=gr;x.fill();
x.beginPath();pts.forEach((v,i)=>i?x.lineTo(px(i),py(v)):x.moveTo(px(i),py(v)));x.strokeStyle=lc;x.lineWidth=5;x.lineJoin='round';x.stroke();
const st=[['TRADES',String(m.t.length)],['TREFFER',m.winRate.toFixed(0)+'%'],['PROFIT-FAKTOR',pfTxt(m.pf)],
['REGELTREUE',m.adherence.toFixed(0)+'%'],['BESTER TAG',D.bestDay&&D.bestDay.day>0?sgn(D.bestDay.day,0):'–'],['MAX. DD',usd(-m.maxDD,0)]];
st.forEach((s,i)=>{const cx=80+(i%3)*330,cy=880+Math.floor(i/3)*150;x.fillStyle=MU;x.font='500 22px '+MO;x.fillText(s[0],cx,cy);x.fillStyle=T;x.font='500 50px '+MO;x.fillText(s[1],cx,cy+62);});
x.fillStyle=GO;x.font='500 22px '+MO;x.fillText('FOKUS',80,1188);
x.fillStyle=T;x.font='30px '+F;
const words=D.focus.split(' ');let line='',ly=1236,nl=0;
for(const wd2 of words){const tst=line?line+' '+wd2:wd2;if(x.measureText(tst).width>920&&line){x.fillText(line,80,ly);ly+=42;line=wd2;if(++nl>=2)break;}else line=tst;}
if(nl<2)x.fillText(line,80,ly);
x.fillStyle=MU;x.font='500 20px '+MO;x.textAlign='right';x.fillText('TRADING JOURNAL',1000,1318);
return cv;
}
function wkPreview(){
const cv=weekCanvas();if(!cv)return;
showModal('<div class="sec" style="margin-bottom:10px">Wochen-Report · Bild</div><img src="'+cv.toDataURL('image/png')+'" style="width:100%;border-radius:12px;border:1px solid var(--border)" alt="Wochen-Report">'+
'<div class="sm muted" style="margin-top:8px">Am iPhone: Bild gedrückt halten → „In Fotos sichern“.</div>'+
'<div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" data-pro="wkShare">Teilen / Speichern</button><button class="btn" data-action="closeModal">Schließen</button></div>');
}
function shareImg(){
const cv=weekCanvas();if(!cv)return;
cv.toBlob(async function(b){
const f=new File([b],'wochen-report-kw'+weekOf(PS.week).kw+'.png',{type:'image/png'});
try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Wochen-Report'});return;}}catch(e){if(e&&e.name==='AbortError')return;}
const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f.name;document.body.appendChild(a);a.click();
setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
},'image/png');
}
function weekBanner(){
const n=new Date(),d=n.getDay();let off=null;
if(d===0&&n.getHours()>=17)off=0;else if(d===1)off=1;
if(off==null)return '';
const w=weekOf(off);if(P().wkSeen===w.from)return '';
const l=weekTrades(w);if(!l.length)return '';
const net=l.reduce((s,t)=>s+t.pnl,0);
return '<div class="px-ban px-green"><span>📊 Dein Wochen-Report KW '+w.kw+' ist fertig · <b class="mono" style="color:'+col(net)+'">'+sgn(net,0)+'</b></span>'+
'<span style="display:flex;gap:6px"><button class="btn primary" data-pro="wkOpen" data-v="'+off+'" data-k="'+w.from+'">Ansehen</button>'+
'<button class="btn tiny" data-pro="wkHide" data-k="'+w.from+'">✕</button></span></div>';
}

/* =========================================================
   7) KI-COACH (Claude über Supabase Edge Function „ai-coach“)
   ========================================================= */
function inRangeDays(rk){if(rk==='all')return S.trades.slice();if(rk==='wk')return weekTrades(weekOf(PS.week));const d=new Date();d.setDate(d.getDate()-Number(rk));const f=isoOf(d);return S.trades.filter(t=>t.date>=f);}
function rLabel(rk){if(rk==='all')return 'alle Trades';if(rk==='wk'){const w=weekOf(PS.week);return 'KW '+w.kw+' ('+deDate(w.from)+' – '+deDate(w.to)+')';}return 'letzte '+rk+' Tage';}
function buildPrompt(rk){
const L=inRangeDays(rk).sort((a,b)=>a.date.localeCompare(b.date)||((a.bg&&a.bg.close)||a.id)-((b.bg&&b.bg.close)||b.id));
const m=metrics(L),M=P().mae,o=[];
const gs=(title,rows)=>rows.length?'\n'+title+':\n'+rows.map(r=>'- '+r.k+': '+r.n+' Trades, Netto '+sgn(r.net,0)+', Treffer '+r.wr.toFixed(0)+'%, PF '+pfTxt(r.pf)).join('\n'):'';
o.push('Du bist mein Trading-Coach. Analysiere mein Trading-Journal ehrlich, konkret und mit Zahlen. Ich trade Krypto-Futures (Bitget USDT-M Perps), vor allem BTC und ETH. Antworte auf Deutsch, locker (du), in Markdown mit genau diesen Abschnitten:\n'+
'## Kurzfazit (2–3 Sätze)\n## Strategie-Ranking (jede Strategie/Setup mit Trades, Netto, Trefferquote, Profit-Faktor; klarer Sieger und Verlierer; Empfehlung pro Strategie: behalten, anpassen oder pausieren – und warum)\n## Was funktioniert (3 Punkte mit Zahlen)\n## Wo du Geld verlierst (3 Punkte mit Zahlen)\n## Muster & Auffälligkeiten (Zeiten, Haltedauer, Setups, Tags, Notizen, MAE/MFE, Gebühren)\n## 3 Regeln für nächste Woche (konkret und messbar)\n## Fokus der Woche (1 Satz)\n'+
'Erfinde nichts – nur was die Daten hergeben. Wenn die Datenbasis zu klein für eine Aussage ist, sag das. Beträge in $.');
o.push('\n# Überblick ('+rLabel(rk)+')');
o.push('Trades: '+m.t.length+' ('+m.nw+' Gewinner, '+m.nl+' Verlierer) · Netto: '+sgn(m.net)+' · Trefferquote: '+m.winRate.toFixed(1)+'% · Profit-Faktor: '+pfTxt(m.pf)+
' · Ø Gewinn: '+usd(m.avgWin)+' · Ø Verlust: '+usd(m.avgLoss)+' · Max. Drawdown: '+usd(m.maxDD)+' · Gewinntage: '+m.dayWin.toFixed(0)+'% · Regeltreue: '+m.adherence.toFixed(0)+'%');
const f=feeInfo(L);
if(f.b.length)o.push('Gebühren+Funding (Bitget-Trades): Brutto '+sgn(f.gross)+', Kosten '+usd(f.cost)+', Netto '+sgn(f.net)+', Ø '+usd(f.per)+' pro Trade, '+f.flipped.length+' Trades nur wegen Gebühren im Minus.');
o.push(gs('Nach Setup',groupStats(L,t=>t.model)));
o.push(gs('Nach Session',groupStats(L,t=>t.session)));
o.push(gs('Nach Symbol',groupStats(L,t=>t.symbol)));
o.push(gs('Nach Richtung',groupStats(L,t=>t.dir)));
o.push(gs('Nach Wochentag',groupStats(L,t=>WEEKDAYS[new Date(t.date+'T12:00:00').getDay()])));
o.push(gs('Nach Ausführungs-Note',groupStats(L,t=>t.grade)));
o.push(gs('Nach Uhrzeit (Entry, 2h-Blöcke)',groupStats(L.filter(openTs),t=>{const h=new Date(openTs(t)).getHours();return (h-h%2)+'–'+(h-h%2+2)+' Uhr';})));
o.push(gs('Nach Haltedauer',groupStats(L.filter(t=>holdMin(t)!=null),holdBucket)));
o.push(gs('Playbook-Regeln',groupStats(L.filter(t=>t.chk),t=>t.chk.met>=t.chk.total?'alle Regeln erfüllt':'Regeln verletzt')));
const tg=TAGS.map(x=>{const l=L.filter(t=>(t.tags||[]).indexOf(x)>=0);return{k:x,n:l.length,net:l.reduce((s,t)=>s+t.pnl,0)};}).filter(r=>r.n);
if(tg.length)o.push('\nFehler-/Qualitäts-Tags:\n'+tg.map(r=>'- '+r.k+': '+r.n+'×, Netto '+sgn(r.net,0)).join('\n'));
const md2=L.filter(t=>M[t.id]),Wn=md2.filter(t=>t.pnl>0).map(t=>M[t.id]),Ls=md2.filter(t=>t.pnl<0).map(t=>M[t.id]);
if(md2.length)o.push('\nMAE/MFE ('+md2.length+' Trades, in % vom Entry): Gewinner Ø MAE '+(avg(Wn.map(x=>x.a))||0).toFixed(2)+'%, 80%-Quantil '+((quant(Wn.map(x=>x.a),.8))||0).toFixed(2)+'%, Ø MFE '+(avg(Wn.map(x=>x.f))||0).toFixed(2)+
'%, Exit-Effizienz Ø '+Math.round((avg(Wn.filter(x=>x.e!=null).map(x=>x.e))||0)*100)+'%; Verlierer Ø MFE '+(avg(Ls.map(x=>x.f))||0).toFixed(2)+'%, Ø MAE '+(avg(Ls.map(x=>x.a))||0).toFixed(2)+'%.');
const pb=P().pb;if(pb.length)o.push('\nMein Playbook:\n'+pb.map(s=>'- '+s.name+': '+s.rules.join(' | ')).join('\n'));
const pc=P().prop;if(pc.on&&pc.size)o.push('\nProp-Firm-Regeln: Konto '+usd(+pc.size,0)+(pc.dll?', max. Tagesverlust '+usd(+pc.dll,0):'')+(pc.mdd?', max. Drawdown '+usd(+pc.mdd,0)+(pc.trail?' (trailing)':' (statisch)'):'')+(pc.target?', Ziel '+usd(+pc.target,0):''));
o.push('\n# Einzelne Trades (Datum;Uhrzeit;Symbol;Richtung;P&L;R;Note;Setup;AmPlan;Tags;Haltedauer_min;MAE%;MFE%;Warum)');
L.slice(-150).forEach(t=>{const mm=M[t.id],hm2=holdMin(t);
o.push([t.date,openTs(t)?hm(openTs(t)):'',t.symbol,t.dir,t.pnl,t.r==null?'':t.r,t.grade,t.model,t.plan?'ja':'nein',(t.tags||[]).join('|'),
hm2==null?'':Math.round(hm2),mm?mm.a.toFixed(2):'',mm?mm.f.toFixed(2):'',(t.why&&t.why!==NOTE_FALLBACK?t.why:'').replace(/\s+/g,' ').replace(/;/g,',').slice(0,180)].join(';'));});
const first=L.length?L[0].date:'0000';
const notes=Object.keys(S.notes).filter(k=>/^\d{4}-\d\d-\d\d$/.test(k)&&k>=first&&typeof S.notes[k]==='string').sort();
if(notes.length)o.push('\n# Tagesnotizen\n'+notes.slice(-40).map(k=>'- '+k+': '+S.notes[k].replace(/\s+/g,' ').slice(0,300)).join('\n'));
return o.filter(Boolean).join('\n');
}
function token(){
try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k));const s=v&&(v.access_token?v:v.currentSession);if(s&&s.access_token)return s.access_token;}}}catch(e){}
return null;
}
async function runCoach(){
if(PS.cBusy)return;
if(!inRangeDays(PS.cr).length){PS.cMsg='⚠️ Keine Trades in diesem Zeitraum.';render();startTicker();return;}
const tok=token();
if(!tok){PS.cMsg='⚠️ Erst in den Einstellungen einloggen (Synchronisierung).';render();startTicker();return;}
PS.cBusy=true;PS.cMsg='Claude analysiert deine Trades … das dauert ca. 20–60 Sekunden.';render();startTicker();
try{
const r=await fetch(FN+'ai-coach',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':PUB},body:JSON.stringify({prompt:buildPrompt(PS.cr)})});
const j=await r.json().catch(()=>({}));
if(!r.ok)throw new Error(j.error||j.msg||j.message||('HTTP '+r.status));
if(!j.text)throw new Error('Leere Antwort');
const C=P().coach;C.unshift({ts:Date.now(),rk:PS.cr,lbl:rLabel(PS.cr),text:j.text});P().coach=C.slice(0,8);
PS.cMsg='';save();
}catch(e){
const msg=e.message||String(e);
PS.cMsg='⚠️ '+msg+(/404|not found|Failed to fetch|Load failed/i.test(msg)?' – ist die Edge Function „ai-coach“ deployed? Bis dahin: „Prompt kopieren“.':'');
}finally{PS.cBusy=false;render();startTicker();}
}
function copyPrompt(){
const p=buildPrompt(PS.cr);
const fallback=()=>{showModal('<div class="sec">Prompt für Claude</div><div class="sm muted" style="margin:6px 0 10px">Alles markieren, kopieren und in Claude einfügen.</div><textarea id="px-prompt" rows="14" readonly>'+esc(p)+'</textarea>'+
'<div style="display:flex;gap:8px;margin-top:12px"><button class="btn" data-action="closeModal">Schließen</button></div>');
const ta=document.getElementById('px-prompt');if(ta){ta.focus();ta.select();}};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(p).then(function(){PS.cMsg='✓ Prompt kopiert ('+Math.round(p.length/1000)+'k Zeichen) – jetzt in Claude einfügen.';render();startTicker();},fallback);
else fallback();
}
function md(s){
return esc(s).split('\n').map(l=>{
l=l.replace(/\*\*(.+?)\*\*/g,'<b style="color:var(--text)">$1</b>');
if(/^#{1,4} /.test(l))return '<div class="sec" style="margin:16px 0 6px;color:var(--text)">'+l.replace(/^#+ /,'')+'</div>';
if(/^\s*[-*•] /.test(l))return '<div style="display:flex;gap:8px;margin:5px 0"><span class="gold">•</span><span>'+l.replace(/^\s*[-*•] /,'')+'</span></div>';
const n=l.match(/^\s*(\d+)[.)] (.*)$/);if(n)return '<div style="display:flex;gap:8px;margin:5px 0"><span class="gold mono">'+n[1]+'</span><span>'+n[2]+'</span></div>';
return l.trim()?'<div style="margin:5px 0">'+l+'</div>':'';
}).join('');
}
function vCoach(){
const C=P().coach,err=/⚠/.test(PS.cMsg);
let h='<div class="card" style="margin-bottom:10px"><div class="sechead"><span class="sec">KI-Coach</span><span class="sec">Claude</span></div>'+
'<div class="sm muted" style="line-height:1.6;margin-bottom:12px">Claude geht deine Trades, Notizen, Tags, Zeiten, Gebühren und MAE/MFE durch und sagt dir konkret, wo du Geld liegen lässt – plus 3 Regeln für nächste Woche.</div>'+
'<div class="seg" style="margin-bottom:10px">'+[['wk','KW '+weekOf(PS.week).kw],['7','7 Tage'],['30','30 Tage'],['all','Alles']].map(r=>'<button data-pro="cRange" data-v="'+r[0]+'" class="'+(PS.cr===r[0]?'on':'')+'">'+r[1]+'</button>').join('')+'</div>'+
'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-pro="coach"'+(PS.cBusy?' disabled':'')+'>'+(PS.cBusy?'Claude denkt nach…':'🤖 Analyse starten')+'</button>'+
'<button class="btn" data-pro="cCopy">Prompt kopieren</button></div>'+
(PS.cMsg?'<div class="sm" style="margin-top:10px;line-height:1.5;color:'+(err?'var(--red)':'var(--muted)')+'">'+esc(PS.cMsg)+'</div>':'')+
'<div class="sm muted" style="margin-top:8px">„Prompt kopieren“ geht ohne Setup: einfach in Claude einfügen.</div></div>';
C.forEach((r,i)=>{
const head=new Date(r.ts).toLocaleDateString('de-DE',{day:'numeric',month:'short'})+' · '+(r.lbl||(r.rk==='all'?'alle Trades':'letzte '+r.rk+' Tage'));
const body='<div style="color:var(--body);font-size:13.5px;line-height:1.6">'+md(r.text)+'</div>';
h+=i===0?'<div class="card" style="margin-bottom:10px"><div class="sechead"><span class="sec">Letzte Analyse · '+head+'</span></div>'+body+'</div>'
:'<details class="card" style="margin-bottom:10px"><summary class="sec" style="cursor:pointer">▸ '+head+'</summary><div style="margin-top:8px">'+body+'</div></details>';
});
return h;
}

/* =========================================================
   PRO-VIEW + Einhängen in die App
   ========================================================= */
function viewPro(){
const tabs=[['ins','Insights'],['mae','MAE/MFE'],['prop','Prop-Firm'],['week','Woche'],['coach','KI-Coach']];
return '<div class="sechead" style="margin:6px 2px 12px"><span class="sec">06 // Pro</span></div>'+
'<div class="pill">'+tabs.map(t=>'<button data-pro="tab" data-v="'+t[0]+'" class="'+(PS.tab===t[0]?'on':'')+'">'+t[1]+'</button>').join('')+'</div>'+
(PS.tab==='mae'?vMae():PS.tab==='prop'?vProp():PS.tab==='week'?vWeek():PS.tab==='coach'?vCoach():vIns());
}
function dashExtras(){
const s=propState();let h='';
if(s&&s.reasons.length)h+='<div class="px-ban px-red"><span>🛑 <b>Heute Schluss.</b> '+esc(s.reasons.join(' · '))+'</span></div>';
h+=reviewBanner()+weekBanner();
if(s)h+=propCard(s,false);
return h;
}
function afterRender(){
const n=pendingList().length;
if(PS.lastNew!=null&&n>PS.lastNew&&!PS.auto&&S.view!=='new'&&document.getElementById('modal').hidden){PS.auto=true;setTimeout(function(){if(document.getElementById('modal').hidden)openReview();},500);}
PS.lastNew=n;
}

NAV.push(['pro','Pro']);
const _render=render;
render=function(){
_render();
const tb=document.getElementById('tabs');
if(tb)tb.insertAdjacentHTML('beforeend','<button class="tab '+(S.view==='pro'?'on':'')+'" data-action="view" data-v="pro">Pro</button>');
afterRender();
};
const _viewForm=viewForm;
viewForm=function(){
if(S.view==='pro')return viewPro();
let h=_viewForm();
const pb=P().pb;
if(pb.length&&draft)h=h.replace('placeholder="IFVG Continuation"></div>','placeholder="IFVG Continuation"><div class="px-chips">'+
pb.map(s=>'<button class="chip '+((draft.model||'').toLowerCase()===s.name.toLowerCase()?'on-good':'')+'" data-action="set" data-k="model" data-v="'+esc(s.name)+'">'+esc(s.name)+'</button>').join('')+'</div></div>');
return h;
};
const _viewDash=viewDash;
viewDash=function(m,mAll){
const h=_viewDash(m,mAll),i=h.indexOf('<div class="ticker"'),x=dashExtras();
return i<0?x+h:h.slice(0,i)+x+h.slice(i);
};
const _viewStrat=viewStrat;
viewStrat=function(m){return pbSection()+_viewStrat(m);};
const _tradeCard=tradeCard;
tradeCard=function(t){
let h=_tradeCard(t);
const id=esc(String(t.id));
let extra=t.chk?'<span class="chip '+(t.chk.met>=t.chk.total?'on-good':'on-bad')+'">Regeln '+t.chk.met+'/'+t.chk.total+'</span>':'';
if(t.bg&&t.bg.open){
extra+='<button class="btn" style="margin-left:auto;padding:3px 9px" data-pro="replay" data-id="'+id+'">▶ Chart</button>';
h=h.replace('<button class="btn" style="margin-left:auto;padding:3px 9px" data-action="edit"',extra+'<button class="btn" style="padding:3px 9px" data-action="edit"');
}else if(extra)h=h.replace('<button class="btn" style="margin-left:auto;padding:3px 9px" data-action="edit"',extra+'<button class="btn" style="margin-left:auto;padding:3px 9px" data-action="edit"');
h=h.replace('<span class="chip" style="color:var(--gold);border-color:var(--gold)">Noch bewerten</span>','<button class="chip" style="color:var(--gold);border-color:var(--gold)" data-pro="rv1" data-id="'+id+'">Noch bewerten →</button>');
return h;
};

/* ---------- Events ---------- */
document.addEventListener('click',function(e){
const el=e.target.closest('[data-pro]');if(!el||el.disabled)return;
const a=el.dataset.pro,v=el.dataset.v,id=el.dataset.id,r=PS.rv;
switch(a){
case 'tab':PS.tab=v;break;
case 'go':S.view='pro';PS.tab=v;closeModal();window.scrollTo(0,0);break;
case 'cell':PS.cell=PS.cell===v?null:v;break;
case 'maeAll':maeAll();return;
case 'replay':openReplay(id);return;
case 'rv':openReview();return;
case 'rv1':openReview(id);return;
case 'rvSet':rvSync();r[el.dataset.k]=el.dataset.k==='plan'?v==='1':v;rvDraw();return;
case 'rvTag':rvSync();r.tags=r.tags.indexOf(v)>=0?r.tags.filter(x=>x!==v):r.tags.concat([v]);rvDraw();return;
case 'rvModel':rvSync();r.model=v;r.met=[];rvDraw();return;
case 'rvMet':{rvSync();const i=+v;r.met=r.met.indexOf(i)>=0?r.met.filter(x=>x!==i):r.met.concat([i]);rvDraw();return;}
case 'rvSave':rvSave();return;
case 'rvSkip':PS.skip.add(String(r.id));rvNext();return;
case 'rvLater':closeModal();PS.rv=null;render();startTicker();return;
case 'propOn':P().prop.on=!P().prop.on;save();break;
case 'propSet':P().prop[el.dataset.k]=el.dataset.k==='trail'?v==='1':v;save();break;
case 'pbEdit':pbEdit(id);return;
case 'pbSave':pbSave(id);return;
case 'pbDel':
if(!el.dataset.armed){el.dataset.armed='1';el.textContent='Wirklich löschen?';return;}
P().pb=P().pb.filter(s=>s.id!==id);save();closeModal();break;
case 'ck':PS.ck={id:id,met:[]};ckDraw();return;
case 'ckTog':{const i=+v,c=PS.ck;c.met=c.met.indexOf(i)>=0?c.met.filter(x=>x!==i):c.met.concat([i]);ckDraw();return;}
case 'ckGo':{closeModal();const b=document.getElementById('pc-btn');if(b)b.click();return;}
case 'wk':PS.week=Math.max(0,PS.week+Number(v));break;
case 'wkImg':wkPreview();return;
case 'wkShare':shareImg();return;
case 'wkOpen':P().wkSeen=el.dataset.k;save();S.view='pro';PS.tab='week';PS.week=+v;window.scrollTo(0,0);break;
case 'wkHide':P().wkSeen=el.dataset.k;save();break;
case 'cRange':PS.cr=v;break;
case 'coach':runCoach();return;
case 'coachWeek':S.view='pro';PS.tab='coach';PS.cr='wk';window.scrollTo(0,0);render();startTicker();runCoach();return;
case 'cCopy':copyPrompt();return;
default:return;
}
render();startTicker();
});
document.addEventListener('change',function(e){
const el=e.target.closest('[data-prop]');
if(el){
const c=P().prop,k=el.dataset.prop;
c[k]=el.type==='number'?(el.value===''?'':Number(el.value)):el.value;
if(k==='size'&&c.on==null&&+c.size>0)c.on=true;
save();
setTimeout(function(){const f=document.activeElement;if(!(f&&f.dataset&&f.dataset.prop)){render();startTicker();}},60);
return;
}
if(e.target.id==='rv-model'&&PS.rv){rvSync();PS.rv.met=[];rvDraw();}
});

render();startTicker();
})();
