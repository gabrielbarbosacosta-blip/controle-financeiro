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
  var TEXT_DEFS=[
    {key:'dashboardSubtitle',selector:'#pageSubtitle',defaultText:'Aqui está a leitura do seu mês.',dashboardOnly:true},
    {key:'openingLabel',anchor:'#kpiOpening',within:'.label',defaultText:'Saldo inicial'},
    {key:'openingHint',anchor:'#kpiOpening',within:'.hint',defaultText:'Base do mês'},
    {key:'incomeLabel',anchor:'#kpiIncome',within:'.label',defaultText:'Entradas'},
    {key:'incomeHint',anchor:'#kpiIncome',within:'.hint',defaultText:'Receitas recebidas'},
    {key:'expenseLabel',anchor:'#kpiExpense',within:'.label',defaultText:'Saídas'},
    {key:'expenseHint',anchor:'#kpiExpense',within:'.hint',defaultText:'Inclui faturas pagas'},
    {key:'invoicesLabel',anchor:'#kpiInvoices',within:'.label',defaultText:'Faturas pagas'},
    {key:'invoicesHint',anchor:'#kpiInvoices',within:'.hint',defaultText:'Um valor por fatura'},
    {key:'closingLabel',anchor:'#kpiClosing',within:'.label',defaultText:'Saldo final'},
    {key:'projectionTitle',anchor:'#projectionChart',within:'.section-head h3',defaultText:'Saldo projetado'},
    {key:'projectionSubtitle',anchor:'#projectionChart',within:'.section-head .muted',defaultText:'Próximos 12 meses • inclui projeção dos cartões'},
    {key:'categoriesTitle',anchor:'#categoryList',within:'.section-head h3',defaultText:'Gastos por categoria'},
    {key:'categoriesSubtitle',anchor:'#categoryList',within:'.section-head .muted',defaultText:'Compras de cartão são classificadas sem duplicar o caixa'}
  ];
  var DEFAULT_CONFIG={
    schemaVersion:1,
    dashboard:{
      kpiOrder:['opening','income','expense','invoices','closing'],
      panelOrder:['projection','categories'],
      hidden:{},
      sizes:{}
    },
    texts:{}
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
    var incomingTexts=src.texts&&typeof src.texts==='object'?src.texts:(dash.texts&&typeof dash.texts==='object'?dash.texts:{});
    var cleanHidden={},cleanSizes={},cleanTexts={};
    KPI_DEFS.concat(PANEL_DEFS).forEach(function(def){
      if(hidden[def.key]===true)cleanHidden[def.key]=true;
      var size=String(sizes[def.key]||'normal');
      if(size==='wide'||size==='full')cleanSizes[def.key]=size;
    });
    Object.keys(incomingTexts).forEach(function(key){
      var value=incomingTexts[key];
      if(value&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,'text')){
        cleanTexts[key]={text:String(value.text??'').replace(/\s+/g,' ').trim().slice(0,240),selector:String(value.selector||'').slice(0,500),base:String(value.base||'').slice(0,240)};
      }else{
        cleanTexts[key]={text:String(value??'').replace(/\s+/g,' ').trim().slice(0,240),selector:'',base:''};
      }
    });
    return {
      schemaVersion:2,
      dashboard:{
        kpiOrder:validOrder(dash.kpiOrder,KPI_DEFS),
        panelOrder:validOrder(dash.panelOrder,PANEL_DEFS),
        hidden:cleanHidden,
        sizes:cleanSizes
      },
      texts:cleanTexts
    };
  }

  function cardFor(def){
    var target=document.querySelector(def.selector);
    return target?(target.closest('.card')||target.closest('.kpi')):null;
  }
  function textElement(def){
    if(def.selector)return document.querySelector(def.selector);
    var anchor=document.querySelector(def.anchor);
    if(!anchor)return null;
    var scope=anchor.closest('.card')||anchor.closest('.kpi');
    return scope?scope.querySelector(def.within):null;
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

  function slugText(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,54)||'texto';
  }

  function cssEscape(value){
    if(window.CSS&&typeof window.CSS.escape==='function')return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g,function(ch){return '\\'+ch});
  }

  function activePageId(){
    return document.querySelector('.page.active')?.id||'page-dashboard';
  }

  function stableSelector(el,pageId){
    if(!el)return '';
    if(el.id)return '#'+cssEscape(el.id);
    if(el.matches('.nav button[data-page]'))return '.nav button[data-page="'+String(el.dataset.page||'').replace(/"/g,'')+'"]';
    var page=document.getElementById(pageId);
    var root=page||document;
    var tag=el.tagName.toLowerCase();
    var cls=Array.from(el.classList).filter(function(x){return !x.startsWith('prumo-')&&!x.startsWith('active')}).slice(0,2);
    var simple=tag+(cls.length?'.'+cls.map(cssEscape).join('.'):'');
    var candidates=Array.from(root.querySelectorAll(simple));
    var index=candidates.indexOf(el);
    if(page&&index>=0)return '#'+cssEscape(pageId)+' '+simple+':nth-of-type('+(Array.from(el.parentElement?.children||[]).filter(function(x){return x.tagName===el.tagName}).indexOf(el)+1)+')';
    return simple;
  }

  function eligibleTextElement(el){
    if(!el||el.nodeType!==1)return false;
    if(el.closest('#prumoGlobalDesignBar,#prumoGlobalTextEditor,.modal,.modal-backdrop'))return false;
    if(el.matches('input,select,textarea,option,canvas,svg,path,table,thead,tbody,tr,td,th'))return false;
    if(el.closest('table,.category-ranking,.category-donut-hole,.history-sections'))return false;
    if(el.matches('.value,.num,.kpi-pending,.kpi-month-change,.history-section-count,[data-history-body]'))return false;
    if(el.closest('.value,.num,.kpi-pending,.kpi-month-change,[data-history-body]'))return false;
    if(el.children.length>0&&!el.matches('button'))return false;
    var text=String(el.textContent||'').replace(/\s+/g,' ').trim();
    if(!text||text.length>240)return false;
    return el.matches('h1,h2,h3,h4,p,small,label,.label,.hint,.muted,.t,.notice,.nav button,.btn,[role="heading"]');
  }

  function generatedTextKey(el,pageId){
    if(el.id)return 'id:'+el.id;
    if(el.matches('.nav button[data-page]'))return 'nav:'+el.dataset.page;
    var base=String(el.dataset.prumoGlobalBaseText||el.textContent||'').replace(/\s+/g,' ').trim();
    var kind=el.tagName.toLowerCase();
    if(el.classList.contains('label'))kind='label';
    else if(el.classList.contains('hint'))kind='hint';
    else if(el.classList.contains('muted'))kind='muted';
    else if(el.classList.contains('btn'))kind='button';
    return pageId+':'+kind+':'+slugText(base);
  }

  function discoverTextSlots(){
    var slots=[];
    var seen=new Set();
    var pageId=activePageId();
    var activePage=document.getElementById(pageId);
    var roots=[];
    if(activePage)roots.push(activePage);
    var nav=document.querySelector('.nav');if(nav)roots.push(nav);
    var title=document.getElementById('pageTitle');if(title)roots.push(title);
    var subtitle=document.getElementById('pageSubtitle');if(subtitle)roots.push(subtitle);

    roots.forEach(function(root){
      var nodes=[];
      if(eligibleTextElement(root))nodes.push(root);
      if(root.querySelectorAll)nodes=nodes.concat(Array.from(root.querySelectorAll('h1,h2,h3,h4,p,small,label,.label,.hint,.muted,.t,.notice,.nav button,.btn,[role="heading"]')));
      nodes.forEach(function(el){
        if(!eligibleTextElement(el)||seen.has(el))return;
        seen.add(el);
        if(!el.dataset.prumoGlobalBaseText)el.dataset.prumoGlobalBaseText=String(el.textContent||'').replace(/\s+/g,' ').trim();
        var routePage=el.id==='pageTitle'||el.id==='pageSubtitle'?pageId:pageId;
        var key=(el.id==='pageTitle'||el.id==='pageSubtitle')?'route:'+routePage+':'+el.id:generatedTextKey(el,routePage);
        var selector=stableSelector(el,routePage);
        slots.push({key:key,selector:selector,base:el.dataset.prumoGlobalBaseText,el:el});
      });
    });
    return slots;
  }

  function applyTextConfig(config){
    var normalized=normalize(config);
    var texts=normalized.texts||{};
    var slots=discoverTextSlots();
    slots.forEach(function(slot){
      var override=texts[slot.key];
      if(!override)return;
      var value=String(override.text??'');
      if(slot.el.textContent!==value)slot.el.textContent=value;
    });
    decorateTexts();
  }

  function closeTextEditor(){
    document.getElementById('prumoGlobalTextEditor')?.remove();
  }

  function openTextEditor(slot){
    if(!editingChromeVisible()||!slot||!slot.el)return;
    closeTextEditor();
    var editor=document.createElement('div');
    editor.id='prumoGlobalTextEditor';
    var current=draftConfig.texts?.[slot.key]?.text;
    if(current==null)current=String(slot.el.textContent||'').replace(/\s+/g,' ').trim();
    editor.innerHTML='<div class="prumo-text-editor-head"><strong>Editar texto</strong><span>'+slot.key.replace(/</g,'&lt;')+'</span></div><textarea maxlength="240"></textarea><div class="prumo-text-editor-actions"><button type="button" class="btn small" data-text-reset>Restaurar</button><button type="button" class="btn small" data-text-cancel>Cancelar</button><button type="button" class="btn primary small" data-text-save>Aplicar</button></div>';
    document.body.appendChild(editor);
    var area=editor.querySelector('textarea');
    area.value=current;
    var rect=slot.el.getBoundingClientRect();
    var width=Math.min(420,Math.max(280,rect.width+80));
    editor.style.width=width+'px';
    var left=Math.min(window.innerWidth-width-12,Math.max(12,rect.left));
    var top=Math.min(window.innerHeight-editor.offsetHeight-12,Math.max(12,rect.bottom+8));
    editor.style.left=left+'px';
    editor.style.top=top+'px';
    area.focus();
    area.select();

    function saveValue(value,reset){
      draftConfig.texts=draftConfig.texts||{};
      var clean=String(value??'').replace(/\s+/g,' ').trim().slice(0,240);
      if(reset||clean===slot.base){
        delete draftConfig.texts[slot.key];
        slot.el.textContent=slot.base;
      }else{
        draftConfig.texts[slot.key]={text:clean,selector:slot.selector,base:slot.base};
        slot.el.textContent=clean;
      }
      markDirty();
      closeTextEditor();
      decorateTexts();
    }

    editor.querySelector('[data-text-save]').onclick=function(){saveValue(area.value,false)};
    editor.querySelector('[data-text-reset]').onclick=function(){saveValue(slot.base,true)};
    editor.querySelector('[data-text-cancel]').onclick=closeTextEditor;
    area.addEventListener('keydown',function(event){
      if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveValue(area.value,false)}
      if(event.key==='Escape'){event.preventDefault();closeTextEditor()}
    });
  }

  function bindEditableText(slot){
    var el=slot.el;
    if(!el||el.dataset.prumoGlobalTextBound==='1')return;
    el.dataset.prumoGlobalTextBound='1';
    el.addEventListener('pointerdown',function(event){
      if(editingChromeVisible()){
        event.stopPropagation();
      }
    });
    el.addEventListener('click',function(event){
      if(!editingChromeVisible())return;
      event.preventDefault();
      event.stopPropagation();
      openTextEditor({
        key:el.dataset.globalTextKey,
        selector:el.dataset.globalTextSelector||'',
        base:el.dataset.prumoGlobalBaseText||'',
        el:el
      });
    });
  }

  function decorateTexts(){
    discoverTextSlots().forEach(function(slot){
      var el=slot.el;
      el.dataset.globalTextKey=slot.key;
      el.dataset.globalTextSelector=slot.selector;
      el.title=editingChromeVisible()?'Clique para editar este texto':'';
      bindEditableText(slot);
    });
  }


  function applyConfig(config,redraw){
    if(applying)return;
    applying=true;
    try{
      var normalized=normalize(config);
      applyGroup(document.querySelector('#page-dashboard .grid-kpi'),KPI_DEFS,normalized.dashboard.kpiOrder,normalized);
      applyGroup(document.querySelector('#page-dashboard .dashboard-grid'),PANEL_DEFS,normalized.dashboard.panelOrder,normalized);
      applyTextConfig(normalized);
      decorateCards();
      decorateTexts();
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
      if(!editingChromeVisible()||event.target.closest('.prumo-global-design-controls')||event.target.closest('[data-global-text-key]')){
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
      '#prumoGlobalDesignNav{display:none}',
      'body.prumo-global-admin #prumoGlobalDesignNav{display:flex;align-items:center;gap:8px;margin-top:10px;border-top:1px solid rgba(120,135,140,.18);padding-top:14px}',
      '#prumoGlobalDesignNav.prumo-design-active{background:rgba(54,129,107,.12)!important;color:#2f7d64!important}',
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
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) [data-global-text-key]{cursor:text;border-radius:5px;transition:background .12s ease,outline-color .12s ease}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) [data-global-text-key]:hover{background:rgba(54,129,107,.08);outline:1px dashed rgba(54,129,107,.45);outline-offset:3px}',
      '#prumoGlobalTextEditor{position:fixed;z-index:2147483646;padding:12px;border:1px solid rgba(99,113,118,.28);border-radius:14px;background:rgba(248,248,244,.98);box-shadow:0 18px 50px rgba(26,39,45,.24);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}',
      '#prumoGlobalTextEditor .prumo-text-editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:#34434b}',
      '#prumoGlobalTextEditor .prumo-text-editor-head strong{font-size:12px}',
      '#prumoGlobalTextEditor .prumo-text-editor-head span{font:500 8px "DM Mono",monospace;color:#7a8588;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#prumoGlobalTextEditor textarea{display:block;width:100%;min-height:76px;resize:vertical;border:1px solid #cfd6d2;border-radius:9px;background:#fff;color:#25343d;padding:10px;font:500 13px system-ui;outline:none}',
      '#prumoGlobalTextEditor textarea:focus{border-color:#5f9b88;box-shadow:0 0 0 3px rgba(54,129,107,.10)}',
      '#prumoGlobalTextEditor .prumo-text-editor-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:9px}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) [data-global-text-key]{cursor:text;border-radius:5px;transition:background .12s ease,outline-color .12s ease}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) [data-global-text-key]:hover{background:rgba(54,129,107,.08);outline:1px dashed rgba(54,129,107,.45);outline-offset:3px}',
      'body.prumo-global-design-mode:not(.prumo-global-design-preview) [data-global-text-key].prumo-global-text-editing{background:#fffef9;outline:2px solid rgba(54,129,107,.72);outline-offset:4px;cursor:text;user-select:text;min-width:24px}',

      '@media(min-width:901px){#page-dashboard .grid-kpi>[data-global-ui-size="wide"]{grid-column:span 2}#page-dashboard .grid-kpi>[data-global-ui-size="full"]{grid-column:1/-1}#page-dashboard .dashboard-grid>[data-global-ui-size="wide"],#page-dashboard .dashboard-grid>[data-global-ui-size="full"]{grid-column:1/-1}}',
      '@media(max-width:900px){#page-dashboard .grid-kpi>[data-global-ui-size],#page-dashboard .dashboard-grid>[data-global-ui-size]{grid-column:1/-1}#prumoGlobalDesignBar{bottom:76px;overflow-x:auto;justify-content:flex-start}#prumoGlobalDesignStatus{min-width:120px}}'
    ].join('');
    document.head.appendChild(style);
  }

  async function enterDesignMode(){
    if(!isAdmin)return;
    await loadDraft();
    designMode=true;
    previewMode=false;
    document.body.classList.add(MODE_CLASS);
    document.body.classList.remove(PREVIEW_CLASS);
    var toggle=document.getElementById('prumoGlobalDesignNav');
    if(toggle){toggle.classList.add('prumo-design-active');toggle.innerHTML='<span aria-hidden="true">✎</span> Editando site'}
    applyConfig(draftConfig);
    setStatus('Rascunho v'+draftMeta.version+' · clique nos textos');
    updateBar();
  }

  function exitDesignMode(){
    if(!designMode)return;
    if(dirty&&!confirm('Sair sem salvar as alterações locais?'))return;
    closeTextEditor();
    designMode=false;
    previewMode=false;
    dirty=false;
    document.body.classList.remove(MODE_CLASS,PREVIEW_CLASS);
    var toggle=document.getElementById('prumoGlobalDesignNav');
    if(toggle){toggle.classList.remove('prumo-design-active');toggle.innerHTML='<span aria-hidden="true">✎</span> Editar site'}
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
    document.getElementById('prumoGlobalDesignNav')?.remove();
    var nav=document.querySelector('.sidebar .nav');
    if(nav&&!document.getElementById('prumoGlobalDesignNav')){
      var button=document.createElement('button');
      button.type='button';
      button.id='prumoGlobalDesignNav';
      button.className='prumo-global-design-nav';
      button.innerHTML='<span aria-hidden="true">✎</span> Editar site';
      button.title='Editar a interface global do Prumo';
      button.onclick=function(event){
        event.preventDefault();
        event.stopPropagation();
        if(designMode)exitDesignMode();else enterDesignMode();
      };
      nav.appendChild(button);
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
    decorateTexts();

    var main=document.querySelector('main.main');
    if(main&&!main.__prumoGlobalTextObserver){
      var queued=false;
      var observer=new MutationObserver(function(mutations){
        if(applying||queued)return;
        var relevant=mutations.some(function(m){
          return m.type==='childList'||(m.type==='attributes'&&m.attributeName==='class');
        });
        if(!relevant)return;
        queued=true;
        requestAnimationFrame(function(){
          queued=false;
          applyTextConfig(activeConfig());
          decorateTexts();
        });
      });
      observer.observe(main,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
      main.__prumoGlobalTextObserver=observer;
    }

    if(!document.body.__prumoGlobalTextNavBound){
      document.body.__prumoGlobalTextNavBound=true;
      document.addEventListener('click',function(event){
        if(event.target.closest('#prumoGlobalDesignNav,#prumoGlobalDesignBar,#prumoGlobalTextEditor'))return;
        if(!event.target.closest('.nav button,[data-page]'))return;
        setTimeout(function(){
          applyTextConfig(activeConfig());
          decorateTexts();
        },0);
      },true);
    }
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