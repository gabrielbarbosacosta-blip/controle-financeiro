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
      #profileSidebarCard.profile-brand-card{margin:0;padding:10px 78px 10px 11px;min-height:66px;border:1px solid var(--line);border-radius:15px;background:rgba(23,32,51,.58);display:flex;align-items:center;gap:12px;cursor:pointer;width:100%;transition:background .15s ease,border-color .15s ease;position:relative}
      #profileSidebarCard.profile-brand-card:hover{background:rgba(30,41,59,.82);border-color:#3a4b64}
      #profileSidebarCard.profile-brand-card:after{display:none}
      #profileSidebarCard.profile-brand-card .profile-card-tools{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:3px}
      #profileSidebarCard.profile-brand-card .profile-card-icon{width:31px;height:31px;min-width:31px;padding:0;display:grid;place-items:center;border:1px solid transparent;border-radius:9px;background:transparent;color:#dbe5f3;line-height:0;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
      #profileSidebarCard.profile-brand-card .profile-card-icon:hover{background:#1d293b;border-color:var(--line);color:#fff}
      #profileSidebarCard.profile-brand-card .profile-card-icon:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      #profileSidebarCard.profile-brand-card .profile-card-icon svg{width:19px;height:19px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #profileSidebarCard.profile-brand-card .profile-card-bell{position:relative}
      #profileSidebarCard.profile-brand-card .profile-sidebar-avatar{width:46px;height:46px;flex:0 0 46px;border-radius:14px;font-size:13px}
      #profileSidebarCard.profile-brand-card .profile-sidebar-copy{min-width:0;flex:1}
      #profileSidebarCard.profile-brand-card .profile-sidebar-name{font-size:14px;line-height:1.2;max-width:110px;font-weight:760}
      #profileSidebarCard.profile-brand-card .profile-sidebar-label{font-size:11px;margin-top:4px;color:var(--muted);max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      .profile-dropdown{position:absolute;left:0;top:calc(100% + 7px);z-index:60;width:min(440px,calc(100vw - 34px));max-height:min(76vh,680px);overflow:auto;padding:12px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.22);border-radius:15px;box-shadow:0 22px 54px rgba(0,0,0,.38);backdrop-filter:blur(20px) saturate(135%);-webkit-backdrop-filter:blur(20px) saturate(135%);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-9px) scale(.985);transform-origin:top left;transition:opacity .20s ease,transform .24s cubic-bezier(.2,.8,.2,1),visibility 0s linear .24s}
      .profile-brand-wrap.open .profile-dropdown{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1);transition:opacity .20s ease,transform .24s cubic-bezier(.2,.8,.2,1),visibility 0s linear 0s}
      .profile-dropdown-title{font-size:13px;font-weight:780;margin:1px 2px 10px;color:#f8fafc}
      .profile-dropdown .profile-layout{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
      .profile-dropdown .profile-layout>.card{padding:14px;box-shadow:none;border-radius:13px;background:rgba(15,23,42,.64);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
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
      #page-profile{display:none!important}
      .topbar #logoutBtn{display:none!important}

      @media(max-width:900px){.profile-brand-wrap{margin-bottom:20px;max-width:340px}.profile-dropdown{position:fixed;left:15px;right:15px;top:90px;width:auto;max-height:calc(100vh - 109px);transform-origin:top center}}
      @media(prefers-reduced-motion:reduce){.profile-dropdown{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function removeProfileNav(){
    document.querySelectorAll('.nav [data-page="profile"]').forEach(el=>el.remove());
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
      card.appendChild(tools);
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
    menu.appendChild(layout);
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
      menu.innerHTML='<div class="profile-dropdown-title">Perfil</div>';
      wrap.appendChild(menu);
      menu.addEventListener('click',e=>e.stopPropagation());
    }else{
      menu.querySelectorAll('[data-profile-action="settings"],.profile-dropdown-footer,.profile-dropdown-divider,[data-profile-action="logout"]').forEach(el=>el.remove());
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
