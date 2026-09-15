(function(){
  if(window.__sharedDeleteLinkGuardLoaded)return;
  window.__sharedDeleteLinkGuardLoaded=true;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function txIdFromRow(row){
    const edit=row?.querySelector?.('button[onclick*="editTx("]');
    if(!edit)return null;
    const code=edit.getAttribute('onclick')||'';
    const match=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1]||null;
  }

  async function refreshEverything(){
    try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){console.warn('Falha ao atualizar estado após pedido de cancelamento.',e)}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    try{window.financeNotificationsRefresh?.()}catch(e){}
    try{window.financeSharedIncomeRefresh?.()}catch(e){}
    try{window.dispatchEvent(new Event('focus'))}catch(e){}
  }

  async function requestCancellation(txId,label){
    const client=getSb();if(!client)return;
    const first=`Este lançamento pertence à despesa compartilhada “${label}”. Ele não pode ser excluído isoladamente. Deseja solicitar o cancelamento da despesa compartilhada inteira?`;
    if(!confirm(first))return;
    if(!confirm('SEGUNDA CONFIRMAÇÃO\n\nO cancelamento afetará a despesa do pagador, as receitas de reembolso e as despesas dos coobrigados. Deseja continuar?'))return;

    try{
      const {data,error}=await client.rpc('finance_request_delete_shared_expense_by_transaction',{p_transaction_id:txId});
      if(error)throw error;
      if(!data?.ok){
        if(data?.error==='already_pending'){alert('Já existe um pedido de cancelamento aguardando confirmação dos participantes.');return}
        throw new Error(data?.error||'cancel_request_failed');
      }
      if(data.status==='deleted')alert('A despesa compartilhada e todos os lançamentos vinculados foram excluídos.');
      else alert('Pedido de cancelamento enviado. Os demais participantes precisam aprovar antes da exclusão.');
      await refreshEverything();
    }catch(e){console.error('Falha ao solicitar cancelamento pelo lançamento vinculado.',e);alert('Não foi possível solicitar o cancelamento desta despesa compartilhada.')}
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('.history-delete-btn');if(!btn)return;
    const row=btn.closest('tr'),txId=txIdFromRow(row);if(!txId||!String(txId).startsWith('shared-'))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    let label='despesa compartilhada';
    try{const tx=state?.transactions?.find?.(t=>String(t.id)===String(txId));if(tx?.description)label=tx.description}catch(err){}
    requestCancellation(txId,label);
  },true);
})();