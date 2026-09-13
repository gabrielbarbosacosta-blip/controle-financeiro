(function(){
  function install(){
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
      const hiddenCardId=document.getElementById('invoiceCardId')?.value||'';
      const hiddenYm=document.getElementById('invoiceYm')?.value||'';
      const cardId=hiddenCardId||((typeof selectedCardId!=='undefined'&&selectedCardId)?selectedCardId:'');
      const ym=hiddenYm||((typeof selectedInvoiceYm!=='undefined'&&selectedInvoiceYm)?selectedInvoiceYm:(state?.settings?.selectedMonth||''));
      if(!cardId||!ym){alert('Não foi possível identificar a fatura selecionada.');return;}

      const allocator=typeof purchaseAllocation==='function'?purchaseAllocation:null;
      const belongs=p=>{
        if(!p||p.cardId!==cardId)return false;
        if(p.firstInvoiceYm===ym)return true;
        if(p.chatgptImport?.invoiceYm===ym)return true;
        if(allocator){try{return !!allocator(p,ym)}catch(e){}}
        return false;
      };

      const before=Array.isArray(state.purchases)?state.purchases:[];
      const affected=before.filter(belongs);
      const inv=typeof getInvoice==='function'?getInvoice(cardId,ym):null;
      const hasAdjustment=!!(inv&&Number(inv.adjustment));
      if(!affected.length&&!hasAdjustment){alert('Esta fatura já está vazia.');return;}

      const card=typeof getCard==='function'?getCard(cardId):null;
      let msg=`Limpar a fatura ${card?.name||''} ${ym}?`;
      if(affected.length)msg+=`\n\nSerão removidas ${affected.length} compra(s) vinculada(s) a esta fatura.`;
      if(hasAdjustment)msg+=`\nO ajuste manual de R$ ${Number(inv.adjustment).toFixed(2).replace('.',',')} será zerado.`;
      if(affected.some(p=>p.mode==='recorrente'||p.openEnded===true||Number(p.installments)>1))msg+='\n\nAtenção: compras parceladas ou recorrentes removidas também deixarão de aparecer nas faturas futuras.';
      if(!confirm(msg))return;

      const previousPurchases=state.purchases;
      const previousAdjustment=inv?.adjustment;
      try{
        const ids=new Set(affected.map(p=>p.id));
        state.purchases=before.filter(p=>!ids.has(p.id));
        if(inv)inv.adjustment=0;
        const removed=before.length-state.purchases.length;
        if(affected.length&&removed!==affected.length)throw new Error(`Foram identificadas ${affected.length} compras, mas somente ${removed} foram removidas.`);

        if(window.financeCloud&&typeof currentUser!=='undefined'&&currentUser?.id){
          if(typeof setSyncStatus==='function')setSyncStatus('Salvando…');
          await window.financeCloud.save(currentUser.id,state);
          if(typeof window.financeCloud.load==='function'){
            const check=await window.financeCloud.load(currentUser.id);
            if(check?.state&&Array.isArray(check.state.purchases)){
              const remaining=check.state.purchases.filter(belongs).length;
              if(remaining)throw new Error(`${remaining} compra(s) ainda permaneceram na fatura após salvar.`);
            }
          }
          if(typeof setSyncStatus==='function')setSyncStatus('Sincronizado com servidor');
        }else if(typeof save==='function')save();

        if(typeof closeModal==='function')closeModal('invoiceModal');
        if(typeof renderAll==='function')renderAll();
        alert(`Fatura limpa com sucesso. ${removed} compra(s) removida(s).`);
      }catch(error){
        state.purchases=previousPurchases;
        if(inv)inv.adjustment=previousAdjustment;
        console.error('Falha ao limpar fatura:',error);
        if(typeof setSyncStatus==='function')setSyncStatus('Falha ao salvar no servidor',true);
        alert(`Não foi possível limpar a fatura. ${error?.message||'Nenhuma alteração foi salva.'}`);
      }
    };
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer);},250);
  }
})();