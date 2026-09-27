(function(){
  // A edição versionada de receitas agora está integrada diretamente em incomes.js.
  // Este arquivo permanece por compatibilidade e inicializa integrações auxiliares da interface.

  if(!document.querySelector('script[data-chatgpt-finance-loader]')){
    const script=document.createElement('script');
    script.src='invoice-ai-client.js';
    script.async=false;
    script.dataset.chatgptFinanceLoader='1';
    document.head.appendChild(script);
  }

  function installInvoiceClear(){
    const form=document.getElementById('invoiceForm');
    if(!form)return false;
    const foot=form.querySelector('.modal-foot');
    if(!foot)return false;

    let btn=document.getElementById('clearInvoicePurchases');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id='clearInvoicePurchases';
      btn.className='btn danger';
      btn.textContent='Limpar fatura';
      foot.insertBefore(btn,foot.firstChild);
    }

    btn.onclick=async()=>{
      const cardId=document.getElementById('invoiceCardId')?.value;
      const ym=document.getElementById('invoiceYm')?.value;
      if(!cardId||!ym){
        alert('Não foi possível identificar a fatura selecionada.');
        return;
      }

      const allocator=typeof purchaseAllocation==='function'?purchaseAllocation:null;
      if(!allocator){
        alert('Não foi possível calcular os itens desta fatura.');
        return;
      }

      const affected=(state.purchases||[]).filter(p=>p.cardId===cardId&&allocator(p,ym));
      const inv=typeof getInvoice==='function'?getInvoice(cardId,ym):null;
      const hasAdjustment=!!(inv&&Number(inv.adjustment));

      if(!affected.length&&!hasAdjustment){
        alert('Esta fatura já está vazia.');
        return;
      }

      const affectsFuture=affected.some(p=>p.mode==='recorrente'||p.openEnded===true||Number(p.installments)>1);
      let msg=`Limpar a fatura ${ym}?`;
      if(affected.length)msg+=`\n\nSerão removidas ${affected.length} compra(s) que aparecem nesta fatura.`;
      if(hasAdjustment)msg+=`\nO ajuste manual de R$ ${Number(inv.adjustment).toFixed(2).replace('.',',')} será zerado.`;
      if(affectsFuture)msg+='\n\nAtenção: compras parceladas ou recorrentes removidas também deixarão de aparecer nas faturas futuras.';
      if(!confirm(msg))return;

      const previousPurchases=state.purchases;
      const previousAdjustment=inv?.adjustment;

      try{
        if(affected.length){
          const ids=new Set(affected.map(p=>p.id));
          state.purchases=state.purchases.filter(p=>!ids.has(p.id));
        }
        if(inv)inv.adjustment=0;

        if(window.financeCloud&&typeof currentUser!=='undefined'&&currentUser?.id){
          setSyncStatus('Salvando…');
          await window.financeCloud.save(currentUser.id,state);
          setSyncStatus('Sincronizado com servidor');
        }else if(typeof save==='function'){
          save();
        }

        if(typeof closeModal==='function')closeModal('invoiceModal');
        if(typeof renderAll==='function')renderAll();
        alert('Fatura limpa com sucesso.');
      }catch(error){
        state.purchases=previousPurchases;
        if(inv)inv.adjustment=previousAdjustment;
        console.error('Falha ao limpar fatura:',error);
        setSyncStatus('Falha ao salvar no servidor',true);
        alert('Não foi possível limpar a fatura. Nenhuma alteração foi salva.');
      }
    };

    return true;
  }

  if(!installInvoiceClear()){
    const timer=setInterval(()=>{if(installInvoiceClear())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),20000);
  }
})();
