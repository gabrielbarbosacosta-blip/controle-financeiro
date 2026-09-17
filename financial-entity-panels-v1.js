(function(){
  if(window.__prumoFinancialEntityPanelsV1)return;
  window.__prumoFinancialEntityPanelsV1=true;

  const PAGE_ID='page-financial-entity';
  const STYLE_ID='financial-entity-panels-v1-style';
  const PANEL_MONTHS=12;
  let currentEntity=null;
  let returnPage='dashboard';
  let observer=null;
  let resizeTimer=0;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const monthLabel=ym=>{try{return typeof fmtMonth==='function'?fmtMonth(ym):ym}catch(e){return ym||'—'}};
  const dateLabel=d=>{try{return typeof fmtDate==='function'?fmtDate(String(d||'').slice(0,10)):String(d||'')}catch(e){return String(d||'')}};
  const ymOf=d=>String(d||'').slice(0,7);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(reembolso|receita|despesa|compartilhada|compartilhado)\b/g,' ').replace(/\bparcela\s+\d+\s*\/\s*(?:\d+|∞)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const statusKey=v=>String(v||'').trim().toLowerCase();
  const addMonth=(ym,n)=>{if(typeof ymAdd==='function')return ymAdd(ym,n);const[y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
  const monthDiffLocal=(a,b)=>{const[ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);return(yb-ya)*12+(mb-ma)};
  const selectedMonth=()=>String(state?.settings?.selectedMonth||new Date().toISOString().slice(0,7));
  const allTx=()=>Array.isArray(state?.transactions)?state.transactions:[];

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #${PAGE_ID}{max-width:1500px;margin:0 auto}
      .entity-panel-back{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#91a2b8;font-size:12px;font-weight:720;padding:0;margin:0 0 14px;cursor:pointer}.entity-panel-back:hover{color:#eef3f9}
      .entity-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}.entity-hero-main{min-width:0}.entity-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#71849c;font-weight:800;margin-bottom:6px}.entity-name{font-size:27px;line-height:1.08;font-weight:850;color:#f3f7fb;letter-spacing:-.025em}.entity-meta{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:9px}.entity-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border:1px solid #2a3d54;background:#0d1929;border-radius:999px;color:#aebed0;font-size:10px;font-weight:730}.entity-chip.ok{border-color:#28513e;background:#10271d;color:#9dd8b6}.entity-chip.warn{border-color:#675226;background:#30250f;color:#efd18c}.entity-chip.info{border-color:#294b6c;background:#10243a;color:#abd5f3}.entity-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .entity-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.entity-kpi{padding:14px 15px!important;min-height:105px}.entity-kpi .k{font-size:10px;color:#8193a9;margin-bottom:9px}.entity-kpi .v{font-size:19px;font-weight:840;letter-spacing:-.02em;color:#eef3f9;font-variant-numeric:tabular-nums}.entity-kpi .s{font-size:10px;color:#71849c;margin-top:6px;line-height:1.35}.entity-kpi .v.positive{color:#91d6b9}.entity-kpi .v.negative{color:#ef9a91}
      .entity-main-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(300px,.7fr);gap:14px;margin-bottom:14px}.entity-card{padding:15px!important}.entity-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.entity-card-title{font-size:13px;font-weight:810;color:#eef3f9}.entity-card-sub{font-size:10px;color:#71849c;margin-top:3px;line-height:1.4}.entity-chart-wrap{height:235px;position:relative}.entity-chart-wrap canvas{width:100%!important;height:235px!important;display:block}.entity-impact-value{font-size:26px;font-weight:850;color:#eef3f9;letter-spacing:-.03em;margin:4px 0}.entity-impact-track{height:8px;border-radius:999px;background:#172338;overflow:hidden;margin:10px 0 7px}.entity-impact-track>span{display:block;height:100%;border-radius:999px;background:#65aaff}.entity-impact-list{display:grid;gap:8px;margin-top:13px}.entity-impact-row{display:flex;justify-content:space-between;gap:14px;font-size:11px;color:#899bb0}.entity-impact-row strong{color:#dbe5f1;font-variant-numeric:tabular-nums}
      .entity-section{margin-bottom:14px}.entity-table-card{padding:0!important;overflow:hidden}.entity-table-head{padding:14px 15px;border-bottom:1px solid var(--line)}.entity-timeline{display:grid}.entity-timeline-row{display:grid;grid-template-columns:88px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:11px 15px;border-bottom:1px solid rgba(148,163,184,.09);font-size:11px}.entity-timeline-row:last-child{border-bottom:0}.entity-period{font-weight:780;color:#dbe5f1}.entity-desc{min-width:0;color:#9bacbf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.entity-amount{font-weight:790;color:#eef3f9;font-variant-numeric:tabular-nums;white-space:nowrap}.entity-status{display:inline-flex;padding:4px 7px;border-radius:999px;border:1px solid #3a4656;background:#151d29;color:#9ba9b8;font-size:9px;font-weight:780;white-space:nowrap}.entity-status.paid{border-color:#28513e;background:#10271d;color:#9dd8b6}.entity-status.pending{border-color:#675226;background:#30250f;color:#efd18c}.entity-status.waiting{border-color:#294b6c;background:#10243a;color:#abd5f3}
      .entity-link-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}.entity-link-mini{padding:10px 11px;border:1px solid rgba(148,163,184,.13);border-radius:11px;background:#0b1424}.entity-link-mini .k{font-size:9px;color:#71849c}.entity-link-mini .v{font-size:13px;font-weight:800;color:#e6edf5;margin-top:4px;font-variant-numeric:tabular-nums}.entity-links{display:grid;gap:8px}.entity-link-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid rgba(148,163,184,.12);border-radius:11px;background:#0b1424}.entity-link-name{font-size:11px;font-weight:790;color:#dce6f2}.entity-link-note{font-size:9px;color:#71849c;margin-top:3px}.entity-link-value{font-size:11px;font-weight:800;font-variant-numeric:tabular-nums;color:#eef3f9}.entity-empty{padding:20px 14px;text-align:center;color:#71849c;font-size:11px}
      .entity-lower-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.entity-history{display:grid;gap:8px}.entity-history-row{display:grid;grid-template-columns:100px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border:1px solid rgba(148,163,184,.1);border-radius:10px;background:#0b1424;font-size:10px}.entity-history-date{color:#91a2b8;font-weight:720}.entity-history-note{color:#71849c}.entity-history-value{font-weight:800;color:#e6edf5;font-variant-numeric:tabular-nums}.entity-info{display:grid;grid-template-columns:1fr 1fr;gap:9px}.entity-info-item{padding:9px 10px;border:1px solid rgba(148,163,184,.1);border-radius:10px;background:#0b1424;min-width:0}.entity-info-item .k{font-size:9px;color:#71849c}.entity-info-item .v{font-size:11px;color:#dbe5f1;font-weight:720;margin-top:4px;overflow-wrap:anywhere}.entity-panel-btn{white-space:nowrap}
      @media(max-width:1050px){.entity-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.entity-main-grid,.entity-lower-grid{grid-template-columns:1fr}.entity-link-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:650px){.entity-hero{display:block}.entity-actions{justify-content:flex-start;margin-top:12px}.entity-name{font-size:23px}.entity-kpis{grid-template-columns:1fr 1fr}.entity-timeline-row{grid-template-columns:70px minmax(0,1fr) auto}.entity-timeline-row .entity-status{grid-column:2/4;justify-self:start}.entity-link-summary{grid-template-columns:1fr 1fr}.entity-link-row{grid-template-columns:1fr auto}.entity-link-row .btn{grid-column:1/3;justify-self:start}.entity-info{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function ensurePage(){
    injectStyles();
    let page=document.getElementById(PAGE_ID);if(page)return page;
    const main=document.querySelector('.main');if(!main)return null;
    page=document.createElement('section');page.className='page';page.id=PAGE_ID;main.appendChild(page);return page;
  }

  function sharedReceivable(t){
    if(!t||String(t.type||'').toLowerCase()!=='receita')return false;
    const id=String(t.id||''),d=String(t.description||''),n=String(t.notes||'');
    return id.startsWith('shared-')&&(d.toLowerCase().startsWith('reembolso')||n.includes('Valor a receber referente à despesa compartilhada'));
  }
  function sharedExpense(t){return !!t&&String(t.type||'').toLowerCase()==='despesa'&&String(t.id||'').startsWith('shared-')}
  function relationValues(t){
    if(!t)return[];
    const keys=['sharedExpenseId','shared_expense_id','sharedId','shared_id','shareId','share_id','originTransactionId','origin_transaction_id','parentTransactionId','parent_transaction_id','linkedTransactionId','linked_transaction_id'];
    return keys.map(k=>t[k]).filter(Boolean).map(String);
  }
  function commonRelation(a,b){const A=new Set(relationValues(a));return relationValues(b).some(v=>A.has(v))}
  function relationBaseName(t){
    let d=String(t?.description||'').replace(/^\s*reembolso\s*[—–-]\s*/i,'');
    return norm(d);
  }
  function relatedByText(a,b){
    const aa=relationBaseName(a),bb=relationBaseName(b);if(!aa||!bb)return false;
    if(aa===bb)return true;
    if(aa.length>=6&&(bb.includes(aa)||aa.includes(bb)))return true;
    const notesA=norm(a?.notes),notesB=norm(b?.notes);
    return (aa.length>=6&&notesB.includes(aa))||(bb.length>=6&&notesA.includes(bb));
  }

  function resolveEntity(kind,id){
    if(kind==='expense'){
      const item=(state?.debts||[]).find(x=>String(x.id)===String(id));
      return item?{kind:'expense',id:String(item.id),item}:null;
    }
    if(kind==='income'){
      const item=(state?.incomePlans||[]).find(x=>String(x.id)===String(id));
      return item?{kind:'income',id:String(item.id),item}:null;
    }
    if(kind==='transaction'){
      const item=allTx().find(x=>String(x.id)===String(id));if(!item)return null;
      if(item.debtManaged===true&&item.debtId&&(state?.debts||[]).some(x=>String(x.id)===String(item.debtId)))return resolveEntity('expense',item.debtId);
      if(item.incomeManaged===true&&item.incomePlanId&&(state?.incomePlans||[]).some(x=>String(x.id)===String(item.incomePlanId)))return resolveEntity('income',item.incomePlanId);
      return{kind:'transaction',id:String(item.id),item};
    }
    return null;
  }

  function entityName(entity){return entity?.kind==='expense'?entity.item.name:entity?.kind==='income'?entity.item.name:entity?.item?.description||'Lançamento'}
  function entityType(entity){
    if(entity.kind==='expense')return'Despesa';
    if(entity.kind==='income')return'Receita';
    if(sharedReceivable(entity.item))return'Reembolso';
    return String(entity.item.type||'Lançamento');
  }
  function occurrences(entity){
    if(entity.kind==='expense')return allTx().filter(t=>t.debtManaged===true&&String(t.debtId)===entity.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(entity.kind==='income')return allTx().filter(t=>t.incomeManaged===true&&String(t.incomePlanId)===entity.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    return[entity.item];
  }
  function isRealized(entity,t){const s=statusKey(t?.status);return entity.kind==='expense'||String(t?.type).toLowerCase()==='despesa'?s==='pago':s==='recebido'}

  function oppositeLinks(entity){
    const source=occurrences(entity),type=entity.kind==='expense'?'despesa':entity.kind==='income'?'receita':String(entity.item.type||'').toLowerCase();
    const want=type==='despesa'?'receita':'despesa',candidates=allTx().filter(t=>String(t.type||'').toLowerCase()===want),seen=new Set(),out=[];
    for(const candidate of candidates){
      let matched=false,sourceTx=null;
      for(const s of source){
        if(commonRelation(s,candidate)||(String(s.id||'').startsWith('shared-')&&String(candidate.id||'').startsWith('shared-')&&relatedByText(s,candidate))){matched=true;sourceTx=s;break}
        if((sharedExpense(s)&&sharedReceivable(candidate))||(sharedReceivable(s)&&sharedExpense(candidate))){if(relatedByText(s,candidate)){matched=true;sourceTx=s;break}}
      }
      if(!matched&&entity.kind!=='transaction'){
        const n=norm(entityName(entity));
        if(n.length>=5&&String(candidate.id||'').startsWith('shared-')&&(relationBaseName(candidate)===n||norm(candidate.notes).includes(n)))matched=true;
      }
      if(matched&&!seen.has(String(candidate.id))){seen.add(String(candidate.id));out.push({tx:candidate,sourceTx,automatic:true})}
    }
    return out.sort((a,b)=>String(b.tx.date||'').localeCompare(String(a.tx.date||'')));
  }

  function currentAmount(entity){
    const ym=selectedMonth();
    if(entity.kind==='expense')return typeof window.expenseAmountForMonth==='function'?Number(window.expenseAmountForMonth(entity.item,ym))||0:Number(entity.item.installmentAmount)||0;
    if(entity.kind==='income')return typeof window.incomeAmountForMonth==='function'?Number(window.incomeAmountForMonth(entity.item,ym))||0:Number(entity.item.amount)||0;
    return Number(entity.item.amount)||0;
  }
  function nextOccurrence(entity){return occurrences(entity).find(t=>!isRealized(entity,t)&&String(t.date||'')>=`${selectedMonth()}-01`)||occurrences(entity).find(t=>!isRealized(entity,t))||null}
  function realizedTotal(entity){return occurrences(entity).filter(t=>isRealized(entity,t)).reduce((s,t)=>s+(Number(t.amount)||0),0)}
  function remainingTotal(entity){return occurrences(entity).filter(t=>!isRealized(entity,t)).reduce((s,t)=>s+(Number(t.amount)||0),0)}

  function activeInMonth(entity,ym){
    if(entity.kind==='expense'){
      const d=entity.item;if(ym<d.firstMonth)return false;if(d.openEnded)return true;
      const elapsed=monthDiffLocal(d.firstMonth,ym),first=Math.max(1,Number(d.firstInstallment)||1),total=Math.max(first,Number(d.totalInstallments)||first);
      return elapsed>=0&&first+elapsed<=total;
    }
    if(entity.kind==='income'){
      const p=entity.item;if(ym<p.firstMonth)return false;if(p.mode!=='mensal')return ym===p.firstMonth;if(p.openEnded)return true;return !p.lastMonth||ym<=p.lastMonth;
    }
    return ym===ymOf(entity.item.date);
  }
  function amountInMonth(entity,ym){
    if(!activeInMonth(entity,ym))return 0;
    if(entity.kind==='expense')return typeof window.expenseAmountForMonth==='function'?Number(window.expenseAmountForMonth(entity.item,ym))||0:Number(entity.item.installmentAmount)||0;
    if(entity.kind==='income')return typeof window.incomeAmountForMonth==='function'?Number(window.incomeAmountForMonth(entity.item,ym))||0:Number(entity.item.amount)||0;
    return Number(entity.item.amount)||0;
  }
  function impact12(entity){let total=0;const start=selectedMonth();for(let i=1;i<=PANEL_MONTHS;i++)total+=amountInMonth(entity,addMonth(start,i));return Math.round(total*100)/100}
  function systemImpact12(entity){
    const fp=window.financeProjection;if(!fp?.flowForMonth)return 0;let total=0;const start=selectedMonth(),cfg=fp.allSources?.();
    for(let i=1;i<=PANEL_MONTHS;i++){
      const row=fp.flowForMonth(addMonth(start,i),cfg)||{};
      total+=entity.kind==='income'||(entity.kind==='transaction'&&String(entity.item.type).toLowerCase()==='receita')?(Number(row.income)||0):(Number(row.expense)||Number(row.otherExpense)||0);
    }
    return total;
  }

  function chartSeries(entity){
    const start=entity.kind==='transaction'?ymOf(entity.item.date):String(entity.item.firstMonth||selectedMonth());
    let from=start;
    if(monthDiffLocal(start,selectedMonth())>6)from=start;else if(monthDiffLocal(start,selectedMonth())>=0)from=start;else from=addMonth(selectedMonth(),-6);
    const out=[];for(let i=0;i<18;i++){const ym=addMonth(from,i);if(entity.kind!=='transaction'&&ym<start)continue;out.push({label:monthLabel(ym),value:amountInMonth(entity,ym),ym})}
    return out.filter(x=>x.value||entity.kind!=='transaction');
  }

  function historyEntries(entity){
    if(entity.kind==='transaction')return[];
    const item=entity.item,base=entity.kind==='expense'?Number(item.installmentAmount)||0:Number(item.amount)||0,raw=Array.isArray(item.amountVersions)?item.amountVersions:(Array.isArray(item.amountHistory)?item.amountHistory:[]),out=[{ym:item.firstMonth,value:base,note:'Valor inicial'}];
    raw.filter(x=>x?.fromMonth).forEach(x=>out.push({ym:String(x.fromMonth),value:Number(x.amount)||0,note:'Novo valor a partir deste mês'}));
    const overrides=item.monthOverrides&&typeof item.monthOverrides==='object'?item.monthOverrides:{};Object.entries(overrides).forEach(([ym,value])=>out.push({ym,value:Number(value)||0,note:'Alteração somente nesta competência'}));
    return out.sort((a,b)=>String(b.ym).localeCompare(String(a.ym)));
  }

  function infoItems(entity){
    if(entity.kind==='expense'){
      const d=entity.item;return[['Conta / credor',d.account||'—'],['Categoria',d.category||'—'],['Primeiro mês',monthLabel(d.firstMonth)],['Vencimento',`Dia ${d.dueDay||'—'}`],['Parcela inicial',String(d.firstInstallment||1)],['Prazo',d.openEnded?'Sem data final':`${d.totalInstallments||'—'} parcelas`],['Observação',d.notes||'—']];
    }
    if(entity.kind==='income'){
      const p=entity.item;return[['Conta de recebimento',p.account||'—'],['Categoria',p.category||'—'],['Primeiro mês',monthLabel(p.firstMonth)],['Último mês',p.openEnded?'Sem data final':monthLabel(p.lastMonth||p.firstMonth)],['Recebimento',`Dia ${p.dueDay||'—'}`],['Periodicidade',p.mode==='mensal'?'Mensal':'Única'],['Observação',p.notes||'—']];
    }
    const t=entity.item;return[['Conta',t.account||'—'],['Categoria',t.category||'—'],['Data',dateLabel(t.date)],['Natureza',sharedReceivable(t)?'Reembolso':t.nature||'—'],['Status',t.status||'—'],['Observação',t.notes||'—']];
  }

  function statusClass(status){const s=statusKey(status);if(s==='pago'||s==='recebido'||s==='paga')return'paid';if(s==='pendente'||s==='aberta'||s==='não paga'||s==='nao paga')return'pending';return'waiting'}
  function entityStatus(entity){
    if(entity.kind==='transaction')return entity.item.status||'—';
    const rows=occurrences(entity),pending=rows.filter(t=>!isRealized(entity,t));if(!pending.length&&!entity.item.openEnded)return entity.kind==='expense'?'Quitada':'Concluída';return'Ativa';
  }

  function editEntity(){
    if(!currentEntity)return;
    if(currentEntity.kind==='expense'&&typeof window.editDebtPlan==='function'){window.editDebtPlan(currentEntity.id);return}
    if(currentEntity.kind==='income'&&typeof window.editIncomePlan==='function'){window.editIncomePlan(currentEntity.id);return}
    if(currentEntity.kind==='transaction'&&!String(currentEntity.id).startsWith('shared-')&&typeof window.editTx==='function')window.editTx(currentEntity.id);
  }

  function backToParent(){
    const page=returnPage||'dashboard',nav=document.querySelector(`.nav [data-page="${CSS.escape(page)}"]`);
    if(nav){nav.click();return}
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));
  }

  function renderLinks(entity){
    const links=oppositeLinks(entity),isExpense=entity.kind==='expense'||(entity.kind==='transaction'&&String(entity.item.type).toLowerCase()==='despesa'),gross=currentAmount(entity),expected=links.reduce((s,x)=>s+(Number(x.tx.amount)||0),0),received=links.filter(x=>statusKey(x.tx.status)==='recebido'||statusKey(x.tx.status)==='pago').reduce((s,x)=>s+(Number(x.tx.amount)||0),0),net=Math.max(0,gross-expected);
    const summary=isExpense&&links.length?`<div class="entity-link-summary"><div class="entity-link-mini"><div class="k">Custo bruto</div><div class="v">${money(gross)}</div></div><div class="entity-link-mini"><div class="k">Reembolso esperado</div><div class="v">${money(expected)}</div></div><div class="entity-link-mini"><div class="k">Reembolso recebido</div><div class="v">${money(received)}</div></div><div class="entity-link-mini"><div class="k">Custo líquido esperado</div><div class="v">${money(net)}</div></div></div>`:'';
    const title=isExpense?'Receitas vinculadas':'Despesas vinculadas';
    const rows=links.length?links.map(({tx})=>`<div class="entity-link-row"><div><div class="entity-link-name">${esc(tx.description||entityType(resolveEntity('transaction',tx.id))||'Lançamento')}</div><div class="entity-link-note">${sharedReceivable(tx)?'Reembolso de despesa compartilhada':'Vínculo financeiro detectado'} · ${esc(tx.status||'—')} · ${esc(dateLabel(tx.date))}</div></div><div class="entity-link-value">${money(tx.amount)}</div><button type="button" class="btn small" data-entity-link-open="${esc(tx.id)}">Ver</button></div>`).join(''):`<div class="entity-empty">Nenhum vínculo financeiro identificado para este item.</div>`;
    return `<div class="card entity-card entity-section"><div class="entity-card-head"><div><div class="entity-card-title">Vínculos financeiros</div><div class="entity-card-sub">${title} e relações automáticas de compartilhamento.</div></div><span class="entity-chip info">${links.length} vínculo${links.length===1?'':'s'}</span></div>${summary}<div class="entity-links">${rows}</div></div>`;
  }

  function renderPanel(entity){
    const page=ensurePage();if(!page)return;currentEntity=entity;
    const rows=occurrences(entity),next=nextOccurrence(entity),realized=realizedTotal(entity),remaining=remainingTotal(entity),impact=impact12(entity),systemTotal=systemImpact12(entity),share=systemTotal>0?Math.min(100,impact/systemTotal*100):0,status=entityStatus(entity),name=entityName(entity),type=entityType(entity),amount=currentAmount(entity),isExpense=entity.kind==='expense'||(entity.kind==='transaction'&&String(entity.item.type).toLowerCase()==='despesa'),history=historyEntries(entity),info=infoItems(entity),series=chartSeries(entity),canEdit=entity.kind!=='transaction'||!String(entity.id).startsWith('shared-');
    const primaryKpis=isExpense
      ?[['Valor atual',money(amount),'Valor vigente desta despesa'],['Próximo vencimento',next?dateLabel(next.date):'—',next?money(next.amount):(status==='Quitada'?'Despesa quitada':'Sem pendências')],['Pago até agora',money(realized),`${rows.filter(t=>isRealized(entity,t)).length} competência(s) realizada(s)`],[entity.item?.openEnded?'Próximos 12 meses':'Saldo restante',entity.item?.openEnded?money(impact):money(remaining),entity.item?.openEnded?'Impacto futuro estimado':'Competências ainda não pagas']]
      :[['Valor atual',money(amount),'Valor vigente desta receita'],['Próximo recebimento',next?dateLabel(next.date):'—',next?money(next.amount):(status==='Concluída'?'Receita concluída':'Sem pendências')],['Recebido até agora',money(realized),`${rows.filter(t=>isRealized(entity,t)).length} competência(s) realizada(s)`],[entity.item?.openEnded?'Próximos 12 meses':'A receber',entity.item?.openEnded?money(impact):money(remaining),entity.item?.openEnded?'Entrada futura estimada':'Competências ainda não recebidas']];

    page.innerHTML=`
      <button type="button" class="entity-panel-back" id="entityPanelBack">← Voltar</button>
      <div class="entity-hero"><div class="entity-hero-main"><div class="entity-eyebrow">Painel ${isExpense?'da despesa':'da receita'} · versão de teste</div><div class="entity-name">${esc(name)}</div><div class="entity-meta"><span class="entity-chip ${isExpense?'warn':'ok'}">${esc(type)}</span><span class="entity-chip">${esc(entity.item.category||'Sem categoria')}</span><span class="entity-chip ${status==='Ativa'?'ok':''}">${esc(status)}</span>${sharedReceivable(entity.item)?'<span class="entity-chip info">Reembolso</span>':''}</div></div><div class="entity-actions">${canEdit?'<button type="button" class="btn" id="entityPanelEdit">Editar</button>':''}</div></div>
      <div class="entity-kpis">${primaryKpis.map(([k,v,s])=>`<div class="card entity-kpi"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('')}</div>
      <div class="entity-main-grid"><div class="card entity-card"><div class="entity-card-head"><div><div class="entity-card-title">Evolução do valor</div><div class="entity-card-sub">Valor por competência, preservando alterações históricas.</div></div></div><div class="entity-chart-wrap"><canvas id="entityValueChart"></canvas></div></div><div class="card entity-card"><div class="entity-card-head"><div><div class="entity-card-title">Impacto financeiro</div><div class="entity-card-sub">Próximos ${PANEL_MONTHS} meses a partir da competência selecionada.</div></div></div><div class="entity-impact-value">${money(impact)}</div><div class="entity-impact-track"><span style="width:${share.toFixed(2)}%"></span></div><div class="entity-card-sub">${systemTotal>0?`${share.toFixed(1).replace('.',',')}% ${isExpense?'das saídas':'das entradas'} projetadas no período`:'Participação geral indisponível'}</div><div class="entity-impact-list"><div class="entity-impact-row"><span>Valor mensal atual</span><strong>${money(amount)}</strong></div><div class="entity-impact-row"><span>${isExpense?'Total pago':'Total recebido'}</span><strong>${money(realized)}</strong></div><div class="entity-impact-row"><span>${isExpense?'Saldo pendente':'A receber'}</span><strong>${money(remaining)}</strong></div></div></div></div>
      <div class="card entity-table-card entity-section"><div class="entity-table-head"><div class="entity-card-title">Competências</div><div class="entity-card-sub">A despesa/receita é o objeto principal; cada linha abaixo é um lançamento associado.</div></div><div class="entity-timeline">${rows.length?rows.slice(-24).map(t=>`<div class="entity-timeline-row"><div class="entity-period">${esc(monthLabel(ymOf(t.date)))}</div><div class="entity-desc">${esc(t.description||name)}</div><div class="entity-amount">${money(t.amount)}</div><span class="entity-status ${statusClass(t.status)}">${esc(t.status||'—')}</span></div>`).join(''):'<div class="entity-empty">Nenhuma competência vinculada.</div>'}</div></div>
      ${renderLinks(entity)}
      <div class="entity-lower-grid"><div class="card entity-card"><div class="entity-card-head"><div><div class="entity-card-title">Histórico de valores</div><div class="entity-card-sub">Versões e exceções registradas.</div></div></div><div class="entity-history">${history.length?history.map(h=>`<div class="entity-history-row"><div class="entity-history-date">${esc(monthLabel(h.ym))}</div><div class="entity-history-note">${esc(h.note)}</div><div class="entity-history-value">${money(h.value)}</div></div>`).join(''):'<div class="entity-empty">Sem alterações de valor registradas.</div>'}</div></div><div class="card entity-card"><div class="entity-card-head"><div><div class="entity-card-title">Informações do cadastro</div><div class="entity-card-sub">Dados estruturais deste item financeiro.</div></div></div><div class="entity-info">${info.map(([k,v])=>`<div class="entity-info-item"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div></div>`;

    page.querySelector('#entityPanelBack').onclick=backToParent;
    page.querySelector('#entityPanelEdit')?.addEventListener('click',editEntity);
    page.querySelectorAll('[data-entity-link-open]').forEach(btn=>btn.onclick=()=>openPanel('transaction',btn.dataset.entityLinkOpen,'financial-entity'));
    requestAnimationFrame(()=>drawValueChart(series));
  }

  function drawValueChart(data){
    const canvas=document.getElementById('entityValueChart');if(!canvas)return;
    if(!data?.length){const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height);return}
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.max(300,Math.round(rect.width||700)),H=Math.max(180,Math.round(rect.height||235));
    canvas.width=W*dpr;canvas.height=H*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const p={l:52,r:14,t:18,b:34},values=data.map(x=>Number(x.value)||0),min=Math.min(0,...values),rawMax=Math.max(...values),max=rawMax===min?min+1:rawMax+(rawMax-min)*.12,x=i=>p.l+(W-p.l-p.r)*(data.length===1?.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    ctx.lineWidth=1;ctx.strokeStyle='#22344a';ctx.fillStyle='#71849c';ctx.font='10px DM Mono, monospace';for(let i=0;i<4;i++){const val=min+(max-min)*i/3,yy=y(val);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),4,yy+3)}
    ctx.strokeStyle='#65aaff';ctx.lineWidth=2.5;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
    data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);ctx.fillStyle='#65aaff';ctx.beginPath();ctx.arc(xx,yy,3.2,0,Math.PI*2);ctx.fill();if(data.length<=12||i%2===0){ctx.fillStyle='#71849c';ctx.font='9px DM Mono, monospace';ctx.save();ctx.translate(xx,H-10);ctx.rotate(-.28);ctx.fillText(d.label,-13,0);ctx.restore()}});
  }

  function openPanel(kind,id,forcedReturn){
    const entity=resolveEntity(kind,id);if(!entity)return;
    const active=document.querySelector('.page.active');
    if(forcedReturn&&forcedReturn!=='financial-entity')returnPage=forcedReturn;
    else if(active&&active.id!==PAGE_ID)returnPage=active.id.replace(/^page-/,'');
    ensurePage();document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===PAGE_ID));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===returnPage));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
    const isExpense=entity.kind==='expense'||(entity.kind==='transaction'&&String(entity.item.type).toLowerCase()==='despesa');
    if(title)title.textContent=isExpense?'Painel da despesa':'Painel da receita';
    if(sub)sub.textContent='Competências, impacto, histórico e vínculos financeiros';
    renderPanel(entity);
  }
  window.openFinancialEntityPanel=openPanel;
  window.closeFinancialEntityPanel=backToParent;

  function parseId(button,fn){const code=button?.getAttribute('onclick')||'',m=code.match(new RegExp(`${fn}\\(['\"]([^'\"]+)['\"]\\)`));return m?.[1]||null}
  function decoratePlans(){
    document.querySelectorAll('#debtTableBody .debt-actions').forEach(actions=>{if(actions.querySelector('.entity-panel-btn'))return;const id=parseId(actions.querySelector('button[onclick*="editDebtPlan("]'),'editDebtPlan');if(!id)return;const b=document.createElement('button');b.type='button';b.className='btn small entity-panel-btn';b.textContent='Painel';b.onclick=()=>openPanel('expense',id,'debts');actions.prepend(b)});
    document.querySelectorAll('#incomeTableBody .income-actions').forEach(actions=>{if(actions.querySelector('.entity-panel-btn'))return;const id=parseId(actions.querySelector('button[onclick*="editIncomePlan("]'),'editIncomePlan');if(!id)return;const b=document.createElement('button');b.type='button';b.className='btn small entity-panel-btn';b.textContent='Painel';b.onclick=()=>openPanel('income',id,'incomes');actions.prepend(b)});
  }
  function decorateHistory(){
    document.querySelectorAll('#historyBody tr').forEach(row=>{if(row.querySelector('.entity-panel-btn'))return;const edit=row.querySelector('button[onclick*="editTx("]'),id=parseId(edit,'editTx');if(!id)return;const cells=row.querySelectorAll('td'),cell=cells[cells.length-1];if(!cell)return;const b=document.createElement('button');b.type='button';b.className='btn small entity-panel-btn';b.textContent='Painel';b.style.marginLeft='6px';b.onclick=e=>{e.stopPropagation();openPanel('transaction',id,'history')};cell.appendChild(b)});
  }
  function decorateSharedIncome(){
    const rows=[...document.querySelectorAll('#sharedIncomeBody tr')],receivables=allTx().filter(sharedReceivable).filter(t=>ymOf(t.date)===selectedMonth());
    rows.forEach(row=>{if(row.querySelector('.entity-panel-btn'))return;const name=row.querySelector('td strong')?.textContent?.trim();if(!name)return;const tx=receivables.find(t=>String(t.description||'').trim()===name);if(!tx)return;const first=row.querySelector('td');const b=document.createElement('button');b.type='button';b.className='btn small entity-panel-btn';b.textContent='Painel';b.style.marginTop='7px';b.onclick=()=>openPanel('transaction',tx.id,'incomes');first?.appendChild(document.createElement('br'));first?.appendChild(b)});
  }
  function decorate(){decoratePlans();decorateHistory();decorateSharedIncome()}

  function init(){
    injectStyles();ensurePage();decorate();
    observer=new MutationObserver(()=>requestAnimationFrame(decorate));observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="debts"],[data-page="incomes"],[data-page="history"]'))setTimeout(decorate,40)},true);
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(currentEntity&&document.getElementById(PAGE_ID)?.classList.contains('active'))drawValueChart(chartSeries(currentEntity))},120)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
