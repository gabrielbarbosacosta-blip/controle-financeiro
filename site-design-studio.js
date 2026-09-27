(function(){
  if(window.__prumoSiteDesignStudioLoaded)return;
  window.__prumoSiteDesignStudioLoaded=true;

  var CONFIG_KEY='dashboard';
  var MODE_CLASS='prumo-site-design-mode';
  var PREVIEW_CLASS='prumo-site-design-preview';
  var ADMIN_CLASS='prumo-site-design-admin';
  var STYLE_ID='prumo-site-design-style';

  var DASHBOARD_KPIS=[
    {key:'opening',selector:'#kpiOpening'},
    {key:'income',selector:'#kpiIncome'},
    {key:'expense',selector:'#kpiExpense'},
    {key:'invoices',selector:'#kpiInvoices'},
    {key:'closing',selector:'#kpiClosing'}
  ];
  var DASHBOARD_PANELS=[
    {key:'projection',selector:'#projectionChart'},
    {key:'categories',selector:'#categoryList'}
  ];

  var DEFAULT_CONFIG={
    schemaVersion:3,
    dashboard:{
      kpiOrder:['opening','income','expense','invoices','closing'],
      panelOrder:['projection','categories'],
      hidden:{},
      sizes:{}
    },
    texts:{},
    customTexts:[],
    cards:{},
    orders:{}
  };

  var publishedConfig=clone(DEFAULT_CONFIG);
  var draftConfig=clone(DEFAULT_CONFIG);
  var publishedMeta={version:1,published_at:null,updated_at:null};
  var draftMeta={version:1,updated_at:null};
  var currentIsAdmin=false;
  var initialized=false;
  var designMode=false;
  var previewMode=false;
  var dirty=false;
  var applying=false;
  var refreshTimer=0;
  var observerTimer=0;
  var routeBaseTexts={};
  var dragCard=null;
  var dragCustomId=null;

  function clone(value){return JSON.parse(JSON.stringify(value))}
  function uid(prefix){return (prefix||'x')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
  function clamp(n,min,max){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min}
  function slug(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,56)||'item'}
  function cssEscape(value){
    if(window.CSS&&typeof window.CSS.escape==='function')return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g,function(ch){return '\\'+ch});
  }
  function cleanText(value,max){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max||300)}
  function activePage(){return document.querySelector('.page.active')}
  function activePageId(){return activePage()?.id||'page-dashboard'}
  function editable(){return designMode&&!previewMode}

  function validOrder(value,defs){
    var allowed=new Set(defs.map(function(x){return x.key}));
    var clean=Array.isArray(value)?value.filter(function(x,i,a){return allowed.has(x)&&a.indexOf(x)===i}):[];
    defs.forEach(function(def){if(!clean.includes(def.key))clean.push(def.key)});
    return clean;
  }

  function normalizeTextOverride(value){
    if(value&&typeof value==='object'){
      return {
        text:cleanText(value.text,300),
        selector:String(value.selector||'').slice(0,600),
        base:cleanText(value.base,300),
        pageId:String(value.pageId||'').slice(0,120),
        deleted:value.deleted===true,
        fontSize:value.fontSize==null?null:clamp(value.fontSize,8,64),
        fontWeight:['400','500','600','700','800'].includes(String(value.fontWeight))?String(value.fontWeight):null,
        align:['left','center','right'].includes(String(value.align))?String(value.align):null
      };
    }
    return {text:cleanText(value,300),selector:'',base:'',pageId:'',deleted:false,fontSize:null,fontWeight:null,align:null};
  }

  function normalize(value){
    var src=value&&typeof value==='object'?value:{};
    var dash=src.dashboard&&typeof src.dashboard==='object'?src.dashboard:{};
    var hidden=dash.hidden&&typeof dash.hidden==='object'?dash.hidden:{};
    var sizes=dash.sizes&&typeof dash.sizes==='object'?dash.sizes:{};
    var sourceTexts=src.texts&&typeof src.texts==='object'?src.texts:(dash.texts&&typeof dash.texts==='object'?dash.texts:{});
    var cleanHidden={},cleanSizes={},texts={},cards={},orders={};

    DASHBOARD_KPIS.concat(DASHBOARD_PANELS).forEach(function(def){
      if(hidden[def.key]===true)cleanHidden[def.key]=true;
      var s=String(sizes[def.key]||'normal');
      if(s==='wide'||s==='full')cleanSizes[def.key]=s;
    });

    Object.keys(sourceTexts).forEach(function(key){texts[key]=normalizeTextOverride(sourceTexts[key])});

    var sourceCards=src.cards&&typeof src.cards==='object'?src.cards:{};
    Object.keys(sourceCards).forEach(function(key){
      var card=sourceCards[key]||{};
      cards[key]={
        selector:String(card.selector||'').slice(0,600),
        pageId:String(card.pageId||'').slice(0,120),
        hidden:card.hidden===true,
        width:['normal','wide','full'].includes(String(card.width))?String(card.width):'normal',
        padding:card.padding==null?null:clamp(card.padding,0,64),
        radius:card.radius==null?null:clamp(card.radius,0,40),
        minHeight:card.minHeight==null?null:clamp(card.minHeight,0,720)
      };
    });

    var sourceOrders=src.orders&&typeof src.orders==='object'?src.orders:{};
    Object.keys(sourceOrders).forEach(function(key){
      if(Array.isArray(sourceOrders[key]))orders[key]=sourceOrders[key].map(String).slice(0,80);
    });

    var customTexts=Array.isArray(src.customTexts)?src.customTexts.map(function(item,index){
      item=item||{};
      return {
        id:String(item.id||('text_'+index)).slice(0,100),
        pageId:String(item.pageId||'page-dashboard').slice(0,120),
        text:cleanText(item.text||'Novo texto',500),
        deleted:item.deleted===true,
        width:[4,6,8,12].includes(Number(item.width))?Number(item.width):12,
        padding:clamp(item.padding==null?18:item.padding,0,64),
        radius:clamp(item.radius==null?10:item.radius,0,40),
        fontSize:clamp(item.fontSize==null?16:item.fontSize,9,48),
        fontWeight:['400','500','600','700','800'].includes(String(item.fontWeight))?String(item.fontWeight):'600',
        align:['left','center','right'].includes(String(item.align))?String(item.align):'left',
        variant:['card','plain'].includes(String(item.variant))?String(item.variant):'card'
      };
    }).filter(function(item,i,a){return item.id&&a.findIndex(function(x){return x.id===item.id})===i}):[];

    return {
      schemaVersion:3,
      dashboard:{
        kpiOrder:validOrder(dash.kpiOrder,DASHBOARD_KPIS),
        panelOrder:validOrder(dash.panelOrder,DASHBOARD_PANELS),
        hidden:cleanHidden,
        sizes:cleanSizes
      },
      texts:texts,
      customTexts:customTexts,
      cards:cards,
      orders:orders
    };
  }

  function activeConfig(){return designMode?draftConfig:publishedConfig}

  function dashboardCardFor(def){
    var target=document.querySelector(def.selector);
    return target?(target.closest('.card')||target.closest('.kpi')):null;
  }

  function applyLegacyDashboard(config){
    var page=document.getElementById('page-dashboard');
    if(!page)return;
    var groups=[
      {container:page.querySelector('.grid-kpi'),defs:DASHBOARD_KPIS,order:config.dashboard.kpiOrder},
      {container:page.querySelector('.dashboard-grid'),defs:DASHBOARD_PANELS,order:config.dashboard.panelOrder}
    ];
    groups.forEach(function(group){
      if(!group.container)return;
      var map=new Map();
      group.defs.forEach(function(def){
        var card=dashboardCardFor(def);
        if(card)map.set(def.key,card);
      });
      var desired=group.order.filter(function(key){return map.has(key)});
      var current=Array.from(group.container.children).map(function(card){
        for(var pair of map.entries()){if(pair[1]===card)return pair[0]}
        return null;
      }).filter(Boolean);
      if(desired.join('|')!==current.join('|')){
        desired.forEach(function(key){var card=map.get(key);if(card)group.container.appendChild(card)});
      }
      group.defs.forEach(function(def){
        var card=map.get(def.key);if(!card)return;
        var hidden=!!config.dashboard.hidden[def.key];
        var ghost=editable()&&hidden;
        card.style.display=hidden&&!ghost?'none':'';
        card.classList.toggle('prumo-design-hidden',ghost);
        var size=String(config.dashboard.sizes[def.key]||'normal');
        card.dataset.prumoLegacySize=(size==='wide'||size==='full')?size:'normal';
      });
    });
  }

  function routeBaseKey(el,pageId){return pageId+':'+el.id}

  function eligibleTextElement(el){
    if(!el||el.nodeType!==1)return false;
    if(el.closest('#prumoDesignBar,#prumoDesignTextEditor,#prumoDesignCardEditor,#prumoDesignFab,.prumo-design-card-tools,.prumo-custom-text-tools,.modal,.modal-backdrop'))return false;
    if(el.matches('input,select,textarea,option,canvas,svg,path,table,thead,tbody,tr,td,th'))return false;
    if(el.closest('table,.category-ranking,.category-donut-hole,[data-history-body]'))return false;
    if(el.matches('.value,.num,.kpi-pending,.kpi-month-change,.history-section-count,.category-donut-hole *'))return false;
    if(el.closest('.value,.num,.kpi-pending,.kpi-month-change,[data-history-body]'))return false;
    if(el.children.length>0&&!el.matches('.nav button'))return false;
    var text=cleanText(el.textContent,400);
    if(!text)return false;
    return el.matches('h1,h2,h3,h4,p,small,label,.label,.hint,.muted,.notice,.btn,.nav button,[role="heading"]');
  }

  function stableSelector(el,pageId){
    if(el.id)return '#'+cssEscape(el.id);
    if(el.matches('.nav button[data-page]'))return '.nav button[data-page="'+String(el.dataset.page||'').replace(/"/g,'')+'"]';
    var page=document.getElementById(pageId);
    var root=page||document;
    var parent=el.parentElement;
    if(!parent)return '';
    var tag=el.tagName.toLowerCase();
    var siblings=Array.from(parent.children).filter(function(x){return x.tagName===el.tagName});
    var nth=siblings.indexOf(el)+1;
    var parentId=parent.id?'#'+cssEscape(parent.id):'';
    if(parentId)return parentId+' > '+tag+':nth-of-type('+nth+')';
    if(page){
      var all=Array.from(root.querySelectorAll(tag));
      var idx=all.indexOf(el)+1;
      return '#'+cssEscape(pageId)+' '+tag+':nth-of-type('+Math.max(1,idx)+')';
    }
    return tag;
  }

  function textSlotKey(el,pageId,base){
    if(el.id==='pageTitle'||el.id==='pageSubtitle')return 'route:'+pageId+':'+el.id;
    if(el.id)return 'id:'+el.id;
    if(el.matches('.nav button[data-page]'))return 'nav:'+el.dataset.page;
    var kind=el.tagName.toLowerCase();
    if(el.classList.contains('label'))kind='label';
    else if(el.classList.contains('hint'))kind='hint';
    else if(el.classList.contains('muted'))kind='muted';
    else if(el.classList.contains('btn'))kind='button';
    return pageId+':'+kind+':'+slug(base);
  }

  function discoverTextSlots(){
    var pageId=activePageId();
    var page=activePage();
    var roots=[];
    if(page)roots.push(page);
    var title=document.getElementById('pageTitle');if(title)roots.push(title);
    var subtitle=document.getElementById('pageSubtitle');if(subtitle)roots.push(subtitle);
    var nav=document.querySelector('.nav');if(nav)roots.push(nav);

    var slots=[],seen=new Set(),counts={};
    roots.forEach(function(root){
      var nodes=[];
      if(eligibleTextElement(root))nodes.push(root);
      if(root.querySelectorAll){
        nodes=nodes.concat(Array.from(root.querySelectorAll('h1,h2,h3,h4,p,small,label,.label,.hint,.muted,.notice,.btn,.nav button,[role="heading"]')));
      }
      nodes.forEach(function(el){
        if(!eligibleTextElement(el)||seen.has(el))return;
        seen.add(el);
        var current=cleanText(el.textContent,400);
        var isRoute=el.id==='pageTitle'||el.id==='pageSubtitle';
        var base;
        if(isRoute){
          var rk=routeBaseKey(el,pageId);
          if(!routeBaseTexts[rk])routeBaseTexts[rk]=current;
          base=routeBaseTexts[rk];
        }else{
          if(!el.dataset.prumoBaseText)el.dataset.prumoBaseText=current;
          base=el.dataset.prumoBaseText;
        }
        var raw=textSlotKey(el,pageId,base);
        counts[raw]=(counts[raw]||0)+1;
        var key=raw+(counts[raw]>1?':'+counts[raw]:'');
        slots.push({key:key,pageId:pageId,selector:stableSelector(el,pageId),base:base,el:el});
      });
    });
    return slots;
  }

  function applyTextStyles(el,override){
    el.style.removeProperty('--prumo-text-design');
    if(override.fontSize!=null)el.style.fontSize=override.fontSize+'px';
    else el.style.removeProperty('font-size');
    if(override.fontWeight)el.style.fontWeight=override.fontWeight;
    else el.style.removeProperty('font-weight');
    if(override.align)el.style.textAlign=override.align;
    else el.style.removeProperty('text-align');
  }

  function applyTextOverrides(config){
    var texts=config.texts||{};
    discoverTextSlots().forEach(function(slot){
      var el=slot.el;
      var override=texts[slot.key];
      el.dataset.prumoTextKey=slot.key;
      el.dataset.prumoTextSelector=slot.selector;
      el.dataset.prumoTextPage=slot.pageId;
      el.dataset.prumoBaseText=slot.base;
      el.classList.remove('prumo-design-text-deleted');
      if(!override){
        if(el.dataset.prumoAppliedText==='1'){
          if(el.textContent!==slot.base)el.textContent=slot.base;
          delete el.dataset.prumoAppliedText;
        }
        el.style.removeProperty('display');
        applyTextStyles(el,{});
        return;
      }
      if(override.deleted){
        if(editable()){
          el.style.removeProperty('display');
          el.classList.add('prumo-design-text-deleted');
          var ghostText=override.text||slot.base||'Texto excluído';
          if(el.textContent!==ghostText)el.textContent=ghostText;
        }else{
          el.style.display='none';
        }
      }else{
        el.style.removeProperty('display');
        if(el.textContent!==override.text)el.textContent=override.text;
      }
      el.dataset.prumoAppliedText='1';
      applyTextStyles(el,override);
    });
  }

  function cardKey(card,pageId){
    if(card.dataset.prumoCardKey)return card.dataset.prumoCardKey;
    var key;
    if(card.id)key='id:'+card.id;
    else{
      var parent=card.parentElement;
      var cards=parent?Array.from(parent.children).filter(function(x){return x.classList&&x.classList.contains('card')&&!x.classList.contains('prumo-custom-text-box')}):[];
      key=pageId+':card:'+(cards.indexOf(card)+1);
    }
    card.dataset.prumoCardKey=key;
    return key;
  }

  function cardSelector(card,pageId){
    if(card.id)return '#'+cssEscape(card.id);
    var parent=card.parentElement;
    if(!parent)return '';
    var cards=Array.from(parent.children).filter(function(x){return x.classList&&x.classList.contains('card')&&!x.classList.contains('prumo-custom-text-box')});
    var idx=cards.indexOf(card)+1;
    var parentSel=parent.id?'#'+cssEscape(parent.id):('#'+cssEscape(pageId)+' .'+cssEscape((Array.from(parent.classList)[0]||'page')));
    return parentSel+' > .card:nth-of-type('+Math.max(1,idx)+')';
  }

  function containerKey(container,pageId){
    if(!container)return '';
    if(container.id)return pageId+':container:id:'+container.id;
    if(container.dataset.prumoContainerKey)return container.dataset.prumoContainerKey;
    var cls=Array.from(container.classList||[]).filter(function(x){return !x.startsWith('prumo-')}).slice(0,2).join('.');
    var siblings=container.parentElement?Array.from(container.parentElement.children).filter(function(x){return x.tagName===container.tagName}):[];
    var key=pageId+':container:'+slug(cls||container.tagName)+':'+(siblings.indexOf(container)+1);
    container.dataset.prumoContainerKey=key;
    return key;
  }

  function activeCards(){
    var page=activePage();
    if(!page)return [];
    return Array.from(page.querySelectorAll('.card')).filter(function(card){
      return !card.closest('.modal,.modal-backdrop')&&!card.classList.contains('prumo-custom-text-box')&&!card.closest('#prumoDesignCardEditor');
    });
  }

  function applyCardOrders(config){
    var page=activePage();
    if(!page)return;
    var pageId=page.id;
    var byParent=new Map();
    activeCards().forEach(function(card){
      var parent=card.parentElement;
      if(!parent)return;
      if(!byParent.has(parent))byParent.set(parent,[]);
      byParent.get(parent).push(card);
    });
    byParent.forEach(function(cards,parent){
      var key=containerKey(parent,pageId);
      var order=config.orders?.[key];
      if(!Array.isArray(order)||!order.length)return;
      var map=new Map(cards.map(function(card){return [cardKey(card,pageId),card]}));
      var desired=order.filter(function(cardId){return map.has(cardId)});
      var current=cards.map(function(card){return cardKey(card,pageId)});
      if(desired.join('|')!==current.join('|')){
        desired.forEach(function(cardId){var card=map.get(cardId);if(card)parent.appendChild(card)});
      }
    });
  }

  function applyCardOverrides(config){
    var page=activePage();
    if(!page)return;
    var pageId=page.id;
    activeCards().forEach(function(card){
      var key=cardKey(card,pageId);
      var entry=config.cards?.[key]||null;
      card.dataset.prumoCardSelector=cardSelector(card,pageId);
      card.dataset.prumoCardPage=pageId;
      card.classList.remove('prumo-design-card-hidden');
      card.style.removeProperty('display');
      card.style.removeProperty('grid-column');
      card.style.removeProperty('padding');
      card.style.removeProperty('border-radius');
      card.style.removeProperty('min-height');
      if(!entry)return;
      if(entry.hidden){
        if(editable()){
          card.style.removeProperty('display');
          card.classList.add('prumo-design-card-hidden');
        }else{
          card.style.display='none';
        }
      }else{
        card.style.removeProperty('display');
      }
      if(entry.width==='wide')card.style.gridColumn='span 2';
      if(entry.width==='full')card.style.gridColumn='1 / -1';
      if(entry.padding!=null)card.style.padding=entry.padding+'px';
      if(entry.radius!=null)card.style.borderRadius=entry.radius+'px';
      if(entry.minHeight!=null&&entry.minHeight>0)card.style.minHeight=entry.minHeight+'px';
    });
  }

  function customHost(pageId,position){
    var page=document.getElementById(pageId);
    if(!page)return null;
    var selector='.prumo-custom-text-host[data-position="'+position+'"]';
    var host=page.querySelector(selector);
    if(!host){
      host=document.createElement('div');
      host.className='prumo-custom-text-host';
      host.dataset.position=position;
      if(position==='top')page.prepend(host);else page.appendChild(host);
    }
    return host;
  }

  function renderCustomTexts(config){
    document.querySelectorAll('.prumo-custom-text-host').forEach(function(host){host.innerHTML=''});
    var page=activePage();
    if(!page)return;
    var pageId=page.id;
    var items=(config.customTexts||[]).filter(function(x){return x.pageId===pageId&&!x.deleted});
    if(!items.length)return;
    var host=customHost(pageId,'top');
    items.forEach(function(item){
      var box=document.createElement('div');
      box.className='prumo-custom-text-box '+(item.variant==='plain'?'is-plain':'is-card');
      box.dataset.customTextId=item.id;
      box.style.gridColumn='span '+item.width;
      box.style.padding=item.padding+'px';
      box.style.borderRadius=item.radius+'px';
      box.style.textAlign=item.align;
      var text=document.createElement('div');
      text.className='prumo-custom-text-content';
      text.textContent=item.text;
      text.style.fontSize=item.fontSize+'px';
      text.style.fontWeight=item.fontWeight;
      box.appendChild(text);
      host.appendChild(box);
    });
  }

  function applyConfig(config,redraw){
    if(applying)return;
    applying=true;
    try{
      var normalized=normalize(config);
      applyLegacyDashboard(normalized);
      applyCardOrders(normalized);
      applyCardOverrides(normalized);
      renderCustomTexts(normalized);
      applyTextOverrides(normalized);
      decorate();
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
    if(!currentUser?.id)return false;
    var result=await sb.from('user_profiles').select('role,active').eq('user_id',currentUser.id).maybeSingle();
    if(result.error){console.warn('Falha ao verificar perfil administrativo.',result.error);return false}
    return result.data?.role==='admin'&&result.data?.active!==false;
  }

  async function loadPublished(force){
    if(!currentUser?.id)return false;
    var row=await fetchStage('published');
    if(!row)return false;
    var version=Number(row.version)||1;
    if(!force&&initialized&&version===Number(publishedMeta.version))return false;
    publishedConfig=normalize(row.config);
    publishedMeta={version:version,published_at:row.published_at||null,updated_at:row.updated_at||null};
    if(!designMode)applyConfig(publishedConfig);
    return true;
  }

  async function loadDraft(){
    if(!currentIsAdmin)return false;
    var row=await fetchStage('draft');
    if(row){
      draftConfig=normalize(row.config);
      draftMeta={version:Number(row.version)||Number(publishedMeta.version)||1,updated_at:row.updated_at||null};
    }else{
      draftConfig=clone(publishedConfig);
      draftMeta={version:Number(publishedMeta.version)||1,updated_at:null};
    }
    dirty=false;
    updateToolbar();
    return true;
  }

  function setStatus(message,tone){
    var el=document.getElementById('prumoDesignStatus');
    if(!el)return;
    el.textContent=message;
    el.dataset.tone=tone||'';
  }

  function markDirty(message){
    dirty=true;
    updateToolbar();
    setStatus(message||'Rascunho com alterações não salvas','warning');
  }

  function updateToolbar(){
    var save=document.getElementById('prumoDesignSave');
    var preview=document.getElementById('prumoDesignPreview');
    if(save)save.disabled=!dirty;
    if(preview)preview.textContent=previewMode?'Voltar a editar':'Pré-visualizar';
  }

  async function saveDraft(quiet){
    if(!currentIsAdmin||!currentUser?.id)return false;
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
      console.error('Falha ao salvar rascunho.',result.error);
      setStatus('Falha ao salvar rascunho','error');
      return false;
    }
    draftConfig=normalize(payload.config);
    draftMeta={version:payload.version,updated_at:now};
    dirty=false;
    updateToolbar();
    if(!quiet)setStatus('Rascunho salvo','success');
    return true;
  }

  async function publishDraft(){
    if(!currentIsAdmin)return;
    var button=document.getElementById('prumoDesignPublish');
    if(button)button.disabled=true;
    try{
      if(!(await saveDraft(true)))return;
      setStatus('Publicando para todos…');
      var result=await sb.rpc('publish_app_ui_config',{p_config_key:CONFIG_KEY});
      if(result.error)throw result.error;
      var row=Array.isArray(result.data)?result.data[0]:result.data;
      if(!row)throw new Error('Publicação sem retorno.');
      publishedConfig=normalize(row.config);
      publishedMeta={version:Number(row.version)||Number(publishedMeta.version)+1,published_at:row.published_at||new Date().toISOString(),updated_at:new Date().toISOString()};
      draftConfig=clone(publishedConfig);
      draftMeta={version:publishedMeta.version,updated_at:publishedMeta.updated_at};
      dirty=false;
      applyConfig(draftConfig);
      setStatus('Publicado para todos · v'+publishedMeta.version,'success');
      updateToolbar();
    }catch(error){
      console.error('Falha ao publicar Design Studio.',error);
      setStatus('Falha ao publicar para todos','error');
    }finally{
      if(button)button.disabled=false;
    }
  }

  async function discardDraft(){
    if(!currentIsAdmin)return;
    if(!confirm('Descartar o rascunho e voltar para a versão publicada?'))return;
    draftConfig=clone(publishedConfig);
    draftMeta={version:Number(publishedMeta.version)||1,updated_at:new Date().toISOString()};
    dirty=true;
    applyConfig(draftConfig);
    if(await saveDraft(true))setStatus('Rascunho restaurado para a versão publicada','success');
  }

  function removePanel(){
    document.getElementById('prumoDesignTextEditor')?.remove();
    document.getElementById('prumoDesignCardEditor')?.remove();
  }

  function panelPosition(panel,target,width){
    var rect=target?.getBoundingClientRect();
    var w=width||360;
    panel.style.width=Math.min(w,window.innerWidth-24)+'px';
    var left=rect?Math.min(window.innerWidth-w-12,Math.max(12,rect.left)):Math.max(12,(window.innerWidth-w)/2);
    var top=rect?Math.min(window.innerHeight-220,Math.max(12,rect.bottom+8)):80;
    panel.style.left=Math.max(12,left)+'px';
    panel.style.top=Math.max(12,top)+'px';
  }

  function openTextEditor(slot){
    if(!editable()||!slot?.el)return;
    removePanel();
    var current=draftConfig.texts?.[slot.key]||normalizeTextOverride({text:slot.el.textContent,base:slot.base,selector:slot.selector,pageId:slot.pageId});
    var panel=document.createElement('div');
    panel.id='prumoDesignTextEditor';
    panel.className='prumo-design-panel';
    panel.innerHTML=
      '<div class="prumo-design-panel-head"><div><strong>Texto</strong><small>'+slot.key.replace(/</g,'&lt;')+'</small></div><button type="button" class="prumo-panel-x">×</button></div>'+
      '<textarea maxlength="300"></textarea>'+
      '<div class="prumo-field-row"><label>Tamanho<input type="number" min="8" max="64" step="1" data-font-size></label><label>Peso<select data-font-weight><option value="">Original</option><option>400</option><option>500</option><option>600</option><option>700</option><option>800</option></select></label><label>Alinhar<select data-align><option value="">Original</option><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div>'+
      '<div class="prumo-design-panel-actions"><button type="button" class="btn small danger" data-delete>Excluir texto</button><button type="button" class="btn small" data-reset>Restaurar</button><button type="button" class="btn small" data-cancel>Cancelar</button><button type="button" class="btn primary small" data-apply>Aplicar</button></div>';
    document.body.appendChild(panel);
    var area=panel.querySelector('textarea');
    area.value=current.deleted?(current.text||slot.base):cleanText(current.text||slot.el.textContent,300);
    panel.querySelector('[data-font-size]').value=current.fontSize||'';
    panel.querySelector('[data-font-weight]').value=current.fontWeight||'';
    panel.querySelector('[data-align]').value=current.align||'';
    panelPosition(panel,slot.el,420);
    area.focus();area.select();

    function store(deleted,reset){
      draftConfig.texts=draftConfig.texts||{};
      if(reset){
        delete draftConfig.texts[slot.key];
      }else{
        draftConfig.texts[slot.key]={
          text:cleanText(area.value,300),
          selector:slot.selector,
          base:slot.base,
          pageId:slot.pageId,
          deleted:deleted===true,
          fontSize:panel.querySelector('[data-font-size]').value?clamp(panel.querySelector('[data-font-size]').value,8,64):null,
          fontWeight:panel.querySelector('[data-font-weight]').value||null,
          align:panel.querySelector('[data-align]').value||null
        };
      }
      markDirty(deleted?'Texto excluído no rascunho':'Texto alterado no rascunho');
      removePanel();
      applyConfig(draftConfig,false);
    }

    panel.querySelector('.prumo-panel-x').onclick=removePanel;
    panel.querySelector('[data-cancel]').onclick=removePanel;
    panel.querySelector('[data-apply]').onclick=function(){store(false,false)};
    panel.querySelector('[data-reset]').onclick=function(){store(false,true)};
    panel.querySelector('[data-delete]').onclick=function(){store(true,false)};
  }

  function customById(id){return draftConfig.customTexts.find(function(x){return x.id===id})}

  function openCustomEditor(id){
    if(!editable())return;
    var item=customById(id);
    if(!item)return;
    removePanel();
    var target=document.querySelector('.prumo-custom-text-box[data-custom-text-id="'+cssEscape(id)+'"]');
    var panel=document.createElement('div');
    panel.id='prumoDesignTextEditor';
    panel.className='prumo-design-panel';
    panel.innerHTML=
      '<div class="prumo-design-panel-head"><div><strong>Caixa de texto</strong><small>'+item.pageId+'</small></div><button type="button" class="prumo-panel-x">×</button></div>'+
      '<textarea maxlength="500"></textarea>'+
      '<div class="prumo-field-row"><label>Largura<select data-width><option value="4">1/3</option><option value="6">1/2</option><option value="8">2/3</option><option value="12">100%</option></select></label><label>Tamanho<input type="number" min="9" max="48" data-font-size></label><label>Peso<select data-weight><option>400</option><option>500</option><option>600</option><option>700</option><option>800</option></select></label></div>'+
      '<div class="prumo-field-row"><label>Padding<input type="number" min="0" max="64" data-padding></label><label>Raio<input type="number" min="0" max="40" data-radius></label><label>Alinhar<select data-align><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div>'+
      '<div class="prumo-field-row"><label>Estilo<select data-variant><option value="card">Card</option><option value="plain">Sem caixa</option></select></label></div>'+
      '<div class="prumo-design-panel-actions"><button type="button" class="btn small danger" data-delete>Excluir caixa</button><button type="button" class="btn small" data-cancel>Cancelar</button><button type="button" class="btn primary small" data-apply>Aplicar</button></div>';
    document.body.appendChild(panel);
    panel.querySelector('textarea').value=item.text;
    panel.querySelector('[data-width]').value=String(item.width);
    panel.querySelector('[data-font-size]').value=item.fontSize;
    panel.querySelector('[data-weight]').value=item.fontWeight;
    panel.querySelector('[data-padding]').value=item.padding;
    panel.querySelector('[data-radius]').value=item.radius;
    panel.querySelector('[data-align]').value=item.align;
    panel.querySelector('[data-variant]').value=item.variant;
    panelPosition(panel,target,440);

    panel.querySelector('.prumo-panel-x').onclick=removePanel;
    panel.querySelector('[data-cancel]').onclick=removePanel;
    panel.querySelector('[data-delete]').onclick=function(){
      draftConfig.customTexts=draftConfig.customTexts.filter(function(x){return x.id!==id});
      markDirty('Caixa de texto removida do rascunho');
      removePanel();applyConfig(draftConfig,false);
    };
    panel.querySelector('[data-apply]').onclick=function(){
      item.text=cleanText(panel.querySelector('textarea').value,500)||'Texto';
      item.width=Number(panel.querySelector('[data-width]').value)||12;
      item.fontSize=clamp(panel.querySelector('[data-font-size]').value,9,48);
      item.fontWeight=panel.querySelector('[data-weight]').value||'600';
      item.padding=clamp(panel.querySelector('[data-padding]').value,0,64);
      item.radius=clamp(panel.querySelector('[data-radius]').value,0,40);
      item.align=panel.querySelector('[data-align]').value||'left';
      item.variant=panel.querySelector('[data-variant]').value||'card';
      markDirty('Caixa de texto ajustada');
      removePanel();applyConfig(draftConfig,false);
    };
  }

  function addTextBox(){
    if(!editable())return;
    var page=activePage();if(!page)return;
    var item={
      id:uid('text'),
      pageId:page.id,
      text:'Novo texto',
      deleted:false,
      width:12,
      padding:18,
      radius:10,
      fontSize:16,
      fontWeight:'600',
      align:'left',
      variant:'card'
    };
    draftConfig.customTexts.push(item);
    markDirty('Nova caixa de texto adicionada');
    applyConfig(draftConfig,false);
    requestAnimationFrame(function(){openCustomEditor(item.id)});
  }

  function openCardEditor(card){
    if(!editable()||!card)return;
    removePanel();
    var pageId=activePageId();
    var key=cardKey(card,pageId);
    var current=draftConfig.cards[key]||{selector:cardSelector(card,pageId),pageId:pageId,hidden:false,width:'normal',padding:null,radius:null,minHeight:null};
    var computed=getComputedStyle(card);
    var panel=document.createElement('div');
    panel.id='prumoDesignCardEditor';
    panel.className='prumo-design-panel';
    panel.innerHTML=
      '<div class="prumo-design-panel-head"><div><strong>Ajustar card</strong><small>'+key+'</small></div><button type="button" class="prumo-panel-x">×</button></div>'+
      '<div class="prumo-field-row"><label>Largura<select data-width><option value="normal">Padrão</option><option value="wide">Largo</option><option value="full">100%</option></select></label><label>Padding<input type="number" min="0" max="64" data-padding></label><label>Raio<input type="number" min="0" max="40" data-radius></label></div>'+
      '<div class="prumo-field-row"><label>Altura mínima<input type="number" min="0" max="720" data-height></label><label class="prumo-check"><input type="checkbox" data-visible> Visível</label></div>'+
      '<div class="prumo-design-panel-actions"><button type="button" class="btn small" data-reset>Restaurar card</button><button type="button" class="btn small" data-cancel>Cancelar</button><button type="button" class="btn primary small" data-apply>Aplicar</button></div>';
    document.body.appendChild(panel);
    panel.querySelector('[data-width]').value=current.width||'normal';
    panel.querySelector('[data-padding]').value=current.padding==null?parseInt(computed.paddingTop)||0:current.padding;
    panel.querySelector('[data-radius]').value=current.radius==null?parseInt(computed.borderRadius)||0:current.radius;
    panel.querySelector('[data-height]').value=current.minHeight||0;
    panel.querySelector('[data-visible]').checked=!current.hidden;
    panelPosition(panel,card,400);

    panel.querySelector('.prumo-panel-x').onclick=removePanel;
    panel.querySelector('[data-cancel]').onclick=removePanel;
    panel.querySelector('[data-reset]').onclick=function(){
      delete draftConfig.cards[key];
      markDirty('Card restaurado no rascunho');
      removePanel();applyConfig(draftConfig,false);
    };
    panel.querySelector('[data-apply]').onclick=function(){
      draftConfig.cards[key]={
        selector:cardSelector(card,pageId),
        pageId:pageId,
        hidden:!panel.querySelector('[data-visible]').checked,
        width:panel.querySelector('[data-width]').value||'normal',
        padding:clamp(panel.querySelector('[data-padding]').value,0,64),
        radius:clamp(panel.querySelector('[data-radius]').value,0,40),
        minHeight:clamp(panel.querySelector('[data-height]').value,0,720)
      };
      markDirty('Card ajustado no rascunho');
      removePanel();applyConfig(draftConfig,false);
    };
  }

  function clearDropMarks(){document.querySelectorAll('.prumo-design-drop-target').forEach(function(x){x.classList.remove('prumo-design-drop-target')})}

  function bindCard(card){
    if(card.dataset.prumoDesignCardBound==='1')return;
    card.dataset.prumoDesignCardBound='1';
    card.addEventListener('dragover',function(event){
      if(!editable()||!dragCard||dragCard===card||dragCard.parentElement!==card.parentElement)return;
      event.preventDefault();
      clearDropMarks();
      var rect=card.getBoundingClientRect();
      var before=(event.clientX-rect.left)<rect.width/2;
      card.classList.add('prumo-design-drop-target');
      if(before)card.parentElement.insertBefore(dragCard,card);
      else card.parentElement.insertBefore(dragCard,card.nextSibling);
    });
    card.addEventListener('drop',function(event){if(dragCard)event.preventDefault()});
  }

  function cardTools(card){
    var tools=card.querySelector(':scope > .prumo-design-card-tools');
    if(tools)return tools;
    tools=document.createElement('div');
    tools.className='prumo-design-card-tools';
    tools.innerHTML='<span class="prumo-card-drag" draggable="true" title="Arrastar">⋮⋮</span><button type="button" title="Ajustar card">Ajustar</button>';
    card.appendChild(tools);
    tools.querySelector('button').onclick=function(event){event.stopPropagation();openCardEditor(card)};
    var handle=tools.querySelector('.prumo-card-drag');
    handle.addEventListener('dragstart',function(event){
      if(!editable()){event.preventDefault();return}
      dragCard=card;
      card.classList.add('prumo-design-dragging');
      try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',card.dataset.prumoCardKey||'card')}catch(_e){}
    });
    handle.addEventListener('dragend',function(){
      if(!dragCard)return;
      var pageId=activePageId();
      var parent=dragCard.parentElement;
      var key=containerKey(parent,pageId);
      var order=Array.from(parent.children).filter(function(x){return x.classList?.contains('card')&&!x.classList.contains('prumo-custom-text-box')}).map(function(x){return cardKey(x,pageId)});
      draftConfig.orders[key]=order;
      dragCard.classList.remove('prumo-design-dragging');
      dragCard=null;clearDropMarks();
      markDirty('Ordem dos cards alterada');
    });
    return tools;
  }

  function bindTextSlot(slot){
    var el=slot.el;
    if(el.dataset.prumoDesignTextBound==='1')return;
    el.dataset.prumoDesignTextBound='1';
    el.addEventListener('click',function(event){
      if(!editable())return;
      if(event.target.closest('.prumo-design-card-tools'))return;
      event.preventDefault();
      event.stopPropagation();
      openTextEditor({
        key:el.dataset.prumoTextKey,
        pageId:el.dataset.prumoTextPage||activePageId(),
        selector:el.dataset.prumoTextSelector||'',
        base:el.dataset.prumoBaseText||cleanText(el.textContent,300),
        el:el
      });
    });
  }

  function decorateCustomTexts(){
    document.querySelectorAll('.prumo-custom-text-box').forEach(function(box){
      var id=box.dataset.customTextId;
      var content=box.querySelector('.prumo-custom-text-content');
      if(content&&!content.dataset.prumoCustomBound){
        content.dataset.prumoCustomBound='1';
        content.onclick=function(event){if(!editable())return;event.stopPropagation();openCustomEditor(id)};
      }
      if(!box.querySelector('.prumo-custom-text-tools')){
        var tools=document.createElement('div');
        tools.className='prumo-custom-text-tools';
        tools.innerHTML='<span draggable="true" title="Arrastar">⋮⋮</span><button type="button">Editar</button><button type="button" data-remove>×</button>';
        box.appendChild(tools);
        tools.querySelector('button:not([data-remove])').onclick=function(event){event.stopPropagation();openCustomEditor(id)};
        tools.querySelector('[data-remove]').onclick=function(event){
          event.stopPropagation();
          draftConfig.customTexts=draftConfig.customTexts.filter(function(x){return x.id!==id});
          markDirty('Caixa de texto excluída');
          applyConfig(draftConfig,false);
        };
        var handle=tools.querySelector('span');
        handle.addEventListener('dragstart',function(event){
          if(!editable()){event.preventDefault();return}
          dragCustomId=id;
          try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id)}catch(_e){}
        });
        handle.addEventListener('dragend',function(){dragCustomId=null});
      }
      box.addEventListener('dragover',function(event){
        if(!editable()||!dragCustomId||dragCustomId===id)return;
        event.preventDefault();
        var from=draftConfig.customTexts.findIndex(function(x){return x.id===dragCustomId});
        var to=draftConfig.customTexts.findIndex(function(x){return x.id===id});
        if(from<0||to<0)return;
        var moved=draftConfig.customTexts.splice(from,1)[0];
        draftConfig.customTexts.splice(to,0,moved);
        markDirty('Ordem das caixas de texto alterada');
        renderCustomTexts(draftConfig);
        decorateCustomTexts();
      });
    });
  }

  function decorate(){
    discoverTextSlots().forEach(function(slot){
      slot.el.dataset.prumoTextKey=slot.key;
      slot.el.dataset.prumoTextSelector=slot.selector;
      slot.el.dataset.prumoTextPage=slot.pageId;
      slot.el.dataset.prumoBaseText=slot.base;
      slot.el.title=editable()?'Clique para editar texto':'';
      bindTextSlot(slot);
    });

    activeCards().forEach(function(card){
      cardTools(card);
      bindCard(card);
    });

    decorateCustomTexts();
  }

  function resetActivePage(){
    if(!editable())return;
    var pageId=activePageId();
    if(!confirm('Restaurar as personalizações da tela atual no rascunho?'))return;
    Object.keys(draftConfig.texts).forEach(function(key){if(draftConfig.texts[key]?.pageId===pageId||key.startsWith('route:'+pageId+':')||key.startsWith(pageId+':'))delete draftConfig.texts[key]});
    Object.keys(draftConfig.cards).forEach(function(key){if(draftConfig.cards[key]?.pageId===pageId||key.startsWith(pageId+':'))delete draftConfig.cards[key]});
    Object.keys(draftConfig.orders).forEach(function(key){if(key.startsWith(pageId+':'))delete draftConfig.orders[key]});
    draftConfig.customTexts=draftConfig.customTexts.filter(function(x){return x.pageId!==pageId});
    if(pageId==='page-dashboard')draftConfig.dashboard=clone(DEFAULT_CONFIG.dashboard);
    markDirty('Tela restaurada no rascunho');
    applyConfig(draftConfig,false);
  }

  function togglePreview(){
    if(!designMode)return;
    removePanel();
    previewMode=!previewMode;
    document.body.classList.toggle(PREVIEW_CLASS,previewMode);
    applyConfig(draftConfig,false);
    setStatus(previewMode?'Pré-visualização do rascunho':'Editando '+activePageId().replace('page-',''));
    updateToolbar();
  }

  async function enterDesignMode(){
    if(!currentIsAdmin)return;
    await loadDraft();
    designMode=true;previewMode=false;
    document.body.classList.add(MODE_CLASS);
    document.body.classList.remove(PREVIEW_CLASS);
    document.querySelectorAll('[data-prumo-design-launcher]').forEach(function(x){x.classList.add('active')});
    applyConfig(draftConfig,false);
    setStatus('Design Studio · '+activePageId().replace('page-',''));
    updateToolbar();
  }

  function exitDesignMode(){
    if(!designMode)return;
    if(dirty&&!confirm('Sair do Modo Design sem salvar as alterações locais?'))return;
    removePanel();
    designMode=false;previewMode=false;dirty=false;
    document.body.classList.remove(MODE_CLASS,PREVIEW_CLASS);
    document.querySelectorAll('[data-prumo-design-launcher]').forEach(function(x){x.classList.remove('active')});
    applyConfig(publishedConfig,false);
  }

  function launcherButton(kind){
    var button=document.createElement('button');
    button.type='button';
    button.dataset.prumoDesignLauncher='1';
    button.className=kind==='top'?'btn prumo-design-launcher-top':'prumo-design-launcher-nav';
    button.innerHTML='<span aria-hidden="true">✎</span> Editar site';
    button.title='Abrir Design Studio global';
    button.onclick=function(event){event.preventDefault();event.stopPropagation();if(designMode)exitDesignMode();else enterDesignMode()};
    return button;
  }

  function installLaunchers(){
    document.querySelectorAll('[data-prumo-design-launcher]').forEach(function(x){x.remove()});
    var nav=document.querySelector('.sidebar .nav');
    if(nav)nav.appendChild(launcherButton('nav'));
    var actions=document.querySelector('.topbar .actions');
    if(actions)actions.insertBefore(launcherButton('top'),actions.firstChild);
    if(!document.getElementById('prumoDesignFab')){
      var fab=launcherButton('fab');
      fab.id='prumoDesignFab';
      fab.className='prumo-design-fab';
      fab.innerHTML='✎';
      fab.setAttribute('aria-label','Editar site');
      document.body.appendChild(fab);
    }
  }

  function installToolbar(){
    if(document.getElementById('prumoDesignBar'))return;
    var bar=document.createElement('div');
    bar.id='prumoDesignBar';
    bar.innerHTML=
      '<span id="prumoDesignStatus">Design Studio</span>'+
      '<button type="button" class="btn small" id="prumoDesignAddText">+ Texto</button>'+
      '<button type="button" class="btn small" id="prumoDesignPreview">Pré-visualizar</button>'+
      '<button type="button" class="btn small" id="prumoDesignSave">Salvar rascunho</button>'+
      '<button type="button" class="btn small" id="prumoDesignResetPage">Restaurar tela</button>'+
      '<button type="button" class="btn small" id="prumoDesignDiscard">Descartar</button>'+
      '<button type="button" class="btn primary small" id="prumoDesignPublish">Publicar para todos</button>'+
      '<button type="button" class="btn small" id="prumoDesignExit">Sair</button>';
    document.body.appendChild(bar);
    bar.querySelector('#prumoDesignAddText').onclick=addTextBox;
    bar.querySelector('#prumoDesignPreview').onclick=togglePreview;
    bar.querySelector('#prumoDesignSave').onclick=function(){saveDraft(false)};
    bar.querySelector('#prumoDesignResetPage').onclick=resetActivePage;
    bar.querySelector('#prumoDesignDiscard').onclick=discardDraft;
    bar.querySelector('#prumoDesignPublish').onclick=publishDraft;
    bar.querySelector('#prumoDesignExit').onclick=exitDesignMode;
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=[
      '[data-prumo-design-launcher],#prumoDesignFab{display:none!important}',
      'body.'+ADMIN_CLASS+' .prumo-design-launcher-nav{display:flex!important;align-items:center;gap:9px;margin-top:10px;padding-top:13px;border-top:1px solid rgba(110,125,130,.18)}',
      'body.'+ADMIN_CLASS+' .prumo-design-launcher-top{display:inline-flex!important;align-items:center;gap:6px}',
      'body.'+ADMIN_CLASS+' #prumoDesignFab{display:grid!important;place-items:center;position:fixed;right:18px;bottom:18px;z-index:2147482500;width:44px;height:44px;border:1px solid rgba(72,104,95,.24);border-radius:50%;background:#f7f7f1;color:#2f7d64;box-shadow:0 12px 30px rgba(32,47,51,.18);font-size:18px;cursor:pointer}',
      'body.'+MODE_CLASS+' #prumoDesignFab{display:none!important}',
      '[data-prumo-design-launcher].active{background:rgba(54,129,107,.12)!important;color:#2f7d64!important}',
      '#prumoDesignBar{position:fixed;left:50%;bottom:18px;z-index:2147483000;transform:translateX(-50%) translateY(18px);display:flex;align-items:center;gap:7px;max-width:min(97vw,1120px);padding:9px 10px;border:1px solid rgba(130,145,150,.28);border-radius:15px;background:rgba(248,248,244,.97);box-shadow:0 18px 50px rgba(26,39,45,.20);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);opacity:0;pointer-events:none;transition:.18s ease;overflow-x:auto}',
      'body.'+MODE_CLASS+' #prumoDesignBar{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}',
      '#prumoDesignStatus{min-width:155px;font:600 10px "DM Mono",monospace;color:#647074;white-space:nowrap;padding:0 7px}',
      '#prumoDesignStatus[data-tone="success"]{color:#2f7d64}#prumoDesignStatus[data-tone="warning"]{color:#966c26}#prumoDesignStatus[data-tone="error"]{color:#b75552}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') [data-prumo-text-key],body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') [data-prumo-text-key]{cursor:text}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') [data-prumo-text-key]:hover{background:rgba(54,129,107,.08);outline:1px dashed rgba(54,129,107,.48);outline-offset:3px;border-radius:4px}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') .prumo-design-text-deleted{display:inline-block!important;opacity:.38;text-decoration:line-through}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') .card:not(.prumo-custom-text-box){position:relative;outline:1px dashed rgba(54,129,107,.45);outline-offset:3px}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') .card.prumo-design-card-hidden{display:block!important;opacity:.35;filter:saturate(.45)}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') .card.prumo-design-card-hidden::before{content:"OCULTO";position:absolute;left:9px;top:9px;z-index:40;padding:3px 6px;border-radius:999px;background:#6e7779;color:#fff;font:700 8px "DM Mono",monospace}',
      '.prumo-design-card-tools{display:none;position:absolute;right:8px;top:8px;z-index:50;align-items:center;gap:4px;padding:4px;border:1px solid rgba(99,113,118,.22);border-radius:9px;background:rgba(248,248,244,.96);box-shadow:0 7px 18px rgba(31,43,49,.12)}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') .prumo-design-card-tools{display:flex}',
      '.prumo-design-card-tools button{border:0;background:transparent;border-radius:6px;padding:5px 7px;font:600 9px system-ui;color:#435158;cursor:pointer}.prumo-design-card-tools button:hover{background:#e8eee9}',
      '.prumo-card-drag,.prumo-custom-text-tools span{width:25px;height:24px;display:grid;place-items:center;cursor:grab;color:#697579;letter-spacing:-3px}',
      '.prumo-design-dragging{opacity:.28!important}.prumo-design-drop-target{box-shadow:-5px 0 0 #36816b!important}',
      '.prumo-custom-text-host{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;margin:0 0 14px}',
      '.prumo-custom-text-box{position:relative;min-width:0}.prumo-custom-text-box.is-card{background:var(--panel,#fff);border:1px solid var(--line,#ddd)}.prumo-custom-text-box.is-plain{background:transparent;border:0}',
      '.prumo-custom-text-tools{display:none;position:absolute;right:7px;top:7px;z-index:30;align-items:center;gap:3px;padding:3px;border:1px solid rgba(99,113,118,.22);border-radius:8px;background:rgba(248,248,244,.96)}',
      'body.'+MODE_CLASS+':not(.'+PREVIEW_CLASS+') .prumo-custom-text-tools{display:flex}',
      '.prumo-custom-text-tools button{border:0;background:transparent;border-radius:5px;padding:4px 6px;cursor:pointer;color:#435158}',
      '.prumo-custom-text-content{white-space:pre-wrap;line-height:1.45}',
      '.prumo-design-panel{position:fixed;z-index:2147483646;padding:12px;border:1px solid rgba(99,113,118,.28);border-radius:14px;background:rgba(248,248,244,.99);box-shadow:0 18px 50px rgba(26,39,45,.24);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);max-height:calc(100vh - 24px);overflow:auto}',
      '.prumo-design-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.prumo-design-panel-head>div{display:grid;gap:2px}.prumo-design-panel-head strong{font-size:13px;color:#2e3c44}.prumo-design-panel-head small{font:500 8px "DM Mono",monospace;color:#7c878a;max-width:270px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prumo-panel-x{border:0;background:transparent;font-size:20px;color:#718083;cursor:pointer}',
      '.prumo-design-panel textarea{width:100%;min-height:88px;resize:vertical;border:1px solid #cfd6d2;border-radius:9px;background:#fff;color:#25343d;padding:10px;font:500 13px system-ui;outline:none}.prumo-design-panel textarea:focus,.prumo-design-panel input:focus,.prumo-design-panel select:focus{border-color:#5f9b88;box-shadow:0 0 0 3px rgba(54,129,107,.10)}',
      '.prumo-field-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}.prumo-field-row label{display:grid;gap:5px;font-size:9px;color:#6c777a}.prumo-field-row input,.prumo-field-row select{width:100%;min-width:0;border:1px solid #d1d7d3;border-radius:7px;background:#fff;padding:7px 8px;font-size:11px;color:#304048}.prumo-field-row .prumo-check{display:flex;align-items:center;gap:7px;padding-top:17px}.prumo-field-row .prumo-check input{width:auto}',
      '.prumo-design-panel-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin-top:11px}',
      '@media(min-width:901px){#page-dashboard .grid-kpi>[data-prumo-legacy-size="wide"]{grid-column:span 2}#page-dashboard .grid-kpi>[data-prumo-legacy-size="full"]{grid-column:1/-1}}',
      '@media(max-width:900px){body.'+ADMIN_CLASS+' .prumo-design-launcher-top{display:none!important}#prumoDesignBar{bottom:72px;justify-content:flex-start}.prumo-field-row{grid-template-columns:1fr 1fr}.prumo-custom-text-box{grid-column:1/-1!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function scheduleApply(){
    clearTimeout(observerTimer);
    observerTimer=setTimeout(function(){
      if(applying)return;
      applyConfig(activeConfig(),false);
      if(designMode)setStatus((previewMode?'Pré-visualizando ':'Editando ')+activePageId().replace('page-',''));
    },40);
  }

  function bindObservers(){
    if(document.body.__prumoDesignStudioObserved)return;
    document.body.__prumoDesignStudioObserved=true;
    var main=document.querySelector('main.main');
    if(main){
      var observer=new MutationObserver(function(mutations){
        if(applying)return;
        var relevant=mutations.some(function(m){
          var target=m.target?.nodeType===1?m.target:m.target?.parentElement;
          if(target?.closest?.('#prumoDesignBar,.prumo-design-panel,.prumo-custom-text-host,.prumo-design-card-tools,.prumo-custom-text-tools'))return false;
          if(m.type==='attributes'&&m.attributeName==='class')return true;
          if(m.type!=='childList')return false;
          var changed=Array.from(m.addedNodes||[]).concat(Array.from(m.removedNodes||[]));
          if(changed.length&&changed.every(function(node){
            if(node.nodeType===3)return false;
            return node.nodeType===1&&(
              node.matches?.('.prumo-design-card-tools,.prumo-custom-text-host,.prumo-custom-text-tools')||
              node.closest?.('.prumo-design-card-tools,.prumo-custom-text-host,.prumo-custom-text-tools')
            );
          }))return false;
          return true;
        });
        if(relevant)scheduleApply();
      });
      observer.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    document.addEventListener('click',function(event){
      if(event.target.closest('#prumoDesignBar,.prumo-design-panel,[data-prumo-design-launcher],#prumoDesignFab'))return;
      if(event.target.closest('.nav button,[data-page]'))setTimeout(scheduleApply,0);
    },true);
    document.addEventListener('keydown',function(event){
      if(event.key==='Escape'){
        if(document.querySelector('.prumo-design-panel'))removePanel();
        else if(designMode)exitDesignMode();
      }
    });
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
    if(initialized||!currentUser?.id||typeof sb==='undefined')return false;
    try{
      await loadPublished(true);
      currentIsAdmin=await detectAdmin();
      document.body.classList.toggle(ADMIN_CLASS,currentIsAdmin);
      if(currentIsAdmin)await loadDraft();
      installStyles();
      installLaunchers();
      installToolbar();
      bindObservers();
      bindRefresh();
      applyConfig(publishedConfig,false);
      initialized=true;
      try{window.dispatchEvent(new CustomEvent('prumo:global-ui-ready',{detail:{version:publishedMeta.version,isAdmin:currentIsAdmin}}))}catch(_e){}
      return true;
    }catch(error){
      console.error('Falha ao iniciar Design Studio.',error);
      return false;
    }
  }

  window.prumoGlobalUi={
    applyCurrent:applyCurrent,
    refreshPublished:refreshPublished,
    isAdmin:function(){return currentIsAdmin},
    isDesignMode:function(){return designMode},
    version:function(){return publishedMeta.version}
  };

  var tries=0;
  var timer=setInterval(async function(){
    tries++;
    if(await init()||tries>180)clearInterval(timer);
  },100);

  window.addEventListener('caderno:splash-done',function(){init();scheduleApply()});
})();