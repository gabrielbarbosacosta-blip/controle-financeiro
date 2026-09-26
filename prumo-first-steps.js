(function(){
  if(window.__prumoFirstStepsLoaded)return;
  window.__prumoFirstStepsLoaded=true;

  var VERSION='v1', userKey='device', card=null, panel=null;
  var defaults={status:'intro',current:0,done:[]};
  var state={status:'intro',current:0,done:[]};
  var steps=[
    {id:'balance',title:'Defina seu saldo inicial',text:'Informe quanto você tem hoje e a data de referência. Esse valor é a base das projeções do Prumo.',action:'Configurar saldo inicial',target:'settings'},
    {id:'income',title:'Cadastre sua primeira receita',text:'Adicione salário, renda extra ou outra entrada. Se for mensal, configure a recorrência para alimentar os próximos meses.',action:'Cadastrar receita',target:'incomes'},
    {id:'expense',title:'Cadastre sua primeira despesa',text:'Inclua contas fixas, parcelas e outros compromissos para o Prumo considerar nas projeções.',action:'Cadastrar despesa',target:'debts'},
    {id:'card',title:'Adicione seus cartões',text:'Cadastre limite, fechamento e vencimento para acompanhar faturas e compras sem duplicar o fluxo de caixa.',action:'Adicionar cartão',target:'cards'},
    {id:'goal',title:'Crie um objetivo',text:'Use um objetivo para acompanhar uma meta financeira individual ou compartilhada.',action:'Abrir Objetivos',target:'goals'},
    {id:'calendar',title:'Ative o calendário',text:'Assine vencimentos e recebimentos no calendário do aparelho.',action:'Configurar calendário',target:'calendar'},
    {id:'install',title:'Instale o Prumo no aparelho',text:'Adicione o Prumo à tela inicial para abrir como aplicativo.',action:'Ver instalação',target:'install'}
  ];

  function storageKey(){return 'prumo:first-steps:'+VERSION+':'+userKey}
  function save(){try{localStorage.setItem(storageKey(),JSON.stringify(state))}catch(_e){}}
  function load(){try{var raw=localStorage.getItem(storageKey());state=raw?Object.assign({},defaults,JSON.parse(raw)):Object.assign({},defaults)}catch(_e){state=Object.assign({},defaults)}}
  async function resolveUser(){
    try{
      var client=(typeof sb!=='undefined'?sb:window.sb);
      if(client&&client.auth&&client.auth.getUser){
        var result=await client.auth.getUser();
        if(result&&result.data&&result.data.user&&result.data.user.id)userKey=result.data.user.id;
      }
    }catch(_e){}
    load();
  }

  function addStyles(){
    if(document.getElementById('prumo-first-steps-style'))return;
    var s=document.createElement('style');s.id='prumo-first-steps-style';
    s.textContent=
      '#prumoFirstStepsCard{margin:0 0 14px;border:1px solid rgba(221,234,172,.22)!important;background:radial-gradient(circle at 0 0,rgba(221,234,172,.10),transparent 34%),linear-gradient(145deg,rgba(13,25,41,.94),rgba(10,21,36,.92))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important;overflow:hidden}'+
      '.pfs-card-inner{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:18px}.pfs-kicker{font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#ddeaac;margin-bottom:6px}.pfs-title{margin:0;color:#f3f7fb;font-size:18px;letter-spacing:-.025em}.pfs-copy{margin:6px 0 0;color:#91a1b4;font-size:11px;line-height:1.5;max-width:680px}.pfs-card-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.pfs-progress{margin-top:12px;height:5px;border-radius:999px;background:#1b2a3d;overflow:hidden;max-width:520px}.pfs-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#65aaff,#ddeaac)}.pfs-meta{margin-top:7px;color:#71849b;font-size:9px;font-weight:750}'+
      '.pfs-panel{position:fixed;right:20px;bottom:20px;z-index:24;width:min(390px,calc(100vw - 28px));border:1px solid rgba(255,255,255,.20);border-radius:22px;background:rgba(10,21,36,.88);-webkit-backdrop-filter:blur(28px) saturate(1.25);backdrop-filter:blur(28px) saturate(1.25);box-shadow:0 24px 70px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);color:#e7edf5;overflow:hidden}.pfs-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 15px 8px}.pfs-panel-head strong{font-size:11px;color:#ddeaac}.pfs-close{appearance:none;border:0;background:transparent;color:#8292a7;font-size:17px;line-height:1;padding:3px 5px;cursor:pointer}.pfs-panel-body{padding:4px 15px 14px}.pfs-step-num{font-size:9px;color:#72849a;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.pfs-step-title{font-size:18px;line-height:1.15;margin:6px 0 7px;color:#f5f7fb;letter-spacing:-.025em}.pfs-step-text{font-size:11px;line-height:1.55;color:#9dadbf;margin:0}.pfs-panel-progress{display:flex;gap:5px;margin:13px 0 14px}.pfs-panel-progress span{height:4px;flex:1;border-radius:999px;background:#223249}.pfs-panel-progress span.done,.pfs-panel-progress span.active{background:#ddeaac}.pfs-panel-actions{display:flex;gap:8px;flex-wrap:wrap}.pfs-panel-actions .btn.primary{margin-left:auto}.pfs-focus-ring{position:fixed;left:0;top:0;z-index:2147482400;pointer-events:none;opacity:0;transform:translate3d(0,0,0);border:1px solid rgba(221,234,172,.62);background:rgba(221,234,172,.045);box-shadow:0 0 0 1px rgba(221,234,172,.08),0 0 16px rgba(221,234,172,.11),inset 0 1px 0 rgba(255,255,255,.09);transition:transform .38s cubic-bezier(.22,1,.36,1),width .38s cubic-bezier(.22,1,.36,1),height .38s cubic-bezier(.22,1,.36,1),border-radius .38s ease,opacity .16s ease;will-change:transform,width,height,opacity;contain:layout style paint}.pfs-focus-ring.visible{opacity:1}.pfs-focus-ring.pulse{animation:pfsFocusPulse .8s ease both}@keyframes pfsFocusPulse{0%,100%{box-shadow:0 0 0 1px rgba(221,234,172,.08),0 0 18px rgba(221,234,172,.12),inset 0 1px 0 rgba(255,255,255,.10)}50%{box-shadow:0 0 0 1px rgba(221,234,172,.18),0 0 26px rgba(221,234,172,.22),inset 0 1px 0 rgba(255,255,255,.14)}}.pfs-settings-card{grid-column:1/-1}.pfs-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px}'+
      '@media(max-width:700px){.pfs-card-inner{grid-template-columns:1fr;padding:15px}.pfs-card-actions{justify-content:flex-start}.pfs-panel{right:12px;left:12px;bottom:calc(96px + env(safe-area-inset-bottom,0px));width:auto}}';
    document.head.appendChild(s);
  }

  function navigate(page){
    var btn=document.querySelector('.sidebar .nav button[data-page="'+page+'"]');
    if(!btn&&(page==='goals'||page==='objectives'))btn=Array.from(document.querySelectorAll('.sidebar .nav button[data-page]')).find(function(b){return /objetiv|meta/i.test(b.textContent||'')})||null;
    if(btn&&!btn.classList.contains('active'))btn.click();
    return btn;
  }
  var focusRing=null,focusHideTimer=null,focusTarget=null,focusPad=5,focusRaf=0;
  function ensureFocusRing(){
    if(focusRing&&document.body.contains(focusRing))return focusRing;
    focusRing=document.createElement('div');
    focusRing.className='pfs-focus-ring';
    document.body.appendChild(focusRing);
    return focusRing;
  }
  function positionFocus(){
    if(!focusTarget||!document.body.contains(focusTarget))return;
    var ring=ensureFocusRing();
    var r=focusTarget.getBoundingClientRect(),pad=focusPad;
    ring.style.transform='translate3d('+(r.left-pad)+'px,'+(r.top-pad)+'px,0)';
    ring.style.width=(r.width+pad*2)+'px';
    ring.style.height=(r.height+pad*2)+'px';
    var radius=parseFloat(getComputedStyle(focusTarget).borderRadius)||10;
    ring.style.borderRadius=(radius+Math.max(2,pad*.55))+'px';
  }
  function scheduleFocusPosition(){
    if(focusRaf)return;
    focusRaf=requestAnimationFrame(function(){
      focusRaf=0;
      positionFocus();
    });
  }
  function placeFocus(el,options){
    options=options||{};
    if(!el)return;
    var ring=ensureFocusRing();
    focusTarget=el;
    focusPad=options.pad==null?5:options.pad;
    clearTimeout(focusHideTimer);
    try{
      var rr=el.getBoundingClientRect();
      if(rr.top<8||rr.bottom>window.innerHeight-8)el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
    }catch(_e){}
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        positionFocus();
        ring.classList.add('visible');
        ring.classList.remove('pulse');
        void ring.offsetWidth;
        ring.classList.add('pulse');
      });
    });
    if(options.duration){
      focusHideTimer=setTimeout(function(){ring.classList.remove('visible');focusTarget=null},options.duration);
    }
  }
  function hideFocus(){
    clearTimeout(focusHideTimer);
    if(focusRaf){cancelAnimationFrame(focusRaf);focusRaf=0}
    if(focusRing)focusRing.classList.remove('visible');
    focusTarget=null;
  }
  window.addEventListener('resize',scheduleFocusPosition,{passive:true});
  window.addEventListener('scroll',scheduleFocusPosition,{passive:true});

  function menuTarget(page){
    var el=document.querySelector('.sidebar .nav button[data-page="'+page+'"]');
    if(!el&&(page==='goals'||page==='objectives'))el=Array.from(document.querySelectorAll('.sidebar .nav button[data-page]')).find(function(b){return /objetiv|meta/i.test(b.textContent||'')})||null;
    if(el)return el;
    el=document.querySelector('.prumo-bottom-nav-item[data-page="'+page+'"]');
    if(!el&&(page==='goals'||page==='objectives'))el=Array.from(document.querySelectorAll('.prumo-bottom-nav-item')).find(function(b){return /objetiv|meta/i.test(b.textContent||'')})||null;
    return el;
  }

  function stagedOpen(page,getButton,openAction,options){
    options=options||{};
    var menu=menuTarget(page);
    if(menu)placeFocus(menu,{duration:900,pad:4});
    setTimeout(function(){
      navigate(page);
      setTimeout(function(){
        var button=typeof getButton==='function'?getButton():null;
        if(button)placeFocus(button,{duration:1000,pad:5});
        setTimeout(function(){
          if(typeof openAction==='function')openAction(button);
        },options.openDelay||900);
      },options.buttonDelay||650);
    },options.menuDelay||800);
  }

  function ensureCard(){
    var dashboard=document.getElementById('page-dashboard');if(!dashboard)return null;
    if(card&&document.body.contains(card))return card;
    card=document.createElement('div');card.id='prumoFirstStepsCard';card.className='card';
    var first=dashboard.querySelector('.grid-kpi');
    if(first)dashboard.insertBefore(card,first);else dashboard.prepend(card);
    return card;
  }
  function renderCard(){
    var el=ensureCard();if(!el)return;
    if(state.status==='skipped'||state.status==='done'){el.style.display='none';return}
    el.style.display='';
    var complete=state.done.length,pct=Math.round((complete/steps.length)*100);
    if(state.status==='intro'){
      el.innerHTML='<div class="pfs-card-inner"><div><div class="pfs-kicker">Primeiros passos</div><h3 class="pfs-title">Vamos configurar o Prumo?</h3><p class="pfs-copy">Comece pelo saldo inicial e passe pelas configurações essenciais. Você pode pular qualquer etapa e voltar depois.</p></div><div class="pfs-card-actions"><button type="button" class="btn" data-pfs-skip-all>Pular por agora</button><button type="button" class="btn primary" data-pfs-start>Começar</button></div></div>';
      el.querySelector('[data-pfs-start]').onclick=start;
      el.querySelector('[data-pfs-skip-all]').onclick=skipAll;
    }else{
      el.innerHTML='<div class="pfs-card-inner"><div><div class="pfs-kicker">Primeiros passos</div><h3 class="pfs-title">Continue sua configuração</h3><p class="pfs-copy">'+complete+' de '+steps.length+' etapas concluídas.</p><div class="pfs-progress"><span style="width:'+pct+'%"></span></div><div class="pfs-meta">'+pct+'% concluído</div></div><div class="pfs-card-actions"><button type="button" class="btn primary" data-pfs-resume>Continuar</button></div></div>';
      el.querySelector('[data-pfs-resume]').onclick=openPanel;
    }
  }

  function ensurePanel(){
    if(panel&&document.body.contains(panel))return panel;
    panel=document.createElement('div');panel.className='pfs-panel';panel.id='prumoFirstStepsPanel';
    panel.innerHTML='<div class="pfs-panel-head"><strong>Primeiros passos</strong><button type="button" class="pfs-close" aria-label="Fechar">✕</button></div><div class="pfs-panel-body"><div class="pfs-step-num"></div><div class="pfs-step-title"></div><p class="pfs-step-text"></p><div class="pfs-panel-progress"></div><div class="pfs-panel-actions"><button type="button" class="btn" data-pfs-skip-step>Pular etapa</button><button type="button" class="btn" data-pfs-done-step>Concluir etapa</button><button type="button" class="btn primary" data-pfs-action></button></div></div>';
    document.body.appendChild(panel);
    panel.querySelector('.pfs-close').onclick=function(){hideFocus();panel.remove();panel=null};
    panel.querySelector('[data-pfs-skip-step]').onclick=function(){advance(false)};
    panel.querySelector('[data-pfs-done-step]').onclick=function(){markStep(steps[state.current].id)};
    panel.querySelector('[data-pfs-action]').onclick=function(){perform(steps[state.current])};
    return panel;
  }
  function renderPanel(){
    if(!panel||!document.body.contains(panel))return;
    if(state.status==='done'){panel.remove();panel=null;return}
    var step=steps[state.current]||steps[0];
    panel.querySelector('.pfs-step-num').textContent='Etapa '+(state.current+1)+' de '+steps.length;
    panel.querySelector('.pfs-step-title').textContent=step.title;
    panel.querySelector('.pfs-step-text').textContent=step.text;
    panel.querySelector('[data-pfs-action]').textContent=step.action;
    panel.querySelector('.pfs-panel-progress').innerHTML=steps.map(function(s,i){return '<span class="'+(state.done.includes(s.id)?'done':i===state.current?'active':'')+'"></span>'}).join('');
  }
  function openPanel(){state.status='active';save();ensurePanel();renderPanel();renderCard()}
  function start(){state.status='active';state.current=0;save();renderCard();openPanel();setTimeout(function(){perform(steps[0])},120)}
  function skipAll(){hideFocus();state.status='skipped';save();renderCard();if(panel){panel.remove();panel=null}}
  function advance(mark){
    var step=steps[state.current];
    if(mark!==false&&step&&!state.done.includes(step.id))state.done.push(step.id);
    if(state.current>=steps.length-1){state.status='done';save();renderCard();if(panel){panel.remove();panel=null}navigate('dashboard');return}
    state.current++;state.status='active';save();renderCard();renderPanel();
  }
  function markStep(id){
    if(!state.done.includes(id))state.done.push(id);
    var idx=steps.findIndex(function(s){return s.id===id});
    if(idx>=0&&state.current<=idx)state.current=Math.min(steps.length-1,idx+1);
    if(state.done.length>=steps.length)state.status='done';else state.status='active';
    save();renderCard();renderPanel();
  }

  function perform(step){
    if(!step)return;
    if(step.target==='settings'){
      var menu=menuTarget('settings');if(menu)placeFocus(menu,{duration:900,pad:4});
      setTimeout(function(){
        navigate('settings');
        setTimeout(function(){
          var field=document.getElementById('setBaseBalance');
          var target=field&&field.closest?field.closest('.card'):field;
          placeFocus(target,{duration:1800,pad:6});
          if(field)try{field.focus({preventScroll:true})}catch(_e){}
        },650);
      },800);
      return;
    }
    if(step.target==='incomes'){
      stagedOpen('incomes',function(){return document.getElementById('addIncomeBtn')},function(button){
        if(button)button.click();else if(typeof window.editIncomePlan==='function')window.editIncomePlan();
      });return;
    }
    if(step.target==='debts'){
      stagedOpen('debts',function(){return document.getElementById('addDebtBtn')},function(button){
        if(button)button.click();else if(typeof window.editDebtPlan==='function')window.editDebtPlan();
      });return;
    }
    if(step.target==='cards'){
      stagedOpen('cards',function(){return document.getElementById('addCardBtn')},function(button){if(button)button.click()});return;
    }
    if(step.target==='goals'){
      stagedOpen('goals',function(){return document.getElementById('addGoalBtn')||document.querySelector('[data-add-goal],.goal-add-button')},function(button){if(button)button.click()},{buttonDelay:750});return;
    }
    if(step.target==='calendar'){
      var settingsMenu=menuTarget('settings');if(settingsMenu)placeFocus(settingsMenu,{duration:900,pad:4});
      setTimeout(function(){
        navigate('settings');
        setTimeout(function(){
          var activate=document.getElementById('calendarActivateBtn');
          placeFocus(activate||document.getElementById('calendarSubscriptionCard'),{duration:1800,pad:6});
        },650);
      },800);
      return;
    }
    if(step.target==='install'){
      var installBtn=document.querySelector('[data-pwa-install],#installPwaBtn,#pwaInstallBtn');
      if(installBtn){placeFocus(installBtn,{duration:1000,pad:5});setTimeout(function(){installBtn.click()},900);return}
      panel.querySelector('.pfs-step-text').textContent='No iPhone: Compartilhar → Adicionar à Tela de Início. No Chrome ou Edge, use a opção Instalar aplicativo no menu do navegador.';
    }
  }

  function syncPanelWithModals(){
    if(!panel||!document.body.contains(panel))return;
    var openModal=document.querySelector('.modal-backdrop.open');
    panel.style.display=openModal?'none':'';
    if(openModal)hideFocus();
  }

  function observeModals(){
    var observer=new MutationObserver(function(){syncPanelWithModals()});
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',function(){setTimeout(syncPanelWithModals,0)},true);
    document.addEventListener('submit',function(){setTimeout(syncPanelWithModals,0)},true);
  }

  function bindHooks(){
    document.addEventListener('click',function(e){
      var id=e.target&&e.target.id||'';
      if(id==='saveSettings'&&state.status==='active'&&steps[state.current]&&steps[state.current].id==='balance')setTimeout(function(){markStep('balance')},350);
      if(id==='calendarActivateBtn'&&state.status==='active'&&steps[state.current]&&steps[state.current].id==='calendar')setTimeout(function(){markStep('calendar')},900);
    },true);
    document.addEventListener('submit',function(e){
      var id=e.target&&e.target.id||'';
      if(id==='incomeForm'&&state.status==='active'&&steps[state.current].id==='income')setTimeout(function(){markStep('income')},500);
      if(id==='debtForm'&&state.status==='active'&&steps[state.current].id==='expense')setTimeout(function(){markStep('expense')},500);
      if(id==='cardForm'&&state.status==='active'&&steps[state.current].id==='card')setTimeout(function(){markStep('card')},500);
      if(/goal/i.test(id)&&state.status==='active'&&steps[state.current].id==='goal')setTimeout(function(){markStep('goal')},500);
    },true);
  }

  function addSettingsEntry(){
    var grid=document.querySelector('#page-settings .settings-grid');if(!grid||document.getElementById('firstStepsSettingsCard'))return;
    var el=document.createElement('div');el.className='card pfs-settings-card';el.id='firstStepsSettingsCard';
    el.innerHTML='<div class="pfs-settings-row"><div><h3>Primeiros passos</h3><p class="muted">Reabra o guia de configuração do Prumo quando quiser.</p></div><button type="button" class="btn" id="openFirstStepsBtn">Abrir guia</button></div>';
    grid.insertBefore(el,grid.querySelector('.prumo-help-card')||grid.querySelector('.danger-zone')||null);
    el.querySelector('#openFirstStepsBtn').onclick=function(){if(state.status==='done'||state.status==='skipped'){state=Object.assign({},defaults,{status:'active'});save();renderCard()}openPanel()};
  }

  async function boot(){
    addStyles();await resolveUser();ensureCard();renderCard();addSettingsEntry();bindHooks();observeModals();
    window.addEventListener('prumo:onboarding-finished',function(){
      if(state.status==='intro'){navigate('dashboard');setTimeout(function(){renderCard();placeFocus(card,{duration:1600,pad:6})},260)}
    });
    window.addEventListener('finance:cloud-ready',function(){setTimeout(function(){ensureCard();renderCard();addSettingsEntry()},180)});
  }

  window.prumoFirstSteps={open:openPanel,start:start,skip:skipAll,reset:async function(){await resolveUser();state=Object.assign({},defaults);save();renderCard();return true}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();