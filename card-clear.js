(function(){
  if(window.__cardClearLoaded)return;
  window.__cardClearLoaded=true;

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function currentCard(){
    const id=document.getElementById('cardId')?.value||'';
    return id?(state?.cards||[]).find(card=>card.id===id)||null:null;
  }

  function countsFor(cardId){
    return{
      purchases:(state?.purchases||[]).filter(p=>p.cardId===cardId).length,
      invoices:(state?.invoices||[]).filter(i=>i.cardId===cardId).length
    };
  }

  function syncZone(){
    const zone=document.getElementById('cardClearZone');
    if(!zone)return;
    const card=currentCard();
    zone.style.display=card?'block':'none';
    const name=zone.querySelector('[data-card-clear-name]');
    if(name)name.textContent=card?.name||'';
  }

  function closeConfirm(){
    document.getElementById('cardClearConfirmModal')?.remove();
  }

  function openConfirm(){
    const card=currentCard();
    if(!card)return;
    closeConfirm();

    const counts=countsFor(card.id);
    const modal=document.createElement('div');
    modal.className='modal-backdrop open';
    modal.id='cardClearConfirmModal';
    modal.style.zIndex='1500';
    modal.innerHTML=`<div class="modal" style="max-width:590px">
      <div class="modal-head">
        <div>
          <h3>Limpar todo o cartão</h3>
          <div class="muted">${esc(card.name)}</div>
        </div>
        <button type="button" class="btn ghost ccc-cancel">✕</button>
      </div>
      <div class="modal-body">
        <div class="warning">
          Esta ação limpa o histórico financeiro do cartão, mas <strong>não exclui o cartão</strong>.
        </div>
        <div class="card" style="margin-top:14px;padding:15px">
          <div style="display:grid;gap:8px">
            <div><strong>${counts.purchases}</strong> compra(s) serão excluídas.</div>
            <div><strong>${counts.invoices}</strong> fatura(s) serão excluídas.</div>
            <div class="muted">Também serão removidos dados auxiliares de importação, exclusões de parcelas e conciliações vinculadas às compras deste cartão.</div>
          </div>
        </div>
        <div class="notice" style="margin-top:14px">
          Serão mantidos: nome do cartão, emissor/conta, limite, estimativa mensal, fechamento, vencimento e status ativo.
        </div>
        <div class="field" style="margin-top:18px">
          <label>Para confirmar, digite <strong>LIMPAR</strong></label>
          <input id="cardClearConfirmText" autocomplete="off" spellcheck="false" placeholder="LIMPAR">
        </div>
        <div id="cardClearResult" class="muted" style="min-height:18px;margin-top:10px"></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ccc-cancel">Cancelar</button>
        <button type="button" class="btn danger" id="cardClearConfirmBtn" disabled>Limpar todo o cartão</button>
      </div>
    </div>`;

    document.body.appendChild(modal);
    const input=modal.querySelector('#cardClearConfirmText');
    const confirmBtn=modal.querySelector('#cardClearConfirmBtn');
    const result=modal.querySelector('#cardClearResult');

    const sync=()=>{confirmBtn.disabled=String(input.value||'').trim()!=='LIMPAR'};
    input.addEventListener('input',sync);
    modal.querySelectorAll('.ccc-cancel').forEach(btn=>btn.onclick=closeConfirm);
    modal.addEventListener('click',event=>{if(event.target===modal)closeConfirm()});

    confirmBtn.onclick=async()=>{
      if(String(input.value||'').trim()!=='LIMPAR')return;
      confirmBtn.disabled=true;
      input.disabled=true;
      result.textContent='Limpando cartão…';
      try{
        let spins=0;
        while(window.financeCloud?.hasPendingLocalWrite&&spins<160){
          await new Promise(resolve=>setTimeout(resolve,25));
          spins++;
        }
        if(window.financeCloud?.hasPendingLocalWrite)throw new Error('Há alterações financeiras ainda sendo sincronizadas. Tente novamente em instantes.');

        if(typeof setSyncStatus==='function')setSyncStatus('Limpando cartão…');
        const {data,error}=await sb.rpc('finance_clear_card',{
          p_card_id:card.id,
          p_expected_updated_at:window.financeCloud?.version||null
        });
        if(error)throw error;
        if(!data?.ok){
          const err=new Error(data?.error||'Falha ao limpar o cartão.');
          err.code=data?.error;
          throw err;
        }

        if(window.financeCloud?.refresh)await window.financeCloud.refresh();
        else{
          state.purchases=(state.purchases||[]).filter(p=>p.cardId!==card.id);
          state.invoices=(state.invoices||[]).filter(i=>i.cardId!==card.id);
          if(typeof renderAll==='function')renderAll();
        }

        const stillPurchases=(state?.purchases||[]).filter(p=>p.cardId===card.id).length;
        const stillInvoices=(state?.invoices||[]).filter(i=>i.cardId===card.id).length;
        if(stillPurchases||stillInvoices)throw new Error('A limpeza foi salva, mas a tela ainda contém dados antigos. Recarregue a página.');

        if(typeof closeModal==='function')closeModal('cardModal');
        closeConfirm();
        if(typeof setSyncStatus==='function')setSyncStatus('Sincronizado com banco relacional');
        alert(`Cartão "${card.name}" limpo com sucesso. ${Number(data.purchasesDeleted)||0} compra(s) e ${Number(data.invoicesDeleted)||0} fatura(s) removidas. O cadastro do cartão foi mantido.`);
      }catch(error){
        console.error('Falha ao limpar cartão:',error);
        if(error?.code==='conflict'){
          try{await window.financeCloud?.refresh?.()}catch(_e){}
          result.textContent='Os dados foram alterados em outra sessão. A tela foi atualizada; confira e tente novamente.';
          if(typeof setSyncStatus==='function')setSyncStatus('Dados alterados em outra sessão — tente novamente',true);
        }else{
          result.textContent=error?.message||'Não foi possível limpar o cartão.';
          if(typeof setSyncStatus==='function')setSyncStatus('Falha ao limpar cartão',true);
        }
        input.disabled=false;
        sync();
      }
    };

    setTimeout(()=>input.focus(),0);
  }

  function install(){
    const modal=document.getElementById('cardModal');
    const form=document.getElementById('cardForm');
    const body=form?.querySelector('.modal-body');
    if(!modal||!form||!body)return false;

    if(!document.getElementById('cardClearZone')){
      const zone=document.createElement('div');
      zone.id='cardClearZone';
      zone.style.cssText='display:none;margin-top:18px;padding-top:18px;border-top:1px solid #213149';
      zone.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div style="min-width:220px;flex:1">
          <div style="font-size:12px;font-weight:800;color:#f2a29c">Zona de risco</div>
          <div style="font-size:12px;margin-top:4px;color:#9baabd">
            Apague todas as compras e faturas de <strong data-card-clear-name style="color:#dbe5f1"></strong>, mantendo o cartão cadastrado.
          </div>
        </div>
        <button type="button" class="btn danger" id="clearEntireCardBtn">Limpar todo o cartão</button>
      </div>`;
      body.appendChild(zone);
      zone.querySelector('#clearEntireCardBtn').onclick=openConfirm;
    }

    if(modal.dataset.cardClearObserved!=='1'){
      modal.dataset.cardClearObserved='1';
      new MutationObserver(syncZone).observe(modal,{attributes:true,attributeFilter:['class']});
    }
    syncZone();
    return true;
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      if(!install()){
        let tries=0;
        const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
      }
    },{once:true});
  }else if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
  }

  window.openCardClearConfirmation=openConfirm;
})();