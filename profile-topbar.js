(function(){
  if(window.__financeProfileTopbarLoaded)return;
  window.__financeProfileTopbarLoaded=true;

  function injectStyles(){
    if(document.getElementById('finance-profile-topbar-style'))return;
    const style=document.createElement('style');
    style.id='finance-profile-topbar-style';
    style.textContent=`
      .sidebar > .brand{display:none!important}
      .profile-brand-wrap{position:relative;margin:0 0 28px;width:100%}
      #profileSidebarCard.profile-brand-card{margin:0;padding:10px 40px 10px 11px;min-height:62px;border:1px solid var(--line);border-radius:15px;background:rgba(23,32,51,.58);display:flex;align-items:center;gap:12px;cursor:pointer;width:100%;transition:background .15s ease,border-color .15s ease;position:relative}
      #profileSidebarCard.profile-brand-card:hover{background:rgba(30,41,59,.82);border-color:#3a4b64}
      #profileSidebarCard.profile-brand-card:after{content:'⌄';position:absolute;right:13px;top:50%;transform:translateY(-54%);font-size:17px;color:var(--muted);transition:transform .16s ease}
      .profile-brand-wrap.open #profileSidebarCard.profile-brand-card:after{transform:translateY(-46%) rotate(180deg)}
      #profileSidebarCard.profile-brand-card .profile-sidebar-avatar{width:46px;height:46px;flex:0 0 46px;border-radius:14px;font-size:13px}
      #profileSidebarCard.profile-brand-card .profile-sidebar-copy{min-width:0;flex:1}
      #profileSidebarCard.profile-brand-card .profile-sidebar-name{font-size:14px;line-height:1.2;max-width:145px;font-weight:760}
      #profileSidebarCard.profile-brand-card .profile-sidebar-label{font-size:11px;margin-top:4px;color:var(--muted)}
      .profile-dropdown{display:none;position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:60;padding:6px;background:#111827;border:1px solid var(--line);border-radius:13px;box-shadow:0 18px 46px rgba(0,0,0,.30)}
      .profile-brand-wrap.open .profile-dropdown{display:grid;gap:3px}
      .profile-dropdown button{width:100%;border:0;background:transparent;color:#e5edf8;text-align:left;padding:10px 11px;border-radius:9px;font:inherit;font-size:12px;cursor:pointer}
      .profile-dropdown button:hover{background:#1a2639}
      .profile-dropdown .profile-dropdown-danger{color:#fecaca}
      .profile-dropdown-divider{height:1px;background:var(--line);margin:3px 5px}
      @media(max-width:900px){.profile-brand-wrap{margin-bottom:20px;max-width:340px}}
    `;
    document.head.appendChild(style);
  }

  function removeProfileNav(){
    document.querySelectorAll('.nav [data-page="profile"]').forEach(el=>el.remove());
  }

  function openSettings(){
    const btn=document.querySelector('.nav [data-page="settings"]');
    if(btn){btn.click();return}
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-settings'));
    const title=document.getElementById('pageTitle'),subtitle=document.getElementById('pageSubtitle');
    if(title)title.textContent='Configurações';
    if(subtitle)subtitle.textContent='Preferências e dados';
  }

  function ensureDropdown(card){
    let wrap=card.parentElement?.classList?.contains('profile-brand-wrap')?card.parentElement:null;
    if(!wrap){
      wrap=document.createElement('div');wrap.className='profile-brand-wrap';
      card.parentNode.insertBefore(wrap,card);wrap.appendChild(card);
    }
    let menu=wrap.querySelector('.profile-dropdown');
    if(!menu){
      menu=document.createElement('div');menu.className='profile-dropdown';menu.setAttribute('role','menu');
      menu.innerHTML='<button type="button" data-profile-action="profile">Meu perfil</button><button type="button" data-profile-action="settings">Configurações</button><div class="profile-dropdown-divider"></div><button type="button" class="profile-dropdown-danger" data-profile-action="logout">Sair</button>';
      wrap.appendChild(menu);
      menu.addEventListener('click',e=>e.stopPropagation());
      menu.querySelector('[data-profile-action="profile"]').onclick=()=>{wrap.classList.remove('open');if(typeof window.openFinanceProfile==='function')window.openFinanceProfile()};
      menu.querySelector('[data-profile-action="settings"]').onclick=()=>{wrap.classList.remove('open');openSettings()};
      menu.querySelector('[data-profile-action="logout"]').onclick=()=>{wrap.classList.remove('open');document.getElementById('logoutBtn')?.click()};
    }
    if(card.dataset.dropdownBound!=='1'){
      card.dataset.dropdownBound='1';
      card.onclick=e=>{e.preventDefault();e.stopPropagation();wrap.classList.toggle('open')};
      card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();wrap.classList.toggle('open')}else if(e.key==='Escape')wrap.classList.remove('open')};
      document.addEventListener('click',e=>{if(!wrap.contains(e.target))wrap.classList.remove('open')});
    }
    return wrap;
  }

  function moveProfileCard(){
    const card=document.getElementById('profileSidebarCard');
    const sidebar=document.querySelector('.sidebar');
    const nav=sidebar?.querySelector('.nav');
    if(!card||!sidebar||!nav)return false;

    const wrap=ensureDropdown(card);
    if(wrap.parentElement!==sidebar||wrap.nextElementSibling!==nav){
      sidebar.insertBefore(wrap,nav);
    }

    card.classList.remove('profile-topbar-card');
    card.classList.add('profile-brand-card');
    card.setAttribute('aria-label','Abrir menu do perfil');
    card.setAttribute('aria-haspopup','menu');
    card.title='Abrir menu do perfil';
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
