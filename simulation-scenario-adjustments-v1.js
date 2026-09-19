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
  function reset(key){stores.set(String(key||'default'),{excluded:new Set(),additions:[]})}
  function isExcluded(key,id){return getStore(key).excluded.has(String(id||''))}
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
      if(!store.excluded.has(String(tx.id||'')))continue;
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
      .sim-scenario-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.sim-scenario-head h3{margin:0;font-size:13px}.sim-scenario-head .muted{font-size:10px;line-height:1.45;margin-top:3px}.sim-scenario-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.sim-scenario-pane{min-width:0;border:1px solid #22344b;border-radius:12px;padding:11px;background:#0d1929}.sim-scenario-pane-title{font-size:11px;font-weight:800;color:#e2e8f0;margin-bottom:8px}.sim-scenario-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #1f3047}.sim-scenario-row:first-child{border-top:0}.sim-scenario-row-title{font-size:10px;font-weight:760;color:#dce6f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sim-scenario-row-meta{font-size:9px;color:#8091a6;margin-top:3px;line-height:1.4}.sim-scenario-row-value{font-size:10px;font-weight:800;white-space:nowrap}.sim-scenario-remove{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:15px;padding:4px}.sim-scenario-remove:hover{color:#fca5a5}.sim-scenario-empty{font-size:9px;color:#71839a;padding:7px 0}.sim-scenario-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sim-scenario-form .full{grid-column:1/-1}.sim-scenario-form label{display:block;font-size:9px;color:#94a3b8;margin-bottom:4px}.sim-scenario-form input,.sim-scenario-form select{width:100%;min-width:0}.sim-scenario-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.sim-scenario-badge{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;border:1px solid #30445e;background:#111f31;color:#cbd6e3;font-size:8px;font-weight:750;margin-right:4px}.sim-scenario-badge.income{border-color:#28513e;background:#102a20;color:#a5e2c8}.sim-scenario-badge.expense{border-color:#5b3431;background:#2a1d1d;color:#efaaa4}.sim-scenario-count{font-size:9px;color:#93c5fd;white-space:nowrap}
      @media(max-width:760px){.sim-scenario-grid{grid-template-columns:1fr}.sim-scenario-form{grid-template-columns:1fr}.sim-scenario-form .full{grid-column:auto}.sim-scenario-head{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(style);
  }
  function existingOptionLabel(tx){
    const desc=String(tx.description||tx.name||'Lançamento');
    return `${tx.type} · ${desc} · ${dateLabel(tx.date)} · ${money(tx.amount)}`;
  }
  function render(key,host,onChange){
    if(!host)return;injectStyles();
    const store=getStore(key),selected=getState()?.settings?.selectedMonth||'';
    const available=relevantTransactions().filter(tx=>!store.excluded.has(String(tx.id||'')));
    const excluded=relevantTransactions().filter(tx=>store.excluded.has(String(tx.id||'')));
    host.innerHTML=`<section class="sim-scenario"><div class="sim-scenario-head"><div><h3>Ajustes do cenário</h3><div class="muted">Estas alterações valem somente nesta simulação. Seus lançamentos reais não serão modificados.</div></div><div style="display:flex;align-items:center;gap:8px"><span class="sim-scenario-count">${count(key)} ajuste${count(key)===1?'':'s'}</span><button type="button" class="btn small" data-sim-clear ${count(key)?'':'disabled'}>Limpar</button></div></div><div class="sim-scenario-grid"><div class="sim-scenario-pane"><div class="sim-scenario-pane-title">Excluir do cenário</div><div class="sim-scenario-form"><div class="full"><label>Lançamento cadastrado</label><select data-sim-existing><option value="">Selecione uma receita ou despesa</option>${available.map(tx=>`<option value="${esc(tx.id)}">${esc(existingOptionLabel(tx))}</option>`).join('')}</select></div></div><div class="sim-scenario-actions"><button type="button" class="btn small" data-sim-exclude ${available.length?'':'disabled'}>Excluir da simulação</button></div><div data-sim-excluded-list>${excluded.length?excluded.map(tx=>`<div class="sim-scenario-row"><div><div class="sim-scenario-row-title"><span class="sim-scenario-badge ${tx.type==='Receita'?'income':'expense'}">${esc(tx.type)}</span>${esc(tx.description||'Lançamento')}</div><div class="sim-scenario-row-meta">${esc(dateLabel(tx.date))} · ${esc(tx.status||'')}</div></div><div style="display:flex;align-items:center;gap:4px"><div class="sim-scenario-row-value">${money(tx.amount)}</div><button type="button" class="sim-scenario-remove" data-sim-restore="${esc(tx.id)}" title="Reincluir no cenário">×</button></div></div>`).join(''):'<div class="sim-scenario-empty">Nenhum lançamento foi excluído.</div>'}</div></div><div class="sim-scenario-pane"><div class="sim-scenario-pane-title">Adicionar ao cenário</div><form class="sim-scenario-form" data-sim-add-form><div><label>Tipo</label><select data-sim-add-type><option>Receita</option><option>Despesa</option></select></div><div><label>Valor (R$)</label><input data-sim-add-amount type="number" min="0.01" step="0.01" required></div><div class="full"><label>Descrição</label><input data-sim-add-description maxlength="100" placeholder="Ex.: renda extra ou novo aluguel" required></div><div><label>Primeiro mês</label><input data-sim-add-start type="month" value="${esc(selected)}" required></div><div><label>Frequência</label><select data-sim-add-mode><option value="unique">Somente uma vez</option><option value="monthly">Mensal</option></select></div><div data-sim-end-wrap style="display:none"><label>Último mês</label><input data-sim-add-end type="month"></div><div class="sim-scenario-actions full"><button type="submit" class="btn small primary">Adicionar ao cenário</button></div></form><div data-sim-add-list>${store.additions.length?store.additions.map(add=>`<div class="sim-scenario-row"><div><div class="sim-scenario-row-title"><span class="sim-scenario-badge ${add.type==='Receita'?'income':'expense'}">${esc(add.type)}</span>${esc(add.description)}</div><div class="sim-scenario-row-meta">${esc(monthLabel(add.startMonth))}${add.mode==='monthly'?` · mensal${add.endMonth?` até ${esc(monthLabel(add.endMonth))}`:' até o fim da projeção'}`:''}</div></div><div style="display:flex;align-items:center;gap:4px"><div class="sim-scenario-row-value">${money(add.amount)}</div><button type="button" class="sim-scenario-remove" data-sim-remove-add="${esc(add.id)}" title="Remover ajuste">×</button></div></div>`).join(''):'<div class="sim-scenario-empty">Nenhuma receita ou despesa hipotética adicionada.</div>'}</div></div></div></section>`;

    const notify=()=>{render(key,host,onChange);try{onChange?.()}catch(e){console.warn('Falha ao recalcular simulação.',e)}};
    const existingSelect=host.querySelector('[data-sim-existing]');
    host.querySelector('[data-sim-exclude]')?.addEventListener('click',()=>{const id=existingSelect?.value;if(!id)return;store.excluded.add(String(id));notify()});
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
