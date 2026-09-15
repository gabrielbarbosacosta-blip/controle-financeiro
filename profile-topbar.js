(function(){
  if(window.__financeProfileTopbarLoaded)return;
  window.__financeProfileTopbarLoaded=true;

  function injectStyles(){
    if(document.getElementById('finance-profile-topbar-style'))return;
    const style=document.createElement('style');
    style.id='finance-profile-topbar-style';
    style.textContent=`
      #profileSidebarCard.profile-topbar-card{margin:0;padding:5px 8px 5px 5px;min-height:42px;border:1px solid var(--line);border-radius:12px;background:#111a2a;display:flex;align-items:center;gap:8px;cursor:pointer;max-width:220px;transition:background .15s ease,border-color .15s ease}
      #profileSidebarCard.profile-topbar-card:hover{background:#182235;border-color:#3a4b64}
      #profileSidebarCard.profile-topbar-card .profile-sidebar-avatar{width:32px;height:32px;flex:0 0 32px;border-radius:10px;font-size:10px}
      #profileSidebarCard.profile-topbar-card .profile-sidebar-copy{min-width:0}
      #profileSidebarCard.profile-topbar-card .profile-sidebar-name{font-size:12px;line-height:1.15;max-width:145px}
      #profileSidebarCard.profile-topbar-card .profile-sidebar-label{font-size:9px;margin-top:2px}
      @media(max-width:700px){#profileSidebarCard.profile-topbar-card{max-width:100%;order:-1}}
    `;
    document.head.appendChild(style);
  }

  function removeProfileNav(){
    document.querySelectorAll('.nav [data-page="profile"]').forEach(el=>el.remove());
  }

  function moveProfileCard(){
    const card=document.getElementById('profileSidebarCard');
    const actions=document.querySelector('.topbar .actions');
    if(!card||!actions)return false;
    if(card.parentElement!==actions){
      const logout=document.getElementById('logoutBtn');
      actions.insertBefore(card,logout||actions.firstChild);
    }
    card.classList.add('profile-topbar-card');
    card.setAttribute('aria-label','Abrir perfil');
    card.title='Abrir perfil';
    return true;
  }

  function sync(){
    removeProfileNav();
    return moveProfileCard();
  }

  function init(){
    injectStyles();
    sync();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const ready=sync();
      if(ready&&tries>5)clearInterval(timer);
      if(tries>200)clearInterval(timer);
    },100);
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
