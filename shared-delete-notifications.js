(function(){
  if(window.__sharedDeleteNotificationsLoaded)return;
  window.__sharedDeleteNotificationsLoaded=true;

  let items=[];let loading=false;let decorating=false;let timer=null;
  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}

  function requesterName(i){return i.deletionRequesterName||'Outro participante'}
  function pendingForMe(){return items.filter(i=>i.myDeleteStatus==='pending')}
  function seenKey(){const uid=getUserId();return uid?`finance-shared-delete-toast-seen:${uid}`:''}
  function readSeen(){const key=seenKey();if(!key)return new Set();try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch(e){return new Set()}}
  function writeSeen(set){const key=seenKey();if(!key)return;try{localStorage.setItem(key,JSON.stringify(Array.from(set).slice(-300)))}catch(e){}}

  function ensureStyles(){
    if(document.getElementById('shared-delete-notification-style'))return;
    const s=document.createElement('style');s.id='shared-delete-notification-style';s.textContent=`
      .notification-card.deletion-request .notification-type{color:#fca5a5}
      .notification-card.deletion-request{border-color:#5f2a2a;background:#1b1115}
      .shared-delete-toast-icon{background:#351717!important;border-color:#713333!important;color:#fca5a5!important}
    `;document.head.appendChild(s);
  }

  function cardHtml(i){
    const who=requesterName(i);
    return `<div class="notification-card deletion-request" data-delete-notification="${esc(i.id)}"><div class="notification-type">Cancelamento de despesa</div><div class="notification-title">${esc(who)} quer cancelar a despesa</div><div class="notification-meta">“${esc(i.description||'Despesa compartilhada')}”<br>Entre e aprove ou recuse o cancelamento.</div><div class="notification-actions"><button type="button" class="btn small danger" data-delete-approve="${esc(i.id)}">Aprovar cancelamento</button><button type="button" class="btn small" data-delete-reject="${esc(i.id)}">Recusar</button></div></div>`;
  }

  function decoratePanel(){
    if(decorating)return;decorating=true;
    try{
      const host=document.getElementById('notificationsList');if(!host)return;
      host.querySelectorAll('.notification-card.deletion-request').forEach(el=>el.remove());
      const pending=pendingForMe();
      if(pending.length){
        const wrap=document.createElement('div');wrap.innerHTML=pending.map(cardHtml).join('');
        [...wrap.children].reverse().forEach(el=>host.prepend(el));
      }
      host.querySelectorAll('[data-delete-approve]').forEach(btn=>btn.onclick=()=>respond(btn.dataset.deleteApprove,true,btn));
      host.querySelectorAll('[data-delete-reject]').forEach(btn=>btn.onclick=()=>respond(btn.dataset.deleteReject,false,btn));
      const base=host.querySelectorAll('.notification-card:not(.deletion-request)').length,total=base+pending.length;
      const count=document.getElementById('notificationsCount');if(count)count.textContent=`${total} pendência${total===1?'':'s'}`;
      const bell=document.getElementById('profileNotificationBtn');if(bell){bell.classList.toggle('has-notifications',total>0);const badge=bell.querySelector('.notification-badge');if(badge)badge.textContent=total>9?'9+':String(total)}
    }finally{decorating=false}
  }

  function showToast(i){
    const host=document.getElementById('financeToastHost');if(!host)return;
    const toast=document.createElement('div');toast.className='finance-toast';toast.innerHTML=`<div class="finance-toast-icon shared-delete-toast-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M8 10v7M12 10v7M16 10v7M6 7l1 13h10l1-13"/></svg></div><div><div class="finance-toast-title">${esc(requesterName(i))} quer cancelar a despesa</div><div class="finance-toast-text">${esc(i.description||'Despesa compartilhada')}</div><div class="finance-toast-hint">Clique para aprovar ou recusar</div></div><button type="button" class="finance-toast-close" aria-label="Fechar">×</button>`;
    host.appendChild(toast);let closed=false;let timeout;
    const close=()=>{if(closed)return;closed=true;clearTimeout(timeout);toast.classList.add('hide');setTimeout(()=>toast.remove(),230)};
    toast.querySelector('.finance-toast-close').onclick=e=>{e.stopPropagation();close()};
    toast.onclick=()=>{close();document.getElementById('profileNotificationBtn')?.click();setTimeout(()=>document.querySelector(`[data-delete-notification="${CSS.escape(String(i.id))}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'}),300)};
    requestAnimationFrame(()=>toast.classList.add('show'));timeout=setTimeout(close,8000);
  }

  function detectToasts(){
    const seen=readSeen();let changed=false;
    pendingForMe().forEach(i=>{const token=`${i.id}:${i.deletionRequestedAt||''}`;if(seen.has(token))return;seen.add(token);changed=true;showToast(i)});
    if(changed)writeSeen(seen);
  }

  async function refreshAll(){
    try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    try{window.financeNotificationsRefresh?.()}catch(e){}
    try{window.financeSharedIncomeRefresh?.()}catch(e){}
  }

  async function respond(id,accept,button){
    const client=getSb();if(!client)return;
    const prompt=accept?'Aprovar o cancelamento desta despesa compartilhada?':'Recusar o cancelamento e manter esta despesa compartilhada?';
    if(!confirm(prompt))return;
    if(button)button.disabled=true;
    try{
      const {data,error}=await client.rpc('finance_respond_delete_shared_expense',{p_shared_id:id,p_accept:accept});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_response_failed');
      await refreshAll();await load();
      if(data.status==='deleted')alert('Cancelamento aprovado. A despesa compartilhada e os lançamentos vinculados foram excluídos.');
      else if(data.status==='cancelled')alert('Cancelamento recusado. A despesa compartilhada foi mantida.');
    }catch(e){console.error('Falha ao responder ao cancelamento compartilhado.',e);alert('Não foi possível registrar sua resposta.')}finally{if(button)button.disabled=false}
  }

  async function load(){
    const client=getSb(),uid=getUserId();if(loading||!client||!uid)return;loading=true;
    try{const {data,error}=await client.rpc('finance_list_shared_expenses');if(error)throw error;items=data?.items||[];decoratePanel();detectToasts()}catch(e){console.warn('Falha ao carregar notificações de cancelamento.',e)}finally{loading=false}
  }

  function init(){
    ensureStyles();
    let tries=0;const ready=setInterval(()=>{tries++;if(getSb()&&getUserId()&&document.getElementById('notificationsList')){clearInterval(ready);load()}else if(tries>300)clearInterval(ready)},100);
    document.addEventListener('click',e=>{if(e.target?.closest?.('#profileNotificationBtn'))setTimeout(load,120)},true);
    timer=setInterval(load,15000);window.addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
    window.financeSharedDeleteNotificationsRefresh=load;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();