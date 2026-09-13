(function(){
  const COLORS={
    pago:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    recebido:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    paga:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    pendente:{bg:'#3a2d12',border:'#8a6a1f',text:'#fde68a'},
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
    select.style.background=c.bg;
    select.style.border=`1px solid ${c.border}`;
    select.style.color=c.text;
    select.style.borderRadius='999px';
    select.style.padding='4px 24px 4px 9px';
    select.style.fontSize='11px';
    select.style.fontWeight='700';
    select.style.lineHeight='1.2';
    select.style.cursor='pointer';
    select.style.minWidth='88px';
    select.style.outline='none';
  }

  function transactionIdFromRow(row){
    const edit=row.querySelector('button[onclick*="editTx("]');
    if(!edit)return null;
    const code=edit.getAttribute('onclick')||'';
    const match=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1]||null;
  }

  function invoiceIdFromRow(row){
    const open=row.querySelector('button[onclick*="openInvoiceFromHistory("]');
    if(!open)return null;
    const code=open.getAttribute('onclick')||'';
    const match=code.match(/openInvoiceFromHistory\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1]||null;
  }

  function buildSelect(label,options,current,onChange){
    const select=document.createElement('select');
    select.className='history-status-select';
    select.setAttribute('aria-label',label);
    options.forEach(status=>{
      const option=document.createElement('option');
      option.value=status;
      option.textContent=status;
      option.selected=status===current;
      select.appendChild(option);
    });
    styleSelect(select);
    select.addEventListener('change',()=>{
      onChange(select.value);
      styleSelect(select);
    });
    return select;
  }

  function enhanceHistoryStatuses(){
    const body=document.getElementById('historyBody');
    if(!body||typeof state==='undefined')return;

    body.querySelectorAll('tr').forEach(row=>{
      if(row.dataset.statusInteractive==='1')return;
      const cells=row.querySelectorAll('td');
      const cell=cells[5];
      if(!cell)return;

      const txId=transactionIdFromRow(row);
      if(txId&&Array.isArray(state?.transactions)){
        const tx=state.transactions.find(t=>t.id===txId);
        if(!tx)return;
        const select=buildSelect(
          `Status de ${tx.description||'lançamento'}`,
          txOptions(tx.type,tx.status),
          tx.status,
          value=>{
            const target=state.transactions.find(t=>t.id===txId);
            if(!target)return;
            target.status=value;
            if(typeof renderAll==='function')renderAll();
            else if(typeof save==='function')save();
          }
        );
        cell.innerHTML='';
        cell.appendChild(select);
        row.dataset.statusInteractive='1';
        return;
      }

      const invoiceId=invoiceIdFromRow(row);
      if(invoiceId&&Array.isArray(state?.invoices)){
        const invoice=state.invoices.find(i=>i.id===invoiceId);
        if(!invoice)return;
        const current=invoice.status==='Paga'?'Paga':'Não paga';
        const select=buildSelect(
          'Status da fatura',
          ['Paga','Não paga'],
          current,
          value=>{
            const target=state.invoices.find(i=>i.id===invoiceId);
            if(!target)return;
            if(value==='Paga'){
              if(target.status!=='Paga')target.lastNonPaidStatus=target.status||'Fechada';
              target.status='Paga';
            }else{
              target.status=(target.lastNonPaidStatus&&target.lastNonPaidStatus!=='Paga')?target.lastNonPaidStatus:'Fechada';
            }
            if(typeof renderAll==='function')renderAll();
            else if(typeof save==='function')save();
          }
        );
        cell.innerHTML='';
        cell.appendChild(select);
        row.dataset.statusInteractive='1';
      }
    });
  }

  const originalRenderHistory=window.renderHistory;
  if(typeof originalRenderHistory==='function'){
    window.renderHistory=function(){
      const result=originalRenderHistory.apply(this,arguments);
      enhanceHistoryStatuses();
      return result;
    };
  }

  function init(){
    const body=document.getElementById('historyBody');
    if(!body)return;
    enhanceHistoryStatuses();
    const observer=new MutationObserver(()=>enhanceHistoryStatuses());
    observer.observe(body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

(function(){
  if(!document.querySelector('script[src="debts.js"]')){
    const debtScript=document.createElement('script');
    debtScript.src='debts.js';
    document.body.appendChild(debtScript);
  }
  if(!document.querySelector('script[src="projection-controls.js"]')){
    const projectionScript=document.createElement('script');
    projectionScript.src='projection-controls.js';
    document.body.appendChild(projectionScript);
  }
})();
