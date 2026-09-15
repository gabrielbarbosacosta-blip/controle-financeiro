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
      #profileSidebarCard.profile-brand-card{margin:0;padding:9px 40px 11px 11px;min-height:94px;border:1px solid var(--line);border-radius:15px;background:rgba(23,32,51,.58);display:grid;grid-template-columns:46px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;column-gap:12px;row-gap:8px;cursor:pointer;width:100%;transition:background .15s ease,border-color .15s ease;position:relative}
      #profileSidebarCard.profile-brand-card:hover{background:rgba(30,41,59,.82);border-color:#3a4b64}
      #profileSidebarCard.profile-brand-card:after{content:'⌄';position:absolute;right:13px;bottom:19px;font-size:17px;color:var(--muted);transition:transform .16s ease}
      .profile-brand-wrap.open #profileSidebarCard.profile-brand-card:after{transform:rotate(180deg)}
      #profileSidebarCard.profile-brand-card .profile-card-tools{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-right:-28px}
      #profileSidebarCard.profile-brand-card .profile-card-icon{width:31px;height:31px;min-width:31px;padding:0;display:grid;place-items:center;border:1px solid transparent;border-radius:9px;background:transparent;color:#dbe5f3;line-height:0;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
      #profileSidebarCard.profile-brand-card .profile-card-icon:hover{background:#1d293b;border-color:var(--line);color:#fff}
      #profileSidebarCard.profile-brand-card .profile-card-icon:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      #profileSidebarCard.profile-brand-card .profile-card-icon svg{width:19px;height:19px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #profileSidebarCard.profile-brand-card .profile-card-bell{position:relative}
      #profileSidebarCard.profile-brand-card .profile-sidebar-avatar{width:46px;height:46px;flex:0 0 46px;border-radius:14px;font-size:13px;grid-column:1;grid-row:2}
      #profileSidebarCard.profile-brand-card .profile-sidebar-copy{min-width:0;grid-column:2;grid-row:2}
      #profileSidebarCard.profile-brand-card .profile-sidebar-name{font-size:14px;line-height:1.2;max-width:145px;font-weight:760}
      #profileSidebarCard.profile-brand-card .profile-sidebar-label{font-size:11px;margin-top:4px;color:var(--muted)}

      .profile-dropdown{display:none;position:absolute;left:0;top:calc(100% + 7px);z-index:60;width:min(440px,calc(100vw - 34px));max-height:min(76vh,680px);overflow:auto;padding:12px;background:#111827;border:1px solid var(--line);border-radius:15px;box-shadow:0 22px 54px rgba(0,0,0,.38)}
      .profile-brand-wrap.open .profile-dropdown{display:block}
      .profile-dropdown-title{font-size:13px;font-weight:780;margin:1px 2px 10px;color:#f8fafc}
      .profile-dropdown .profile-layout{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
      .profile-dropdown .profile-layout>.card{padding:14px;box-shadow:none;border-radius:13px;background:#0f172a}
      .profile-dropdown .profile-photo-card h3,.profile-dropdown .section-head{display:none}
      .profile-dropdown .profile-avatar{width:92px;height:92px;border-radius:26px;margin:0 auto 11px;font-size:25px}
      .profile-dropdown .profile-photo-actions .btn{padding:7px 9px;font-size:11px}
      .profile-dropdown .profile-identity-note{display:none}
      .profile-dropdown .form-grid{grid-template-columns:1fr!important;gap:10px}
      .profile-dropdown .form-grid .full{grid-column:auto}
      .profile-dropdown .field label{font-size:11px}
      .profile-dropdown .field input{padding:9px 10px;font-size:12px}
      .profile-dropdown #profileCpfHint{font-size:10px;line-height:1.35}
      .profile-dropdown #profileSaveBtn{width:100%;padding:9px 11px}
      .profile-dropdown .profile-status{margin-top:8px;min-height:16px;font-size:11px}
      .profile-dropdown-footer{display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
      .profile-dropdown-footer button{width:100%;border:1px solid var(--line);background:#182235;color:#e5edf8;text-align:center;padding:9px 10px;border-radius:9px;font:inherit;font-size:11px;cursor:pointer}
      .profile-dropdown-footer button:hover{filter:brightness(1.08)}
      #page-profile{display:none!important}
      .topbar #logoutBtn{display:none!important}

      @media(max-width:900px){.profile-brand-wrap{margin-bottom:20px;max-width:340px}.profile-dropdown{position:fixed;left:15px;right:15px;top:118px;width:auto;max-height:calc(100vh - 137px)}}
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

  function ensureCardTools(card){
    let tools=card.querySelector('.profile-card-tools');
    if(!tools){
      tools=document.createElement('div');
      tools.className='profile-card-tools';
      tools.innerHTML=`
        <button type="button" class="profile-card-icon profile-card-bell" id="profileNotificationBtn" aria-label="Notificações" title="Notificações (em breve)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        </button>
        <button type="button" class="profile-card-icon profile-card-exit" id="profileCardLogoutBtn" aria-label="Sair" title="Sair">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H10"/><path d="M14 8l4 4-4 4"/><path d="M8 12h10"/></svg>
        </button>`;
      card.insertBefore(tools,card.firstChild);
      const bell=tools.querySelector('#profileNotificationBtn');
      const exit=tools.querySelector('#profileCardLogoutBtn');
      bell.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
      exit.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();document.getElementById('logoutBtn')?.click()});
      bell.addEventListener('keydown',e=>e.stopPropagation());
      exit.addEventListener('keydown',e=>e.stopPropagation());
    }
    return tools;
  }

  function moveProfileEditorIntoMenu(menu){
    if(menu.querySelector('.profile-layout'))return true;
    const page=document.getElementById('page-profile');
    const layout=page?.querySelector('.profile-layout');
    if(!layout)return false;
    const footer=menu.querySelector('.profile-dropdown-footer');
    menu.insertBefore(layout,footer||null);
    return true;
  }

  function ensureDropdown(card){
    let wrap=card.parentElement?.classList?.contains('profile-brand-wrap')?card.parentElement:null;
    if(!wrap){
      wrap=document.createElement('div');wrap.className='profile-brand-wrap';
      card.parentNode.insertBefore(wrap,card);wrap.appendChild(card);
    }
    let menu=wrap.querySelector('.profile-dropdown');
    if(!menu){
      menu=document.createElement('div');menu.className='profile-dropdown';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Perfil');
      menu.innerHTML='<div class="profile-dropdown-title">Perfil</div><div class="profile-dropdown-footer"><button type="button" data-profile-action="settings">Configurações</button></div>';
      wrap.appendChild(menu);
      menu.addEventListener('click',e=>e.stopPropagation());
      menu.querySelector('[data-profile-action="settings"]').onclick=()=>{wrap.classList.remove('open');openSettings()};
    }else{
      const logout=menu.querySelector('[data-profile-action="logout"]');
      if(logout)logout.remove();
      const divider=menu.querySelector('.profile-dropdown-divider');
      if(divider)divider.remove();
    }
    moveProfileEditorIntoMenu(menu);
    if(card.dataset.dropdownBound!=='1'){
      card.dataset.dropdownBound='1';
      card.onclick=e=>{e.preventDefault();e.stopPropagation();wrap.classList.toggle('open');if(wrap.classList.contains('open'))moveProfileEditorIntoMenu(menu)};
      card.onkeydown=e=>{if(e.target!==card)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();wrap.classList.toggle('open');if(wrap.classList.contains('open'))moveProfileEditorIntoMenu(menu)}else if(e.key==='Escape')wrap.classList.remove('open')};
      document.addEventListener('click',e=>{if(!wrap.contains(e.target))wrap.classList.remove('open')});
    }
    return wrap;
  }

  function moveProfileCard(){
    const card=document.getElementById('profileSidebarCard');
    const sidebar=document.querySelector('.sidebar');
    const nav=sidebar?.querySelector('.nav');
    if(!card||!sidebar||!nav)return false;

    ensureCardTools(card);
    const wrap=ensureDropdown(card);
    if(wrap.parentElement!==sidebar||wrap.nextElementSibling!==nav){
      sidebar.insertBefore(wrap,nav);
    }

    card.classList.remove('profile-topbar-card');
    card.classList.add('profile-brand-card');
    card.setAttribute('aria-label','Abrir perfil');
    card.setAttribute('aria-haspopup','dialog');
    card.title='Abrir perfil';
    return true;
  }

  function escapeSeparateProfilePage(){
    const page=document.getElementById('page-profile');
    if(page?.classList.contains('active'))document.querySelector('.nav [data-page="dashboard"]')?.click();
  }

  function sync(){
    removeProfileNav();
    escapeSeparateProfilePage();
    return moveProfileCard();
  }

  function init(){
    injectStyles();
    sync();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const ready=sync();
      const moved=!!document.querySelector('.profile-dropdown .profile-layout');
      if(ready&&moved&&tries>5)clearInterval(timer);
      if(tries>200)clearInterval(timer);
    },100);
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
