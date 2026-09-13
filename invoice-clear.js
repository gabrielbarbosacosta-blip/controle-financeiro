(function(){
  function install(){
    const form=document.getElementById('invoiceForm');
    if(!form||document.getElementById('clearInvoicePurchases'))return false;
    const foot=form.querySelector('.modal-foot');
    if(!foot)return false;

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='clearInvoicePurchases';
    btn.className='btn danger';
    btn.textContent='Limpar todas as compras';
    foot.insertBefore(btn,foot.firstChild);

    btn.onclick=()=>{
      const cardId=document.getElementById('invoiceCardId')?.value;
      const ym=document.getElementById('invoiceYm')?.value;
      if(!cardId||!ym){
        alert('Não foi possível identificar a fatura selecionada.');
        return;
      }

      const affected=state.purchases.filter(p=>p.cardId===cardId&&purchaseAllocation(p,ym));
      const inv=typeof getInvoice==='function'?getInvoice(cardId,ym):null;
      const hasAdjustment=!!(inv&&Number(inv.adjustment));

      if(!affected.length&&!hasAdjustment){
        alert('Esta fatura já está vazia.');
        return;
      }

      const recurring=affected.some(p=>p.mode==='recorrente');
      let msg=`Limpar a fatura ${ym}?`;
      if(affected.length) msg+=`\n\nSerão removidas ${affected.length} compra(s) que aparecem nesta fatura.`;
      if(hasAdjustment) msg+=`\nO ajuste manual de R$ ${Number(inv.adjustment).toFixed(2).replace('.',',')} será zerado.`;
      if(recurring) msg+='\n\nAtenção: cobranças recorrentes removidas deixarão de aparecer também nas demais faturas.';
      else if(affected.length) msg+='\n\nAtenção: compras parceladas removidas deixarão de aparecer também nas demais parcelas/faturas.';
      if(!confirm(msg))return;

      if(affected.length){
        const ids=new Set(affected.map(p=>p.id));
        state.purchases=state.purchases.filter(p=>!ids.has(p.id));
      }
      if(inv) inv.adjustment=0;

      save();
      if(typeof closeModal==='function')closeModal('invoiceModal');
      renderAll();
    };
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>80)clearInterval(timer);
    },250);
  }
})();