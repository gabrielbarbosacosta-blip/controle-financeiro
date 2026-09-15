(function(){
  if(window.__financeNotificationsLoaded)return;
  window.__financeNotificationsLoaded=true;

  const STYLE_ID='finance-notifications-style';
  let panel=null,backdrop=null,toastHost=null;
  let items=[],balances=[];
  let loading=false;
  const toastQueue=[];
  let toastActive=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const fmtDateSafe=d=>{try{return typeof fmtDate==='function'?fmtDate(d):d||''}catch(e){return d||''}};
  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getCurrentUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      #profileNotificationBtn{position:relative}
      #profileNotificationBtn .notification-badge{position:absolute;right:1px;top:0;min-width:15px;height:15px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-size:9px;font-weight:800;line-height:15px;text-align:center;border:2px solid #172033;display:none}
      #profileNotificationBtn.has-notifications .notification-badge{display:block}
      .notifications-backdrop{position:fixed;inset:0;z-index:1100;background:rgba(2,6,23,.08);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .20s ease,visibility 0s linear .22s}
      .notifications-backdrop.open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .20s ease,visibility 0s linear 0s}
      .notifications-panel{position:fixed;z-index:1200;width:min(440px,calc(100vw - 34px));max-height:min(76vh,680px);overflow:auto;padding:12px;background:#111827;border:1px solid #334155;border-radius:15px;box-shadow:0 24px 64px rgba(0,0,0,.52);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-9px) scale(.985);transform-origin:top left;transition:opacity .20s ease,transform .24s cubic-bezier(.2,.8,.2,1),visibility 0s linear .24s}
      .notifications-panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1);transition:opacity .20s ease,transform .24s cubic-bezier(.2,.8,.2,1),visibility 0s linear 0s}
      .notifications-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:1px 2px 10px}
      .notifications-title{font-size:14px;font-weight:800;color:#f8fafc}.notifications-count{font-size:10px;color:#94a3b8}
      .notifications-list{display:grid;gap:9px}
      .notification-card{padding:13px 14px;border:1px solid var(--line);border-radius:13px;background:#0f172a}
      .notification-type{font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#93c5fd;margin-bottom:5px}
      .notification-card.charge .notification-type{color:#fde68a}
      .notification-title{font-size:13px;font-weight:780;color:#f8fafc}.notification-meta{font-size:11px;color:var(--muted);line-height:1.5;margin-top:5px}
      .notification-value{font-size:16px;font-weight:800;margin-top:8px}.notification-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
      .notification-empty{padding:28px 14px;text-align:center;color:var(--muted);font-size:12px}

      .finance-toast-host{position:fixed;right:22px;bottom:22px;z-index:1400;width:min(370px,calc(100vw - 30px));pointer-events:none}
      .finance-toast{pointer-events:auto;display:grid;grid-template-columns:38px minmax(0,1fr) 24px;gap:10px;align-items:start;padding:13px 13px 13px 12px;background:#111827;border:1px solid #334155;border-radius:14px;box-shadow:0 20px 55px rgba(0,0,0,.48);opacity:0;transform:translateY(18px) scale(.98);transition:opacity .22s ease,transform .28s cubic-bezier(.2,.8,.2,1);cursor:pointer}
      .finance-toast.show{opacity:1;transform:translateY(0) scale(1)}
      .finance-toast.hide{opacity:0;transform:translateY(10px) scale(.985)}
      .finance-toast-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#102845;border:1px solid #1d497b;color:#93c5fd}
      .finance-toast-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      .finance-toast-title{font-size:12px;font-weight:800;color:#f8fafc;line-height:1.35}.finance-toast-text{font-size:11px;color:#cbd5e1;line-height:1.45;margin-top:3px}.finance-toast-hint{font-size:10px;color:#60a5fa;margin-top:6px;font-weight:700}
      .finance-toast-close{width:24px;height:24px;border:0;background:transparent;color:#94a3b8;padding:0;border-radius:7px;font-size:17px;line-height:1;display:grid;place-items:center}.finance-toast-close:hover{background:#1e293b;color:#fff}

      @media(max-width:900px){.notifications-panel{left:15px!important;right:15px!important;top:90px!important;width:auto;max-height:calc(100vh - 109px);transform-origin:top center}.finance-toast-host{left:15px;right:15px;bottom:15px;width:auto}}
      @media(prefers-reduced-motion:reduce){.notifications-panel,.notifications-backdrop,.finance-toast{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi(){
    injectStyles();
    if(!backdrop){backdrop=document.createElement('div');backdrop.className='notifications-backdrop';backdrop.id='notificationsBackdrop';document.body.appendChild(backdrop);backdrop.onclick=closePanel}
    if(!panel){panel=document.createElement('div');panel.className='notifications-panel';panel.id='notificationsPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Notificações');panel.innerHTML='<div class="notifications-head"><div><div class="notifications-title">Notificações</div><div class="notifications-count" id="notificationsCount"></div></div></div><div class="notifications-list" id="notificationsList"></div>';document.body.appendChild(panel);panel.addEventListener('click',e=>e.stopPropagation())}
    if(!toastHost){toastHost=document.createElement('div');toastHost.className='finance-toast-host';toastHost.id='financeToastHost';document.body.appendChild(toastHost)}
    bindBell();
  }

  function bell(){return document.getElementById('profileNotificationBtn')}
  function bindBell(){
    const b=bell();if(!b)return false;
    if(!b.querySelector('.notification-badge')){const badge=document.createElement('span');badge.className='notification-badge';badge.setAttribute('aria-hidden','true');b.appendChild(badge)}
    if(b.dataset.notificationsBound!=='1'){
      b.dataset.notificationsBound='1';b.title='Notificações';
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();togglePanel()});
      b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();togglePanel()}else if(e.key==='Escape')closePanel()});
    }
    return true;
  }

  function positionPanel(){
    const card=document.getElementById('profileSidebarCard');if(!card||!panel||window.innerWidth<=900)return;
    const r=card.getBoundingClientRect();const width=Math.min(440,window.innerWidth-34);const maxLeft=Math.max(16,window.innerWidth-width-16);
    panel.style.left=Math.min(Math.max(16,r.left),maxLeft)+'px';panel.style.top=(r.bottom+7)+'px';
  }

  function openPanel(sharedId){
    ensureUi();document.querySelector('body > .profile-dropdown.open')?.classList.remove('open');document.body.classList.remove('profile-menu-open');positionPanel();backdrop.classList.add('open');requestAnimationFrame(()=>panel.classList.add('open'));loadNotifications().then(()=>{
      if(!sharedId)return;
      requestAnimationFrame(()=>{const card=panel.querySelector(`[data-notification-shared="${CSS.escape(String(sharedId))}"]`);card?.scrollIntoView({block:'nearest',behavior:'smooth'})});
    });
  }
  function closePanel(){if(panel)panel.classList.remove('open');if(backdrop)backdrop.classList.remove('open')}
  function togglePanel(){ensureUi();panel.classList.contains('open')?closePanel():openPanel()}

  function updateBadge(){
    const b=bell();if(!b)return;
    const pending=items.filter(i=>i.myStatus==='pending').length;const charges=balances.filter(x=>(Number(x.toReceive)||0)>0).length;const count=pending+charges;
    b.classList.toggle('has-notifications',count>0);const badge=b.querySelector('.notification-badge');if(badge)badge.textContent=count>9?'9+':String(count);
  }

  function creatorLabel(i){const creator=(i.participants||[]).find(p=>p.userId===i.creatorUserId||p.isCreator);return creator?.nickname||creator?.fullName||i.creatorName||'Outro usuário'}

  function seenKey(){const uid=getCurrentUserId();return uid?`finance-shared-toast-seen:${uid}`:''}
  function readSeen(){
    const key=seenKey();if(!key)return new Set();
    try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch(e){return new Set()}
  }
  function writeSeen(set){
    const key=seenKey();if(!key)return;
    try{localStorage.setItem(key,JSON.stringify(Array.from(set).slice(-300)))}catch(e){}
  }
  function detectNewInvitations(nextItems){
    const seen=readSeen();let changed=false;
    nextItems.filter(i=>i.myStatus==='pending').forEach(i=>{
      const id=String(i.id||'');if(!id||seen.has(id))return;
      seen.add(id);changed=true;queueToast(i);
    });
    if(changed)writeSeen(seen);
  }

  function queueToast(item){toastQueue.push(item);showNextToast()}
  function showNextToast(){
    if(toastActive||!toastQueue.length)return;
    ensureUi();toastActive=true;
    const item=toastQueue.shift();const creator=creatorLabel(item);const toast=document.createElement('div');toast.className='finance-toast';toast.setAttribute('role','status');toast.innerHTML=`<div class="finance-toast-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8M8 11h6M7 3h10a2 2 0 0 1 2 2v14l-4-3H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg></div><div><div class="finance-toast-title">${esc(creator)} cadastrou uma despesa</div><div class="finance-toast-text">${esc(item.description||'Nova despesa compartilhada')} · ${money(item.isPayer?Number(item.amount)||0:Number(item.myAmount)||0)}</div><div class="finance-toast-hint">Clique para ver</div></div><button type="button" class="finance-toast-close" aria-label="Fechar">×</button>`;
    toastHost.appendChild(toast);
    let closed=false,timer=null;
    const finish=()=>{if(closed)return;closed=true;clearTimeout(timer);toast.classList.add('hide');setTimeout(()=>{toast.remove();toastActive=false;showNextToast()},230)};
    toast.querySelector('.finance-toast-close').addEventListener('click',e=>{e.stopPropagation();finish()});
    toast.addEventListener('click',()=>{finish();openPanel(item.id)});
    requestAnimationFrame(()=>toast.classList.add('show'));
    timer=setTimeout(finish,7000);
  }

  function invitationCard(i){
    const value=i.isPayer?Number(i.amount)||0:Number(i.myAmount)||0;
    return `<div class="notification-card" data-notification-shared="${esc(i.id)}"><div class="notification-type">Despesa compartilhada</div><div class="notification-title">${esc(i.description||'Nova despesa compartilhada')}</div><div class="notification-meta">${esc(creatorLabel(i))} compartilhou uma despesa com você${i.payerName?`.<br>Pagador: ${esc(i.payerName)}`:''}${i.date?` · ${esc(fmtDateSafe(i.date))}`:''}</div><div class="notification-value">${money(value)}</div><div class="notification-actions"><button type="button" class="btn small primary" data-notification-accept="${esc(i.id)}">Aceitar despesa</button><button type="button" class="btn small" data-notification-open-sharing="1">Ver detalhes</button></div></div>`;
  }

  function chargeCard(b){
    const name=b.name||'Participante',amount=Number(b.toReceive)||0;
    return `<div class="notification-card charge"><div class="notification-type">Cobrança pendente</div><div class="notification-title">${esc(name)} ainda possui valor pendente com você</div><div class="notification-meta">Há um saldo a receber ainda não quitado nos compartilhamentos.</div><div class="notification-value">${money(amount)}</div><div class="notification-actions"><button type="button" class="btn small" data-notification-open-sharing="1">Abrir compartilhamentos</button></div></div>`;
  }

  function render(){
    ensureUi();const pending=items.filter(i=>i.myStatus==='pending'),charges=balances.filter(b=>(Number(b.toReceive)||0)>0);
    const host=document.getElementById('notificationsList'),count=document.getElementById('notificationsCount');if(count)count.textContent=`${pending.length+charges.length} pendência${pending.length+charges.length===1?'':'s'}`;
    if(host){host.innerHTML=(pending.length||charges.length)?pending.map(invitationCard).join('')+charges.map(chargeCard).join(''):'<div class="notification-empty">Nenhuma notificação pendente.</div>';bindActions(host)}
    updateBadge();
  }

  function bindActions(root){
    root.querySelectorAll('[data-notification-accept]').forEach(btn=>btn.onclick=()=>acceptShared(btn.dataset.notificationAccept,btn));
    root.querySelectorAll('[data-notification-open-sharing]').forEach(btn=>btn.onclick=()=>{closePanel();if(typeof window.openSharedExpenses==='function')window.openSharedExpenses();else document.querySelector('.nav [data-page="sharing"]')?.click()});
  }

  async function acceptShared(id,button){
    const client=getSb();if(!id||!client)return;
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Aceitando…'}
    try{
      const {data,error}=await client.rpc('finance_respond_shared_expense',{p_shared_id:id,p_accept:true});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'respond_failed');
      if(window.financeCloud?.refresh)await window.financeCloud.refresh();await loadNotifications();try{if(typeof setSyncStatus==='function')setSyncStatus('Despesa compartilhada confirmada')}catch(e){}
    }catch(e){console.error('Falha ao aceitar despesa compartilhada pela notificação.',e);alert('Não foi possível aceitar esta despesa agora.');if(button){button.disabled=false;button.textContent=old||'Aceitar despesa'}}
  }

  async function loadNotifications(){
    const client=getSb(),userId=getCurrentUserId();if(loading||!client||!userId)return;loading=true;
    try{
      const [listRes,balanceRes]=await Promise.all([client.rpc('finance_list_shared_expenses'),client.rpc('finance_shared_balances')]);
      if(listRes.error)throw listRes.error;if(balanceRes.error)throw balanceRes.error;
      const nextItems=listRes.data?.items||[];detectNewInvitations(nextItems);items=nextItems;balances=balanceRes.data?.items||[];render();
    }catch(e){console.warn('Falha ao carregar notificações.',e)}finally{loading=false}
  }

  function init(){
    ensureUi();
    let tries=0;const readyTimer=setInterval(()=>{tries++;bindBell();if(getCurrentUserId()&&getSb()){clearInterval(readyTimer);loadNotifications()}else if(tries>300)clearInterval(readyTimer)},100);
    setInterval(()=>{if(getCurrentUserId())loadNotifications()},30000);
    window.addEventListener('resize',()=>{if(panel?.classList.contains('open'))positionPanel()});
    window.addEventListener('scroll',()=>{if(panel?.classList.contains('open'))positionPanel()},{passive:true});
    document.addEventListener('click',e=>{if(panel?.classList.contains('open')&&!panel.contains(e.target)&&!bell()?.contains(e.target))closePanel()});
    window.financeNotificationsRefresh=loadNotifications;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
