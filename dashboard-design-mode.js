(function(){
  if(window.__prumoGlobalDesignModeLoaded)return;
  window.__prumoGlobalDesignModeLoaded=true;

  var CONFIG_KEY='dashboard';
  var MODE_CLASS='prumo-global-design-mode';
  var PREVIEW_CLASS='prumo-global-design-preview';
  var STYLE_ID='prumo-global-design-style';

  var KPI_DEFS=[
    {key:'opening',selector:'#kpiOpening'},
    {key:'income',selector:'#kpiIncome'},
    {key:'expense',selector:'#kpiExpense'},
    {key:'invoices',selector:'#kpiInvoices'},
    {key:'closing',selector:'#kpiClosing'}
  ];
  var PANEL_DEFS=[
    {key:'projection',selector:'#projectionChart'},
    {key:'categories',selector:'#categoryList'}
  ];
  var DEFAULT_CONFIG={
    schemaVersion:1,
    dashboard:{
      kpiOrder:['opening','income','expense','invoices','closing'],
      panelOrder:['projection','categories'],
      hidden:{},
      sizes:{}
    }
  };

  var publishedConfig=clone(DEFAULT_CONFIG);
  var draftConfig=clone(DEFAULT_CONFIG);
  var publishedMeta={version:1,published_at:null,updated_at:null};
  var draftMeta={version:1,updated_at:null};
  var isAdmin=false;
  var initialized=false;
  var designMode=false;
  var previewMode=false;
  var dirty=false;
  var dragging=null;
  var refreshTimer=0;
  var applying=false;

  function clone(value){return JSON.parse(JSON.stringify(value))}
  function validOrder(value,defs){
    var allowed=new Set(defs.map(function(x){return x.key}));
    var clean=Array.isArray(value)?value.filter(function(x,i,a){return allowed.has(x)&&a.indexOf(x)===i}):[];
    defs.forEach(function(def){if(!clean.includes(def.key))clean.push(def.key)});
    return clean;
  }
  function normalize(value){
    var src=value&&typeof value==='object'?value:{};
    var dash=src.dashboard&&typeof src.dashboard==='object'?src.dashboard:{};
    var hidden=dash.hidden&&typeof dash.hidden==='object'?dash.hidden:{};
    var sizes=dash.sizes&&typeof dash.sizes==='object'?dash.sizes:{};
    var cleanHidden={},cleanSizes={};
    KPI_DEFS.concat(PANEL_DEFS).forEach(function(def){
      if(hidden[def.key]===true)cleanHidden[def.key]=true;
      var size=String(sizes[def.key]||'normal');
      if(size==='wide'||size==='full')cleanSizes[def.key]=size;
    });
    return {
      schemaVersion:1,
      dashboard:{
        kpiOrder:validOrder(dash.kpiOrder,KPI_DEFS),
        panelOrder:validOrder(dash.panelOrder,PANEL_DEFS),
        hidden:cleanHidden,
        sizes:cleanSizes
      }
    };
  }

  function cardFor(def){
    var target=document.querySelector(def.selector);
    return target?(target.closest('.card')||target.closest('.kpi')):null;
  }
  function activeConfig(){return designMode?draftConfig:publishedConfig}
  function editingChromeVisible(){return designMode&&!previewMode}

  function applyGroup(container,defs,order,config){
    if(!container)return;
    var byKey=new Map();
    defs.forEach(function(def){
      var card=cardFor(def);
      if(!card)return;
      card.dataset.globalUiBlock=def.key;
      byKey.set(def.key,card);
    });
    order.forEach(function(key){
      var card=byKey.get(key);
      if(card)container.appendChild(card);
    });
    defs.forEach(function(def){
      var card=byKey.get(def.key);
      if(!card)return;
      var hidden=!!config.dashboard.hidden[def.key];
      var showGhost=editingChromeVisible()&&hidden;
      card.style.display=hidden&&!showGhost?'none':'';
      card.classList.toggle('prumo-global-design-hidden',showGhost);
      var size=String(config.dashboard.sizes[def.key]||'normal');
      card.dataset.globalUiSize=(size==='wide'||size==='full')?size:'normal';
    });
  }

  function applyConfig(config,redraw){
    if(applying)return;
    applying=true;
    try{
      var normalized=normalize(config);
      applyGroup(document.querySelector('#page-dashboard .grid-kpi'),KPI_DEFS,normalized.dashboard.kpiOrder,normalized);
      applyGroup(document.querySelector('#page-dashboard .dashboard-grid'),PANEL_DEFS,normalized.dashboard.panelOrder,normalized);
      decorateCards();
      updateBar();
      if(redraw!==false){
        requestAnimationFrame(function(){
          try{if(typeof window.redrawFilteredProjection==='function')window.redrawFilteredProjection()}catch(_e){}
        });
      }
    }finally{
      applying=false;
    }
  }

  function applyCurrent(){applyConfig(activeConfig())}

  async function fetchStage(stage){
    var result=await sb.from('app_ui_configs')
      .select('config,version,updated_at,published_at')
      .eq('config_key',CONFIG_KEY)
      .eq('stage',stage)
      .maybeSingle();
    if(result.error)throw result.error;
    return result.data||null;
  }

  async function detectAdmin(){
    if(!currentUser||!currentUser.id)return false;
    var result=await sb.from('user_profiles')
      .select('role,active')
      .eq('user_id',currentUser.id)
      .maybeSingle();
    if(result.error){
      console.warn('Não foi possível verificar permissão administrativa.',result.error);
      return false;
    }
    return result.data&&result.data.role==='admin'&&result.data.active!==false;
  }

  async function loadPublished(force){
    if(!currentUser||!currentUser.id)return false;
    var row=await fetchStage('published');
    if(!row)return false;
    var incomingVersion=Number(row.version)||1;
    if(!force&&initialized&&incomingVersion===Number(publishedMeta.version))return false;
    publishedConfig=normalize(row.config);
    publishedMeta={version:incomingVersion,published_at:row.published_at||null,updated_at:row.updated_at||null};
    if(!designMode)applyConfig(publishedConfig);
    return true;
  }

  async function loadDraft(){
    if(!isAdmin)return false;
    var row=await fetchStage('draft');
    if(row){
      draftConfig=normalize(row.config);
      draftMeta={version:Number(row.version)||Number(publishedMeta.version)||1,updated_at:row.updated_at||null};
    }else{
      draftConfig=clone(publishedConfig);
      draftMeta={version:Number(publishedMeta.version)||1,updated_at:null};
    }
    dirty=false;
    return true;
  }

  function setStatus(message,tone){
    var el=document.getElementById('prumoGlobalDesignStatus');
    if(!el)return;
    el.textContent=message;
    el.dataset.tone=tone||'';
  }

  function updateBar(){
    var save=document.getElementById('prumoGlobalSave');
    var preview=document.getElementById('prumoGlobalPreview');
    if(save)save.disabled=!dirty;
    if(preview)preview.textContent=previewMode?'Voltar a editar':'Pré-visualizar';
  }

  function markDirty(){
    dirty=true;
    updateBar();
    setStatus('Alterações locais não salvas','warning');
  }

  async function saveDraft(quiet){
    if(!isAdmin||!currentUser||!currentUser.id)return false;
    var now=new Date().toISOString();
    var payload={
      config_key:CONFIG_KEY,
      stage:'draft',
      config:normalize(draftConfig),
      version:Number(draftMeta.version)||Number(publishedMeta.version)||1,
      updated_by:currentUser.id,
      updated_at:now,
      published_at:null
    };
    if(!quiet)setStatus('Salvando rascunho…');
    var result=await sb.from('app_ui_configs').upsert(payload,{onConflict:'config_key,stage'});
    if(result.error){
      console.error('Falha ao salvar rascunho global.',result.error);
      setStatus('Falha ao salvar rascunho','error');
      return false;
    }
    draftConfig=normalize(payload.config);
    draftMeta={version:payload.version,updated_at:now};
    dirty=false;
    updateBar();
    if(!quiet)setStatus('Rascunho salvo','success');
    return true;
  }

  async function publishDraft(){
    if(!isAdmin)return;
    var button=document.getElementById('prumoGlobalPublish');
    if(button)button.disabled=true;
    try{
      if(!(await saveDraft(true)))return;
      setStatus('Publicando para todos…');
      var result=await sb.rpc('publish_app_ui_config',{p_config_key:CONFIG_KEY});
      if(result.error)throw result.error;
      var row=Array.isArray(result.data)?result.data[0]:result.data;
      if(!row)throw new Error('Publicação sem retorno.');
      publishedConfig=normalize(row.config);
      publishedMeta={
        version:Number(row.version)||Number(publishedMeta.version)+1,
        published_at:row.published_at||new Date().toISOString(),
        updated_at:new Date().toISOString()
      };
      draftConfig=clone(publishedConfig);
      draftMeta={version:publishedMeta.version,updated_at:publishedMeta.updated_at};
      dirty=false;
      applyConfig(draftConfig);
      setStatus('Publicado para todos · v'+publishedMeta.version,'success');
      updateBar();
    }catch(error){
      console.error('Falha ao publicar layout global.',error);
      setStatus('Falha ao publicar para todos','error');
    }finally{
      if(button)button.disabled=false;
    }
  }

  async function discardDraft(){
    if(!isAdmin)return;
    if(!confirm('Descartar o rascunho e voltar à versão publicada?'))return;
    draftConfig=clone(publishedConfig);
    draftMeta={version:Number(publishedMeta.version)||1,updated_at:new Date().toISOString()};
    dirty=true;
    applyConfig(draftConfig);
    if(await saveDraft(true))setStatus('Rascunho restaurado à versão publicada','success');
  }

  function restoreDefault(){
    if(!isAdmin)return;
    if(!confirm('Aplicar o layout padrão ao rascunho? Ele só chegará aos usuários depois de publicar.'))return;
    draftConfig=clone(DEFAULT_CONFIG);
    markDirty();
    applyConfig(draftConfig);
  }

  function sizeLabel(key,isPanel){
    var size=String(draftConfig.dashboard.sizes[key]||'normal');
    if(size==='full')return '100%';
    if(size==='wide')return isPanel?'100%':'2×';
    return isPanel?'Padrão':'1×';
  }

  function cycleSize(key,isPanel){
    if(!editingChromeVisible())return;
    var current=String(draftConfig.dashboard.sizes[key]||'normal');
    var next;
    if(isPanel)next=current==='normal'?'full':'normal';
    else next=current==='normal'?'wide':current==='wide'?'full':'normal';
    if(next==='normal')delete draftConfig.dashboard.sizes[key];
    else draftConfig.dashboard.sizes[key]=next;
    markDirty();
    applyConfig(draftConfig);
  }

  function toggleHidden(key){
    if(!editingChromeVisible())return;
    if(draftConfig.dashboard.hidden[key])delete draftConfig.dashboard.hidden[key];
    else draftConfig.dashboard.hidden[key]=true;
    markDirty();
    applyConfig(draftConfig);
  }

  function groupForCard(card){
    if(card&&card.parentElement&&card.parentElement.classList.contains('grid-kpi'))return 'kpi';
    if(card&&card.parentElement&&card.parentElement.classList.contains('dashboard-grid'))return 'panel';
    return '';
  }

  function commitDomOrder(group){
    var container=document.querySelector(group==='kpi'?'#page-dashboard .grid-kpi':'#page-dashboard .dashboard-grid');
    if(!container)return;
    var defs=group==='kpi'?KPI_DEFS:PANEL_DEFS;
    var allowed=new Set(defs.map(function(x){return x.key}));
    var order=Array.from(container.children)
      .map(function(x){return x.dataset.globalUiBlock})
      .filter(function(key){return allowed.has(key)});
    if(group==='kpi')draftConfig.dashboard.kpiOrder=order;
    else draftConfig.dashboard.panelOrder=order;
    markDirty();
  }

  function clearDropMarks(){
    document.querySelectorAll('.prumo-global-drop-target').forEach(function(el){el.classList.remove('prumo-global-drop-target')});
  }

  function bindDrag(card){
    if(card.dataset.prumoGlobalDragBound==='1')return;
    card.dataset.prumoGlobalDragBound='1';

    card.addEventListener('dragstart',function(event){
      if(!editingChromeVisible()||event.target.closest('.prumo-global-design-controls')){
        event.preventDefault();
        return;
      }
      dragging=card;
      card.classList.add('prumo-global-dragging');
      try{
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',card.dataset.globalUiBlock||'');
      }catch(_e){}
    });

    card.addEventListener('dragover',function(event){
      if(!dragging||dragging===card||groupForCard(dragging)!==groupForCard(card))return;
      event.preventDefault();
      clearDropMarks();
      var rect=card.getBoundingClientRect();
      var before=(event.clientX-rect.left)<rect.width/2;
      if(before){
        card.classList.add('prumo-global-drop-target');
        card.parentElement.insertBefore(dragging,card);
      }else{
        card.parentElement.insertBefore(dragging,card.nextSibling);
      }
    });

    card.addEventListener('drop',function(event){if(dragging)event.preventDefault()});

    card.addEventListener('dragend',function(){
      if(!dragging)return;
      var group=groupForCard(dragging);
      dragging.classList.remove('prumo-global-dragging');
      clearDropMarks();
      dragging=null;
      if(group)commitDomOrder(group);
      applyConfig(draftConfig);
    });
  }

  function controlsFor(card,key,isPanel){
    var controls=card.querySelector(':scope > .prumo-global-design-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.className='prumo-global-design-controls';
      controls.innerHTML='<span class="prumo-global-handle" title="Arrastar">⋮⋮</span><button type="button" class="prumo-global-control prumo-global-size" data-global-size></button><button type="button" class="prumo-global-control prumo-global-eye" data-global-eye></button>';
      card.appendChild(controls);
      controls.querySelector('[data-global-size]').onclick=function(event){event.stopPropagation();cycleSize(key,isPanel)};
      controls.querySelector('[data-global-eye]').onclick=function(event){event.stopPropagation();toggleHidden(key)};
    }
    var hidden=!!draftConfig.dashboard.hidden[key];
    var size=controls.querySelector('[data-global-size]');
    if(size){size.textContent=sizeLabel(key,isPanel);size.title='Alterar tamanho'}
    var eye=controls.querySelector('[data-global-eye]');
    if(eye){eye.textContent=hidden?'○':'◉';eye.title=hidden?'Mostrar para usuários':'Ocultar dos usuários'}
  }

  function decorateCards(){
    var editing=editingChromeVisible();
    [
      {defs:KPI_DEFS,isPanel:false},
      {defs:PANEL_DEFS,isPanel:true}
    ].forEach(function(group){
      group.defs.forEach(function(def){
        var card=cardFor(def);
        if(!card)return;
        card.dataset.globalUiBlock=def.key;
        card.draggable=editing;
        controlsFor(card,def.key,group.isPanel);
        bindDrag(card);
      });
    });
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=[
      '#prumoGlobalDesignToggle{display:none}',
      'body.prumo-global-admin #prumoGlobalDesignToggle{display:inline-flex}',
      '#prumoGlobalDesignToggle.active{background:#1f6f5d!important;color:#fff!important;border-color:#1f6f5d!important}',
      '#prumoGlobalDesignBar{position:fixed;left:50%;bottom:22px;z-index:2147483000;transform:translateX(-50%) translateY(18px);display:flex;align-items:center;gap:7px;max-width:min(96vw,980px);padding:9px 10px;border:1px solid rgba(130,145,150,.28);border-radius:15px;background:rgba(248,248,244,.96);box-shadow:0 18px 50px rgba(26,39,45,.20);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease}',
      'body.prumo-global-design-mode #prumoGlobalDesignBar{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}',
      '#prumoGlobalDesignStatus{min-width:170px;font:600 10px "DM Mono",monospace;color:#647074;white-space:nowrap;padding:0 7px}',
      '#prumoGlobalDesignStatus[data-tone="success"]{color:#2f7d64}',
      '#prumoGlobalDesignStatus[data-tone="warning"]{color:#966c26}',
      '#prumoGlobalDesignStatus[data-tone="error"]{color:#b75552}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) #page-dashboard .card[data-global-ui-block]{position:relative;outline:1px dashed rgba(54,129,107,.68);outline-offset:3px;cursor:grab;user-select:none}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) #page-dashboard .kpi[data-global-ui-block]:hover{transform:none}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) #page-dashboard .card[data-global-ui-block]:hover{outline-color:#36816b;box-shadow:0 10px 28px rgba(35,48,53,.11)}',
      '.prumo-global-design-controls{position:absolute;right:8px;top:8px;z-index:30;display:none;align-items:center;gap:4px;padding:4px;border:1px solid rgba(99,113,118,.22);border-radius:10px;background:rgba(248,248,244,.96);box-shadow:0 7px 18px rgba(31,43,49,.12);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) .prumo-global-design-controls{display:flex}',
      '.prumo-global-handle{width:25px;height:27px;display:grid;place-items:center;color:#657276;cursor:grab;font-size:15px;letter-spacing:-3px}',
      '.prumo-global-control{height:27px;min-width:28px;border:0;border-radius:7px;background:transparent;color:#435158;display:grid;place-items:center;font:700 9px "DM Mono",monospace;cursor:pointer;padding:0 7px}',
      '.prumo-global-control:hover{background:#e9eee8;color:#245f50}',
      '.prumo-global-eye{font-size:13px;padding:0}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) #page-dashboard .prumo-global-design-hidden{opacity:.38!important;filter:saturate(.5);display:flex!important}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) #page-dashboard .dashboard-grid>.prumo-global-design-hidden{display:block!important}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) #page-dashboard .prumo-global-design-hidden::before{content:"OCULTO";position:absolute;left:10px;top:10px;z-index:29;padding:3px 6px;border-radius:999px;background:#6e7779;color:#fff;font:700 8px "DM Mono",monospace;letter-spacing:.08em}',
      '.prumo-global-dragging{opacity:.32!important}',
      '.prumo-global-drop-target{box-shadow:-5px 0 0 #36816b!important}',
      '@media(min-width:901px){#page-dashboard .grid-kpi>[data-global-ui-size="wide"]{grid-column:span 2}#page-dashboard .grid-kpi>[data-global-ui-size="full"]{grid-column:1/-1}#page-dashboard .dashboard-grid>[data-global-ui-size="wide"],#page-dashboard .dashboard-grid>[data-global-ui-size="full"]{grid-column:1/-1}}',
      '@media(max-width:900px){#page-dashboard .grid-kpi>[data-global-ui-size],#page-dashboard .dashboard-grid>[data-global-ui-size]{grid-column:1/-1}#prumoGlobalDesignBar{bottom:76px;overflow-x:auto;justify-content:flex-start}#prumoGlobalDesignStatus{min-width:120px}}'
    ].join('');
    document.head.appendChild(style);
  }

  async function enterDesignMode(){
    if(!isAdmin)return;
    if(!document.getElementById('page-dashboard')?.classList.contains('active')){
      try{showPage('dashboard')}catch(_e){}
      await new Promise(function(resolve){setTimeout(resolve,0)});
    }
    await loadDraft();
    designMode=true;
    previewMode=false;
    document.body.classList.add(MODE_CLASS);
    document.body.classList.remove(PREVIEW_CLASS);
    var toggle=document.getElementById('prumoGlobalDesignToggle');
    if(toggle){toggle.classList.add('active');toggle.textContent='Editando site'}
    applyConfig(draftConfig);
    setStatus('Rascunho global · v'+draftMeta.version);
    updateBar();
  }

  function exitDesignMode(){
    if(!designMode)return;
    if(dirty&&!confirm('Sair sem salvar as alterações locais?'))return;
    designMode=false;
    previewMode=false;
    dirty=false;
    document.body.classList.remove(MODE_CLASS,PREVIEW_CLASS);
    var toggle=document.getElementById('prumoGlobalDesignToggle');
    if(toggle){toggle.classList.remove('active');toggle.textContent='Editar site'}
    applyConfig(publishedConfig);
  }

  function togglePreview(){
    if(!designMode)return;
    previewMode=!previewMode;
    document.body.classList.toggle(PREVIEW_CLASS,previewMode);
    applyConfig(draftConfig);
    setStatus(previewMode?'Pré-visualização do rascunho':'Editando rascunho global');
    updateBar();
  }

  function installUi(){
    installStyles();
    var actions=document.querySelector('.topbar .actions');
    if(actions&&!document.getElementById('prumoGlobalDesignToggle')){
      var button=document.createElement('button');
      button.type='button';
      button.className='btn';
      button.id='prumoGlobalDesignToggle';
      button.textContent='Editar site';
      button.title='Editar a interface global do Prumo';
      button.onclick=function(){if(designMode)exitDesignMode();else enterDesignMode()};
      actions.insertBefore(button,actions.firstChild);
    }

    if(!document.getElementById('prumoGlobalDesignBar')){
      var bar=document.createElement('div');
      bar.id='prumoGlobalDesignBar';
      bar.innerHTML='<span id="prumoGlobalDesignStatus">Modo Design global</span><button type="button" class="btn small" id="prumoGlobalPreview">Pré-visualizar</button><button type="button" class="btn small" id="prumoGlobalSave">Salvar rascunho</button><button type="button" class="btn small" id="prumoGlobalDiscard">Descartar</button><button type="button" class="btn small" id="prumoGlobalDefault">Layout padrão</button><button type="button" class="btn primary small" id="prumoGlobalPublish">Publicar para todos</button><button type="button" class="btn small" id="prumoGlobalExit">Sair</button>';
      document.body.appendChild(bar);
      bar.querySelector('#prumoGlobalPreview').onclick=togglePreview;
      bar.querySelector('#prumoGlobalSave').onclick=function(){saveDraft(false)};
      bar.querySelector('#prumoGlobalDiscard').onclick=discardDraft;
      bar.querySelector('#prumoGlobalDefault').onclick=restoreDefault;
      bar.querySelector('#prumoGlobalPublish').onclick=publishDraft;
      bar.querySelector('#prumoGlobalExit').onclick=exitDesignMode;
    }
    decorateCards();
  }

  async function refreshPublished(){
    if(!initialized||designMode||document.visibilityState==='hidden')return;
    try{await loadPublished(false)}catch(error){console.warn('Falha ao atualizar interface publicada.',error)}
  }

  function bindRefresh(){
    if(refreshTimer)return;
    window.addEventListener('focus',refreshPublished);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refreshPublished()});
    refreshTimer=setInterval(refreshPublished,300000);
  }

  async function init(){
    if(initialized||!currentUser||!currentUser.id||typeof sb==='undefined')return false;
    try{
      await loadPublished(true);
      isAdmin=await detectAdmin();
      document.body.classList.toggle('prumo-global-admin',isAdmin);
      if(isAdmin)await loadDraft();
      installUi();
      applyConfig(publishedConfig);
      bindRefresh();
      initialized=true;
      try{window.dispatchEvent(new CustomEvent('prumo:global-ui-ready',{detail:{version:publishedMeta.version,isAdmin:isAdmin}}))}catch(_e){}
      return true;
    }catch(error){
      console.error('Falha ao iniciar configuração global da interface.',error);
      return false;
    }
  }

  window.prumoGlobalUi={
    applyCurrent:applyCurrent,
    refreshPublished:refreshPublished,
    isAdmin:function(){return isAdmin},
    isDesignMode:function(){return designMode},
    version:function(){return publishedMeta.version}
  };

  var tries=0;
  var timer=setInterval(async function(){
    tries++;
    if(await init()||tries>160)clearInterval(timer);
  },100);

  window.addEventListener('caderno:splash-done',function(){init();applyCurrent()});
})();