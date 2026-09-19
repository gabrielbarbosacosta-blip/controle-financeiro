(function(){
  if(window.__monthlyCommitmentsDashboardV1Loaded)return;
  window.__monthlyCommitmentsDashboardV1Loaded=true;

  const STYLE_ID='monthly-commitments-dashboard-v1-style';

  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const monthKeySafe=d=>String(d||'').slice(0,7);
  const settledSafe=s=>String(s||'')!=='Pendente';
  const round2Safe=v=>Math.round((Number(v)||0)*100)/100;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #monthlyCommitmentsCard{margin-top:14px;margin-bottom:14px}
      .monthly-commitments-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .monthly-commitment-metric{padding:13px 14px;border:1px solid #23334a;border-radius:12px;background:#0d1929;min-width:0}
      .monthly-commitment-metric .k{font-size:9px;font-weight:760;color:#91a1b4;letter-spacing:.02em}
      .monthly-commitment-metric .v{font:800 18px 'DM Mono',monospace;letter-spacing:-.04em;margin-top:6px;color:#eef3f8;white-space:nowrap}
      .monthly-commitment-metric .h{font-size:9px;color:#71839a;margin-top:5px;line-height:1.35}
      .monthly-commitment-metric.receive .v,.monthly-commitment-metric.forecast.positive .v{color:#91d6b9}
      .monthly-commitment-metric.due .v{color:#ead38f}
      .monthly-commitment-metric.overdue .v,.monthly-commitment-metric.forecast.negative .v{color:#ef8a81}
      .monthly-commitment-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:11px;padding-top:10px;border-top:1px solid #1f3047;color:#8293a8;font-size:10px}
      .monthly-commitment-foot strong{color:#dce6f2}
      @media(max-width:900px){.monthly-commitments-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.monthly-commitments-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function getSelectedMonth(){
    try{
      const v=state?.settings?.selectedMonth;
      if(/^\d{4}-\d{2}$/.test(String(v)))return String(v);
    }catch(_e){}
    return document.getElementById('monthSelect')?.value||new Date().toISOString().slice(0,7);
  }

  function invoiceDueDateSafe(card,ym){
    try{if(typeof invoiceDueDate==='function')return invoiceDueDate(card,ym)}catch(_e){}
    const [y,m]=String(ym).split('-').map(Number),day=Math.max(1,Math.min(Number(card?.dueDay)||10,new Date(y,m,0).getDate()));
    return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function invoiceTotalSafe(cardId,ym){
    try{if(typeof invoiceKnownTotal==='function')return Number(invoiceKnownTotal(cardId,ym))||0}catch(_e){}
    return 0;
  }

  function todayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function monthLabelSafe(ym){
    try{if(typeof fmtMonth==='function')return fmtMonth(ym)}catch(_e){}
    return ym;
  }

  function compute(){
    if(typeof state==='undefined'||!state?.settings)return null;
    const ym=getSelectedMonth(),today=todayKey();
    const txs=Array.isArray(state.transactions)?state.transactions:[];
    const invoices=Array.isArray(state.invoices)?state.invoices:[];
    const cards=Array.isArray(state.cards)?state.cards:[];

    let due=0,receivable=0,overdue=0,pendingExpenseAll=0,pendingIncomeAll=0,unpaidInvoicesAll=0;
    let nextDue=null,nextDueLabel='';

    for(const t of txs){
      if(monthKeySafe(t.date)!==ym)continue;
      const status=String(t.status||''),pending=status==='Pendente',amount=Number(t.amount)||0;
      if(!pending)continue;
      if(t.type==='Receita'){
        pendingIncomeAll+=amount;
        receivable+=amount;
      }else if(t.type==='Despesa'){
        pendingExpenseAll+=amount;
        const d=String(t.date||'');
        if(d<today)overdue+=amount;
        else{
          due+=amount;
          if(!nextDue||d<nextDue){nextDue=d;nextDueLabel=t.description||'Despesa'}
        }
      }
    }

    for(const card of cards){
      if(card?.active===false)continue;
      const inv=invoices.find(i=>String(i.cardId)===String(card.id)&&String(i.ym)===ym);
      if(String(inv?.status||'Aberta')==='Paga')continue;
      const amount=invoiceTotalSafe(card.id,ym);
      if(amount<=0)continue;
      const d=invoiceDueDateSafe(card,ym);
      unpaidInvoicesAll+=amount;
      if(d<today)overdue+=amount;
      else{
        due+=amount;
        if(!nextDue||d<nextDue){nextDue=d;nextDueLabel=`Fatura ${card?.name||'Cartão'}`}
      }
    }

    let actualClosing=0;
    try{actualClosing=Number(actualForMonth(ym)?.closing)||0}catch(_e){}
    const forecast=round2Safe(actualClosing+pendingIncomeAll-pendingExpenseAll-unpaidInvoicesAll);

    return{
      ym,due:round2Safe(due),receivable:round2Safe(receivable),overdue:round2Safe(overdue),
      forecast,actualClosing:round2Safe(actualClosing),nextDue,nextDueLabel
    };
  }

  function ensureCard(){
    injectStyles();
    const page=document.getElementById('page-dashboard');if(!page)return null;
    let card=document.getElementById('monthlyCommitmentsCard');
    if(!card){
      card=document.createElement('div');
      card.className='card';
      card.id='monthlyCommitmentsCard';
      card.innerHTML=`<div class="section-head"><div><h3>Compromissos do mês</h3><div class="muted" id="monthlyCommitmentsSubtitle">Valores pendentes dentro da competência selecionada.</div></div></div><div class="monthly-commitments-grid"><div class="monthly-commitment-metric due"><div class="k">A vencer</div><div class="v" id="monthlyDueValue">—</div><div class="h">Despesas e faturas ainda não vencidas</div></div><div class="monthly-commitment-metric receive"><div class="k">A receber</div><div class="v" id="monthlyReceivableValue">—</div><div class="h">Receitas pendentes no mês</div></div><div class="monthly-commitment-metric overdue"><div class="k">Vencido</div><div class="v" id="monthlyOverdueValue">—</div><div class="h">Despesas e faturas em atraso</div></div><div class="monthly-commitment-metric forecast" id="monthlyForecastMetric"><div class="k">Saldo previsto</div><div class="v" id="monthlyForecastValue">—</div><div class="h">Saldo após pendências do mês</div></div></div><div class="monthly-commitment-foot"><span id="monthlyCommitmentsContext"></span><span id="monthlyNextDue"></span></div>`;
      const shared=document.getElementById('sharedDashboardCard');
      if(shared)page.insertBefore(card,shared);
      else page.appendChild(card);
    }else{
      const shared=document.getElementById('sharedDashboardCard');
      if(shared&&card.nextElementSibling!==shared)page.insertBefore(card,shared);
    }
    return card;
  }

  function render(){
    const card=ensureCard(),data=compute();if(!card||!data)return;
    document.getElementById('monthlyDueValue').textContent=money(data.due);
    document.getElementById('monthlyReceivableValue').textContent=money(data.receivable);
    document.getElementById('monthlyOverdueValue').textContent=money(data.overdue);
    document.getElementById('monthlyForecastValue').textContent=money(data.forecast);
    const metric=document.getElementById('monthlyForecastMetric');
    metric.classList.toggle('positive',data.forecast>=0);
    metric.classList.toggle('negative',data.forecast<0);
    document.getElementById('monthlyCommitmentsSubtitle').textContent=`Fluxo pendente de ${monthLabelSafe(data.ym)}.`;
    document.getElementById('monthlyCommitmentsContext').innerHTML=`Saldo já realizado: <strong>${esc(money(data.actualClosing))}</strong>`;
    const next=document.getElementById('monthlyNextDue');
    if(data.nextDue){
      const label=typeof fmtDate==='function'?fmtDate(data.nextDue):data.nextDue;
      next.innerHTML=`Próximo vencimento: <strong>${esc(label)}</strong> · ${esc(data.nextDueLabel)}`;
    }else next.textContent=data.overdue>0?'Há valores vencidos sem baixa.':'Nenhum vencimento futuro pendente neste mês.';
  }

  function observe(){
    const page=document.getElementById('page-dashboard');if(!page)return false;
    ensureCard();
    const obs=new MutationObserver(mutations=>{
      const meaningful=mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&(n.id==='sharedDashboardCard'||n.querySelector?.('#sharedDashboardCard'))));
      if(meaningful){ensureCard();render()}
    });
    obs.observe(page,{childList:true,subtree:false});
    return true;
  }

  function patchRenderAll(){
    try{
      if(typeof renderAll!=='function'||renderAll.__monthlyCommitmentsPatched)return;
      const base=renderAll;
      const wrapped=function(){const r=base.apply(this,arguments);queueMicrotask(render);return r};
      wrapped.__monthlyCommitmentsPatched=true;
      window.renderAll=wrapped;
      try{renderAll=wrapped}catch(_e){}
    }catch(_e){}
  }

  function init(){
    injectStyles();patchRenderAll();
    if(!observe()){
      let tries=0;const timer=setInterval(()=>{tries++;if(observe()||tries>300)clearInterval(timer)},100);
    }
    document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(render,0));
    window.addEventListener('focus',render);
    render();
    setTimeout(render,350);setTimeout(render,1200);
  }

  window.financeMonthlyCommitments={refresh:render,compute};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();