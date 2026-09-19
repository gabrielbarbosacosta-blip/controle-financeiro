(function(){
  if(window.financeSimulationScenario)return;

  const stores=new Map();
  let seq=0;
  const STYLE_ID='simulation-scenario-adjustments-style';

  function getStore(key){
    const k=String(key||'default');
    if(!stores.has(k))stores.set(k,{excluded:new Set(),additions:[]});
    return stores.get(k);
  }
  function getState(){try{return state||window.state||{}}catch(_e){return window.state||{}}}
  function horizon(){
    try{if(typeof window.getProjectionMonths==='function')return Math.max(1,Number(window.getProjectionMonths())||12)}catch(_e){}
    const n=Number(getState()?.settings?.projectionMonths)||12;return Math.max(1,n);
  }
  function addMonth(ym,n){
    try{if(typeof ymAdd==='function')return ymAdd(ym,n)}catch(_e){}
    const [y,m]=String(ym||'').split('-').map(Number);if(!y||!m)return String(ym||'');
    const d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function monthOf(date){return String(date||'').slice(0,7)}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(_e){return `R$ ${(Number(v)||0).toFixed(2)}`}}
  function monthLabel(ym){try{return typeof fmtMonth==='function'?fmtMonth(ym):ym}catch(_e){return ym}}
  function dateLabel(v){try{return typeof fmtDate==='function'?fmtDate(v):String(v||'')}catch(_e){return String(v||'')}}
  function isSettled(status){
    try{if(typeof settled==='function')return !!settled(status)}catch(_e){}
    return ['pago','paga','recebido','recebida','confirmado','confirmada'].includes(String(status||'').toLowerCase());
  }
  function impactsMonth(tx,ym){
    if(!tx||!ym)return false;
    if(monthOf(tx.date)===ym&&isSettled(tx.status))return true;
    try{if(typeof isProjectedTxInMonth==='function')return !!isProjectedTxInMonth(tx,ym)}catch(_e){}
    return monthOf(tx.date)===ym;
  }
  function relevantTransactions(){
    const s=getState(),selected=s?.settings?.selectedMonth||'';
    if(!selected)return [];
    const months=[];for(let i=0;i<=horizon();i++)months.push(addMonth(selected,i));
    return (s.transactions||[]).filter(tx=>{
      if(!['Receita','Despesa'].includes(String(tx?.type||'')))return false;
      if(tx?.projection===false&&monthOf(tx?.date)!==selected)return false;
      return months.some(ym=>impactsMonth(tx,ym));
    }).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.description||'').localeCompare(String(b.description||'')));
  }
  function entityKeyForTx(tx){
    if(tx?.debtManaged===true&&tx?.debtId)return `debt:${tx.debtId}`;
    if(tx?.incomeManaged===true&&tx?.incomePlanId)return `income:${tx.incomePlanId}`;
    return `tx:${tx?.id||''}`;
  }
  function entitySummary(entity){
    if(entity.kind==='debt'){
      const d=entity.source||{},amount=Number(d.installmentAmount)||Number(entity.transactions?.[0]?.amount)||0;
      return d.openEnded
        ? `${money(amount)} por mês · sem data final`
        : `${money(amount)} por parcela · ${Number(d.totalInstallments)||entity.transactions.length||1} parcelas`;
    }
    if(entity.kind==='income'){
      const p=entity.source||{},amount=Number(p.amount)||Number(entity.transactions?.[0]?.amount)||0;
      return p.mode==='mensal'
        ? `${money(amount)} por mês${p.openEnded?' · sem data final':''}`
        : `${money(amount)} · recebimento único`;
    }
    const tx=entity.transactions?.[0]||{};
    return `${money(tx.amount)} · ${dateLabel(tx.date)}`;
  }
  function scenarioEntities(){
    const s=getState(),groups=new Map();
    for(const tx of relevantTransactions()){
      const key=entityKeyForTx(tx);
      if(!groups.has(key))groups.set(key,{key,type:tx.type,transactions:[],kind:key.startsWith('debt:')?'debt':key.startsWith('income:')?'income':'transaction'});
      groups.get(key).transactions.push(tx);
    }
    for(const entity of groups.values()){
      if(entity.kind==='debt'){
        const id=entity.key.slice(5),d=(s.debts||[]).find(x=>String(x.id)===id);
        entity.source=d||null;entity.title=d?.name||entity.transactions[0]?.description||'Despesa';
        entity.account=d?.account||entity.transactions[0]?.account||'';
        entity.subtitle='Dívida completa';
      }else if(entity.kind==='income'){
        const id=entity.key.slice(7),p=(s.incomePlans||[]).find(x=>String(x.id)===id);
        entity.source=p||null;entity.title=p?.name||entity.transactions[0]?.description||'Receita';
        entity.account=p?.account||entity.transactions[0]?.account||'';
        entity.subtitle=p?.mode==='mensal'?'Receita recorrente':'Receita';
      }else{
        const tx=entity.transactions[0]||{};
        entity.title=tx.description||tx.name||'Lançamento';
        entity.account=tx.account||'';
        entity.subtitle=tx.recurring?'Lançamento recorrente':'Lançamento';
      }
      entity.summary=entitySummary(entity);
    }
    return [...groups.values()].sort((a,b)=>{
      if(a.type!==b.type)return a.type==='Receita'?-1:1;
      return String(a.title||'').localeCompare(String(b.title||''),'pt-BR');
    });
  }
  function reset(key){stores.set(String(key||'default'),{excluded:new Set(),additions:[]})}
  function isExcluded(key,id){
    const value=String(id||''),store=getStore(key);
    if(store.excluded.has(value))return true;
    const tx=(getState().transactions||[]).find(x=>String(x.id||'')===value);
    return !!tx&&store.excluded.has(entityKeyForTx(tx));
  }
  function count(key){const s=getStore(key);return s.excluded.size+s.additions.length}
  function additionApplies(add,ym){
    if(!add||!ym)return false;
    if(add.mode==='unique')return ym===add.startMonth;
    if(ym<add.startMonth)return false;
    return !add.endMonth||ym<=add.endMonth;
  }
  function amountsForMonth(key,ym){
    let income=0,expense=0;
    for(const add of getStore(key).additions){
      if(!additionApplies(add,ym))continue;
      if(add.type==='Receita')income+=Number(add.amount)||0;else expense+=Number(add.amount)||0;
    }
    return{income,expense};
  }
  function selectedAdjustment(key,ym,skipTx){
    const s=getState(),store=getStore(key);let delta=0;
    for(const tx of s.transactions||[]){
      if(!isExcluded(key,tx.id))continue;
      if(typeof skipTx==='function'&&skipTx(tx))continue;
      if(monthOf(tx.date)!==ym||!isSettled(tx.status))continue;
      const amount=Number(tx.amount)||0;
      if(tx.type==='Receita')delta-=amount;else if(tx.type==='Despesa')delta+=amount;
    }
    const add=amountsForMonth(key,ym);delta+=add.income-add.expense;
    return delta;
  }
  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .sim-scenario{margin:14px 0;padding:14px;border:1px solid #2a3b54;border-radius:14px;background:#0b1424}
      .sim-scenario-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.sim-scenario-head h3{margin:0;font-size:13px}.sim-scenario-head .muted{font-size:10px;line-height:1.45;margin-top:3px}.sim-scenario-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.sim-scenario-pane{min-width:0;border:1px solid #22344b;border-radius:12px;padding:11px;background:#0d1929}.sim-scenario-pane-title{font-size:11px;font-weight:800;color:#e2e8f0;margin-bottom:8px}.sim-exclude-picker{position:relative}.sim-exclude-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:10px 12px;border:1px solid #30445e;border-radius:10px;background:#111f31;color:#e2e8f0;cursor:pointer;font:inherit}.sim-exclude-trigger:hover{border-color:#4b6585;background:#14243a}.sim-exclude-trigger strong{font-size:10px}.sim-exclude-trigger span{font-size:9px;color:#8da0b7}.sim-exclude-menu{position:absolute;z-index:45;top:calc(100% + 8px);left:0;width:min(720px,calc(100vw - 80px));max-height:430px;overflow:auto;padding:11px;border:1px solid #344966;border-radius:13px;background:#0c1726;box-shadow:0 18px 45px rgba(0,0,0,.38)}.sim-exclude-menu[hidden]{display:none}.sim-exclude-menu-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.sim-exclude-menu-head strong{font-size:11px;color:#e2e8f0}.sim-exclude-menu-head span{font-size:9px;color:#8091a6}.sim-exclude-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sim-exclude-card{appearance:none;width:100%;min-width:0;text-align:left;padding:10px;border:1px solid #22344b;border-radius:11px;background:#0f1b2c;color:#dce6f2;cursor:pointer}.sim-exclude-card:hover{border-color:#415a78;background:#122137}.sim-exclude-card.selected{border-color:#60a5fa;background:#112942;box-shadow:inset 0 0 0 1px rgba(96,165,250,.25)}.sim-exclude-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.sim-exclude-card-title{font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sim-exclude-card-summary{font-size:9px;color:#9aaac0;margin-top:5px;line-height:1.4}.sim-exclude-card-account{font-size:8px;color:#71839a;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sim-exclude-menu-foot{display:flex;justify-content:flex-end;gap:7px;padding-top:10px;margin-top:10px;border-top:1px solid #22344b}.sim-excluded-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.sim-excluded-mini{display:flex;align-items:center;gap:8px;max-width:100%;padding:7px 8px 7px 9px;border:1px solid #2c405a;border-radius:10px;background:#101c2d}.sim-excluded-mini-main{min-width:0}.sim-excluded-mini-title{font-size:9px;font-weight:800;color:#dce6f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.sim-excluded-mini-meta{font-size:8px;color:#8192a7;margin-top:2px}.sim-scenario-remove{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:15px;padding:4px}.sim-scenario-remove:hover{color:#fca5a5}.sim-scenario-empty{font-size:9px;color:#71839a;padding:7px 0}.sim-scenario-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sim-scenario-form .full{grid-column:1/-1}.sim-scenario-form label{display:block;font-size:9px;color:#94a3b8;margin-bottom:4px}.sim-scenario-form input,.sim-scenario-form select{width:100%;min-width:0}.sim-scenario-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.sim-scenario-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #1f3047}.sim-scenario-row:first-child{border-top:0}.sim-scenario-row-title{font-size:10px;font-weight:760;color:#dce6f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sim-scenario-row-meta{font-size:9px;color:#8091a6;margin-top:3px;line-height:1.4}.sim-scenario-row-value{font-size:10px;font-weight:800;white-space:nowrap}.sim-scenario-badge{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;border:1px solid #30445e;background:#111f31;color:#cbd6e3;font-size:8px;font-weight:750;margin-right:4px}.sim-scenario-badge.income{border-color:#28513e;background:#102a20;color:#a5e2c8}.sim-scenario-badge.expense{border-color:#5b3431;background:#2a1d1d;color:#efaaa4}.sim-scenario-count{font-size:9px;color:#93c5fd;white-space:nowrap}
      @media(max-width:760px){.sim-scenario-grid{grid-template-columns:1fr}.sim-scenario-form{grid-template-columns:1fr}.sim-scenario-form .full{grid-column:auto}.sim-scenario-head{align-items:flex-start;flex-direction:column}.sim-exclude-menu{position:static;width:100%;max-height:none;margin-top:8px}.sim-exclude-cards{grid-template-columns:1fr}.sim-excluded-mini{width:100%}.sim-excluded-mini-title{max-width:none}}
    `;document.head.appendChild(style);
  }
  function render(key,host,onChange){
    if(!host)return;injectStyles();
    const store=getStore(key),selected=getState()?.settings?.selectedMonth||'';
    const entities=scenarioEntities();
    const available=entities.filter(entity=>!store.excluded.has(entity.key));
    const excluded=entities.filter(entity=>store.excluded.has(entity.key));
    host.innerHTML=`<section class="sim-scenario"><div class="sim-scenario-head"><div><h3>Ajustes do cenário</h3><div class="muted">As alterações valem somente nesta simulação. Dívidas e receitas recorrentes são tratadas como um único compromisso.</div></div><div style="display:flex;align-items:center;gap:8px"><span class="sim-scenario-count">${count(key)} ajuste${count(key)===1?'':'s'}</span><button type="button" class="btn small" data-sim-clear ${count(key)?'':'disabled'}>Limpar</button></div></div><div class="sim-scenario-grid"><div class="sim-scenario-pane"><div class="sim-scenario-pane-title">Excluir do cenário</div><div class="sim-exclude-picker"><button type="button" class="sim-exclude-trigger" data-sim-exclude-trigger><div><strong>Excluir receita ou despesa</strong><div><span>Escolha um compromisso cadastrado</span></div></div><span>▾</span></button><div class="sim-exclude-menu" data-sim-exclude-menu hidden><div class="sim-exclude-menu-head"><strong>Selecione o que deseja retirar</strong><span>${available.length} item${available.length===1?'':'s'}</span></div><div class="sim-exclude-cards">${available.length?available.map(entity=>`<button type="button" class="sim-exclude-card" data-sim-entity="${esc(entity.key)}"><div class="sim-exclude-card-top"><div class="sim-exclude-card-title"><span class="sim-scenario-badge ${entity.type==='Receita'?'income':'expense'}">${esc(entity.type)}</span>${esc(entity.title)}</div></div><div class="sim-exclude-card-summary">${esc(entity.summary)}</div>${entity.account?`<div class="sim-exclude-card-account">${esc(entity.account)}</div>`:''}</button>`).join(''):'<div class="sim-scenario-empty">Não há receitas ou despesas disponíveis para excluir.</div>'}</div><div class="sim-exclude-menu-foot"><button type="button" class="btn small" data-sim-exclude-cancel>Cancelar</button><button type="button" class="btn small primary" data-sim-exclude-confirm disabled>Confirmar</button></div></div></div><div class="sim-excluded-list" data-sim-excluded-list>${excluded.length?excluded.map(entity=>`<div class="sim-excluded-mini"><div class="sim-excluded-mini-main"><div class="sim-excluded-mini-title"><span class="sim-scenario-badge ${entity.type==='Receita'?'income':'expense'}">${esc(entity.type)}</span>${esc(entity.title)}</div><div class="sim-excluded-mini-meta">${esc(entity.summary)}</div></div><button type="button" class="sim-scenario-remove" data-sim-restore="${esc(entity.key)}" title="Reincluir no cenário">×</button></div>`).join(''):'<div class="sim-scenario-empty">Nenhum compromisso excluído do cenário.</div>'}</div></div><div class="sim-scenario-pane"><div class="sim-scenario-pane-title">Adicionar ao cenário</div><form class="sim-scenario-form" data-sim-add-form><div><label>Tipo</label><select data-sim-add-type><option>Receita</option><option>Despesa</option></select></div><div><label>Valor (R$)</label><input data-sim-add-amount type="number" min="0.01" step="0.01" required></div><div class="full"><label>Descrição</label><input data-sim-add-description maxlength="100" placeholder="Ex.: renda extra ou novo aluguel" required></div><div><label>Primeiro mês</label><input data-sim-add-start type="month" value="${esc(selected)}" required></div><div><label>Frequência</label><select data-sim-add-mode><option value="unique">Somente uma vez</option><option value="monthly">Mensal</option></select></div><div data-sim-end-wrap style="display:none"><label>Último mês</label><input data-sim-add-end type="month"></div><div class="sim-scenario-actions full"><button type="submit" class="btn small primary">Adicionar ao cenário</button></div></form><div data-sim-add-list>${store.additions.length?store.additions.map(add=>`<div class="sim-scenario-row"><div><div class="sim-scenario-row-title"><span class="sim-scenario-badge ${add.type==='Receita'?'income':'expense'}">${esc(add.type)}</span>${esc(add.description)}</div><div class="sim-scenario-row-meta">${esc(monthLabel(add.startMonth))}${add.mode==='monthly'?` · mensal${add.endMonth?` até ${esc(monthLabel(add.endMonth))}`:' até o fim da projeção'}`:''}</div></div><div style="display:flex;align-items:center;gap:4px"><div class="sim-scenario-row-value">${money(add.amount)}</div><button type="button" class="sim-scenario-remove" data-sim-remove-add="${esc(add.id)}" title="Remover ajuste">×</button></div></div>`).join(''):'<div class="sim-scenario-empty">Nenhuma receita ou despesa hipotética adicionada.</div>'}</div></div></div></section>`;

    const notify=()=>{render(key,host,onChange);try{onChange?.()}catch(e){console.warn('Falha ao recalcular simulação.',e)}};
    const menu=host.querySelector('[data-sim-exclude-menu]'),trigger=host.querySelector('[data-sim-exclude-trigger]'),confirmBtn=host.querySelector('[data-sim-exclude-confirm]');
    let selectedEntity='';
    const closeMenu=()=>{selectedEntity='';if(menu)menu.hidden=true;host.querySelectorAll('[data-sim-entity]').forEach(card=>card.classList.remove('selected'));if(confirmBtn)confirmBtn.disabled=true};
    trigger?.addEventListener('click',()=>{if(menu)menu.hidden=!menu.hidden});
    host.querySelector('[data-sim-exclude-cancel]')?.addEventListener('click',closeMenu);
    host.querySelectorAll('[data-sim-entity]').forEach(card=>card.addEventListener('click',()=>{
      selectedEntity=String(card.dataset.simEntity||'');
      host.querySelectorAll('[data-sim-entity]').forEach(x=>x.classList.toggle('selected',x===card));
      if(confirmBtn)confirmBtn.disabled=!selectedEntity;
    }));
    confirmBtn?.addEventListener('click',()=>{if(!selectedEntity)return;store.excluded.add(selectedEntity);closeMenu();notify()});
    host.querySelectorAll('[data-sim-restore]').forEach(btn=>btn.addEventListener('click',()=>{store.excluded.delete(String(btn.dataset.simRestore||''));notify()}));
    host.querySelectorAll('[data-sim-remove-add]').forEach(btn=>btn.addEventListener('click',()=>{store.additions=store.additions.filter(x=>String(x.id)!==String(btn.dataset.simRemoveAdd||''));notify()}));
    host.querySelector('[data-sim-clear]')?.addEventListener('click',()=>{store.excluded.clear();store.additions=[];notify()});
    const form=host.querySelector('[data-sim-add-form]'),mode=form?.querySelector('[data-sim-add-mode]'),endWrap=form?.querySelector('[data-sim-end-wrap]');
    mode?.addEventListener('change',()=>{if(endWrap)endWrap.style.display=mode.value==='monthly'?'block':'none'});
    form?.addEventListener('submit',e=>{
      e.preventDefault();
      const type=form.querySelector('[data-sim-add-type]')?.value||'Receita';
      const amount=Number(form.querySelector('[data-sim-add-amount]')?.value)||0;
      const description=form.querySelector('[data-sim-add-description]')?.value.trim()||'';
      const startMonth=form.querySelector('[data-sim-add-start]')?.value||selected;
      const modeValue=form.querySelector('[data-sim-add-mode]')?.value||'unique';
      const endMonth=modeValue==='monthly'?(form.querySelector('[data-sim-add-end]')?.value||null):startMonth;
      if(amount<=0||!description||!startMonth)return;
      if(endMonth&&endMonth<startMonth){alert('O último mês não pode ser anterior ao primeiro mês.');return}
      store.additions.push({id:`sim-${Date.now()}-${++seq}`,type,amount,description,startMonth,mode:modeValue,endMonth});notify();
    });
  }
  function mount(key,host,onChange){render(key,host,onChange)}

  window.financeSimulationScenario={reset,isExcluded,count,amountsForMonth,selectedAdjustment,mount};
})();
