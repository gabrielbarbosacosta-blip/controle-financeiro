(function(){
  if(window.__sharedStatusLinkLoaded)return;
  window.__sharedStatusLinkLoaded=true;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getState(){try{return state}catch(e){return window.state||null}}
  function transactionIdFromRow(row){
    const edit=row?.querySelector?.('button[onclick*="editTx("]');if(!edit)return null;
    const code=edit.getAttribute('onclick')||'';
    const match=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1]||null;
  }
  function isSharedManagedTx(tx){
    if(!tx)return false;
    if(String(tx.id||'').startsWith('shared-'))return true;
    if(tx.debtManaged===true&&String(tx.debtId||'').startsWith('shared-debt-'))return true;
    return false;
  }
  async function refreshAll(){
    try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){console.warn('Falha ao atualizar estado compartilhado.',e)}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    try{window.financeSharedIncomeRefresh?.()}catch(e){}
    try{window.financeSharedPaymentConfirmationsRefresh?.()}catch(e){}
    try{window.financeSharedBalancesDetailRefresh?.()}catch(e){}
    try{window.financeNotificationsRefresh?.()}catch(e){}
  }

  document.addEventListener('change',async e=>{
    const select=e.target?.closest?.('.history-status-select');if(!select)return;
    const row=select.closest('tr'),txId=transactionIdFromRow(row);if(!txId)return;

    const client=getSb(),st=getState();if(!client||!Array.isArray(st?.transactions))return;
    const tx=st.transactions.find(t=>String(t.id)===String(txId));
    if(!isSharedManagedTx(tx))return;

    e.preventDefault();e.stopImmediatePropagation();
    const previous=tx?.status||'';const next=select.value;
    select.disabled=true;
    try{
      const {data,error}=await client.rpc('finance_set_shared_transaction_status',{p_transaction_id:txId,p_status:next});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'shared_status_failed');
      if(data.handled===false){
        if(tx)tx.status=next;
        if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
        return;
      }
      if(data.action==='payment_confirmation_requested'){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Pagamento aguardando confirmação do pagador')}catch(e){}
      }else if(data.action==='received_confirmed'){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Recebimento confirmado')}catch(e){}
      }
      await refreshAll();
    }catch(err){
      console.error('Falha ao atualizar status de lançamento compartilhado.',err);
      select.value=previous;
      alert('Não foi possível atualizar este status agora.');
    }finally{select.disabled=false}
  },true);
})();