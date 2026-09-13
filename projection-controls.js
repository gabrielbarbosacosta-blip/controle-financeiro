(function(){
  const STYLE_ID='projection-source-filter-style';
  const SOURCE_META={
    transactions:{label:'Lançamentos',short:'Lançamentos'},
    cards:{label:'Cartões',short:'Cartões'},
    debts:{label:'Dívidas',short:'Dívidas'}
  };

  function ensureConfig(){
    if(typeof state==='undefined'||!state?.settings)return{transactions:true,cards:true,debts:true};
    const saved=state.settings.dashboardProjectionSources||{};
    const config={
      transactions:saved.transactions!==false,
      cards:saved.cards!==false,
      debts:saved.debts!==false
    };
    state.settings.dashboardProjectionSources=config;
    return config;
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .projection-source-control{position:relative;display:flex;align-items:center}
      .projection-filter-btn{padding:6px 9px!important;font-size:11px!important;color:#cbd5e1!important;background:#111827!important}
      .projection-filter-btn.active{border-color:#3b82f6!important;color:#dbeafe!important}
      .projection-source-popover{position:absolute;top:calc(100% + 7px);right:0;z-index:25;min-width:190px;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.34);display:none}
      .projection-source-popover.open{display:block}
      .projection-source-title{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;padding:2px 4px 7px}
      .projection-source-option{display:flex;align-items:center;gap:8px;padding:7px 5px;border-radius:8px;color:#e2e8f0;font-size:12px;cursor:pointer;white-space:nowrap}
      .projection-source-option:hover{background:#172033}
      .projection-source-option input{accent-color:#3b82f6;margin:0}
      .projection-source-foot{border-top:1px solid #273449;margin-top:5px;padding:7px 4px 2px;color:#64748b;font-size:10px;line-height:1.35}
    `;
    document.head.appendChild(style);
  }

  function filteredProjection(selectedYm,months=12){
    const config=ensureConfig();
    if(typeof actualForMonth!=='function')return[];
    const actual=actualForMonth(selectedYm);
    let opening=Number(actual.closing)||0;
    const rows=[];

    for(let i=1;i<=months;i++){
      const ym=typeof ymAdd==='function'?ymAdd(selectedYm,i):selectedYm;
      let income=0,otherExpense=0,benefits=0;

      if(Array.isArray(state?.transactions)){
        for(const tx of state.transactions){
          if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
          const isDebt=tx.debtManaged===true;
          if(isDebt&&!config.debts)continue;
          if(!isDebt&&!config.transactions)continue;
          if(tx.type==='Receita')income+=Number(tx.amount)||0;
          else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
          else if(tx.type==='Benefício')benefits+=Number(tx.amount)||0;
        }
      }

      const invoices=config.cards&&Array.isArray(state?.cards)
        ?state.cards.filter(c=>c.active!==false).reduce((sum,card)=>sum+(typeof cardForecast==='function'?(Number(cardForecast(card,ym).total)||0):0),0)
        :0;
      const expense=otherExpense+invoices;
      const result=income-expense;
      const closing=typeof round2==='function'?round2(opening+result):Math.round((opening+result)*100)/100;
      rows.push({ym,opening,income,otherExpense,invoices,expense,benefits,result,closing});
      opening=closing;
    }
    return rows;
  }

  function updateSummary(){
    const chart=document.getElementById('projectionChart');
    const card=chart?.closest('.card');
    if(!card)return;
    const subtitle=card.querySelector('.section-head .muted');
    if(!subtitle)return;
    const config=ensureConfig();
    const active=Object.keys(SOURCE_META).filter(key=>config[key]).map(key=>SOURCE_META[key].short);
    subtitle.textContent=`Próximos 12 meses • ${active.length?active.join(' + '):'sem impactos futuros'}`;
  }

  function redraw(){
    if(typeof state==='undefined'||!state?.settings?.selectedMonth)return;
    const rows=filteredProjection(state.settings.selectedMonth,12);
    if(typeof drawLineChart==='function'){
      drawLineChart('projectionChart',rows.map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing})));
    }
    updateSummary();
    syncControls();
  }

  function setSource(key,enabled){
    if(typeof state==='undefined'||!state?.settings)return;
    const config=ensureConfig();
    config[key]=!!enabled;
    state.settings.dashboardProjectionSources={...config};
    if(typeof save==='function')save();
    redraw();
  }

  function syncControls(){
    const config=ensureConfig();
    document.querySelectorAll('[data-projection-source]').forEach(input=>{
      const key=input.dataset.projectionSource;
      input.checked=!!config[key];
    });
    const button=document.getElementById('projectionSourceButton');
    if(button){
      const count=Object.keys(SOURCE_META).filter(key=>config[key]).length;
      button.classList.toggle('active',count!==Object.keys(SOURCE_META).length);
      button.title=`${count} de ${Object.keys(SOURCE_META).length} fontes ativas`;
    }
  }

  function mountControls(){
    injectStyles();
    const chart=document.getElementById('projectionChart');
    const card=chart?.closest('.card');
    const head=card?.querySelector('.section-head');
    if(!head)return;

    let holder=document.getElementById('projectionSourceControl');
    if(!holder){
      holder=document.createElement('div');
      holder.id='projectionSourceControl';
      holder.className='projection-source-control';
      holder.innerHTML=`
        <button type="button" class="btn small projection-filter-btn" id="projectionSourceButton" aria-expanded="false">Filtros</button>
        <div class="projection-source-popover" id="projectionSourcePopover">
          <div class="projection-source-title">Impactar saldo projetado</div>
          ${Object.entries(SOURCE_META).map(([key,meta])=>`<label class="projection-source-option"><input type="checkbox" data-projection-source="${key}"> ${meta.label}</label>`).join('')}
          <div class="projection-source-foot">Desmarque uma fonte para simular o saldo sem esse impacto.</div>
        </div>`;
      head.appendChild(holder);

      const button=holder.querySelector('#projectionSourceButton');
      const popover=holder.querySelector('#projectionSourcePopover');
      button.addEventListener('click',e=>{
        e.stopPropagation();
        const open=popover.classList.toggle('open');
        button.setAttribute('aria-expanded',String(open));
      });
      popover.addEventListener('click',e=>e.stopPropagation());
      holder.querySelectorAll('[data-projection-source]').forEach(input=>{
        input.addEventListener('change',()=>setSource(input.dataset.projectionSource,input.checked));
      });
    }
    syncControls();
    updateSummary();
  }

  document.addEventListener('click',()=>{
    const popover=document.getElementById('projectionSourcePopover');
    const button=document.getElementById('projectionSourceButton');
    if(popover?.classList.contains('open')){
      popover.classList.remove('open');
      button?.setAttribute('aria-expanded','false');
    }
  });

  const originalRenderDashboard=window.renderDashboard;
  if(typeof originalRenderDashboard==='function'){
    window.renderDashboard=function(){
      const result=originalRenderDashboard.apply(this,arguments);
      mountControls();
      redraw();
      return result;
    };
  }

  function init(){
    mountControls();
    redraw();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
