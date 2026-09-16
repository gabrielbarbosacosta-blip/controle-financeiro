(function(){
  if(window.__financeNotificationQueueLoaded)return;
  window.__financeNotificationQueueLoaded=true;

  let observer=null;
  let syncing=false;
  let currentIndex=0;
  let ordered=[];
  let viewTimer=null;

  function host(){return document.getElementById('notificationsList')}
  function panel(){return document.getElementById('notificationsPanel')}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}

  function classify(card,index){
    if(card.classList.contains('payment-confirmation'))return {mode:'persistent',kind:'payment',key:card.dataset.paymentConfirmation||`payment:${index}`,priority:10};
    if(card.classList.contains('deletion-request'))return {mode:'persistent',kind:'delete',key:card.dataset.deleteNotification||`delete:${index}`,priority:20};
    if(card.hasAttribute('data-notification-shared'))return {mode:'persistent',kind:'invite',key:card.dataset.notificationShared||`invite:${index}`,priority:30};
    if(card.classList.contains('charge'))return {mode:'once',kind:'charge',key:card.dataset.notificationKey||`charge:${index}`,priority:40};
    return {mode:'persistent',kind:'other',key:`other:${index}`,priority:50};
  }

  function ensureControls(){
    const p=panel();if(!p)return null;
    let controls=p.querySelector('.notification-queue-controls');
    if(controls)return controls;
    controls=document.createElement('div');controls.className='notification-queue-controls';
    controls.innerHTML='<button type="button" class="btn small" data-queue-prev>Anterior</button><div class="notification-queue-position"></div><button type="button" class="btn small" data-queue-next>Próxima</button>';
    const list=host();if(list)list.insertAdjacentElement('afterend',controls);
    controls.querySelector('[data-queue-prev]').onclick=()=>move(-1);
    controls.querySelector('[data-queue-next]').onclick=()=>move(1);
    return controls;
  }

  function injectStyles(){
    if(document.getElementById('notification-queue-style'))return;
    const s=document.createElement('style');s.id='notification-queue-style';s.textContent=`
      .notification-card.queue-hidden{display:none!important}
      .notification-card.queue-active{display:block!important}
      .notification-queue-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
      .notification-queue-position{font-size:10px;color:var(--muted);text-align:center;flex:1}
      .notification-queue-controls .btn[disabled]{opacity:.4;pointer-events:none}
    `;document.head.appendChild(s);
  }

  function cardSort(a,b){
    const da=Number(a.el.dataset.queueSeq||0),db=Number(b.el.dataset.queueSeq||0);
    if(da&&db&&da!==db)return da-db;
    if(a.meta.priority!==b.meta.priority)return a.meta.priority-b.meta.priority;
    return a.domIndex-b.domIndex;
  }

  function buildQueue(){
    const h=host();if(!h)return[];
    let seq=1;
    const cards=[...h.querySelectorAll('.notification-card')].filter(el=>el.style.display!=='none'||el.classList.contains('queue-active'));
    return cards.map((el,domIndex)=>{
      if(!el.dataset.queueSeq)el.dataset.queueSeq=String(Date.now()*1000+(seq++));
      const meta=classify(el,domIndex);
      el.dataset.notificationMode=el.dataset.notificationMode||meta.mode;
      el.dataset.notificationKind=meta.kind;
      el.dataset.notificationQueueKey=el.dataset.notificationQueueKey||meta.key;
      return {el,meta,domIndex};
    }).sort(cardSort);
  }

  function updateBadge(){
    const total=ordered.length;
    const bell=document.getElementById('profileNotificationBtn');
    if(bell){bell.classList.toggle('has-notifications',total>0);const b=bell.querySelector('.notification-badge');if(b)b.textContent=total>9?'9+':String(total)}
    const count=document.getElementById('notificationsCount');if(count)count.textContent=`${total} na fila`;
  }

  function scheduleViewed(item){
    clearTimeout(viewTimer);viewTimer=null;
    if(!item||item.meta.mode!=='once'||!panel()?.classList.contains('open'))return;
    viewTimer=setTimeout(()=>{
      const card=item.el;
      if(!card.isConnected||!card.classList.contains('queue-active'))return;
      card.dataset.queueViewed='1';
      try{window.financeMarkVisibleChargeNotificationsViewed?.()}catch(e){}
    },700);
  }

  function apply(){
    if(syncing)return;syncing=true;
    try{
      ordered=buildQueue();
      if(!ordered.length){currentIndex=0;ensureControls()?.setAttribute('hidden','');updateBadge();return}
      if(currentIndex>=ordered.length)currentIndex=ordered.length-1;
      if(currentIndex<0)currentIndex=0;
      ordered.forEach((item,i)=>{
        const active=i===currentIndex;
        item.el.classList.toggle('queue-active',active);
        item.el.classList.toggle('queue-hidden',!active);
        item.el.dataset.queueActive=active?'1':'0';
      });
      const controls=ensureControls();
      if(controls){
        controls.removeAttribute('hidden');
        const pos=controls.querySelector('.notification-queue-position');
        if(pos)pos.textContent=`${currentIndex+1} de ${ordered.length}`;
        controls.querySelector('[data-queue-prev]').disabled=currentIndex<=0;
        controls.querySelector('[data-queue-next]').disabled=currentIndex>=ordered.length-1;
      }
      updateBadge();scheduleViewed(ordered[currentIndex]);
    }finally{syncing=false}
  }

  function move(delta){
    const current=ordered[currentIndex];
    if(current?.meta.mode==='once'&&current.el.dataset.queueViewed==='1'){
      current.el.style.display='none';
      current.el.classList.remove('queue-active');
      current.el.classList.add('queue-hidden');
      ordered.splice(currentIndex,1);
      if(delta<0)currentIndex=Math.max(0,currentIndex-1);
      else if(currentIndex>=ordered.length)currentIndex=Math.max(0,ordered.length-1);
    }else{
      currentIndex=Math.max(0,Math.min(ordered.length-1,currentIndex+delta));
    }
    apply();
  }

  function onPanelOpen(){
    const h=host();if(!h)return;
    currentIndex=0;
    setTimeout(apply,80);
  }

  function observe(){
    const h=host();if(!h||observer)return false;
    observer=new MutationObserver(()=>{if(!syncing)setTimeout(apply,0)});
    observer.observe(h,{childList:true,subtree:true,attributes:true,attributeFilter:['style','data-notification-key']});
    return true;
  }

  function init(){
    injectStyles();
    let tries=0;const ready=setInterval(()=>{tries++;if(observe()){clearInterval(ready);apply()}else if(tries>300)clearInterval(ready)},100);
    document.addEventListener('click',e=>{if(e.target?.closest?.('#profileNotificationBtn'))onPanelOpen()},true);
    window.financeNotificationQueueRefresh=apply;
    window.financeNotificationQueueNext=()=>move(1);
    window.financeNotificationQueuePrev=()=>move(-1);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();