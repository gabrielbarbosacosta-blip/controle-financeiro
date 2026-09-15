(function(){
  if(window.__sharedExpenseDeletionLoaded)return;
  window.__sharedExpenseDeletionLoaded=true;

  let items=[];
  let loading=false;
  let busy=new Set();

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]||c))}

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
    `;
    document.head.appendChild(s);
  }

  async function refreshData(){
    if(loading||!window.sb||!window.currentUser?.id)return;
    loading=true;
    try{
      const {data,error}=await sb.rpc('finance_list_shared_expenses');
      if(error)throw error;
      items=data?.items||[];
      decorateAll();
    }catch(e){console.warn('Falha ao carregar estado de exclusão compartilhada.',e)}
    finally{loading=false}
  }

  function itemById(id){return items.find(x=>String(x.id)===String(id))||null}

  function ensureActionHost(card){
    let host=card.querySelector('.shared-item-actions');
    if(!host){host=document.createElement('div');host.className='shared-item-actions';card.appendChild(host)}
    return host;
  }

  function decorateCard(card){
    const id=card?.dataset?.sharedId;if(!id)return;
    const item=itemById(id);if(!item)return;
    card.querySelectorAll('.shared-delete-state,.shared-delete-badge,.shared-delete-btn').forEach(el=>el.remove());

    const deletionPending=item.deletionStatus==='pending';
    if(deletionPending){
      const pending=Number(item.pendingDeleteCount)||0;
      const badge=document.createElement('div');badge.className='shared-delete-badge';
      badge.textContent=pending>0?`Exclusão aguardando ${pending} confirmação${pending===1?'':'ões'}`:'Exclusão em processamento';
      card.appendChild(badge);
    }

    if(item.myDeleteStatus==='pending'){
      const box=document.createElement('div');box.className='shared-delete-state';
      box.innerHTML=`<strong>Solicitação de exclusão</strong><br>O criador quer excluir esta despesa compartilhada. Se você confirmar, seus lançamentos vinculados serão removidos quando todos os participantes necessários aceitarem.<div class="shared-delete-actions"><button type="button" class="btn small danger" data-shared-delete-accept="${esc(id)}">Confirmar exclusão</button><button type="button" class="btn small" data-shared-delete-reject="${esc(id)}">Manter despesa</button></div>`;
      card.appendChild(box);
    }

    if(item.isCreator&&item.deletionStatus!=='pending'){
      const host=ensureActionHost(card);
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn small danger shared-delete-btn';btn.dataset.sharedDeleteRequest=id;btn.textContent='Excluir';
      host.appendChild(btn);
    }

    bindCard(card);
  }

  function bindCard(card){
    card.querySelectorAll('[data-shared-delete-request]').forEach(btn=>btn.onclick=()=>requestDelete(btn.dataset.sharedDeleteRequest));
    card.querySelectorAll('[data-shared-delete-accept]').forEach(btn=>btn.onclick=()=>respondDelete(btn.dataset.sharedDeleteAccept,true));
    card.querySelectorAll('[data-shared-delete-reject]').forEach(btn=>btn.onclick=()=>respondDelete(btn.dataset.sharedDeleteReject,false));
  }

  function decorateAll(){
    document.querySelectorAll('.shared-item[data-shared-id]').forEach(decorateCard);
  }

  function confirmDeleteTwice(item,acceptedOthers){
    const description=item?.description||'esta despesa';
    const firstMessage=acceptedOthers
      ?`Excluir “${description}”? Como ${acceptedOthers} participante${acceptedOthers===1?' já aceitou':'s já aceitaram'}, a exclusão ficará aguardando confirmação antes de remover os lançamentos.`
      :`Excluir “${description}”? Como ninguém além de você confirmou, a despesa poderá ser removida imediatamente após a segunda confirmação.`;
    if(!confirm(firstMessage))return false;

    const secondMessage=acceptedOthers
      ?`SEGUNDA CONFIRMAÇÃO\n\nConfirma definitivamente o pedido de exclusão de “${description}”? A solicitação será enviada aos demais participantes que precisam aprovar a remoção.`
      :`SEGUNDA CONFIRMAÇÃO\n\nConfirma definitivamente a exclusão de “${description}”? Esta ação removerá a despesa compartilhada e os lançamentos vinculados e não poderá ser desfeita.`;
    return confirm(secondMessage);
  }

  async function requestDelete(id){
    if(busy.has(id))return;
    const item=itemById(id);if(!item)return;
    const acceptedOthers=(item.participants||[]).filter(p=>p.userId!==currentUser.id&&p.status==='accepted').length;
    if(!confirmDeleteTwice(item,acceptedOthers))return;
    busy.add(id);
    try{
      const {data,error}=await sb.rpc('finance_request_delete_shared_expense',{p_shared_id:id});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_request_failed');
      try{if(typeof setSyncStatus==='function')setSyncStatus(data.status==='deleted'?'Despesa compartilhada excluída':'Exclusão aguardando confirmação')}catch(e){}
      if(data.status==='deleted')document.querySelectorAll(`.shared-item[data-shared-id="${CSS.escape(id)}"]`).forEach(el=>el.remove());
      await refreshData();
      window.financeNotificationsRefresh?.();
      window.dispatchEvent(new Event('focus'));
    }catch(e){console.error('Falha ao solicitar exclusão.',e);alert('Não foi possível solicitar a exclusão desta despesa.')}
    finally{busy.delete(id)}
  }

  async function respondDelete(id,accept){
    if(busy.has(id))return;
    const verb=accept?'confirmar a exclusão':'manter a despesa';
    if(!confirm(accept?'Confirmar a exclusão desta despesa? Seus lançamentos vinculados serão removidos quando todos confirmarem.':'Recusar a exclusão e manter esta despesa compartilhada?'))return;
    busy.add(id);
    try{
      const {data,error}=await sb.rpc('finance_respond_delete_shared_expense',{p_shared_id:id,p_accept:accept});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_response_failed');
      try{if(typeof setSyncStatus==='function')setSyncStatus(data.status==='deleted'?'Despesa compartilhada excluída':data.status==='cancelled'?'Exclusão recusada':'Confirmação registrada')}catch(e){}
      if(data.status==='deleted')document.querySelectorAll(`.shared-item[data-shared-id="${CSS.escape(id)}"]`).forEach(el=>el.remove());
      await refreshData();
      window.financeNotificationsRefresh?.();
      window.dispatchEvent(new Event('focus'));
    }catch(e){console.error(`Falha ao ${verb}.`,e);alert(`Não foi possível ${verb}.`)}
    finally{busy.delete(id)}
  }

  function boot(){
    injectStyles();
    const observer=new MutationObserver(()=>decorateAll());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    let tries=0;
    const timer=setInterval(()=>{tries++;if(window.sb&&window.currentUser?.id){clearInterval(timer);refreshData()}else if(tries>600)clearInterval(timer)},100);
    window.addEventListener('focus',refreshData);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData()});
    setInterval(refreshData,60000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
