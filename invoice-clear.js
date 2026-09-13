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
      const cardId=document.getElementById('invoiceCardId').value;
      const ym=document.getElementById('invoiceYm').value;
      if(!cardId||!ym)return;
      const affected=state.purchases.filter(p=>p.cardId===cardId&&purchaseAllocation(p,ym));
      if(!affected.length){alert('Esta fatura não possui compras para limpar.');return;}
      const recurring=affected.some(p=>p.mode==='recorrente');
      const msg=`Remover todas as ${affected.length} compra(s) que aparecem nesta fatura?`+(recurring?'\n\nAtenção: cobranças recorrentes selecionadas também serão removidas das demais faturas.':'\n\nParcelamentos selecionados também serão removidos das demais parcelas/faturas.');
      if(!confirm(msg))return;
      const ids=new Set(affected.map(p=>p.id));
      state.purchases=state.purchases.filter(p=>!ids.has(p.id));
      closeModal('invoiceModal');
      renderAll();
    };
    return true;
  }
  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer);},250);
  }
})();