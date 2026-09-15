(function(){
  if(window.__sharedExpenseDeletionLoaded)return;
  window.__sharedExpenseDeletionLoaded=true;

  let items=[];
  let loading=false;
  let busy=new Set();

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]||c))}
  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getCurrentUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}

  function injectStyles(){
    if(document.getElementById('shared-expense-deletion-style'))return;
    const s=document.createElement('style');
    s.id='shared-expense-deletion-style';
    s.textContent=`
      .shared-delete-state{margin-top:10px;padding:10px 11px;border:1px solid #7c5c19;border-radius:11px;background:#2c210c;color:#fde68a;font-size:11px;line-height:1.45}
      .shared-delete-state strong{color:#fff7cf}
      .shared-delete-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
      .shared-delete-badge{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;border:1px solid #7c5c19;background:#2c210c;color:#fde68a;font-size:10px;font-weight:700;margin-top:7px}
      .shared-delete-btn{margin-left:auto}
      .shared-delete-btn[disabled],[data-shared-delete-accept][disabled],[data-shared-delete-reject][disabled]{opacity:.55;cursor:wait}
    `;
    document.head.appendChild(s);
  }

  async function refreshData(){
    const client=getSb(),userId=getCurrentUserId();
    if(loading||!client||!userId)return;
    loading=true;
    try{
      const {data,error}=await client.rpc('finance_list_shared_expenses');
      if(error)throw error;
      items=data?.items||[];
      decorateAll();
    }catch(e){console.warn('Falha ao carregar estado de exclusão compartilhada.',e)}
    finally{loading=false}
  }

  async function syncEverywhere(){
    try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){console.warn('Falha ao atualizar estado financeiro após exclusão compartilhada.',e)}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    await refreshData();
    try{await window.financeNotificationsRefresh?.()}catch(e){}
    try{await window.financeSharedDeleteNotificationsRefresh?.()}catch(e){}
    try{window.financeSharedIncomeRefresh?.()}catch(e){}
  }

  function itemById(id){return items.find(x=>String(x.id)===String(id))||null}

  function ensureActionHost(card){
    let host=card.querySelector('.shared-item-actions');
    if(!host){host=document.createElement('div');host.className='shared-item-actions';card.appendChild(host)}
    return host;
  }

  function setCardBusy(id,isBusy,label='Processando…'){
    document.querySelectorAll(`.shared-item[data-shared-id="${CSS.escape(String(id))}"]`).forEach(card=>{
      card.querySelectorAll('[data-shared-delete-request],[data-shared-delete-accept],[data-shared-delete-reject]').forEach(btn=>{
        if(isBusy){if(!btn.dataset.originalText)btn.dataset.originalText=btn.textContent;btn.disabled=true;btn.textContent=label}
        else{btn.disabled=false;if(btn.dataset.originalText){btn.textContent=btn.dataset.originalText;delete btn.dataset.originalText}}
      });
    });
  }

  function decorateCard(card){
    const id=card?.dataset?.sharedId;if(!id)return;
    const item=itemById(id);if(!item)return;
    card.querySelectorAll('.shared-delete-state,.shared-delete-badge,.shared-delete-btn').forEach(el=>el.remove());

    const deletionPending=item.deletionStatus==='pending';
    if(deletionPending){
      const pending=Number(item.pendingDeleteCount)||0;
      const badge=document.createElement('div');badge.className='shared-delete-badge';
      badge.textContent=pending>0?`Cancelamento aguardando ${pending} confirmação${pending===1?'':'ões'}`:'Cancelamento em processamento';
      card.appendChild(badge);
    }

    if(item.myDeleteStatus==='pending'){
      const requester=item.deletionRequesterName||'Outro participante';
      const box=document.createElement('div');box.className='shared-delete-state';
      box.innerHTML=`<strong>Solicitação de cancelamento</strong><br>${esc(requester)} quer cancelar esta despesa compartilhada. Se você confirmar, seus lançamentos vinculados serão removidos quando todos os participantes necessários aceitarem.<div class="shared-delete-actions"><button type="button" class="btn small danger" data-shared-delete-accept="${esc(id)}">Aprovar cancelamento</button><button type="button" class="btn small" data-shared-delete-reject="${esc(id)}">Recusar</button></div>`;
      card.appendChild(box);
    }

    const canRequestDelete=item.myStatus==='accepted'&&item.deletionStatus!=='pending';
    if(canRequestDelete){
      const host=ensureActionHost(card);
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn small danger shared-delete-btn';btn.dataset.sharedDeleteRequest=id;btn.textContent='Excluir despesa compartilhada';
      host.appendChild(btn);
    }

    bindCard(card);
  }

  function bindCard(card){
    card.querySelectorAll('[data-shared-delete-request]').forEach(btn=>btn.onclick=()=>requestDelete(btn.dataset.sharedDeleteRequest));
    card.querySelectorAll('[data-shared-delete-accept]').forEach(btn=>btn.onclick=()=>respondDelete(btn.dataset.sharedDeleteAccept,true));
    card.querySelectorAll('[data-shared-delete-reject]').forEach(btn=>btn.onclick=()=>respondDelete(btn.dataset.sharedDeleteReject,false));
  }

  function decorateAll(){document.querySelectorAll('.shared-item[data-shared-id]').forEach(decorateCard)}

  function confirmDeleteTwice(item,acceptedOthers){
    const description=item?.description||'esta despesa';
    const firstMessage=acceptedOthers
      ?`Cancelar “${description}”? Como ${acceptedOthers} outro${acceptedOthers===1?' participante já aceitou':'s participantes já aceitaram'}, o cancelamento ficará aguardando aprovação antes de remover os lançamentos.`
      :`Cancelar “${description}”? Como ninguém além de você confirmou, a despesa poderá ser removida imediatamente após a segunda confirmação.`;
    if(!confirm(firstMessage))return false;
    const secondMessage=acceptedOthers
      ?`SEGUNDA CONFIRMAÇÃO\n\nConfirma definitivamente o pedido de cancelamento de “${description}”? Os demais participantes receberão uma notificação para aprovar ou recusar.`
      :`SEGUNDA CONFIRMAÇÃO\n\nConfirma definitivamente o cancelamento de “${description}”? Esta ação removerá a despesa compartilhada e todos os lançamentos vinculados e não poderá ser desfeita.`;
    return confirm(secondMessage);
  }

  async function requestDelete(id){
    if(busy.has(id))return;
    const item=itemById(id),userId=getCurrentUserId(),client=getSb();
    if(!item||!userId||!client)return;
    const acceptedOthers=(item.participants||[]).filter(p=>p.userId!==userId&&p.status==='accepted').length;
    if(!confirmDeleteTwice(item,acceptedOthers))return;
    busy.add(id);setCardBusy(id,true,'Solicitando…');
    try{
      const {data,error}=await client.rpc('finance_request_delete_shared_expense',{p_shared_id:id});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_request_failed');
      try{if(typeof setSyncStatus==='function')setSyncStatus(data.status==='deleted'?'Despesa compartilhada excluída':'Cancelamento aguardando confirmação')}catch(e){}
      if(data.status==='deleted')document.querySelectorAll(`.shared-item[data-shared-id="${CSS.escape(String(id))}"]`).forEach(el=>el.remove());
      await syncEverywhere();
    }catch(e){console.error('Falha ao solicitar cancelamento.',e);alert('Não foi possível solicitar o cancelamento desta despesa.');setCardBusy(id,false)}
    finally{busy.delete(id)}
  }

  async function respondDelete(id,accept){
    if(busy.has(id))return;
    const client=getSb();if(!client)return;
    const verb=accept?'aprovar o cancelamento':'recusar o cancelamento';
    if(!confirm(accept?'Aprovar o cancelamento desta despesa? Seus lançamentos vinculados serão removidos quando todos confirmarem.':'Recusar o cancelamento e manter esta despesa compartilhada?'))return;
    busy.add(id);setCardBusy(id,true,accept?'Aprovando…':'Recusando…');
    try{
      const {data,error}=await client.rpc('finance_respond_delete_shared_expense',{p_shared_id:id,p_accept:accept});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_response_failed');
      try{if(typeof setSyncStatus==='function')setSyncStatus(data.status==='deleted'?'Despesa compartilhada excluída':data.status==='cancelled'?'Cancelamento recusado':'Confirmação registrada')}catch(e){}
      if(data.status==='deleted')document.querySelectorAll(`.shared-item[data-shared-id="${CSS.escape(String(id))}"]`).forEach(el=>el.remove());
      await syncEverywhere();
    }catch(e){console.error(`Falha ao ${verb}.`,e);alert(`Não foi possível ${verb}.`);setCardBusy(id,false)}
    finally{busy.delete(id)}
  }

  function boot(){
    injectStyles();
    const observer=new MutationObserver(()=>decorateAll());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    let tries=0;
    const timer=setInterval(()=>{tries++;if(getSb()&&getCurrentUserId()){clearInterval(timer);refreshData()}else if(tries>600)clearInterval(timer)},100);
    window.addEventListener('focus',refreshData);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData()});
    setInterval(refreshData,60000);
    window.financeSharedDeletionRefresh=refreshData;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
