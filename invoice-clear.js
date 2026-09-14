(function(){
  function isExcluded(p,ym){
    return Array.isArray(p?.excludedInvoiceMonths)&&p.excludedInvoiceMonths.includes(ym);
  }

  function isSeries(p){
    const importedTotal=Number(p?.chatgptImport?.installmentTotal);
    return p?.mode==='recorrente'||p?.openEnded===true||Number(p?.installments)>1||(Number.isInteger(importedTotal)&&importedTotal>1);
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function askClearOptions({cardName,ym,uniqueCount,seriesCount,hasAdjustment}){
    return new Promise(resolve=>{
      document.getElementById('clearInvoiceOptionsModal')?.remove();
      const modal=document.createElement('div');
      modal.className='modal-backdrop open';
      modal.id='clearInvoiceOptionsModal';
      modal.innerHTML=`<div class="modal" style="max-width:560px">
        <div class="modal-head"><div><h3>Limpar fatura</h3><div class="muted">${esc(cardName||'Cartão')} • ${esc(ym)}</div></div><button type="button" class="btn ghost cio-cancel">✕</button></div>
        <div class="modal-body">
          <div class="notice">Serão removidos os itens desta competência. Compras parceladas e recorrentes podem continuar normalmente nas próximas faturas.</div>
          <div style="margin-top:16px;display:grid;gap:8px">
            <div><strong>${uniqueCount}</strong> compra(s) única(s) serão excluídas.</div>
            <div><strong>${seriesCount}</strong> compra(s) parcelada(s)/recorrente(s) têm ocorrência nesta fatura.</div>
            ${hasAdjustment?'<div>O ajuste e os dados de conciliação desta fatura serão zerados.</div>':''}
          </div>
          <label class="toggle" style="margin-top:18px;align-items:flex-start;gap:10px">
            <input type="checkbox" id="clearInvoiceDeleteSeries" ${seriesCount?'':'disabled'}>
            <span><strong>Excluir também compras parceladas e recorrentes</strong><br><small class="muted">Se marcado, a compra inteira será apagada e deixará de aparecer também nas faturas futuras. Desmarcado, somente esta competência é removida.</small></span>
          </label>
        </div>
        <div class="modal-foot"><button type="button" class="btn cio-cancel">Cancelar</button><button type="button" class="btn danger" id="clearInvoiceConfirm">Limpar fatura</button></div>
      </div>`;
      document.body.appendChild(modal);
      let done=false;
      const finish=value=>{if(done)return;done=true;modal.remove();resolve(value)};
      modal.querySelectorAll('.cio-cancel').forEach(b=>b.onclick=()=>finish(null));
      modal.addEventListener('click',e=>{if(e.target===modal)finish(null)});
      modal.querySelector('#clearInvoiceConfirm').onclick=()=>finish({deleteSeries:!!modal.querySelector('#clearInvoiceDeleteSeries')?.checked});
    });
  }

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
        if(!p||p.cardId!==cardId||isExcluded(p,ym))return false;
        if(allocator){try{return !!allocator(p,ym)}catch(e){}}
        return p.firstInvoiceYm===ym||p.chatgptImport?.invoiceYm===ym;
      };

      const purchases=Array.isArray(state.purchases)?state.purchases:[];
      const affected=purchases.filter(belongs);
      const series=affected.filter(isSeries);
      const unique=affected.filter(p=>!isSeries(p));
      const inv=typeof getInvoice==='function'?getInvoice(cardId,ym):null;
      const hasAdjustment=!!(inv&&(Number(inv.adjustment)||Number(inv.statementTotal)||inv.reconciledAt));
      if(!affected.length&&!hasAdjustment){alert('Esta fatura já está vazia.');return;}

      const card=typeof getCard==='function'?getCard(cardId):null;
      const choice=await askClearOptions({cardName:card?.name||'',ym,uniqueCount:unique.length,seriesCount:series.length,hasAdjustment});
      if(!choice)return;

      const deleteIds=[...unique.map(p=>p.id),...(choice.deleteSeries?series.map(p=>p.id):[])];
      const excludeIds=choice.deleteSeries?[]:series.map(p=>p.id);
      let committed=false;
      try{
        if(typeof sb==='undefined'||!currentUser?.id)throw new Error('Sessão autenticada não disponível.');
        if(typeof setSyncStatus==='function')setSyncStatus('Limpando fatura…');
        const {data,error}=await sb.rpc('finance_clear_invoice',{
          p_card_id:cardId,
          p_invoice_month:`${ym}-01`,
          p_delete_purchase_ids:deleteIds,
          p_exclude_purchase_ids:excludeIds,
          p_expected_updated_at:window.financeCloud?.version||null
        });
        if(error)throw error;
        if(!data?.ok){
          const e=new Error(data?.error||'Falha ao limpar fatura.');
          e.code=data?.error;
          throw e;
        }
        committed=true;

        if(window.financeCloud?.refresh)await window.financeCloud.refresh();
        else throw new Error('Não foi possível recarregar o banco após a limpeza.');

        const visible=(state.purchases||[]).filter(belongs);
        if(visible.length)throw new Error(`${visible.length} compra(s) ainda permaneceram visíveis nesta fatura.`);
        if(excludeIds.length){
          const keep=new Set(excludeIds);
          const kept=(state.purchases||[]).filter(p=>keep.has(p.id)&&isExcluded(p,ym)).length;
          if(kept!==excludeIds.length)throw new Error('Nem todas as compras parceladas/recorrentes foram preservadas corretamente.');
        }

        if(typeof closeModal==='function')closeModal('invoiceModal');
        if(typeof setSyncStatus==='function')setSyncStatus('Sincronizado com banco relacional');
        const keptText=excludeIds.length?` ${excludeIds.length} compra(s) parcelada(s)/recorrente(s) foram mantidas para as próximas faturas.`:'';
        alert(`Fatura limpa com sucesso. ${Number(data.deleted)||0} compra(s) excluída(s).${keptText}`);
      }catch(error){
        console.error('Falha ao limpar fatura:',error);
        if(committed){
          if(typeof setSyncStatus==='function')setSyncStatus('Fatura salva; recarregue a página',true);
          alert(`A limpeza foi salva no banco, mas a atualização da tela falhou. Recarregue a página. ${error?.message||''}`);
        }else{
          if(typeof setSyncStatus==='function')setSyncStatus(error?.code==='conflict'?'Dados alterados em outra sessão — atualize a página':'Falha ao salvar no servidor',true);
          alert(`Não foi possível limpar a fatura. ${error?.message||'Nenhuma alteração foi salva.'}`);
        }
      }
    };
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer);},250);
  }
})();
