(function(){
  if(window.__prumoDashboardDesignModeLoaded)return;
  window.__prumoDashboardDesignModeLoaded=true;

  const STYLE_ID='prumo-dashboard-design-mode-style';
  const MODE_CLASS='prumo-design-mode';
  let dragging=null;

  const fallbackKpis=[
    {key:'opening',label:'Saldo inicial',selector:'#kpiOpening'},
    {key:'income',label:'Receitas de caixa',selector:'#kpiIncome'},
    {key:'expense',label:'Saídas de caixa',selector:'#kpiExpense'},
    {key:'invoices',label:'Faturas pagas',selector:'#kpiInvoices'},
    {key:'closing',label:'Saldo final',selector:'#kpiClosing'}
  ];
  const fallbackPanels=[
    {key:'projection',label:'Saldo projetado',selector:'#projectionChart'},
    {key:'categories',label:'Gastos por categoria',selector:'#categoryList'}
  ];

  function api(){return window.prumoUiLayout||null}
  function defs(){
    return {
      kpis:Array.isArray(api()?.kpis)?api().kpis:fallbackKpis,
      panels:Array.isArray(api()?.panels)?api().panels:fallbackPanels
    };
  }
  function layout(){
    const value=api()?.ensure?.();
    if(value)return value;
    if(!state?.settings)return null;
    state.settings.uiLayout=state.settings.uiLayout||{kpiOrder:fallbackKpis.map(x=>x.key),panelOrder:fallbackPanels.map(x=>x.key),hidden:{},sizes:{}};
    state.settings.uiLayout.hidden=state.settings.uiLayout.hidden||{};
    state.settings.uiLayout.sizes=state.settings.uiLayout.sizes||{};
    return state.settings.uiLayout;
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #prumoDesignToggle{display:none}
      body.prumo-dashboard-active #prumoDesignToggle{display:inline-flex}
      #prumoDesignToggle.prumo-design-active{background:#1f6f5d!important;color:#fff!important;border-color:#1f6f5d!important}
      #prumoDesignBar{position:fixed;left:50%;bottom:22px;z-index:2147483000;transform:translateX(-50%) translateY(18px);display:flex;align-items:center;gap:8px;max-width:min(92vw,760px);padding:8px 10px;border:1px solid rgba(130,145,150,.28);border-radius:14px;background:rgba(248,248,244,.94);box-shadow:0 16px 44px rgba(26,39,45,.18);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease}
      body.${MODE_CLASS} #prumoDesignBar{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
      #prumoDesignBar .prumo-design-status{font:600 11px 'DM Mono',monospace;color:#647074;white-space:nowrap;margin-right:4px}
      #prumoDesignBar .btn{white-space:nowrap}
      body.${MODE_CLASS} #page-dashboard .card[data-ui-block]{position:relative;outline:1px dashed rgba(54,129,107,.62);outline-offset:3px;cursor:grab;user-select:none;transition:outline-color .15s ease,opacity .15s ease,transform .15s ease,box-shadow .15s ease}
      body.${MODE_CLASS} #page-dashboard .card[data-ui-block]:hover{outline-color:#36816b;box-shadow:0 10px 28px rgba(35,48,53,.10)}
      body.${MODE_CLASS} #page-dashboard .kpi[data-ui-block]:hover{transform:none}
      body.${MODE_CLASS} #page-dashboard .card.prumo-design-dragging{opacity:.35}
      body.${MODE_CLASS} #page-dashboard .card.prumo-design-drop-before{box-shadow:-5px 0 0 #36816b}
      body.${MODE_CLASS} #page-dashboard .card.prumo-design-hidden{opacity:.38!important;filter:saturate(.55);display:flex!important}
      body.${MODE_CLASS} #page-dashboard .dashboard-grid>.card.prumo-design-hidden{display:block!important}
      body.${MODE_CLASS} #page-dashboard .card.prumo-design-hidden::before{content:'OCULTO';position:absolute;left:10px;top:10px;z-index:24;padding:3px 6px;border-radius:999px;background:#6e7779;color:#fff;font:700 8px 'DM Mono',monospace;letter-spacing:.08em}
      .prumo-design-controls{position:absolute;right:8px;top:8px;z-index:25;display:none;align-items:center;gap:4px;padding:4px;border:1px solid rgba(99,113,118,.22);border-radius:10px;background:rgba(248,248,244,.94);box-shadow:0 7px 18px rgba(31,43,49,.12);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      body.${MODE_CLASS} .prumo-design-controls{display:flex}
      .prumo-design-control{width:27px;height:27px;border:0;border-radius:7px;background:transparent;color:#435158;display:grid;place-items:center;font:700 12px system-ui;cursor:pointer;padding:0}
      .prumo-design-control:hover{background:#e9eee8;color:#245f50}
      .prumo-design-handle{cursor:grab;font-size:15px;letter-spacing:-3px;padding-right:3px}
      .prumo-design-size-label{min-width:34px;width:auto;padding:0 7px;font-size:9px;font-family:'DM Mono',monospace}
      .prumo-design-eye{font-size:13px}
      @media(min-width:901px){
        #page-dashboard .grid-kpi>[data-ui-size="wide"]{grid-column:span 2}
        #page-dashboard .grid-kpi>[data-ui-size="full"]{grid-column:1/-1}
        #page-dashboard .dashboard-grid>[data-ui-size="wide"],#page-dashboard .dashboard-grid>[data-ui-size="full"]{grid-column:1/-1}
      }
      @media(max-width:900px){
        #page-dashboard .grid-kpi>[data-ui-size],#page-dashboard .dashboard-grid>[data-ui-size]{grid-column:1/-1}
        #prumoDesignBar{bottom:76px;overflow-x:auto;justify-content:flex-start}
        #prumoDesignBar .prumo-design-status{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function persist(){
    const a=api();
    if(a?.persist){a.persist();return}
    if(typeof save==='function')save();
    a?.apply?.();
  }

  function refreshLayout(){
    api()?.apply?.();
    decorateCards();
    updateBar();
    requestAnimationFrame(()=>{try{window.redrawFilteredProjection?.()}catch(_e){}});
  }

  function sizeName(key,isPanel){
    const s=String(layout()?.sizes?.[key]||'normal');
    if(s==='full')return '100%';
    if(s==='wide')return isPanel?'100%':'2×';
    return isPanel?'Padrão':'1×';
  }

  function nextSize(key,isPanel){
    const l=layout();if(!l)return;
    l.sizes=l.sizes||{};
    const current=String(l.sizes[key]||'normal');
    if(isPanel){l.sizes[key]=current==='normal'?'wide':'normal'}
    else{l.sizes[key]=current==='normal'?'wide':current==='wide'?'full':'normal'}
    persist();refreshLayout();
  }

  function toggleHidden(key){
    const l=layout();if(!l)return;
    l.hidden=l.hidden||{};
    l.hidden[key]=!l.hidden[key];
    persist();refreshLayout();
  }

  function groupForCard(card){
    if(card?.parentElement?.classList.contains('grid-kpi'))return 'kpi';
    if(card?.parentElement?.classList.contains('dashboard-grid'))return 'panel';
    return '';
  }

  function orderFromDom(group){
    const l=layout();if(!l)return;
    const container=document.querySelector(group==='kpi'?'#page-dashboard .grid-kpi':'#page-dashboard .dashboard-grid');
    if(!container)return;
    const allowed=new Set((group==='kpi'?defs().kpis:defs().panels).map(x=>x.key));
    const order=[...container.children].map(x=>x.dataset.uiBlock).filter(x=>allowed.has(x));
    if(group==='kpi')l.kpiOrder=order;else l.panelOrder=order;
    persist();
  }

  function clearDropMarks(){
    document.querySelectorAll('.prumo-design-drop-before').forEach(x=>x.classList.remove('prumo-design-drop-before'));
  }

  function bindDrag(card){
    if(card.dataset.prumoDesignDragBound==='1')return;
    card.dataset.prumoDesignDragBound='1';
    card.addEventListener('dragstart',event=>{
      if(!document.body.classList.contains(MODE_CLASS)){event.preventDefault();return}
      if(event.target.closest('.prumo-design-control')){event.preventDefault();return}
      dragging=card;card.classList.add('prumo-design-dragging');
      try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',card.dataset.uiBlock||'')}catch(_e){}
    });
    card.addEventListener('dragend',()=>{
      if(!dragging)return;
      const group=groupForCard(dragging);
      dragging.classList.remove('prumo-design-dragging');clearDropMarks();dragging=null;
      if(group)orderFromDom(group);
      refreshLayout();
    });
    card.addEventListener('dragover',event=>{
      if(!dragging||dragging===card||groupForCard(dragging)!==groupForCard(card))return;
      event.preventDefault();clearDropMarks();
      const rect=card.getBoundingClientRect();
      const before=(event.clientX-rect.left)<rect.width/2;
      if(before){card.classList.add('prumo-design-drop-before');card.parentElement.insertBefore(dragging,card)}
      else{card.parentElement.insertBefore(dragging,card.nextSibling)}
    });
    card.addEventListener('drop',event=>{if(dragging)event.preventDefault()});
  }

  function controlsFor(card,key,isPanel){
    let controls=card.querySelector(':scope > .prumo-design-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.className='prumo-design-controls';
      controls.innerHTML='<button type="button" class="prumo-design-control prumo-design-handle" title="Arrastar" aria-label="Arrastar">⋮⋮</button><button type="button" class="prumo-design-control prumo-design-size-label" data-design-size title="Alterar tamanho">1×</button><button type="button" class="prumo-design-control prumo-design-eye" data-design-eye title="Ocultar ou mostrar">◉</button>';
      card.appendChild(controls);
      controls.querySelector('[data-design-size]').addEventListener('click',event=>{event.stopPropagation();nextSize(key,isPanel)});
      controls.querySelector('[data-design-eye]').addEventListener('click',event=>{event.stopPropagation();toggleHidden(key)});
    }
    const hidden=!!layout()?.hidden?.[key];
    const sizeButton=controls.querySelector('[data-design-size]');
    if(sizeButton)sizeButton.textContent=sizeName(key,isPanel);
    const eye=controls.querySelector('[data-design-eye]');
    if(eye){eye.textContent=hidden?'○':'◉';eye.title=hidden?'Mostrar widget':'Ocultar widget'}
    return controls;
  }

  function decorateCards(){
    const d=defs();
    [{defs:d.kpis,isPanel:false},{defs:d.panels,isPanel:true}].forEach(set=>set.defs.forEach(def=>{
      const target=document.querySelector(def.selector);
      const card=target?.closest('.card')||target?.closest('.kpi');
      if(!card)return;
      card.dataset.uiBlock=def.key;
      card.draggable=document.body.classList.contains(MODE_CLASS);
      controlsFor(card,def.key,set.isPanel);
      bindDrag(card);
    }));
  }

  function updateBar(){
    const bar=document.getElementById('prumoDesignBar');if(!bar)return;
    const l=layout();
    const total=defs().kpis.length+defs().panels.length;
    const hidden=Object.values(l?.hidden||{}).filter(Boolean).length;
    const status=bar.querySelector('.prumo-design-status');
    if(status)status.textContent=hidden?`${total-hidden} visíveis · ${hidden} ocultos`:`${total} widgets visíveis`;
  }

  function copyLayout(){
    const l=layout();if(!l)return;
    const text=JSON.stringify(l,null,2);
    const done=()=>{
      const btn=document.getElementById('prumoDesignCopy');if(!btn)return;
      const old=btn.textContent;btn.textContent='Copiado';setTimeout(()=>{btn.textContent=old},1200);
    };
    navigator.clipboard?.writeText(text).then(done).catch(()=>{
      const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();
      try{document.execCommand('copy');done()}catch(_e){}
      area.remove();
    });
  }

  function resetLayout(){
    if(!confirm('Restaurar o layout padrão da Visão Geral?'))return;
    if(!state?.settings)return;
    state.settings.uiLayout=api()?.defaults?.()||{kpiOrder:fallbackKpis.map(x=>x.key),panelOrder:fallbackPanels.map(x=>x.key),hidden:{},sizes:{}};
    persist();refreshLayout();
  }

  function setDesignMode(enabled){
    const body=document.body;
    body.classList.toggle(MODE_CLASS,enabled);
    const button=document.getElementById('prumoDesignToggle');
    if(button){button.classList.toggle('prumo-design-active',enabled);button.textContent=enabled?'Concluir':'Editar painel';button.setAttribute('aria-pressed',String(enabled))}
    decorateCards();
    document.querySelectorAll('#page-dashboard .card[data-ui-block]').forEach(card=>{card.draggable=enabled});
    api()?.apply?.();
    if(!enabled){
      clearDropMarks();dragging=null;
      if(typeof save==='function')save();
      requestAnimationFrame(()=>{try{window.redrawFilteredProjection?.()}catch(_e){}});
    }else{
      requestAnimationFrame(()=>document.querySelector('#page-dashboard .card[data-ui-block]')?.scrollIntoView({block:'nearest',behavior:'smooth'}));
    }
    updateBar();
  }

  function syncDashboardState(){
    const active=document.getElementById('page-dashboard')?.classList.contains('active');
    document.body.classList.toggle('prumo-dashboard-active',!!active);
    if(!active&&document.body.classList.contains(MODE_CLASS))setDesignMode(false);
  }

  function installUi(){
    injectStyles();
    const actions=document.querySelector('.topbar .actions');
    if(actions&&!document.getElementById('prumoDesignToggle')){
      const button=document.createElement('button');
      button.type='button';button.className='btn';button.id='prumoDesignToggle';button.textContent='Editar painel';button.setAttribute('aria-pressed','false');
      button.onclick=()=>setDesignMode(!document.body.classList.contains(MODE_CLASS));
      actions.insertBefore(button,actions.firstChild);
    }
    if(!document.getElementById('prumoDesignBar')){
      const bar=document.createElement('div');bar.id='prumoDesignBar';
      bar.innerHTML='<span class="prumo-design-status">Modo Design</span><button type="button" class="btn small" id="prumoDesignCopy">Copiar layout</button><button type="button" class="btn small" id="prumoDesignReset">Restaurar padrão</button><button type="button" class="btn primary small" id="prumoDesignDone">Concluir</button>';
      document.body.appendChild(bar);
      bar.querySelector('#prumoDesignCopy').onclick=copyLayout;
      bar.querySelector('#prumoDesignReset').onclick=resetLayout;
      bar.querySelector('#prumoDesignDone').onclick=()=>setDesignMode(false);
    }
    decorateCards();syncDashboardState();
    const dashboard=document.getElementById('page-dashboard');
    if(dashboard&&!dashboard.__prumoDesignModeObserver){
      const observer=new MutationObserver(()=>{decorateCards();syncDashboardState()});
      observer.observe(dashboard,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
      dashboard.__prumoDesignModeObserver=observer;
    }
    document.addEventListener('click',event=>{if(event.target.closest('.nav button,[data-page]'))setTimeout(syncDashboardState,0)},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains(MODE_CLASS))setDesignMode(false)});
  }

  function boot(){
    if(!api()){
      let tries=0;
      const timer=setInterval(()=>{tries++;if(api()||tries>80){clearInterval(timer);if(api())installUi()}},100);
      return;
    }
    installUi();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();