(function(){
  if(typeof sb==='undefined'||!sb?.auth?.updateUser||sb.auth.__financeStateRedirected)return;
  const originalUpdateUser=sb.auth.updateUser.bind(sb.auth);
  sb.auth.updateUser=async function(attributes={}){
    const data=attributes?.data;
    if(data&&Object.prototype.hasOwnProperty.call(data,'finance_state')){
      const userId=typeof currentUser!=='undefined'?currentUser?.id:null;
      if(!userId){
        return {data:{user:null},error:new Error('Usuário não autenticado para sincronização financeira.')};
      }
      const updatedAt=data.finance_updated_at||new Date().toISOString();
      const {error}=await sb.from('finance_states').upsert({
        user_id:userId,
        state:data.finance_state,
        updated_at:updatedAt
      },{onConflict:'user_id'});
      if(error)return {data:{user:currentUser},error};
      return {data:{user:currentUser},error:null};
    }
    return originalUpdateUser(attributes);
  };
  sb.auth.__financeStateRedirected=true;
})();

(function(){
  const COLORS={synced:'#22c55e',saving:'#f59e0b',error:'#ef4444',idle:'#64748b'};
  const LABELS={synced:'Sincronizado',saving:'Salvando',error:'Falha ao sincronizar',idle:'Status de sincronização'};

  function statusFromText(text,bad){
    const t=String(text||'').toLowerCase();
    if(bad||t.includes('falha')||t.includes('erro')||t.includes('não sincron'))return'error';
    if(t.includes('salvando')||t.includes('sincronizando'))return'saving';
    if(t.includes('sincronizado'))return'synced';
    return'idle';
  }

  function paint(status){
    const el=document.getElementById('syncStatus');
    if(!el)return;
    const label=LABELS[status]||LABELS.idle;
    el.textContent='';
    el.setAttribute('aria-label',label);
    el.title=label;
    el.style.width='12px';
    el.style.height='12px';
    el.style.minWidth='12px';
    el.style.padding='0';
    el.style.margin='0 2px';
    el.style.border='0';
    el.style.borderRadius='50%';
    el.style.display='inline-flex';
    el.style.alignSelf='center';
    el.style.flex='0 0 12px';
    el.style.background=COLORS[status]||COLORS.idle;
    el.style.boxShadow=`0 0 0 3px ${COLORS[status]||COLORS.idle}22`;
    el.style.transition='background .18s ease, box-shadow .18s ease';
    el.dataset.syncState=status;
  }

  const originalSync=window.setSyncStatus;
  window.setSyncStatus=function(text,bad=false){
    if(typeof originalSync==='function')originalSync(text,bad);
    paint(statusFromText(text,bad));
  };

  function removeLegacyPendingBoxes(){
    document.getElementById('kpiIncomeForecastBox')?.remove();
    document.getElementById('kpiExpensePendingBox')?.remove();
  }

  function watchLegacyPendingBoxes(){
    removeLegacyPendingBoxes();
    const root=document.getElementById('page-dashboard')||document.body;
    if(!root||root.__prumoLegacyPendingObserver)return;
    const observer=new MutationObserver(()=>{
      if(document.getElementById('kpiIncomeForecastBox')||document.getElementById('kpiExpensePendingBox')){
        removeLegacyPendingBoxes();
      }
    });
    observer.observe(root,{childList:true,subtree:true});
    root.__prumoLegacyPendingObserver=observer;
  }

  function anchorMainToTop(){
    const main=document.querySelector('.main');
    if(!main)return;
    main.style.margin='0 auto';
    main.style.alignSelf='start';
  }

  const originalDashboard=window.renderDashboard;
  if(typeof originalDashboard==='function'){
    window.renderDashboard=function(){
      originalDashboard.apply(this,arguments);
      removeLegacyPendingBoxes();
    };
  }

  function init(){
    anchorMainToTop();
    const el=document.getElementById('syncStatus');
    if(el){const initial=String(el.textContent||'');paint(statusFromText(initial,false));}
    watchLegacyPendingBoxes();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

(function(){
  if(document.querySelector('script[src="cloud-sync.js"]'))return;
  const script=document.createElement('script');
  script.src='cloud-sync.js';
  document.body.appendChild(script);
})();

(function(){
  if(document.querySelector('script[src="invoice-materializer.js"]'))return;
  const script=document.createElement('script');
  script.src='invoice-materializer.js';
  document.body.appendChild(script);
})();

(function(){
  if(document.querySelector('script[src="admin-dashboard.js"]'))return;
  const script=document.createElement('script');
  script.src='admin-dashboard.js';
  document.body.appendChild(script);
})();

(function(){
  if(document.querySelector('script[src="data-reset.js"]'))return;
  const script=document.createElement('script');
  script.src='data-reset.js';
  document.body.appendChild(script);
})();