(function(){
  if(window.__prumoFinancialEntityPanelRuntimeV2)return;
  window.__prumoFinancialEntityPanelRuntimeV2=true;

  const BACKDROP_ID='prumoFinancialPanelBackdropV2';
  const PANEL_ID='prumoFinancialPanelV2';
  const STYLE_ID='prumoFinancialPanelStyleV2';
  const HORIZON=12;
  let current=null;
  let resizeTimer=0;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const num=v=>Number(v)||0;
  const money=v=>{try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v))}catch(e){return `R$ ${num(v).toFixed(2).replace('.',',')}`}};
  const monthLabel=ym=>{try{return typeof fmtMonth==='function'?fmtMonth(ym):ym}catch(e){return ym||'—'}};
  const dateLabel=d=>{try{return typeof fmtDate==='function'?fmtDate(String(d||'').slice(0,10)):String(d||'')}catch(e){return String(d||'')}};
  const ymOf=d=>String(d||'').slice(0,7);
  const statusKey=v=>String(v||'').trim().toLowerCase();
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(reembolso|receita|despesa|compartilhada|compartilhado)\b/g,' ').replace(/\bparcela\s+\d+\s*\/\s*(?:\d+|∞)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const addMonth=(ym,n)=>{try{if(typeof ymAdd==='function')return ymAdd(ym,n)}catch(e){}const[y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
  const monthDiff=(a,b)=>{const[ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);return(yb-ya)*12+(mb-ma)};
  const getState=()=>{try{return typeof state!=='undefined'?state:window.state}catch(e){return window.state}};
  const selectedMonth=()=>String(getState()?.settings?.selectedMonth||new Date().toISOString().slice(0,7));
  const transactions=()=>Array.isArray(getState()?.transactions)?getState().transactions:[];

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #${BACKDROP_ID}{position:fixed;inset:0;z-index:2147483000;background:rgba(2,7,14,.74);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:none}
      #${BACKDROP_ID}.open{display:block}
      #${PANEL_ID}{position:fixed;z-index:2147483001;left:50%;top:50%;width:min(1160px,calc(100vw - 64px));max-height:calc(100vh - 54px);overflow:auto;overscroll-behavior:contain;transform:translate(-50%,-50%);background:#091523;border:1px solid #26384e;border-radius:22px;box-shadow:0 34px 95px rgba(0,0,0,.62);padding:24px;display:none;color:#e7edf5}
      #${PANEL_ID}.open{display:block;animation:prumoPanelV2In .2s cubic-bezier(.2,.75,.25,1) both}
      body.prumo-financial-panel-open{overflow:hidden!important}
      @keyframes prumoPanelV2In{from{opacity:0;transform:translate(-50%,-47%) scale(.985)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      .pfp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:16px}.pfp-head-main{min-width:0}.pfp-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#71849c;font-weight:800;margin-bottom:6px}.pfp-title{font-size:28px;line-height:1.08;font-weight:850;letter-spacing:-.03em;color:#f3f7fb}.pfp-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.pfp-chip{display:inline-flex;align-items:center;padding:4px 8px;border:1px solid #2b4058;border-radius:999px;background:#0d1b2c;color:#aebed0;font-size:10px;font-weight:760}.pfp-chip.ok{border-color:#28513e;background:#10271d;color:#9dd8b6}.pfp-chip.warn{border-color:#675226;background:#30250f;color:#efd18c}.pfp-chip.info{border-color:#294b6c;background:#10243a;color:#abd5f3}.pfp-actions{display:flex;gap:8px;align-items:center}.pfp-close{width:36px;height:36px;display:grid;place-items:center;border-radius:999px;border:1px solid #31445b;background:#101e30;color:#c6d0dc;font-size:20px;cursor:pointer}.pfp-close:hover{color:#fff;border-color:#4c647e}
      .pfp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:14px}.pfp-card{border:1px solid #203149;background:#0d1929;border-radius:15px}.pfp-kpi{padding:14px 15px;min-height:103px}.pfp-kpi .k{font-size:10px;color:#8193a9;margin-bottom:9px}.pfp-kpi .v{font-size:19px;font-weight:840;letter-spacing:-.02em;color:#eef3f9;font-variant-numeric:tabular-nums}.pfp-kpi .s{font-size:10px;color:#71849c;margin-top:6px;line-height:1.35}
      .pfp-main{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(300px,.7fr);gap:14px;margin-bottom:14px}.pfp-section{padding:15px}.pfp-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.pfp-section-title{font-size:13px;font-weight:810;color:#eef3f9}.pfp-section-sub{font-size:10px;color:#71849c;margin-top:3px;line-height:1.45}.pfp-chart{height:225px}.pfp-chart canvas{width:100%!important;height:225px!important;display:block}.pfp-impact-value{font-size:27px;font-weight:850;letter-spacing:-.03em}.pfp-impact-track{height:8px;background:#172338;border-radius:999px;overflow:hidden;margin:11px 0 7px}.pfp-impact-track span{display:block;height:100%;border-radius:999px;background:#65aaff}.pfp-impact-list{display:grid;gap:8px;margin-top:14px}.pfp-impact-row{display:flex;justify-content:space-between;gap:12px;font-size:11px;color:#899bb0}.pfp-impact-row strong{color:#dbe5f1;font-variant-numeric:tabular-nums}
      .pfp-table{overflow:hidden;margin-bottom:14px}.pfp-table-head{padding:14px 15px;border-bottom:1px solid #203149}.pfp-row{display:grid;grid-template-columns:90px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:11px 15px;border-bottom:1px solid rgba(148,163,184,.09);font-size:11px}.pfp-row:last-child{border-bottom:0}.pfp-period{font-weight:780;color:#dbe5f1}.pfp-desc{min-width:0;color:#9bacbf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pfp-value{font-weight:790;color:#eef3f9;font-variant-numeric:tabular-nums}.pfp-status{display:inline-flex;padding:4px 7px;border-radius:999px;border:1px solid #3a4656;background:#151d29;color:#9ba9b8;font-size:9px;font-weight:780;white-space:nowrap}.pfp-status.paid{border-color:#28513e;background:#10271d;color:#9dd8b6}.pfp-status.pending{border-color:#675226;background:#30250f;color:#efd18c}.pfp-status.waiting{border-color:#294b6c;background:#10243a;color:#abd5f3}
      .pfp-link-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:11px}.pfp-mini{padding:10px 11px;border:1px solid #203149;border-radius:11px;background:#0a1524}.pfp-mini .k{font-size:9px;color:#71849c}.pfp-mini .v{font-size:13px;font-weight:800;color:#e6edf5;margin-top:4px}.pfp-links{display:grid;gap:8px}.pfp-link{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid #203149;border-radius:11px;background:#0a1524}.pfp-link-name{font-size:11px;font-weight:790;color:#dce6f2}.pfp-link-note{font-size:9px;color:#71849c;margin-top:3px}.pfp-link-value{font-size:11px;font-weight:800;color:#eef3f9}.pfp-empty{padding:18px 14px;text-align:center;color:#71849c;font-size:11px}
      .pfp-lower{display:grid;grid-template-columns:1fr 1fr;gap:14px}.pfp-history{display:grid;gap:8px}.pfp-history-row{display:grid;grid-template-columns:100px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border:1px solid #203149;border-radius:10px;background:#0a1524;font-size:10px}.pfp-history-date{color:#91a2b8;font-weight:720}.pfp-history-note{color:#71849c}.pfp-history-value{font-weight:800;color:#e6edf5}.pfp-info{display:grid;grid-template-columns:1fr 1fr;gap:9px}.pfp-info-item{padding:9px 10px;border:1px solid #203149;border-radius:10px;background:#0a1524}.pfp-info-item .k{font-size:9px;color:#71849c}.pfp-info-item .v{font-size:11px;color:#dbe5f1;font-weight:720;margin-top:4px;overflow-wrap:anywhere}
      .pfp-panel-btn{white-space:nowrap}
      body.prumo-financial-panel-open .modal-backdrop.open{z-index:2147483200!important}
      @media(max-width:1020px){.pfp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pfp-main,.pfp-lower{grid-template-columns:1fr}.pfp-link-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:680px){#${PANEL_ID}{left:8px;right:8px;top:8px;bottom:8px;width:auto;max-height:none;transform:none;border-radius:18px;padding:18px 14px}.pfp-head{display:block}.pfp-actions{margin-top:12px}.pfp-title{font-size:23px}.pfp-kpis{grid-template-columns:1fr 1fr}.pfp-row{grid-template-columns:72px minmax(0,1fr) auto}.pfp-row .pfp-status{grid-column:2/4;justify-self:start}.pfp-link{grid-template-columns:1fr auto}.pfp-link .btn{grid-column:1/3;justify-self:start}.pfp-info{grid-template-columns:1fr}@keyframes prumoPanelV2In{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}}
      @media(prefers-reduced-motion:reduce){#${PANEL_ID}.open{animation:none!important}}
    `;document.head.appendChild(s);
  }

  function ensureShell(){
    injectStyle();
    let back=document.getElementById(BACKDROP_ID);if(!back){back=document.createElement('div');back.id=BACKDROP_ID;back.addEventListener('click',close);document.body.appendChild(back)}
    let panel=document.getElementById(PANEL_ID);if(!panel){panel=document.createElement('div');panel.id=PANEL_ID;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');document.body.appendChild(panel)}
    return panel;
  }

  function parseInline(button,fn){const code=button?.getAttribute('onclick')||'',m=code.match(new RegExp(`${fn}\\(['\"]([^'\"]+)['\"]\\)`));return m?.[1]||null}

  function sharedReceivable(t){
    if(!t||String(t.type||'').toLowerCase()!=='receita')return false;
    const id=String(t.id||''),d=String(t.description||''),n=String(t.notes||'');
    return id.startsWith('shared-')&&(d.toLowerCase().startsWith('reembolso')||n.includes('Valor a receber referente à despesa compartilhada'));
  }
  function sharedExpense(t){return !!t&&String(t.type||'').toLowerCase()==='despesa'&&String(t.id||'').startsWith('shared-')}

  function resolve(kind,id){
    const s=getState();if(!s)return null;
    if(kind==='expense'){const item=(s.debts||[]).find(x=>String(x.id)===String(id));return item?{kind:'expense',id:String(item.id),item}:null}
    if(kind==='income'){const item=(s.incomePlans||[]).find(x=>String(x.id)===String(id));return item?{kind:'income',id:String(item.id),item}:null}
    const item=(s.transactions||[]).find(x=>String(x.id)===String(id));if(!item)return null;
    if(item.debtManaged===true&&item.debtId)return resolve('expense',item.debtId)||{kind:'transaction',id:String(item.id),item};
    if(item.incomeManaged===true&&item.incomePlanId)return resolve('income',item.incomePlanId)||{kind:'transaction',id:String(item.id),item};
    return{kind:'transaction',id:String(item.id),item};
  }

  function routeFrom(trigger){
    if(trigger.dataset?.pfpKind&&trigger.dataset?.pfpId)return{kind:trigger.dataset.pfpKind,id:trigger.dataset.pfpId};
    if(trigger.matches('[data-pfp-link]'))return{kind:'transaction',id:trigger.dataset.pfpLink};
    const debt=trigger.closest('#debtTableBody tr');if(debt){const id=parseInline(debt.querySelector('button[onclick*="editDebtPlan("]'),'editDebtPlan');if(id)return{kind:'expense',id}}
    const income=trigger.closest('#incomeTableBody tr');if(income){const id=parseInline(income.querySelector('button[onclick*="editIncomePlan("]'),'editIncomePlan');if(id)return{kind:'income',id}}
    const hist=trigger.closest('[data-history-body="1"] tr');if(hist){const id=parseInline(hist.querySelector('button[onclick*="editTx("]'),'editTx');if(id)return{kind:'transaction',id}}
    const shared=trigger.closest('#sharedIncomeBody tr');if(shared){const name=shared.querySelector('td strong')?.textContent?.trim(),tx=transactions().find(t=>sharedReceivable(t)&&String(t.description||'').trim()===name&&ymOf(t.date)===selectedMonth());if(tx)return{kind:'transaction',id:String(tx.id)}}
    return null;
  }

  function entityName(e){return e.kind==='expense'?e.item.name:e.kind==='income'?e.item.name:e.item.description||'Lançamento'}
  function entityType(e){if(e.kind==='expense')return'Despesa';if(e.kind==='income')return'Receita';if(sharedReceivable(e.item))return'Reembolso';return String(e.item.type||'Lançamento')}
  function isExpenseEntity(e){return e.kind==='expense'||(e.kind==='transaction'&&String(e.item.type||'').toLowerCase()==='despesa')}
  function occurrences(e){if(e.kind==='expense')return transactions().filter(t=>t.debtManaged===true&&String(t.debtId)===e.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(e.kind==='income')return transactions().filter(t=>t.incomeManaged===true&&String(t.incomePlanId)===e.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));return[e.item]}
  function realized(e,t){const s=statusKey(t?.status);return isExpenseEntity(e)?s==='pago':s==='recebido'}
  function currentAmount(e){const ym=selectedMonth();try{if(e.kind==='expense'&&typeof window.expenseAmountForMonth==='function')return num(window.expenseAmountForMonth(e.item,ym));if(e.kind==='income'&&typeof window.incomeAmountForMonth==='function')return num(window.incomeAmountForMonth(e.item,ym))}catch(err){}return e.kind==='expense'?num(e.item.installmentAmount):e.kind==='income'?num(e.item.amount):num(e.item.amount)}
  function nextOccurrence(e){const rows=occurrences(e);return rows.find(t=>!realized(e,t)&&String(t.date||'')>=`${selectedMonth()}-01`)||rows.find(t=>!realized(e,t))||null}
  function realizedTotal(e){return occurrences(e).filter(t=>realized(e,t)).reduce((s,t)=>s+num(t.amount),0)}
  function remainingTotal(e){return occurrences(e).filter(t=>!realized(e,t)).reduce((s,t)=>s+num(t.amount),0)}

  function activeInMonth(e,ym){
    if(e.kind==='transaction')return ym===ymOf(e.item.date);
    if(e.kind==='expense'){
      const d=e.item;if(!d.firstMonth||ym<d.firstMonth)return false;if(d.openEnded)return true;
      const elapsed=monthDiff(d.firstMonth,ym),first=Math.max(1,num(d.firstInstallment)||1),total=Math.max(first,num(d.totalInstallments)||first);return elapsed>=0&&first+elapsed<=total;
    }
    const p=e.item;if(!p.firstMonth||ym<p.firstMonth)return false;if(p.mode!=='mensal')return ym===p.firstMonth;if(p.openEnded)return true;return !p.lastMonth||ym<=p.lastMonth;
  }
  function amountAt(e,ym){if(!activeInMonth(e,ym))return 0;try{if(e.kind==='expense'&&typeof window.expenseAmountForMonth==='function')return num(window.expenseAmountForMonth(e.item,ym));if(e.kind==='income'&&typeof window.incomeAmountForMonth==='function')return num(window.incomeAmountForMonth(e.item,ym))}catch(err){}return currentAmount(e)}
  function impact12(e){let total=0,start=selectedMonth();for(let i=1;i<=HORIZON;i++)total+=amountAt(e,addMonth(start,i));return Math.round(total*100)/100}
  function systemImpact12(e){
    try{
      const fp=window.financeProjection;if(!fp?.flowForMonth)return 0;let total=0,start=selectedMonth(),cfg=fp.allSources?.();
      for(let i=1;i<=HORIZON;i++){const r=fp.flowForMonth(addMonth(start,i),cfg)||{};total+=isExpenseEntity(e)?num(r.expense||r.otherExpense):num(r.income)}
      return total;
    }catch(err){return 0}
  }

  function history(e){
    if(e.kind==='transaction')return[];
    const item=e.item,base=e.kind==='expense'?num(item.installmentAmount):num(item.amount),raw=Array.isArray(item.amountVersions)?item.amountVersions:(Array.isArray(item.amountHistory)?item.amountHistory:[]),out=[{ym:item.firstMonth,value:base,note:'Valor inicial'}];
    raw.filter(x=>x?.fromMonth).forEach(x=>out.push({ym:String(x.fromMonth),value:num(x.amount),note:'Novo valor a partir deste mês'}));
    const overrides=item.monthOverrides&&typeof item.monthOverrides==='object'?item.monthOverrides:{};Object.entries(overrides).forEach(([ym,value])=>out.push({ym,value:num(value),note:'Alteração somente nesta competência'}));
    return out.sort((a,b)=>String(b.ym).localeCompare(String(a.ym)));
  }
  function chartSeries(e){
    const start=e.kind==='transaction'?ymOf(e.item.date):String(e.item.firstMonth||selectedMonth()),from=monthDiff(start,selectedMonth())<0?addMonth(selectedMonth(),-6):start,out=[];
    for(let i=0;i<18;i++){const ym=addMonth(from,i);if(e.kind!=='transaction'&&ym<start)continue;out.push({label:monthLabel(ym),value:amountAt(e,ym),ym})}return out;
  }
  function info(e){
    if(e.kind==='expense'){const d=e.item;return[['Conta / credor',d.account||'—'],['Categoria',d.category||'—'],['Primeiro mês',monthLabel(d.firstMonth)],['Vencimento',`Dia ${d.dueDay||'—'}`],['Parcela inicial',String(d.firstInstallment||1)],['Prazo',d.openEnded?'Sem data final':`${d.totalInstallments||'—'} parcelas`],['Observação',d.notes||'—']]}
    if(e.kind==='income'){const p=e.item;return[['Conta de recebimento',p.account||'—'],['Categoria',p.category||'—'],['Primeiro mês',monthLabel(p.firstMonth)],['Último mês',p.openEnded?'Sem data final':monthLabel(p.lastMonth||p.firstMonth)],['Recebimento',`Dia ${p.dueDay||'—'}`],['Periodicidade',p.mode==='mensal'?'Mensal':'Única'],['Observação',p.notes||'—']]}
    const t=e.item;return[['Conta',t.account||'—'],['Categoria',t.category||'—'],['Data',dateLabel(t.date)],['Natureza',sharedReceivable(t)?'Reembolso':t.nature||'—'],['Status',t.status||'—'],['Observação',t.notes||'—']];
  }
  function entityStatus(e){if(e.kind==='transaction')return e.item.status||'—';const rows=occurrences(e),pending=rows.filter(t=>!realized(e,t));if(!pending.length&&!e.item.openEnded)return isExpenseEntity(e)?'Quitada':'Concluída';return'Ativa'}
  function statusClass(v){const s=statusKey(v);if(s==='pago'||s==='recebido'||s==='paga')return'paid';if(s==='pendente'||s==='aberta'||s==='não paga'||s==='nao paga')return'pending';return'waiting'}

  function relationValues(t){const keys=['sharedExpenseId','shared_expense_id','sharedId','shared_id','shareId','share_id','originTransactionId','origin_transaction_id','parentTransactionId','parent_transaction_id','linkedTransactionId','linked_transaction_id'];return keys.map(k=>t?.[k]).filter(Boolean).map(String)}
  function sameRelation(a,b){const A=new Set(relationValues(a));return relationValues(b).some(v=>A.has(v))}
  function baseName(t){return normalize(String(t?.description||'').replace(/^\s*reembolso\s*[—–-]\s*/i,''))}
  function relatedText(a,b){const aa=baseName(a),bb=baseName(b);if(!aa||!bb)return false;if(aa===bb)return true;if(aa.length>=6&&(bb.includes(aa)||aa.includes(bb)))return true;return normalize(a?.notes).includes(bb)||normalize(b?.notes).includes(aa)}
  function links(e){
    try{
      const src=occurrences(e),want=isExpenseEntity(e)?'receita':'despesa',out=[],seen=new Set();
      for(const candidate of transactions().filter(t=>String(t.type||'').toLowerCase()===want)){
        let match=false;
        for(const s of src){if(sameRelation(s,candidate)||((String(s.id||'').startsWith('shared-')||sharedExpense(s)||sharedReceivable(s))&&(String(candidate.id||'').startsWith('shared-')||sharedExpense(candidate)||sharedReceivable(candidate))&&relatedText(s,candidate))){match=true;break}}
        if(!match&&e.kind!=='transaction'){const n=normalize(entityName(e));if(n.length>=5&&String(candidate.id||'').startsWith('shared-')&&(baseName(candidate)===n||normalize(candidate.notes).includes(n)))match=true}
        if(match&&!seen.has(String(candidate.id))){seen.add(String(candidate.id));out.push(candidate)}
      }
      return out.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    }catch(err){return[]}
  }

  function renderLinks(e){
    const rows=links(e),expense=isExpenseEntity(e),gross=currentAmount(e),expected=rows.reduce((s,t)=>s+num(t.amount),0),received=rows.filter(t=>['recebido','pago'].includes(statusKey(t.status))).reduce((s,t)=>s+num(t.amount),0),net=Math.max(0,gross-expected);
    const summary=expense&&rows.length?`<div class="pfp-link-summary"><div class="pfp-mini"><div class="k">Custo bruto</div><div class="v">${money(gross)}</div></div><div class="pfp-mini"><div class="k">Reembolso esperado</div><div class="v">${money(expected)}</div></div><div class="pfp-mini"><div class="k">Reembolso recebido</div><div class="v">${money(received)}</div></div><div class="pfp-mini"><div class="k">Custo líquido esperado</div><div class="v">${money(net)}</div></div></div>`:'';
    const list=rows.length?rows.map(t=>`<div class="pfp-link"><div><div class="pfp-link-name">${esc(t.description||'Lançamento vinculado')}</div><div class="pfp-link-note">${sharedReceivable(t)?'Reembolso de despesa compartilhada':'Vínculo financeiro detectado'} · ${esc(t.status||'—')} · ${esc(dateLabel(t.date))}</div></div><div class="pfp-link-value">${money(t.amount)}</div><button type="button" class="btn small" data-pfp-link="${esc(t.id)}">Ver</button></div>`).join(''):'<div class="pfp-empty">Nenhum vínculo financeiro identificado para este item.</div>';
    return `<div class="pfp-card pfp-section" style="margin-bottom:14px"><div class="pfp-section-head"><div><div class="pfp-section-title">Vínculos financeiros</div><div class="pfp-section-sub">${expense?'Receitas vinculadas':'Despesas vinculadas'} e relações de compartilhamento.</div></div><span class="pfp-chip info">${rows.length} vínculo${rows.length===1?'':'s'}</span></div>${summary}<div class="pfp-links">${list}</div></div>`;
  }

  function isGoalManagedEntity(e){
    try{
      if(e.kind==='expense')return !!window.financeGoalManagedProtection?.isDebtPlan?.(e.id);
      if(e.kind==='income')return !!window.financeGoalManagedProtection?.isIncomePlan?.(e.id);
      if(e.kind==='transaction')return !!window.financeGoalManagedProtection?.isTransaction?.(e.item||e.id);
    }catch(_e){}
    return e.kind==='expense'?String(e.id).startsWith('goal-shared-')
      :e.kind==='income'?String(e.id).startsWith('goal-shared-income-')
      :false;
  }

  function render(e){
    const goalManaged=isGoalManagedEntity(e),panel=ensureShell(),rows=occurrences(e),next=nextOccurrence(e),done=realizedTotal(e),remaining=remainingTotal(e),future=impact12(e),system=systemImpact12(e),share=system>0?Math.min(100,future/system*100):0,status=entityStatus(e),amount=currentAmount(e),expense=isExpenseEntity(e),hist=history(e),details=info(e),series=chartSeries(e),canEdit=!goalManaged&&(e.kind!=='transaction'||!String(e.id).startsWith('shared-'));
    const kpis=expense
      ?[['Valor atual',money(amount),'Valor vigente desta despesa'],['Próximo vencimento',next?dateLabel(next.date):'—',next?money(next.amount):(status==='Quitada'?'Despesa quitada':'Sem pendências')],['Pago até agora',money(done),`${rows.filter(t=>realized(e,t)).length} competência(s) realizada(s)`],[e.item?.openEnded?'Próximos 12 meses':'Saldo restante',e.item?.openEnded?money(future):money(remaining),e.item?.openEnded?'Impacto futuro estimado':'Competências ainda não pagas']]
      :[['Valor atual',money(amount),'Valor vigente desta receita'],['Próximo recebimento',next?dateLabel(next.date):'—',next?money(next.amount):(status==='Concluída'?'Receita concluída':'Sem pendências')],['Recebido até agora',money(done),`${rows.filter(t=>realized(e,t)).length} competência(s) realizada(s)`],[e.item?.openEnded?'Próximos 12 meses':'A receber',e.item?.openEnded?money(future):money(remaining),e.item?.openEnded?'Entrada futura estimada':'Competências ainda não recebidas']];

    panel.innerHTML=`<div class="pfp-head"><div class="pfp-head-main"><div class="pfp-eyebrow">Painel ${expense?'da despesa':'da receita'}</div><div class="pfp-title">${esc(entityName(e))}</div><div class="pfp-meta"><span class="pfp-chip ${expense?'warn':'ok'}">${esc(entityType(e))}</span><span class="pfp-chip">${esc(e.item.category||'Sem categoria')}</span><span class="pfp-chip ${status==='Ativa'?'ok':''}">${esc(status)}</span>${sharedReceivable(e.item)?'<span class="pfp-chip info">Reembolso</span>':''}${goalManaged?'<span class="pfp-chip info">Gerenciado em Objetivos</span>':''}</div></div><div class="pfp-actions">${canEdit?'<button type="button" class="btn" data-pfp-edit>Editar</button>':''}<button type="button" class="pfp-close" data-pfp-close aria-label="Fechar painel">×</button></div></div>
      <div class="pfp-kpis">${kpis.map(([k,v,s])=>`<div class="pfp-card pfp-kpi"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('')}</div>
      <div class="pfp-main"><div class="pfp-card pfp-section"><div class="pfp-section-head"><div><div class="pfp-section-title">Evolução do valor</div><div class="pfp-section-sub">Valor por competência, preservando alterações históricas.</div></div></div><div class="pfp-chart"><canvas id="pfpValueChart"></canvas></div></div><div class="pfp-card pfp-section"><div class="pfp-section-head"><div><div class="pfp-section-title">Impacto financeiro</div><div class="pfp-section-sub">Próximos ${HORIZON} meses a partir da competência selecionada.</div></div></div><div class="pfp-impact-value">${money(future)}</div><div class="pfp-impact-track"><span style="width:${share.toFixed(2)}%"></span></div><div class="pfp-section-sub">${system>0?`${share.toFixed(1).replace('.',',')}% ${expense?'das saídas':'das entradas'} projetadas no período`:'Participação geral indisponível'}</div><div class="pfp-impact-list"><div class="pfp-impact-row"><span>Valor mensal atual</span><strong>${money(amount)}</strong></div><div class="pfp-impact-row"><span>${expense?'Total pago':'Total recebido'}</span><strong>${money(done)}</strong></div><div class="pfp-impact-row"><span>${expense?'Saldo pendente':'A receber'}</span><strong>${money(remaining)}</strong></div></div></div></div>
      <div class="pfp-card pfp-table"><div class="pfp-table-head"><div class="pfp-section-title">Competências</div><div class="pfp-section-sub">Cada linha é um lançamento associado à despesa ou receita.</div></div>${rows.length?rows.slice(-24).map(t=>`<div class="pfp-row"><div class="pfp-period">${esc(monthLabel(ymOf(t.date)))}</div><div class="pfp-desc">${esc(t.description||entityName(e))}</div><div class="pfp-value">${money(t.amount)}</div><span class="pfp-status ${statusClass(t.status)}">${esc(t.status||'—')}</span></div>`).join(''):'<div class="pfp-empty">Nenhuma competência vinculada.</div>'}</div>
      ${renderLinks(e)}
      <div class="pfp-lower"><div class="pfp-card pfp-section"><div class="pfp-section-head"><div><div class="pfp-section-title">Histórico de valores</div><div class="pfp-section-sub">Versões e exceções registradas.</div></div></div><div class="pfp-history">${hist.length?hist.map(h=>`<div class="pfp-history-row"><div class="pfp-history-date">${esc(monthLabel(h.ym))}</div><div class="pfp-history-note">${esc(h.note)}</div><div class="pfp-history-value">${money(h.value)}</div></div>`).join(''):'<div class="pfp-empty">Sem alterações de valor registradas.</div>'}</div></div><div class="pfp-card pfp-section"><div class="pfp-section-head"><div><div class="pfp-section-title">Informações do cadastro</div><div class="pfp-section-sub">Dados estruturais deste item financeiro.</div></div></div><div class="pfp-info">${details.map(([k,v])=>`<div class="pfp-info-item"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div></div>`;

    panel.querySelector('[data-pfp-close]')?.addEventListener('click',close);
    panel.querySelector('[data-pfp-edit]')?.addEventListener('click',()=>edit(e));
    panel.querySelectorAll('[data-pfp-link]').forEach(btn=>btn.addEventListener('click',()=>{const linked=resolve('transaction',btn.dataset.pfpLink);if(linked)open(linked)}));
    current=e;
    document.getElementById(BACKDROP_ID)?.classList.add('open');panel.classList.add('open');document.body.classList.add('prumo-financial-panel-open');
    requestAnimationFrame(()=>drawChart(series));
  }

  function drawChart(data){
    const canvas=document.getElementById('pfpValueChart');if(!canvas||!data?.length)return;
    try{
      const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.max(300,Math.round(rect.width||700)),H=Math.max(180,Math.round(rect.height||225));canvas.width=W*dpr;canvas.height=H*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
      const p={l:52,r:14,t:18,b:34},values=data.map(x=>num(x.value)),min=Math.min(0,...values),rawMax=Math.max(...values),max=rawMax===min?min+1:rawMax+(rawMax-min)*.12,x=i=>p.l+(W-p.l-p.r)*(data.length===1?0.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
      ctx.lineWidth=1;ctx.strokeStyle='#22344a';ctx.fillStyle='#71849c';ctx.font='10px monospace';for(let i=0;i<4;i++){const val=min+(max-min)*i/3,yy=y(val);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),4,yy+3)}
      ctx.strokeStyle='#65aaff';ctx.lineWidth=2.5;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();data.forEach((d,i)=>{ctx.fillStyle='#65aaff';ctx.beginPath();ctx.arc(x(i),y(d.value),3.2,0,Math.PI*2);ctx.fill()});
    }catch(err){console.warn('Falha ao desenhar gráfico do painel:',err)}
  }

  function edit(e){
    if(isGoalManagedEntity(e)){alert('Este item é gerenciado pela seção Objetivos.');return}
    try{if(e.kind==='expense'&&typeof window.editDebtPlan==='function')return window.editDebtPlan(e.id);if(e.kind==='income'&&typeof window.editIncomePlan==='function')return window.editIncomePlan(e.id);if(e.kind==='transaction'&&!String(e.id).startsWith('shared-')&&typeof window.editTx==='function')return window.editTx(e.id)}catch(err){console.error('Falha ao editar item financeiro:',err)}
  }
  function open(e){if(!e)return;try{render(e)}catch(err){console.error('Falha ao renderizar painel financeiro:',err);const p=ensureShell();p.innerHTML=`<div class="pfp-head"><div><div class="pfp-eyebrow">Painel financeiro</div><div class="pfp-title">${esc(entityName(e))}</div></div><button type="button" class="pfp-close" data-pfp-close>×</button></div><div class="pfp-card pfp-section"><div class="pfp-section-title">Não foi possível montar todos os indicadores</div><div class="pfp-section-sub" style="margin-top:8px">O item foi localizado, mas um dos cálculos auxiliares falhou. A abertura do painel continua disponível nesta versão de teste.</div></div>`;p.querySelector('[data-pfp-close]')?.addEventListener('click',close);document.getElementById(BACKDROP_ID)?.classList.add('open');p.classList.add('open');document.body.classList.add('prumo-financial-panel-open')}}
  function close(){document.getElementById(BACKDROP_ID)?.classList.remove('open');document.getElementById(PANEL_ID)?.classList.remove('open');document.body.classList.remove('prumo-financial-panel-open');current=null}

  function decorate(){
    document.querySelectorAll('#debtTableBody .debt-actions').forEach(actions=>{const row=actions.closest('tr'),current=actions.querySelector('.pfp-panel-btn'),editBtn=actions.querySelector('button[onclick*="editDebtPlan("]'),id=current?.dataset.pfpId||parseInline(editBtn,'editDebtPlan');if(!id)return;if(!current){const b=document.createElement('button');b.type='button';b.className='btn small pfp-panel-btn';b.textContent='Painel';b.dataset.pfpKind='expense';b.dataset.pfpId=id;actions.prepend(b)}const name=row?.querySelector('.debt-name');if(name){name.classList.add('pfp-entity-name-link');name.setAttribute('role','button');name.tabIndex=0;name.dataset.pfpKind='expense';name.dataset.pfpId=id;name.dataset.pfpOpen='1'}editBtn?.remove()});
    document.querySelectorAll('#incomeTableBody .income-actions').forEach(actions=>{const row=actions.closest('tr'),current=actions.querySelector('.pfp-panel-btn'),editBtn=actions.querySelector('button[onclick*="editIncomePlan("]'),id=current?.dataset.pfpId||parseInline(editBtn,'editIncomePlan');if(!id)return;if(!current){const b=document.createElement('button');b.type='button';b.className='btn small pfp-panel-btn';b.textContent='Painel';b.dataset.pfpKind='income';b.dataset.pfpId=id;actions.prepend(b)}const name=row?.querySelector('.income-name');if(name){name.classList.add('pfp-entity-name-link');name.setAttribute('role','button');name.tabIndex=0;name.dataset.pfpKind='income';name.dataset.pfpId=id;name.dataset.pfpOpen='1'}editBtn?.remove()});
    document.querySelectorAll('[data-history-body="1"] tr').forEach(row=>{if(row.querySelector('.pfp-panel-btn'))return;const id=parseInline(row.querySelector('button[onclick*="editTx("]'),'editTx');if(!id)return;const cells=row.querySelectorAll('td'),cell=cells[cells.length-1];if(!cell)return;const b=document.createElement('button');b.type='button';b.className='btn small pfp-panel-btn';b.textContent='Painel';b.style.marginLeft='6px';cell.appendChild(b)});
    const rec=transactions().filter(sharedReceivable).filter(t=>ymOf(t.date)===selectedMonth());document.querySelectorAll('#sharedIncomeBody tr').forEach(row=>{if(row.querySelector('.pfp-panel-btn'))return;const name=row.querySelector('td strong')?.textContent?.trim(),tx=rec.find(t=>String(t.description||'').trim()===name);if(!tx)return;const b=document.createElement('button');b.type='button';b.className='btn small pfp-panel-btn';b.textContent='Painel';b.style.marginTop='7px';row.querySelector('td')?.appendChild(document.createElement('br'));row.querySelector('td')?.appendChild(b)});
  }

  function init(){
    ensureShell();decorate();
    new MutationObserver(()=>requestAnimationFrame(decorate)).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',ev=>{
      const trigger=ev.target?.closest?.('.pfp-panel-btn,[data-pfp-link],[data-pfp-open]');if(!trigger)return;const route=routeFrom(trigger);if(!route)return;const entity=resolve(route.kind,route.id);if(!entity)return;ev.preventDefault();ev.stopImmediatePropagation();open(entity);
    },true);
    document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target?.matches?.('[data-pfp-open]')){const route=routeFrom(ev.target),entity=route&&resolve(route.kind,route.id);if(entity){ev.preventDefault();open(entity);return}}if(ev.key==='Escape'&&document.body.classList.contains('prumo-financial-panel-open')&&!document.querySelector('.modal-backdrop.open')){ev.preventDefault();close()}});
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(current)drawChart(chartSeries(current))},120)});
    window.openPrumoFinancialPanel=(kind,id)=>{const e=resolve(kind,id);if(e)open(e)};
    window.closePrumoFinancialPanel=close;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
