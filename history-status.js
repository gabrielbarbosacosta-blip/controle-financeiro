(function(){
  const COLORS={
    pago:{bg:'#eef6f1',border:'#cbe0d6',text:'#39705e'},recebido:{bg:'#eef6f1',border:'#cbe0d6',text:'#39705e'},paga:{bg:'#eef6f1',border:'#cbe0d6',text:'#39705e'},pendente:{bg:'#fbf5e9',border:'#ead9b8',text:'#816631'},'aguardando confirmação':{bg:'#eff5f8',border:'#d1e0e8',text:'#496f85'},'não paga':{bg:'#fff2f0',border:'#efcfcc',text:'#9a4e4b'},'nao paga':{bg:'#fff2f0',border:'#efcfcc',text:'#9a4e4b'}
  };
  function txOptions(type,current){const normalized=String(type||'').trim().toLowerCase(),options=normalized==='despesa'?['Pago','Pendente']:['Recebido','Pendente'];if(current&&!options.includes(current))options.unshift(current);return options}
  function styleSelect(select){const key=String(select.value||'').trim().toLowerCase(),c=COLORS[key]||{bg:'#f1f1ed',border:'#deded8',text:'#667276'};select.style.background=c.bg;select.style.border=`1px solid ${c.border}`;select.style.color=c.text;select.style.borderRadius='999px';select.style.padding='4px 24px 4px 9px';select.style.fontSize='11px';select.style.fontWeight='700';select.style.lineHeight='1.2';select.style.cursor='pointer';select.style.minWidth='88px';select.style.outline='none'}
  function transactionIdFromRow(row){const edit=row.querySelector('button[onclick*="editTx("]');if(!edit)return null;const code=edit.getAttribute('onclick')||'',match=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);return match?.[1]||null}
  function invoiceIdFromRow(row){const open=row.querySelector('button[onclick*="openInvoiceFromHistory("]');if(!open)return null;const code=open.getAttribute('onclick')||'',match=code.match(/openInvoiceFromHistory\(['\"]([^'\"]+)['\"]\)/);return match?.[1]||null}
  function buildSelect(label,options,current,onChange){const select=document.createElement('select');select.className='history-status-select';select.setAttribute('aria-label',label);options.forEach(status=>{const option=document.createElement('option');option.value=status;option.textContent=status;option.selected=status===current;select.appendChild(option)});styleSelect(select);select.addEventListener('change',()=>{onChange(select.value);styleSelect(select)});return select}
  function isGoalManagedTransaction(tx){
    try{if(window.financeGoalManagedProtection?.isTransaction?.(tx))return true}catch(_e){}
    return String(tx?.debtId||'').startsWith('goal-shared-')
      ||String(tx?.incomePlanId||'').startsWith('goal-shared-income-')
      ||/aporte compartilhado vinculado ao objetivo/i.test(String(tx?.notes||''));
  }
  async function setGoalManagedStatus(txId,value,select){
    const target=Array.isArray(state?.transactions)?state.transactions.find(t=>t.id===txId):null;
    if(!target)return;
    const previous=target.status;
    if(select)select.disabled=true;
    try{
      const client=typeof sb!=='undefined'?sb:window.sb;
      const {data,error}=await client.rpc('finance_set_shared_transaction_status',{p_transaction_id:txId,p_status:value});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.detail||data?.error||'shared_status_failed');
      if(data?.handled===false)throw new Error('shared_link_not_found');
      try{await window.financeCloud?.refresh?.()}catch(_e){}
      try{if(typeof renderAll==='function')renderAll()}catch(_e){}
      try{window.financeSharedPaymentConfirmationsRefresh?.()}catch(_e){}
      try{window.financeSharedBalancesDetailRefresh?.()}catch(_e){}
      try{window.financeNotificationsRefresh?.()}catch(_e){}
      if(data?.action==='payment_confirmation_requested'){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Pagamento aguardando confirmação do pagador')}catch(_e){}
      }else if(data?.action==='received_confirmed'){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Recebimento confirmado')}catch(_e){}
      }
    }catch(err){
      console.error('Falha ao atualizar lançamento gerenciado por Objetivos.',err);
      target.status=previous;
      if(select){select.value=previous;styleSelect(select)}
      alert('Não foi possível atualizar o status deste lançamento agora.');
    }finally{
      if(select)select.disabled=false;
    }
  }
  function deleteTransaction(txId){if(typeof state==='undefined'||!Array.isArray(state?.transactions))return;const tx=state.transactions.find(t=>t.id===txId);if(!tx)return;if(typeof window.isDebtAdvanceTransaction==='function'&&window.isDebtAdvanceTransaction(tx)){if(typeof window.cancelDebtAdvanceTransaction==='function')window.cancelDebtAdvanceTransaction(txId);else alert('Não foi possível cancelar esta antecipação agora.');return}if(isGoalManagedTransaction(tx)){alert('Este lançamento é gerenciado pela seção Objetivos. Para alterar ou cancelar o aporte compartilhado, acesse o objetivo correspondente.');return}if(tx.debtManaged===true&&tx.debtId){if(typeof window.deleteDebtPlan==='function')window.deleteDebtPlan(tx.debtId);else alert('Esta parcela é gerenciada pela área Despesas. Exclua a despesa por lá.');return}if(tx.incomeManaged===true&&tx.incomePlanId){if(typeof window.deleteIncomePlan==='function')window.deleteIncomePlan(tx.incomePlanId);else alert('Este lançamento é gerenciado pela área Receitas. Exclua a receita por lá.');return}const label=tx.description||'este lançamento';if(!confirm(`Excluir o lançamento "${label}"? Esta ação não poderá ser desfeita.`))return;state.transactions=state.transactions.filter(t=>t.id!==txId);if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save()}
  function mountDeleteButton(row,tx){const cells=row.querySelectorAll('td'),actionCell=cells[7];if(!actionCell||actionCell.querySelector('.history-delete-btn,.history-goal-managed'))return;actionCell.style.whiteSpace='nowrap';if(isGoalManagedTransaction(tx)){const badge=document.createElement('span');badge.className='history-goal-managed';badge.textContent='Gerenciado em Objetivos';badge.title='A exclusão deste lançamento só pode ocorrer pela gestão do objetivo.';actionCell.appendChild(badge);return}const button=document.createElement('button');button.type='button';button.className='btn small danger history-delete-btn';button.textContent=(typeof window.isDebtAdvanceTransaction==='function'&&window.isDebtAdvanceTransaction(tx))?'Cancelar':'Excluir';button.style.marginLeft='6px';button.addEventListener('click',e=>{e.stopPropagation();deleteTransaction(tx.id)});actionCell.appendChild(button)}
  function enhanceHistoryStatuses(){const bodies=[...document.querySelectorAll('[data-history-body="1"]')];if(!bodies.length||typeof state==='undefined')return;bodies.forEach(body=>body.querySelectorAll('tr').forEach(row=>{if(row.dataset.statusInteractive==='1')return;const cells=row.querySelectorAll('td'),cell=cells[5];if(!cell)return;const txId=transactionIdFromRow(row);if(txId&&Array.isArray(state?.transactions)){const tx=state.transactions.find(t=>t.id===txId);if(!tx)return;const select=buildSelect(`Status de ${tx.description||'lançamento'}`,txOptions(tx.type,tx.status),tx.status,value=>{const target=state.transactions.find(t=>t.id===txId);if(!target)return;if(isGoalManagedTransaction(target)){setGoalManagedStatus(txId,value,select);return}target.status=value;if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save()});cell.innerHTML='';cell.appendChild(select);mountDeleteButton(row,tx);row.dataset.statusInteractive='1';return}const invoiceId=invoiceIdFromRow(row);if(invoiceId&&Array.isArray(state?.invoices)){const invoice=state.invoices.find(i=>i.id===invoiceId);if(!invoice)return;const current=invoice.status==='Paga'?'Paga':'Não paga',select=buildSelect('Status da fatura',['Paga','Não paga'],current,value=>{const target=state.invoices.find(i=>i.id===invoiceId);if(!target)return;if(value==='Paga'){if(target.status!=='Paga')target.lastNonPaidStatus=target.status||'Fechada';target.status='Paga'}else target.status=(target.lastNonPaidStatus&&target.lastNonPaidStatus!=='Paga')?target.lastNonPaidStatus:'Fechada';if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save()});cell.innerHTML='';cell.appendChild(select);row.dataset.statusInteractive='1'}}))}
  const originalRenderHistory=window.renderHistory;if(typeof originalRenderHistory==='function')window.renderHistory=function(){const result=originalRenderHistory.apply(this,arguments);enhanceHistoryStatuses();return result};
  function init(){const page=document.getElementById('page-history');if(!page)return;enhanceHistoryStatuses();const observer=new MutationObserver(()=>enhanceHistoryStatuses());observer.observe(page,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
(function(){const style=document.createElement('style');style.textContent='#invoiceMonthLocal{display:none!important}';document.head.appendChild(style)})();
(async function(){
  const scripts=['prumo-ui-current.js?v=20260924-monthminimal1','chart-first-load-v1.js?v=20260917-chartintro7','pwa.js?v=20260918-localdev1','profile.js?v=20260919-avatarlogoutfix1','profile-topbar.js','notifications.js?v=20260919-recurringplans1','notifications-queue.js?v=20260919-connections1','modal-effects.js','shared-expenses-bootstrap.js?v=20260919-connections1','counterparty-obligations-v1.js?v=20260919-connections2','bank-branding.js','bank-branding-rounded.js','card-glass-tune.js','card-organizer.js','card-edit-control.js','debts.js?v=20260924-advancecancel1','shared-debts-ui.js','shared-expense-deletion.js','shared-delete-link-guard.js','shared-delete-notifications.js','shared-status-link.js?v=20260919-goalsharedconfirm2','shared-payment-confirmations.js','shared-balances-detail.js?v=20260919-counterparty1','shared-balances-theme-v2.js?v=20260916-balances1','expense-materializer.js','expense-value-history.js','simulation-scenario-adjustments-v1.js?v=20260919-scenario4','expense-simulator.js?v=20260919-scenario1','incomes.js','connections-v1.js?v=20260919-connections4','shared-income-ui.js?v=20260919-goalsharedconfirm2','income-open-ended.js','income-value-history.js','income-simulator.js?v=20260919-scenario1','opening-balance-adjustment-v1.js?v=20260919-reconcile1','monthly-commitments-dashboard-v1.js?v=20260919-dueflow2','projection-controls.js?v=20260917-canonical-filter1','projected-closing.js','objectives.js?v=20260924-recurringfix1','objectives-expense-v4.js?v=20260916-v5','objectives-sync-v5.js?v=20260916-v5','objectives-collaboration-v6.js?v=20260919-goalexitrefund1','objectives-contribution-mode-v1.js?v=20260924-recurringfix1','objectives-ledger-v1.js?v=20260919-ledgerpeople1','purchase-management.js','purchase-simulator.js?v=20260919-scenario1','projection-period.js','chart-tooltips.js?v=20260917-tooltip2','invoice-ai-client.js','invoice-ai-importer-core-v2.js','invoice-ai-ui.js'];
  const clean=src=>String(src||'').split('?')[0].replace(/^\.\//,'');
  const exists=src=>[...document.scripts].some(s=>clean(s.getAttribute('src'))===clean(src));
  const loadScript=src=>new Promise(resolve=>{
    if(exists(src)){resolve();return}
    const script=document.createElement('script');script.src=src;script.async=false;
    script.onload=()=>resolve();script.onerror=()=>{console.warn('Falha ao carregar módulo:',src);resolve()};
    document.body.appendChild(script);
  });
  for(const src of scripts)await loadScript(src);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  document.documentElement?.classList.add('prumo-current-ui-ready');
  window.__prumoInitialModulesReady=true;
  try{window.dispatchEvent(new CustomEvent('prumo:initial-modules-ready'))}catch(_e){}

  let tries=0;const sharingTimer=setInterval(()=>{
    tries++;let ready=false;try{ready=!!(currentUser?.id&&window.financeCloud)}catch(e){}
    if(ready){
      clearInterval(sharingTimer);
      if(!window.__sharedExpensesLoaded&&!document.querySelector('script[data-shared-expenses-v2="1"]')){
        const script=document.createElement('script');script.src='shared-expenses.js?v=20260919-recurringplans1';script.async=false;script.dataset.sharedExpensesV2='1';document.body.appendChild(script)
      }
    }else if(tries>600)clearInterval(sharingTimer)
  },100);
})();
