(function(){
  const COLORS={
    pago:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    recebido:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    paga:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    pendente:{bg:'#3a2d12',border:'#8a6a1f',text:'#fde68a'},
    'aguardando confirmação':{bg:'#102845',border:'#1d497b',text:'#bfdbfe'},
    'não paga':{bg:'#3b1717',border:'#8b3a3a',text:'#fecaca'},
    'nao paga':{bg:'#3b1717',border:'#8b3a3a',text:'#fecaca'}
  };

  function txOptions(type,current){
    const normalized=String(type||'').trim().toLowerCase();
    const options=normalized==='despesa'?['Pago','Pendente']:['Recebido','Pendente'];
    if(current&&!options.includes(current))options.unshift(current);
    return options;
  }

  function styleSelect(select){
    const key=String(select.value||'').trim().toLowerCase();
    const c=COLORS[key]||{bg:'#172033',border:'#334155',text:'#e2e8f0'};
    select.style.background=c.bg;select.style.border=`1px solid ${c.border}`;select.style.color=c.text;select.style.borderRadius='999px';select.style.padding='4px 24px 4px 9px';select.style.fontSize='11px';select.style.fontWeight='700';select.style.lineHeight='1.2';select.style.cursor='pointer';select.style.minWidth='88px';select.style.outline='none';
  }

  function transactionIdFromRow(row){const edit=row.querySelector('button[onclick*="editTx("]');if(!edit)return null;const code=edit.getAttribute('onclick')||'';const match=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);return match?.[1]||null}
  function invoiceIdFromRow(row){const open=row.querySelector('button[onclick*="openInvoiceFromHistory("]');if(!open)return null;const code=open.getAttribute('onclick')||'';const match=code.match(/openInvoiceFromHistory\(['\"]([^'\"]+)['\"]\)/);return match?.[1]||null}
  function buildSelect(label,options,current,onChange){const select=document.createElement('select');select.className='history-status-select';select.setAttribute('aria-label',label);options.forEach(status=>{const option=document.createElement('option');option.value=status;option.textContent=status;option.selected=status===current;select.appendChild(option)});styleSelect(select);select.addEventListener('change',()=>{onChange(select.value);styleSelect(select)});return select}

  function deleteTransaction(txId){
    if(typeof state==='undefined'||!Array.isArray(state?.transactions))return;
    const tx=state.transactions.find(t=>t.id===txId);if(!tx)return;
    if(tx.debtManaged===true&&tx.debtId){if(typeof window.deleteDebtPlan==='function')window.deleteDebtPlan(tx.debtId);else alert('Esta parcela é gerenciada pela área Despesas. Exclua a despesa por lá.');return}
    if(tx.incomeManaged===true&&tx.incomePlanId){if(typeof window.deleteIncomePlan==='function')window.deleteIncomePlan(tx.incomePlanId);else alert('Este lançamento é gerenciado pela área Receitas. Exclua a receita por lá.');return}
    const label=tx.description||'este lançamento';if(!confirm(`Excluir o lançamento "${label}"? Esta ação não poderá ser desfeita.`))return;
    state.transactions=state.transactions.filter(t=>t.id!==txId);if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
  }

  function mountDeleteButton(row,tx){const cells=row.querySelectorAll('td'),actionCell=cells[7];if(!actionCell||actionCell.querySelector('.history-delete-btn'))return;actionCell.style.whiteSpace='nowrap';const button=document.createElement('button');button.type='button';button.className='btn small danger history-delete-btn';button.textContent='Excluir';button.style.marginLeft='6px';button.addEventListener('click',e=>{e.stopPropagation();deleteTransaction(tx.id)});actionCell.appendChild(button)}

  function enhanceHistoryStatuses(){
    const body=document.getElementById('historyBody');if(!body||typeof state==='undefined')return;
    body.querySelectorAll('tr').forEach(row=>{
      if(row.dataset.statusInteractive==='1')return;const cells=row.querySelectorAll('td'),cell=cells[5];if(!cell)return;
      const txId=transactionIdFromRow(row);
      if(txId&&Array.isArray(state?.transactions)){
        const tx=state.transactions.find(t=>t.id===txId);if(!tx)return;
        const select=buildSelect(`Status de ${tx.description||'lançamento'}`,txOptions(tx.type,tx.status),tx.status,value=>{const target=state.transactions.find(t=>t.id===txId);if(!target)return;target.status=value;if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save()});
        cell.innerHTML='';cell.appendChild(select);mountDeleteButton(row,tx);row.dataset.statusInteractive='1';return;
      }
      const invoiceId=invoiceIdFromRow(row);
      if(invoiceId&&Array.isArray(state?.invoices)){
        const invoice=state.invoices.find(i=>i.id===invoiceId);if(!invoice)return;const current=invoice.status==='Paga'?'Paga':'Não paga';
        const select=buildSelect('Status da fatura',['Paga','Não paga'],current,value=>{const target=state.invoices.find(i=>i.id===invoiceId);if(!target)return;if(value==='Paga'){if(target.status!=='Paga')target.lastNonPaidStatus=target.status||'Fechada';target.status='Paga'}else target.status=(target.lastNonPaidStatus&&target.lastNonPaidStatus!=='Paga')?target.lastNonPaidStatus:'Fechada';if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save()});
        cell.innerHTML='';cell.appendChild(select);row.dataset.statusInteractive='1';
      }
    });
  }

  const originalRenderHistory=window.renderHistory;if(typeof originalRenderHistory==='function')window.renderHistory=function(){const result=originalRenderHistory.apply(this,arguments);enhanceHistoryStatuses();return result};
  function init(){const body=document.getElementById('historyBody');if(!body)return;enhanceHistoryStatuses();const observer=new MutationObserver(()=>enhanceHistoryStatuses());observer.observe(body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
  const style=document.createElement('style');
  style.textContent='#invoiceMonthLocal{display:none!important}';
  document.head.appendChild(style);
})();

(function(){
  ['pwa.js','cloud-sync.js','profile.js','profile-topbar.js','notifications.js','modal-effects.js','shared-expenses-bootstrap.js','bank-branding.js','bank-branding-rounded.js','card-glass-tune.js','card-organizer.js','card-edit-control.js','debts.js','shared-debts-ui.js','shared-expense-deletion.js','shared-delete-link-guard.js','shared-delete-notifications.js','shared-status-link.js','shared-payment-confirmations.js','expense-materializer.js','expense-value-history.js','expense-simulator.js','incomes.js','shared-income-ui.js','income-open-ended.js','income-value-history.js','income-simulator.js','projection-controls.js','projected-closing.js','purchase-management.js','purchase-simulator.js','projection-period.js','chart-tooltips.js','invoice-ai-client.js','invoice-ai-importer-core-v2.js','invoice-ai-ui.js'].forEach(src=>{
    if(document.querySelector(`script[src="${src}"]`))return;
    const script=document.createElement('script');script.src=src;document.body.appendChild(script);
  });

  let tries=0;
  const sharingTimer=setInterval(()=>{
    tries++;
    let ready=false;
    try{ready=!!(currentUser?.id&&window.financeCloud)}catch(e){}
    if(ready){
      clearInterval(sharingTimer);
      if(!window.__sharedExpensesLoaded&&!document.querySelector('script[data-shared-expenses-v2="1"]')){
        const script=document.createElement('script');script.src='shared-expenses.js?v=20260915-series2';script.dataset.sharedExpensesV2='1';document.body.appendChild(script);
      }
    }else if(tries>600)clearInterval(sharingTimer);
  },100);
})();