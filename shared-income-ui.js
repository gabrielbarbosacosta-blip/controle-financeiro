(function(){
  if(window.__sharedIncomeUiLoaded)return;
  window.__sharedIncomeUiLoaded=true;

  const STYLE_ID='shared-income-ui-style';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function fmtDateSafe(d){try{return typeof fmtDate==='function'?fmtDate(d):d}catch(e){return d}}
  function monthLabelSafe(ym){try{return typeof fmtMonth==='function'?fmtMonth(ym):ym}catch(e){return ym}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;
    s.textContent=`
      #sharedIncomeCard{margin-top:14px}
      #sharedIncomeCard .shared-income-tag{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;border:1px solid #245f37;background:#102a19;color:#bbf7d0;font-size:10px;font-weight:700}
      #sharedIncomeCard .shared-income-status{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;border:1px solid #6b5318;background:#30230c;color:#fde68a;font-size:10px;font-weight:700}
      #sharedIncomeCard .shared-income-status.received{border-color:#245f37;background:#102a19;color:#bbf7d0}
      #sharedIncomeCard .shared-income-empty{padding:24px;text-align:center;color:var(--muted);font-size:12px}
    `;
    document.head.appendChild(s);
  }

  function isSharedReceivable(t){
    if(!t||String(t.type||'').toLowerCase()!=='receita')return false;
    const id=String(t.id||''),desc=String(t.description||''),notes=String(t.notes||'');
    return id.startsWith('shared-')&&(desc.startsWith('Reembolso —')||notes.includes('Valor a receber referente à despesa compartilhada'));
  }

  function sharedReceivables(){
    try{return (Array.isArray(state?.transactions)?state.transactions:[]).filter(isSharedReceivable)}catch(e){return[]}
  }

  function ensureCard(){
    injectStyles();
    const page=document.getElementById('page-incomes');if(!page)return null;
    let card=document.getElementById('sharedIncomeCard');
    if(card)return card;
    card=document.createElement('div');card.className='card';card.id='sharedIncomeCard';
    card.innerHTML=`<div class="section-head"><div><h3>Receitas de compartilhamentos</h3><div class="muted">Reembolsos a receber de despesas compartilhadas que você pagou.</div></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Receita</th><th>Origem</th><th>Data</th><th>Status</th><th class="num">Valor</th></tr></thead><tbody id="sharedIncomeBody"></tbody></table></div>`;
    page.appendChild(card);return card;
  }

  function renderCard(){
    const card=ensureCard();if(!card)return;
    const body=document.getElementById('sharedIncomeBody');if(!body)return;
    const rows=sharedReceivables().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    if(!rows.length){body.innerHTML='<tr><td colspan="5"><div class="shared-income-empty">Nenhum reembolso de despesa compartilhada a receber.</div></td></tr>';return}
    body.innerHTML=rows.map(t=>{
      const status=String(t.status||'Pendente');
      const received=status.toLowerCase()==='recebido';
      return `<tr><td><strong>${esc(t.description||'Reembolso')}</strong><br><span class="shared-income-tag">Compartilhamento</span></td><td>${esc(t.account||'Compartilhamento')}</td><td>${esc(fmtDateSafe(t.date||''))}</td><td><span class="shared-income-status ${received?'received':''}">${esc(status)}</span></td><td class="num"><strong>${money(t.amount)}</strong></td></tr>`;
    }).join('');
  }

  function updateSummary(){
    const rows=sharedReceivables();
    let plans=[],managed=[];
    try{plans=Array.isArray(state?.incomePlans)?state.incomePlans:[];managed=(Array.isArray(state?.transactions)?state.transactions:[]).filter(t=>t.incomeManaged===true)}catch(e){}
    const all=[...managed,...rows],pending=all.filter(t=>String(t.status||'').toLowerCase()==='pendente');
    const count=document.getElementById('incomePlanCount'),pc=document.getElementById('incomePendingCount'),pt=document.getElementById('incomePendingTotal'),nd=document.getElementById('incomeNextDue');
    if(count)count.textContent=String(plans.length+rows.length);
    if(pc)pc.textContent=String(pending.length);
    if(pt)pt.textContent=money(pending.reduce((s,t)=>s+(Number(t.amount)||0),0));
    if(nd){const next=[...pending].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))[0];nd.textContent=next?`${monthLabelSafe(String(next.date||'').slice(0,7))} • ${money(next.amount)}`:'—'}
  }

  function sync(){
    const page=document.getElementById('page-incomes');if(!page)return;
    renderCard();updateSummary();
  }

  function init(){
    injectStyles();
    let tries=0;const timer=setInterval(()=>{tries++;sync();if(document.getElementById('page-incomes')&&tries>10)clearInterval(timer);if(tries>300)clearInterval(timer)},100);
    const observer=new MutationObserver(()=>{if(document.getElementById('page-incomes')?.classList.contains('active'))queueMicrotask(sync)});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="incomes"]'))setTimeout(sync,0)});
    window.addEventListener('focus',sync);
    window.financeSharedIncomeRefresh=sync;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
