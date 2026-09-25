/* PRUMO — interface canônica atual
   Consolida comportamento de tema, modo escuro e estabilidade.
*/

(function(){
  if(window.__cadernoFigmaThemeLoaded)return;
  window.__cadernoFigmaThemeLoaded=true;

  const THEME_VERSION='20260919-navicons2';
  const LABELS={dashboard:'Visão geral',history:'Lançamentos',cards:'Cartões',incomes:'Receitas',debts:'Despesas',projection:'Projeções',goals:'Objetivos',sharing:'Compartilhamentos',connections:'Conexões',settings:'Configurações'};
  const ICONS={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    history:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    cards:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    incomes:'<path d="M12 4v15"/><path d="m6.5 13.5 5.5 5.5 5.5-5.5"/>',
    debts:'<path d="M12 20V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/>',
    projection:'<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><circle cx="6" cy="15" r="1.1"/><circle cx="10" cy="11" r="1.1"/><circle cx="13" cy="14" r="1.1"/><circle cx="18" cy="8" r="1.1"/>',
    goals:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none"/>',
    sharing:'<path d="M8 19V5"/><path d="m4.5 8.5 3.5-3.5 3.5 3.5"/><path d="M16 5v14"/><path d="m12.5 15.5 3.5 3.5 3.5-3.5"/>',
    connections:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.1 2.5-5 5.5-5s5 1.9 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 15c.8-.5 1.7-.8 2.7-.8 2.4 0 4 1.6 4.3 4.3"/>',
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
    const legacyLogout=sidebar.querySelector('.caderno-sidebar-logout');
    if(legacyLogout)legacyLogout.remove();
  }

  function iconFor(page){const path=ICONS[page]||ICONS.settings;return `<span class="caderno-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`}
  function decorateNav(){
    const nav=document.querySelector('.nav');if(!nav)return;
    nav.querySelectorAll('button[data-page]').forEach(btn=>{
      const page=btn.dataset.page||'',label=LABELS[page]||btn.dataset.cadernoLabel||btn.textContent.trim();btn.dataset.cadernoLabel=label;
      const icon=btn.querySelector('.caderno-nav-icon');
      if(!icon){const old=btn.textContent.trim();btn.innerHTML=`${iconFor(page)}<span class="caderno-nav-label">${escapeHtml(LABELS[page]||old)}</span>`}
      else if(page==='projection'&&icon.dataset.iconVersion!=='chart-v1')icon.outerHTML=iconFor(page).replace('class="caderno-nav-icon"','class="caderno-nav-icon" data-icon-version="chart-v1"');
      else if(page==='sharing'&&icon.dataset.iconVersion!=='opposite-arrows-v1')icon.outerHTML=iconFor(page).replace('class="caderno-nav-icon"','class="caderno-nav-icon" data-icon-version="opposite-arrows-v1"');
      const text=btn.querySelector('.caderno-nav-label'),wanted=LABELS[page]||label;if(text&&text.textContent!==wanted)text.textContent=wanted;
    });
  }

  function ensureMonthSwitcher(){
    const select=document.getElementById('monthSelect');if(!select||select.closest('.caderno-month-switcher'))return;
    select.classList.remove('prumo-month-select-hidden');
    select.removeAttribute('aria-hidden');
    select.removeAttribute('tabindex');
    const wrap=document.createElement('div');wrap.className='caderno-month-switcher';
    const prev=document.createElement('button');prev.type='button';prev.setAttribute('aria-label','Mês anterior');prev.textContent='‹';
    const next=document.createElement('button');next.type='button';next.setAttribute('aria-label','Próximo mês');next.textContent='›';
    select.parentNode.insertBefore(wrap,select);wrap.append(prev,select,next);
    const move=delta=>{const ni=Math.max(0,Math.min(select.options.length-1,select.selectedIndex+delta));if(ni===select.selectedIndex)return;select.selectedIndex=ni;select.dispatchEvent(new Event('change',{bubbles:true}))};
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
  }




  function removeDuplicateMonthNavigation(){
    const actions=document.querySelector('.topbar .actions');
    if(!actions)return;
    const canonical=actions.querySelector('.caderno-month-switcher');

    const isArrowButton=btn=>{
      if(!btn||btn.tagName!=='BUTTON')return false;
      const text=String(btn.textContent||'').trim();
      const label=String(btn.getAttribute('aria-label')||'').toLowerCase();
      return text==='‹'||text==='›'||text==='←'||text==='→'||
        label.includes('mês anterior')||label.includes('mes anterior')||
        label.includes('próximo mês')||label.includes('proximo mes');
    };

    [...actions.children].forEach(child=>{
      if(child===canonical||child.id==='quickAdd'||child.id==='logoutBtn'||child.id==='monthSelect')return;
      if(isArrowButton(child)){child.remove();return}
      const buttons=[...child.querySelectorAll?.('button')||[]];
      if(buttons.length===2&&buttons.every(isArrowButton))child.remove();
    });
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

  function decorate(){injectTheme();decorateBrand();ensureProfile();decorateNav();ensureMonthSwitcher();removeDuplicateMonthNavigation();decorateQuickAdd();refreshHeading();tuneDashboardCopy()}
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


(function(){
  if(window.__cadernoDarkV2Loaded)return;
  window.__cadernoDarkV2Loaded=true;
  const VERSION='20260917-dark6';

  function inject(){
    if(!document.getElementById('caderno-remove-duplicate-profile')){const style=document.createElement('style');style.id='caderno-remove-duplicate-profile';style.textContent='.caderno-profile{display:none!important}';document.head.appendChild(style)}
    document.documentElement.classList.add('caderno-dark');
  }

  function drawDarkChart(id,data){
    const canvas=document.getElementById(id);if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.max(300,rect.width||700),H=Math.max(210,rect.height||280),p={l:55,r:16,t:18,b:38};
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const vals=data.map(d=>Number(d.value)||0);let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min){max+=1;min-=1}const pad=(max-min)*.08;max+=pad;min-=pad;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    ctx.clearRect(0,0,W,H);ctx.lineWidth=1;ctx.font="10px 'DM Mono', monospace";ctx.textBaseline='middle';
    for(let i=0;i<=3;i++){const val=min+(max-min)*i/3,yy=y(val);ctx.strokeStyle='#23344b';ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillStyle='#718197';ctx.textAlign='right';ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),p.l-8,yy)}
    if(min<0&&max>0){ctx.strokeStyle='#647790';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}
    ctx.strokeStyle='#65aaff';ctx.lineWidth=2.3;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
    data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);ctx.fillStyle=Number(d.value)<0?'#ed7773':'#65aaff';ctx.beginPath();ctx.arc(xx,yy,3.5,0,Math.PI*2);ctx.fill();if(data.length<=12||i%2===0){ctx.save();ctx.translate(xx,H-13);ctx.rotate(-.28);ctx.fillStyle='#718197';ctx.font="9px 'DM Mono', monospace";ctx.textAlign='center';ctx.fillText(d.label,0,0);ctx.restore()}});
  }
  window.__cadernoDarkChartRenderer=drawDarkChart;

  function installRenderer(){
    const current=window.drawLineChart;if(current?.__lineOnlyFirstLoad||current?.__cadernoTooltipOnly)return;
    try{window.drawLineChart=drawDarkChart;drawLineChart=drawDarkChart}catch(e){window.drawLineChart=drawDarkChart}
  }

  function restyleStatusSelects(){
    document.querySelectorAll('.history-status-select').forEach(select=>{const v=String(select.value||'').toLowerCase();let c={bg:'#111f31',border:'#2c4058',text:'#dbe5f1'};if(['pago','recebido','paga'].includes(v))c={bg:'#102a20',border:'#28513e',text:'#a5e2c8'};else if(v==='pendente')c={bg:'#2a2213',border:'#5a4824',text:'#ead38f'};else if(v.includes('aguardando'))c={bg:'#10243a',border:'#275073',text:'#abd5f3'};else if(v.includes('não paga')||v.includes('nao paga'))c={bg:'#2b171b',border:'#623039',text:'#f2a29c'};select.style.background=c.bg;select.style.border=`1px solid ${c.border}`;select.style.color=c.text});
  }

  function boot(){
    inject();installRenderer();restyleStatusSelects();
    new MutationObserver(()=>restyleStatusSelects()).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',()=>{if(window.__financeChartLineIntroActive===true)return;setTimeout(()=>{try{if(typeof window.redrawFilteredProjection==='function')window.redrawFilteredProjection()}catch(e){}},80)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();


(function(){
  if(window.__cadernoStabilityV3Loaded)return;
  window.__cadernoStabilityV3Loaded=true;
  const VERSION='20260918-stability28-longer-splash-exit';
  const PROFILE_SKINS=['profile-panel-current.js?v=20260924-profileglass1'];
  const FEATURE_SCRIPTS=['profile-avatar-performance-v1.js?v=20260917-avatarperf1','goal-participant-avatars-v7.js?v=20260924-recurringfix1','goal-recurring-terminology-v1.js?v=20260916-goalterms2','goal-recurring-participants-v2.js?v=20260916-goalsharedrecurring1','goal-effective-metrics-v1.js?v=20260916-goaleffective1','goal-extra-delete-v1.js?v=20260916-goalextra2','kpi-countup-v1.js?v=20260918-kpicount3'];
  let moving=false;

  function ensureThemeLink(){
    let link=document.getElementById('prumo-ui-current');
    if(!link){
      link=document.createElement('link');
      link.id='prumo-ui-current';
      link.rel='stylesheet';
      link.href='prumo-ui-current.css?v=20260924-recurringfix1';
      document.head.appendChild(link);
    }
    return link;
  }

  function ensureScripts(list){
    list.forEach(src=>{
      const file=String(src).split('?')[0];
      if([...document.scripts].some(s=>String(s.getAttribute('src')||'').split('?')[0].endsWith(file)))return;
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      document.body.appendChild(script);
    });
  }

  function ensureProfileSkins(){ensureScripts(PROFILE_SKINS)}
  function ensureFeatureScripts(){ensureScripts(FEATURE_SCRIPTS)}

  function keepThemeLast(){
    if(moving)return;
    const link=ensureThemeLink();
    if(document.head.lastElementChild===link)return;
    moving=true;
    document.head.appendChild(link);
    queueMicrotask(()=>{moving=false});
  }

  function fallbackName(){
    try{
      const meta=currentUser?.user_metadata||{};
      const full=String(meta.full_name||meta.name||meta.nome||'').trim();
      const email=String(currentUser?.email||'').trim();
      const base=full||email.split('@')[0].replace(/[._-]+/g,' ')||'Gabriel';
      return base.split(/\s+/)[0]||'Gabriel';
    }catch(e){return'Gabriel'}
  }

  function profileNickname(){
    const nick=String(document.getElementById('profileNickname')?.value||'').trim();
    return nick||fallbackName();
  }

  function refreshGreeting(){
    const active=document.querySelector('.nav button.active')?.dataset.page||'';
    if(active&&active!=='dashboard')return;
    const title=document.getElementById('pageTitle');
    if(!title)return;
    const hour=new Date().getHours();
    const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
    const wanted=`${greeting}, ${profileNickname()}.`;
    if(title.textContent!==wanted)title.textContent=wanted;
  }

  function normalizeUi(){
    document.documentElement.classList.add('caderno-theme','caderno-dark','caderno-stable');
    document.querySelectorAll('.caderno-profile').forEach(el=>el.setAttribute('hidden',''));
    const title=document.getElementById('pageTitle');
    if(title)title.classList.add('caderno-page-title');
    document.querySelectorAll('.page').forEach(page=>page.classList.add('caderno-page'));
    refreshGreeting();
  }

  function startSplashRelease(){
    if(window.__prumoSplashManagedByApp===true)return;
    const started=performance.now();
    const MIN_VISIBLE=3450;
    const SETTLE_AFTER_READY=520;
    const CHART_LEAD=420;
    let finished=false;
    let chartTriggered=false;
    let pollTimer=0;
    let chartTimer=0;
    let releaseTimer=0;

    let exiting=false;
    const release=()=>{
      if(finished||exiting)return;
      exiting=true;
      clearInterval(pollTimer);
      clearTimeout(chartTimer);
      clearTimeout(releaseTimer);
      const body=document.body;
      let exitMs=650;
      try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)exitMs=0}catch(e){}
      body?.classList.add('caderno-splash-exit');
      setTimeout(()=>{
        finished=true;
        body?.classList.add('caderno-splash-done');
        body?.classList.remove('caderno-splash-exit');
        try{window.dispatchEvent(new CustomEvent('caderno:splash-done'))}catch(e){}
      },exitMs);
    };

    const triggerChart=()=>{
      if(chartTriggered||finished)return;
      chartTriggered=true;
      try{window.dispatchEvent(new CustomEvent('caderno:chart-intro-start'))}catch(e){}
      try{window.financeStartFirstLoadChart?.()}catch(e){}
    };

    const scheduleRelease=(baseDelay,withChart)=>{
      if(finished)return;
      clearInterval(pollTimer);
      clearTimeout(chartTimer);
      clearTimeout(releaseTimer);
      const minRemaining=Math.max(0,MIN_VISIBLE-(performance.now()-started));
      const delay=Math.max(Number(baseDelay)||0,minRemaining);
      if(withChart&&!chartTriggered){
        chartTimer=setTimeout(triggerChart,Math.max(0,delay-CHART_LEAD));
      }
      releaseTimer=setTimeout(release,delay);
    };

    const dashboardReady=()=>{
      const app=document.getElementById('appRoot');
      const month=document.getElementById('monthSelect');
      const opening=String(document.getElementById('kpiOpening')?.textContent||'').trim();
      return window.__prumoInitialModulesReady===true&&!!app&&!app.classList.contains('auth-hidden')&&(month?.options?.length||0)>0&&opening&&opening!=='—';
    };

    pollTimer=setInterval(()=>{
      if(!dashboardReady())return;
      scheduleRelease(SETTLE_AFTER_READY,true);
    },50);

    try{
      const client=typeof sb!=='undefined'?sb:window.sb;
      client?.auth?.getSession?.().then(({data})=>{
        if(!data?.session)scheduleRelease(0,false);
      }).catch(()=>{});
    }catch(e){}

    setTimeout(()=>{
      if(finished)return;
      if(dashboardReady()){
        triggerChart();
        setTimeout(release,CHART_LEAD);
      }
    },8000);
  }

  function boot(){
    ensureThemeLink();
    normalizeUi();
    keepThemeLast();
    ensureProfileSkins();
    ensureFeatureScripts();
    startSplashRelease();

    let queued=false;
    const schedule=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        normalizeUi();
        keepThemeLast();
        ensureProfileSkins();
        ensureFeatureScripts();
      });
    };

    new MutationObserver(schedule).observe(document.head,{childList:true});
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('input',e=>{
      if(e.target?.id==='profileNickname')schedule();
    },true);
    document.addEventListener('click',e=>{
      if(e.target.closest('.nav button,[data-page],.btn,.credit-card'))setTimeout(schedule,0);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
