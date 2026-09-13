(function(){
  function pendingAmountForMonth(type,ym){
    if(typeof state==='undefined'||!Array.isArray(state?.transactions))return 0;
    const normalized=String(type||'').trim().toLowerCase();
    let total=state.transactions.filter(t=>String(t.type||'').trim().toLowerCase()===normalized&&String(t.status||'').trim().toLowerCase()==='pendente'&&String(t.date||'').slice(0,7)===ym).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice==='function'?getInvoice(c.id,ym)?.status!=='Paga':true).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return typeof round2==='function'?round2(total):Math.round(total*100)/100;
  }

  function renderProjectedClosing(){
    if(typeof state==='undefined'||!state?.settings?.selectedMonth)return;
    const valueEl=document.getElementById('kpiClosing');
    const card=valueEl?.closest('.kpi');
    if(!card)return;
    let box=document.getElementById('kpiProjectedClosingBox');
    if(!box){
      box=document.createElement('div');
      box.id='kpiProjectedClosingBox';
      box.style.cssText='margin-top:8px;padding:6px 8px;border:1px solid #273449;border-radius:8px;background:#0b1424;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:1.2';
      box.innerHTML='<span style="color:#94a3b8">Saldo final projetado</span><strong id="kpiProjectedClosing" style="font-size:12px;font-variant-numeric:tabular-nums">—</strong>';
      card.appendChild(box);
    }
    const ym=state.settings.selectedMonth;
    const closing=typeof actualForMonth==='function'?(Number(actualForMonth(ym).closing)||0):0;
    const projected=(typeof round2==='function'?round2:v=>Math.round(v*100)/100)(closing+pendingAmountForMonth('Receita',ym)-pendingAmountForMonth('Despesa',ym));
    const target=document.getElementById('kpiProjectedClosing');
    if(target){
      const text=typeof fmtMoney==='function'?fmtMoney(projected):String(projected);
      if(target.textContent!==text)target.textContent=text;
      target.style.color=projected<0?'#fecaca':'#bbf7d0';
    }
  }

  const observer=new MutationObserver(renderProjectedClosing);
  function init(){
    renderProjectedClosing();
    const dashboard=document.getElementById('page-dashboard');
    if(dashboard)observer.observe(dashboard,{childList:true,subtree:true,characterData:true});
    const month=document.getElementById('monthSelect');
    if(month)month.addEventListener('change',()=>setTimeout(renderProjectedClosing,0));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
  if(document.querySelector('script[src="income-simulator-comparison.js"]'))return;
  const script=document.createElement('script');
  script.src='income-simulator-comparison.js';
  document.body.appendChild(script);
})();

(function(){
  if(window.__projectionVertexEvents)return;
  window.__projectionVertexEvents=true;
  const add=(ym,n)=>typeof ymAdd==='function'?ymAdd(ym,n):ym;
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):String(Number(v)||0);
  const cfg=id=>{if(id!=='projectionChart')return{incomes:true,debts:true,cards:true};const s=state?.settings?.dashboardProjectionSources||{};return{incomes:s.incomes!==false,debts:s.debts!==false,cards:s.cards!==false}};
  function evt(list,type,action,name,amount){amount=Math.abs(Number(amount)||0);if(!amount)return;const positive=(type==='Receita'&&action!=='end')||(type==='Despesa'&&action==='end');list.push({type,action,name:name||type,amount,positive})}
  function monthEvents(ym,id){
    const out=[],c=cfg(id);
    if(c.incomes)for(const p of state?.incomePlans||[]){const a=typeof window.incomeAmountForMonth==='function'?window.incomeAmountForMonth(p,ym):Number(p.amount)||0;if(p.mode==='unica'){if(p.firstMonth===ym)evt(out,'Receita','once',p.name,a)}else{if(p.firstMonth===ym)evt(out,'Receita','start',p.name,a);if(p.openEnded!==true&&p.lastMonth===ym)evt(out,'Receita','end',p.name,a)}}
    if(c.debts)for(const d of state?.debts||[]){const a=Number(d.installmentAmount)||0;if(d.firstMonth===ym)evt(out,'Despesa','start',d.name,a);if(d.openEnded!==true){const first=Math.max(1,Number(d.firstInstallment)||1),total=Math.max(first,Number(d.totalInstallments)||first);if(add(d.firstMonth,total-first)===ym)evt(out,'Despesa','end',d.name,a)}}
    if(c.cards)for(const p of state?.purchases||[]){let a=Number(p.installmentValue)||0;if(p.mode==='recorrente'){a=Number(p.totalAmount)||0;if(p.firstInvoiceYm===ym)evt(out,'Despesa','start',p.description,a);if(p.recurringEnd===ym)evt(out,'Despesa','end',p.description,a);continue}if(p.openEnded===true){if(p.firstInvoiceYm===ym)evt(out,'Despesa','start',p.description,a);continue}const cur=Number(p.chatgptImport?.installmentCurrent),tot=Number(p.chatgptImport?.installmentTotal);if(Number.isInteger(cur)&&Number.isInteger(tot)&&cur>=1&&tot>=cur){if(!a)a=Number(p.totalAmount)||0;if(cur===1&&p.firstInvoiceYm===ym)evt(out,'Despesa','start',p.description,a);if(add(p.firstInvoiceYm,tot-cur)===ym)evt(out,'Despesa','end',p.description,a);continue}const n=Math.max(1,Number(p.installments)||1);if(n<=1)continue;if(!a&&typeof purchaseAllocation==='function')a=Number(purchaseAllocation(p,ym)?.amount)||0;if(p.firstInvoiceYm===ym)evt(out,'Despesa','start',p.description,a);if(add(p.firstInvoiceYm,n-1)===ym)evt(out,'Despesa','end',p.description,a)}
    return out;
  }
  function annotate(id,data){
    if(id!=='projectionChart'&&id!=='projectionChartLarge')return;
    const canvas=document.getElementById(id),host=canvas?.parentElement;if(!canvas||!host||!data?.length||!state?.settings?.selectedMonth)return;
    host.style.position='relative';host.querySelector(':scope > .projection-vertex-event-layer')?.remove();
    const layer=document.createElement('div');layer.className='projection-vertex-event-layer';layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:8';host.appendChild(layer);
    const rect=canvas.getBoundingClientRect(),W=Math.max(300,rect.width||700),H=Math.max(220,rect.height||300),p={l:62,r:18,t:20,b:42},vals=data.map(d=>Number(d.value)||0);let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min){max+=1;min-=1}const pad=(max-min)*.1;max+=pad;min-=pad;const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    data.forEach((d,i)=>{const ym=add(state.settings.selectedMonth,i+1),events=monthEvents(ym,id);if(!events.length)return;const pos=events.filter(e=>e.positive).length,neg=events.length-pos,b=document.createElement('div'),title=events.map(e=>`${e.positive?'+':'−'} ${e.type} ${e.action==='start'?'iniciou':e.action==='end'?'terminou':'pontual'}: ${e.name} (${money(e.amount)})`).join('\n');b.title=title;b.textContent=pos&&neg?`+${pos} −${neg}`:pos?`+${pos}`:`−${neg}`;b.style.cssText=`position:absolute;left:${x(i)}px;top:${y(Number(d.value)||0)-16}px;transform:translate(-50%,-100%);padding:2px 6px;border-radius:999px;font:700 10px system-ui;color:#fff;background:${pos&&neg?'#d97706':pos?'#16a34a':'#dc2626'};border:1px solid rgba(255,255,255,.35);box-shadow:0 2px 8px rgba(0,0,0,.28);pointer-events:auto;white-space:nowrap;cursor:help`;layer.appendChild(b)});
  }
  const base=window.drawLineChart;if(typeof base==='function'&&!base.__projectionVertexEvents){const wrapped=function(id,data){const r=base.apply(this,arguments);try{annotate(id,data)}catch(e){console.error('projection vertex events',e)}return r};wrapped.__projectionVertexEvents=true;window.drawLineChart=wrapped;try{drawLineChart=wrapped}catch(e){}}
})();
