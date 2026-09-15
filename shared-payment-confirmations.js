(function(){
  if(window.__sharedPaymentConfirmationsLoaded)return;
  window.__sharedPaymentConfirmationsLoaded=true;

  let items=[];let loading=false;let wrapped=false;
  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}

  function seenKey(){const uid=getUserId();return uid?`finance-shared-payment-toast-seen:${uid}`:''}
  function readSeen(){const k=seenKey();if(!k)return new Set();try{return new Set(JSON.parse(localStorage.getItem(k)||'[]'))}catch(e){return new Set()}}
  function writeSeen(s){const k=seenKey();if(!k)return;try{localStorage.setItem(k,JSON.stringify(Array.from(s).slice(-300)))}catch(e){}}

  function cardHtml(i){
    return `<div class="notification-card payment-confirmation" data-payment-confirmation="${esc(i.sharedExpenseId)}:${esc(i.participantUserId)}"><div class="notification-type">Confirmação de pagamento</div><div class="notification-title">${esc(i.participantName||'Participante')} informou que pagou</div><div class="notification-meta">${esc(i.description||'Despesa compartilhada')}<br>Confirme se você recebeu esse pagamento.</div><div class="notification-value">${money(i.amount)}</div><div class="notification-actions"><button type="button" class="btn small primary" data-payment-accept="${esc(i.sharedExpenseId)}" data-participant="${esc(i.participantUserId)}">Confirmar recebimento</button><button type="button" class="btn small" data-payment-reject="${esc(i.sharedExpenseId)}" data-participant="${esc(i.participantUserId)}">Não recebi</button></div></div>`;
  }

  function recomputeBadge(){
    const host=document.getElementById('notificationsList');const bell=document.getElementById('profileNotificationBtn');if(!host||!bell)return;
    const total=host.querySelectorAll('.notification-card').length;
    bell.classList.toggle('has-notifications',total>0);const badge=bell.querySelector('.notification-badge');if(badge)badge.textContent=total>9?'9+':String(total);
    const count=document.getElementById('notificationsCount');if(count)count.textContent=`${total} pendência${total===1?'':'s'}`;
  }

  function decorate(){
    const host=document.getElementById('notificationsList');if(!host)return;
    host.querySelectorAll('.notification-card.payment-confirmation').forEach(el=>el.remove());
    if(items.length){
      const empty=host.querySelector('.notification-empty');if(empty)empty.remove();
      const wrap=document.createElement('div');wrap.innerHTML=items.map(cardHtml).join('');
      [...wrap.children].reverse().forEach(el=>host.prepend(el));
    }
    host.querySelectorAll('[data-payment-accept]').forEach(btn=>btn.onclick=()=>respond(btn.dataset.paymentAccept,btn.dataset.participant,true,btn));
    host.querySelectorAll('[data-payment-reject]').forEach(btn=>btn.onclick=()=>respond(btn.dataset.paymentReject,btn.dataset.participant,false,btn));
    recomputeBadge();
  }

  function showToast(i){
    const host=document.getElementById('financeToastHost');if(!host)return;
    const toast=document.createElement('div');toast.className='finance-toast';
    toast.innerHTML=`<div class="finance-toast-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6"/><path d="M4 20h16"/></svg></div><div><div class="finance-toast-title">${esc(i.participantName||'Participante')} informou que pagou</div><div class="finance-toast-text">${esc(i.description||'Despesa compartilhada')} · ${money(i.amount)}</div><div class="finance-toast-hint">Clique para confirmar ou recusar</div></div><button type="button" class="finance-toast-close" aria-label="Fechar">×</button>`;
    host.appendChild(toast);let closed=false;let timer;
    const close=()=>{if(closed)return;closed=true;clearTimeout(timer);toast.classList.add('hide');setTimeout(()=>toast.remove(),230)};
    toast.querySelector('.finance-toast-close').onclick=e=>{e.stopPropagation();close()};
    toast.onclick=()=>{close();document.getElementById('profileNotificationBtn')?.click();setTimeout(()=>document.querySelector(`[data-payment-confirmation="${CSS.escape(String(i.sharedExpenseId)+':'+String(i.participantUserId))}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'}),250)};
    requestAnimationFrame(()=>toast.classList.add('show'));timer=setTimeout(close,8000);
  }

  function detectToasts(){
    const seen=readSeen();let changed=false;
    items.forEach(i=>{const token=`${i.sharedExpenseId}:${i.participantUserId}:${i.requestedAt||''}`;if(seen.has(token))return;seen.add(token);changed=true;showToast(i)});
    if(changed)writeSeen(seen);
  }

  async function refreshEverywhere(){
    try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    try{window.financeSharedIncomeRefresh?.()}catch(e){}
    try{window.financeNotificationsRefresh?.()}catch(e){}
  }

  async function respond(sharedId,participantId,accept,button){
    const client=getSb();if(!client)return;
    if(!confirm(accept?'Confirmar que você recebeu este pagamento?':'Informar que este pagamento ainda não foi recebido?'))return;
    if(button)button.disabled=true;
    try{
      const {data,error}=await client.rpc('finance_respond_shared_payment',{p_shared_id:sharedId,p_participant_user_id:participantId,p_accept:accept});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'payment_response_failed');
      await refreshEverywhere();await load();
      try{if(typeof setSyncStatus==='function')setSyncStatus(accept?'Pagamento confirmado':'Pagamento recusado')}catch(e){}
    }catch(e){console.error('Falha ao responder confirmação de pagamento.',e);alert('Não foi possível registrar sua resposta agora.')}finally{if(button)button.disabled=false}
  }

  async function load(){
    const client=getSb(),uid=getUserId();if(loading||!client||!uid)return;loading=true;
    try{
      const {data,error}=await client.rpc('finance_list_shared_payment_confirmations');if(error)throw error;
      items=data?.items||[];decorate();detectToasts();
    }catch(e){console.warn('Falha ao carregar confirmações de pagamento compartilhado.',e)}finally{loading=false}
  }

  function wrapNotificationsRefresh(){
    if(wrapped||typeof window.financeNotificationsRefresh!=='function')return;
    const original=window.financeNotificationsRefresh;
    window.financeNotificationsRefresh=async function(){const r=await original.apply(this,arguments);await load();decorate();return r};wrapped=true;
  }

  function init(){
    let tries=0;const ready=setInterval(()=>{tries++;wrapNotificationsRefresh();if(getSb()&&getUserId()&&document.getElementById('notificationsList')){load();if(wrapped)clearInterval(ready)}else if(tries>300)clearInterval(ready)},100);
    document.addEventListener('click',e=>{if(e.target?.closest?.('#profileNotificationBtn'))setTimeout(()=>{load();decorate()},50)});
    window.addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
    setInterval(load,15000);
    window.financeSharedPaymentConfirmationsRefresh=load;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();