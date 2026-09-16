(function(){
  if(window.__sharedIncomeUiLoaded)return;
  window.__sharedIncomeUiLoaded=true;

  const STYLE_ID='shared-income-ui-style';
  let syncing=false;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function fmtDateSafe(d){try{return typeof fmtDate==='function'?fmtDate(d):d}catch(e){return d}}
  function monthLabelSafe(ym){try{return typeof fmtMonth==='function'?fmtMonth(ym):ym}catch(e){return ym}}
  function getSelectedMonth(){
    try{
      const value=state?.settings?.selectedMonth||window.state?.settings?.selectedMonth||'';
      if(/^\d{4}-\d{2}$/.test(String(value)))return String(value);
    }catch(e){}
    const candidates=['#monthSelect','#selectedMonth','#projectionMonth','#historyMonth','input[type="month"]'];
    for(const selector of candidates){
      const el=document.querySelector(selector),value=el?.value||'';
      if(/^\d{4}-\d{2}$/.test(String(value)))return String(value);
    }
    const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

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

  function sharedReceivables(month=getSelectedMonth()){
    try{
      return (Array.isArray(state?.transactions)?state.transactions:[])
        .filter(isSharedReceivable)
        .filter(t=>!month||String(t.date||'').slice(0,7)===month);
    }catch(e){return[]}
  }

  function ensureCard(){
    injectStyles();
    const page=document.getElementById('page-incomes');if(!page)return null;
    let card=document.getElementById('sharedIncomeCard');
    if(card)return card;
    card=document.createElement('div');card.className='card';card.id='sharedIncomeCard';
    card.innerHTML=`<div class="section-head"><div><h3>Receitas de compartilhamentos</h3><div class="muted" id="sharedIncomeSubtitle">Reembolsos a receber de despesas compartilhadas que você pagou.</div></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Receita</th><th>Origem</th><th>Data</th><th>Status</th><th class="num">Valor</th></tr></thead><tbody id="sharedIncomeBody"></tbody></table></div>`;
    page.appendChild(card);return card;
  }

  function renderCard(){
    const card=ensureCard();if(!card)return;
    const body=document.getElementById('sharedIncomeBody');if(!body)return;
    const month=getSelectedMonth();
    const subtitle=document.getElementById('sharedIncomeSubtitle');
    if(subtitle)subtitle.textContent=`Reembolsos da competência ${monthLabelSafe(month)}.`;
    const rows=sharedReceivables(month).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    const html=!rows.length
      ?`<tr><td colspan="5"><div class="shared-income-empty">Nenhum reembolso de despesa compartilhada em ${esc(monthLabelSafe(month))}.</div></td></tr>`
      :rows.map(t=>{
        const status=String(t.status||'Pendente');
        const received=status.toLowerCase()==='recebido';
        return `<tr><td><strong>${esc(t.description||'Reembolso')}</strong><br><span class="shared-income-tag">Compartilhamento</span></td><td>${esc(t.account||'Compartilhamento')}</td><td>${esc(fmtDateSafe(t.date||''))}</td><td><span class="shared-income-status ${received?'received':''}">${esc(status)}</span></td><td class="num"><strong>${money(t.amount)}</strong></td></tr>`;
      }).join('');
    if(body.innerHTML!==html)body.innerHTML=html;
  }

  function updateSummary(){
    const month=getSelectedMonth();
    const rows=sharedReceivables(month);
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
    if(syncing)return;
    const page=document.getElementById('page-incomes');if(!page)return;
    syncing=true;
    try{renderCard();updateSummary()}finally{syncing=false}
  }

  function hookIncomeRender(){
    if(typeof window.renderIncomePage!=='function'||window.renderIncomePage.__sharedIncomeHooked)return false;
    const original=window.renderIncomePage;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      queueMicrotask(sync);
      return result;
    };
    wrapped.__sharedIncomeHooked=true;
    window.renderIncomePage=wrapped;
    return true;
  }

  function init(){
    injectStyles();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      hookIncomeRender();
      if(document.getElementById('page-incomes'))sync();
      if((hookIncomeRender()&&document.getElementById('page-incomes'))||tries>300)clearInterval(timer);
    },100);
    document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="incomes"]'))setTimeout(sync,0)});
    document.addEventListener('change',e=>{
      const value=String(e.target?.value||'');
      if(/^\d{4}-\d{2}$/.test(value)&&document.getElementById('page-incomes')?.classList.contains('active'))setTimeout(sync,0);
    },true);
    window.addEventListener('focus',()=>{if(document.getElementById('page-incomes')?.classList.contains('active'))sync()});
    window.financeSharedIncomeRefresh=sync;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
