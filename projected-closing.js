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
