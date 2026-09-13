(function(){
  const COLORS={
    pago:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    recebido:{bg:'#16351f',border:'#2f7d46',text:'#bbf7d0'},
    pendente:{bg:'#3a2d12',border:'#8a6a1f',text:'#fde68a'}
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

  function enhanceHistoryStatuses(){
    const body=document.getElementById('historyBody');
    if(!body||typeof state==='undefined'||!Array.isArray(state?.transactions))return;

    body.querySelectorAll('tr').forEach(row=>{
      if(row.dataset.statusInteractive==='1')return;
      const txId=transactionIdFromRow(row);
      if(!txId)return;
      const tx=state.transactions.find(t=>t.id===txId);
      if(!tx)return;
      const cells=row.querySelectorAll('td');
      const cell=cells[5];
      if(!cell)return;

      const select=document.createElement('select');
      select.className='history-status-select';
      select.setAttribute('aria-label',`Status de ${tx.description||'lançamento'}`);
      txOptions(tx.type,tx.status).forEach(status=>{
        const option=document.createElement('option');
        option.value=status;
        option.textContent=status;
        option.selected=status===tx.status;
        select.appendChild(option);
      });
      styleSelect(select);

      select.addEventListener('change',()=>{
        const target=state.transactions.find(t=>t.id===txId);
        if(!target)return;
        target.status=select.value;
        styleSelect(select);
        if(typeof renderAll==='function')renderAll();
        else if(typeof save==='function')save();
      });

      cell.innerHTML='';
      cell.appendChild(select);
      row.dataset.statusInteractive='1';
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
