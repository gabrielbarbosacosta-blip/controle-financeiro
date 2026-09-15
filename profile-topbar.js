(function(){
  if(window.__financeProfileTopbarLoaded)return;
  window.__financeProfileTopbarLoaded=true;

  function injectStyles(){
    if(document.getElementById('finance-profile-topbar-style'))return;
    const style=document.createElement('style');
    style.id='finance-profile-topbar-style';
    style.textContent=`
      .sidebar > .brand{display:none!important}
      #profileSidebarCard.profile-brand-card{margin:0 0 28px;padding:10px 11px;min-height:62px;border:1px solid var(--line);border-radius:15px;background:rgba(23,32,51,.58);display:flex;align-items:center;gap:12px;cursor:pointer;width:100%;transition:background .15s ease,border-color .15s ease}
      #profileSidebarCard.profile-brand-card:hover{background:rgba(30,41,59,.82);border-color:#3a4b64}
      #profileSidebarCard.profile-brand-card .profile-sidebar-avatar{width:46px;height:46px;flex:0 0 46px;border-radius:14px;font-size:13px}
      #profileSidebarCard.profile-brand-card .profile-sidebar-copy{min-width:0;flex:1}
      #profileSidebarCard.profile-brand-card .profile-sidebar-name{font-size:14px;line-height:1.2;max-width:170px;font-weight:760}
      #profileSidebarCard.profile-brand-card .profile-sidebar-label{font-size:11px;margin-top:4px;color:var(--muted)}
      @media(max-width:900px){#profileSidebarCard.profile-brand-card{margin-bottom:20px;max-width:340px}}
    `;
    document.head.appendChild(style);
  }

  function removeProfileNav(){
    document.querySelectorAll('.nav [data-page="profile"]').forEach(el=>el.remove());
  }

  function moveProfileCard(){
    const card=document.getElementById('profileSidebarCard');
    const sidebar=document.querySelector('.sidebar');
    const nav=sidebar?.querySelector('.nav');
    if(!card||!sidebar||!nav)return false;

    if(card.parentElement!==sidebar||card.nextElementSibling!==nav){
      sidebar.insertBefore(card,nav);
    }

    card.classList.remove('profile-topbar-card');
    card.classList.add('profile-brand-card');
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
