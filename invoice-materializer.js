(function(){
  function materializeProjectedInvoices(){
    if(typeof state==='undefined'||!Array.isArray(state.cards)||!Array.isArray(state.invoices)||typeof invoiceKnownTotal!=='function'||typeof ensureInvoice!=='function'||typeof ymAdd!=='function')return false;
    const base=state.settings?.selectedMonth;
    if(!base)return false;
    let changed=false;
    for(let i=0;i<24;i++){
      const ym=ymAdd(base,i);
      for(const card of state.cards){
        if(card.active===false)continue;
        if(getInvoice(card.id,ym))continue;
        const known=Number(invoiceKnownTotal(card.id,ym))||0;
        if(known<=0)continue;
        const inv=ensureInvoice(card.id,ym);
        inv.status='Aberta';
        inv.adjustment=Number(inv.adjustment)||0;
        inv.notes=inv.notes||'Fatura prevista gerada automaticamente a partir das compras e parcelas do cartão.';
        changed=true;
      }
    }
    return changed;
  }

  function refresh(){
    const changed=materializeProjectedInvoices();
    if(changed&&typeof save==='function')save();
    if(typeof renderHistory==='function')renderHistory();
    if(typeof renderDashboard==='function')renderDashboard();
  }

  const month=document.getElementById('monthSelect');
  if(month)month.addEventListener('change',()=>setTimeout(refresh,0));

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);
  else refresh();
})();