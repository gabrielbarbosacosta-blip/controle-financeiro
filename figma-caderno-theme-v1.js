(function(){
  if(window.__cadernoFigmaThemeLoaded)return;
  window.__cadernoFigmaThemeLoaded=true;

  const THEME_VERSION='20260918-13';
  const LABELS={dashboard:'Visão geral',history:'Lançamentos',cards:'Cartões',incomes:'Receitas',debts:'Despesas',projection:'Projeções',goals:'Objetivos',settings:'Configurações'};
  const ICONS={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    history:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    cards:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    incomes:'<path d="M19 5v6h-6M5 19v-6h6"/><path d="m19 11-7-7-7 7M5 13l7 7 7-7"/>',
    debts:'<path d="M19 5v6h-6M5 19v-6h6"/><path d="m19 11-7-7-7 7M5 13l7 7 7-7"/>',
    projection:'<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><circle cx="6" cy="15" r="1.1"/><circle cx="10" cy="11" r="1.1"/><circle cx="13" cy="14" r="1.1"/><circle cx="18" cy="8" r="1.1"/>',
    goals:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.08 2.08-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55v.08h-3v-.08A1.7 1.7 0 0 0 10.72 18.6a1.7 1.7 0 0 0-1.88.34l-.06.06L6.7 16.92l.06-.06A1.7 1.7 0 0 0 7.1 15a1.7 1.7 0 0 0-1.55-1.03h-.08v-3h.08A1.7 1.7 0 0 0 7.1 9.94a1.7 1.7 0 0 0-.34-1.88L6.7 8 8.78 5.92l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55v-.08h3v.08a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z"/>'
  };
  let greetingAnimated=false;

  function ensureGreetingFadeStyle(){
    if(document.getElementById('prumo-greeting-fade-style'))return;
    const style=document.createElement('style');
    style.id='prumo-greeting-fade-style';
    style.textContent=`.prumo-title-fade{animation:prumoGreetingFade .72s cubic-bezier(.22,1,.36,1) both;will-change:opacity,transform,filter}@keyframes prumoGreetingFade{0%{opacity:0;transform:translateY(7px);filter:blur(5px)}42%{opacity:.66;filter:blur(1.8px)}100%{opacity:1;transform:translateY(0);filter:blur(0)}}@media(prefers-reduced-motion:reduce){.prumo-title-fade{animation:none!important}}`;
    document.head.appendChild(style);
  }

  function injectTheme(){
    if(!document.getElementById('caderno-figma-theme')){
      const link=document.createElement('link');
      link.id='caderno-figma-theme';
      link.rel='stylesheet';
      link.href=`figma-caderno-theme-v1.css?v=${THEME_VERSION}`;
      document.head.appendChild(link);
    }
    ensureGreetingFadeStyle();
    document.documentElement.classList.add('caderno-theme');
    if(document.title!=='prumo')document.title='prumo';
  }

  function safeUser(){try{return typeof currentUser!=='undefined'?currentUser:null}catch(e){return null}}
  function userDisplay(){
    const user=safeUser(),meta=user?.user_metadata||{},full=String(meta.full_name||meta.name||meta.nome||'').trim(),email=String(user?.email||'').trim();
    const name=full||email.split('@')[0].replace(/[._-]+/g,' ')||'Gabriel';
    return{name:name.replace(/\b\w/g,m=>m.toUpperCase()),email:email||'Conta pessoal'};
  }
  function firstName(){return userDisplay().name.split(/\s+/)[0]||'Gabriel'}
  function initials(name){return String(name||'G').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'G'}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function decorateBrand(){
    document.querySelectorAll('.brand h1').forEach(h=>{if(h.textContent!=='prumo')h.textContent='prumo'});
    const brand=document.querySelector('.sidebar>.brand');if(!brand)return;
    const logo=brand.querySelector('.logo');if(logo&&logo.textContent)logo.textContent='';
  }

  function ensureProfile(){
    const sidebar=document.querySelector('.sidebar'),brand=sidebar?.querySelector(':scope > .brand');if(!sidebar||!brand)return;
    const info=userDisplay();let profile=sidebar.querySelector('.caderno-profile');
    if(!profile){profile=document.createElement('div');profile.className='caderno-profile';profile.setAttribute('aria-label','Conta pessoal');brand.insertAdjacentElement('afterend',profile)}
    const wanted=`<span class="caderno-avatar">${initials(info.name)}</span><span class="caderno-profile-copy"><b>${escapeHtml(info.name)}</b><small>${escapeHtml(info.email||'Conta pessoal')}</small></span><span class="caderno-profile-chevron">›</span>`;
    if(profile.innerHTML!==wanted)profile.innerHTML=wanted;
    const originalLogout=document.getElementById('logoutBtn');let logout=sidebar.querySelector('.caderno-sidebar-logout');
    if(!logout){logout=document.createElement('button');logout.type='button';logout.className='caderno-sidebar-logout';logout.textContent='Sair da conta';sidebar.appendChild(logout)}
    if(!logout.dataset.bound){logout.dataset.bound='1';logout.addEventListener('click',()=>originalLogout?.click())}
  }

  function iconFor(page){const path=ICONS[page]||ICONS.settings;return `<span class="caderno-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`}
  function decorateNav(){
    const nav=document.querySelector('.nav');if(!nav)return;
    nav.querySelectorAll('button[data-page]').forEach(btn=>{
      const page=btn.dataset.page||'',label=LABELS[page]||btn.dataset.cadernoLabel||btn.textContent.trim();btn.dataset.cadernoLabel=label;
      const icon=btn.querySelector('.caderno-nav-icon');
      if(!icon){const old=btn.textContent.trim();btn.innerHTML=`${iconFor(page)}<span class="caderno-nav-label">${escapeHtml(LABELS[page]||old)}</span>`}
      else if(page==='projection'&&icon.dataset.iconVersion!=='chart-v1')icon.outerHTML=iconFor(page).replace('class="caderno-nav-icon"','class="caderno-nav-icon" data-icon-version="chart-v1"');
      const text=btn.querySelector('.caderno-nav-label'),wanted=LABELS[page]||label;if(text&&text.textContent!==wanted)text.textContent=wanted;
    });
  }

  function ensureMonthSwitcher(){
    const select=document.getElementById('monthSelect');if(!select||select.closest('.caderno-month-switcher'))return;
    const wrap=document.createElement('div');wrap.className='caderno-month-switcher';
    const prev=document.createElement('button');prev.type='button';prev.setAttribute('aria-label','Mês anterior');prev.textContent='‹';
    const next=document.createElement('button');next.type='button';next.setAttribute('aria-label','Próximo mês');next.textContent='›';
    select.parentNode.insertBefore(wrap,select);wrap.append(prev,select,next);
    const move=delta=>{const ni=Math.max(0,Math.min(select.options.length-1,select.selectedIndex+delta));if(ni===select.selectedIndex)return;select.selectedIndex=ni;select.dispatchEvent(new Event('change',{bubbles:true}))};
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
  }

  function decorateQuickAdd(){const btn=document.getElementById('quickAdd');if(!btn)return;if(btn.textContent.trim()!=='Novo lançamento')btn.textContent='Novo lançamento';btn.setAttribute('aria-label','Novo lançamento')}
  function activePage(){return document.querySelector('.nav button.active')?.dataset.page||''}
  function refreshHeading(){
    if(activePage()!=='dashboard')return;
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle'),hour=new Date().getHours(),greet=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite',wanted=`${greet}, ${firstName()}.`;
    if(title&&title.textContent!==wanted)title.textContent=wanted;if(sub&&sub.textContent!=='Aqui está a leitura do seu mês.')sub.textContent='Aqui está a leitura do seu mês.';
  }

  function animateTitle(el,delay=0){
    if(!el||!el.textContent.trim())return;
    try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return}catch(e){}
    setTimeout(()=>{
      if(!el.isConnected)return;
      el.classList.remove('prumo-title-fade');
      void el.offsetWidth;
      el.classList.add('prumo-title-fade');
      el.addEventListener('animationend',()=>el.classList.remove('prumo-title-fade'),{once:true});
    },delay);
  }

  const animatedPageTitles=new Set();

  function animatePageTitle(page=activePage()){
    const title=document.getElementById('pageTitle');
    if(!title||!title.textContent.trim()||!page||animatedPageTitles.has(page))return;
    animatedPageTitles.add(page);
    animateTitle(title);
  }

  function animateGreeting(){
    if(greetingAnimated||activePage()!=='dashboard')return;
    greetingAnimated=true;
    animatePageTitle();
  }


  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
  function tuneDashboardCopy(){
    const dash=document.getElementById('page-dashboard');if(!dash)return;
    const kpis=dash.querySelectorAll('.grid-kpi .kpi'),labels=['Saldo inicial','Entradas','Saídas','Faturas pagas','Saldo final'],hints=['Base do mês','Receitas recebidas','Inclui faturas pagas','Um valor por fatura','Resultado do período'];
    kpis.forEach((card,i)=>{setText(card.querySelector('.label'),labels[i]||'');const h=card.querySelector('.hint');if(h&&h.id!=='kpiResultHint'&&hints[i])setText(h,hints[i])});
    setText(dash.querySelector('.dashboard-grid>.card:first-child h3'),'Saldo projetado');setText(dash.querySelector('.dashboard-grid>.card:nth-child(2) h3'),'Gastos por categoria');
  }

  function decorate(){injectTheme();decorateBrand();ensureProfile();decorateNav();ensureMonthSwitcher();decorateQuickAdd();refreshHeading();tuneDashboardCopy()}
  function observe(){
    let scheduled=false;const run=()=>{scheduled=false;decorate()},queue=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(run)};
    new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{const navButton=e.target.closest('.nav button[data-page]');if(navButton){const page=navButton.dataset.page;setTimeout(()=>{refreshHeading();decorateNav();animatePageTitle(page)},45)}});
  }
  function boot(){
    decorate();observe();setTimeout(decorate,150);setTimeout(decorate,700);
    window.addEventListener('caderno:splash-done',()=>setTimeout(animateGreeting,55),{once:true});
    if(document.body?.classList.contains('caderno-splash-done'))setTimeout(animateGreeting,55);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
