(function(){
  if(window.__financeObjectiveExpenseV3Loaded)return;
  window.__financeObjectiveExpenseV3Loaded=true;

  const STYLE_ID='finance-objective-expense-v3-style';
  let busy=false;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}
  function dateLabel(d){try{return typeof fmtDate==='function'?fmtDate(String(d||'').slice(0,10)):String(d||'')}catch(e){return String(d||'')}}
  function selectedMonth(){try{return String(state?.settings?.selectedMonth||document.getElementById('monthSelect')?.value||'').slice(0,7)}catch(e){return''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function isGoalTx(tx){return !!tx&&(String(tx.id||'').startsWith('goal-plan-')||String(tx.id||'').startsWith('goal-contrib-')||(String(tx.nature||'').toLowerCase()==='objetivo'&&String(tx.category||'').toLowerCase()==='objetivos'))}
  function isPlanned(tx){return String(tx?.id||'').startsWith('goal-plan-')||/^aporte planejado\s*[—-]/i.test(String(tx?.description||''))}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .objective-expense-card{margin-top:14px;border-color:rgba(139,92,246,.42)!important;background:linear-gradient(180deg,rgba(76,29,149,.11),rgba(15,23,42,.96))!important}
      .objective-expense-accent{color:#c4b5fd!important}.objective-expense-total{font-size:18px;font-weight:850;color:#c4b5fd}
      .objective-expense-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}
      .objective-expense-badge.paid{background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe}.objective-expense-badge.planned{background:#172554;border:1px dashed #6366f1;color:#c7d2fe}
      #goalExpenseBody tr.goal-paid td{background:rgba(76,29,149,.055)}#goalExpenseBody tr.goal-planned td{background:rgba(49,46,129,.055)}
      #goalExpenseBody tr td:first-child{box-shadow:inset 3px 0 0 #8b5cf6}
      #historyBody tr.goal-contribution-history-row td{background:rgba(76,29,149,.07)!important;border-top-color:rgba(167,139,250,.18)!important;border-bottom-color:rgba(167,139,250,.12)!important}
      #historyBody tr.goal-contribution-history-row.goal-plan-history-row td{background:rgba(49,46,129,.07)!important}
      #historyBody tr.goal-contribution-history-row td:first-child{box-shadow:inset 3px 0 0 #8b5cf6}
      #historyBody tr.goal-contribution-history-row .num{color:#c4b5fd!important;font-weight:850}
      .goal-history-badge{display:inline-flex;align-items:center;margin-left:6px;padding:2px 6px;border-radius:999px;background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe;font-size:9px;font-weight:800;vertical-align:middle}
      .goal-history-badge.planned{background:#172554;border-style:dashed;border-color:#6366f1;color:#c7d2fe}
      .goal-history-status{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe;font-size:10px;font-weight:800;white-space:nowrap}
      .goal-history-status.planned{background:#172554;border:1px dashed #6366f1;color:#c7d2fe}
      #page-goals .goal-contrib-value{color:#c4b5fd!important}#page-goals .goal-contrib-row{border-color:rgba(167,139,250,.22)!important;background:rgba(76,29,149,.08)!important}
    `;document.head.appendChild(s);
  }

  function ensureCategory(){
    try{if(typeof categories!=='undefined'&&Array.isArray(categories)&&!categories.includes('Objetivos'))categories.push('Objetivos')}catch(e){}
    for(const id of ['txCategory','categoryFilter','debtCategory']){
      const sel=document.getElementById(id);if(!sel)continue;
      if(![...sel.options].some(o=>o.value==='Objetivos'||o.textContent==='Objetivos')){const o=document.createElement('option');o.value='Objetivos';o.textContent='Objetivos';sel.appendChild(o)}
    }
  }

  function ensureObjectiveCopy(){
    const intro=document.querySelector('#page-goals .goals-intro');
    if(intro)intro.innerHTML='<strong>O aporte planejado já entra no fluxo financeiro.</strong> Ao criar um objetivo com aporte mensal, cada competência recebe uma <strong>Despesa pendente → Objetivos</strong>. Quando você realiza o aporte, o valor efetivo passa a ser uma <strong>Despesa paga</strong>. A cor violeta diferencia objetivos das despesas de consumo.';
    const note=document.getElementById('goalContributionModal')?.querySelector('.goal-modal-note');
    if(note)note.innerHTML='O aporte realizado será registrado como <strong>Despesa paga</strong>. O valor planejado pendente daquela competência será recalculado automaticamente para evitar duplicidade.';
  }

  function ensureAccountField(){
    const form=document.getElementById('goalContributionForm'),grid=form?.querySelector('.form-grid');if(!form||!grid)return false;
    if(document.getElementById('goalContributionAccount'))return true;
    const field=document.createElement('div');field.className='field';field.innerHTML='<label>Conta de origem</label><input id="goalContributionAccount" placeholder="Ex.: Banco do Brasil"><small class="muted">Conta de onde saiu o dinheiro.</small>';
    const notes=document.getElementById('goalContributionNotes')?.closest('.field');grid.insertBefore(field,notes||null);return true;
  }

  function ensureExpenseSection(){
    const page=document.getElementById('page-debts');if(!page)return false;
    if(document.getElementById('goalExpenseCard'))return true;
    const card=document.createElement('div');card.className='card objective-expense-card';card.id='goalExpenseCard';
    card.innerHTML=`<div class="section-head"><div><h3 class="objective-expense-accent">Aportes para objetivos</h3><div class="muted" id="goalExpenseContext">Planejado e realizado na competência selecionada.</div></div><div style="text-align:right"><div class="muted" style="font-size:9px">Total previsto no mês</div><div class="objective-expense-total" id="goalExpenseTotal">R$ 0,00</div></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Objetivo</th><th>Conta</th><th>Status</th><th class="num">Valor</th><th></th></tr></thead><tbody id="goalExpenseBody"></tbody></table></div>`;
    page.appendChild(card);return true;
  }

  function renderExpenseSection(){
    if(!ensureExpenseSection())return;
    let txs=[];try{txs=(Array.isArray(state?.transactions)?state.transactions:[]).filter(isGoalTx)}catch(e){}
    const ym=selectedMonth();if(ym)txs=txs.filter(t=>String(t.date||'').slice(0,7)===ym);
    txs.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')));
    const total=txs.reduce((s,t)=>s+(Number(t.amount)||0),0),planned=txs.filter(isPlanned).reduce((s,t)=>s+(Number(t.amount)||0),0),paid=txs.filter(t=>!isPlanned(t)).reduce((s,t)=>s+(Number(t.amount)||0),0);
    const body=document.getElementById('goalExpenseBody'),sum=document.getElementById('goalExpenseTotal'),ctx=document.getElementById('goalExpenseContext');
    if(sum)sum.textContent=money(total);if(ctx)ctx.textContent=ym?`Competência ${ym} · realizado ${money(paid)} · pendente ${money(planned)}`:`Realizado ${money(paid)} · pendente ${money(planned)}`;
    if(!body)return;
    body.innerHTML=txs.length?txs.map(t=>{const plan=isPlanned(t),name=String(t.description||'Aporte').replace(/^Aporte planejado\s*[—-]\s*/i,'').replace(/^Aporte\s*[—-]\s*/i,'');return `<tr class="${plan?'goal-planned':'goal-paid'}"><td>${esc(dateLabel(t.date))}</td><td><strong>${esc(name)}</strong><div class="muted" style="font-size:9px">${plan?'Aporte mensal planejado':'Aporte realizado'}</div></td><td>${esc(t.account||'Objetivos')}</td><td><span class="objective-expense-badge ${plan?'planned':'paid'}">${plan?'Pendente · Planejado':'Pago · Aporte'}</span></td><td class="num objective-expense-accent"><strong>${money(t.amount)}</strong></td><td><button type="button" class="btn small" data-open-goals-from-expense="1">${plan?'Aportar':'Ver objetivo'}</button></td></tr>`}).join(''):'<tr><td colspan="6" class="empty">Nenhum aporte previsto ou realizado nesta competência.</td></tr>';
    body.querySelectorAll('[data-open-goals-from-expense]').forEach(b=>b.onclick=()=>window.openFinanceGoals?.());
  }

  function rowGoalInfo(row){
    const cells=row.querySelectorAll('td');if(cells.length<8)return null;
    const category=String(cells[3]?.textContent||'').trim().toLowerCase(),desc=String(cells[2]?.textContent||'').trim();
    if(category!=='objetivos'&&!/^aporte( planejado)?\s*[—-]/i.test(desc))return null;
    return{planned:/^aporte planejado\s*[—-]/i.test(desc)};
  }

  function enhanceHistory(){
    const body=document.getElementById('historyBody');if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const info=rowGoalInfo(row);if(!info)return;
      row.classList.add('goal-contribution-history-row');row.classList.toggle('goal-plan-history-row',info.planned);const cells=row.querySelectorAll('td');
      if(cells[1])cells[1].innerHTML=`${esc(String(cells[1].textContent||'Despesa').replace(/Aporte|Planejado/g,'').trim()||'Despesa')}<span class="goal-history-badge ${info.planned?'planned':''}">${info.planned?'Planejado':'Aporte'}</span>`;
      if(cells[5])cells[5].innerHTML=`<span class="goal-history-status ${info.planned?'planned':''}">${info.planned?'Pendente · Objetivo':'Pago · Objetivo'}</span>`;
      if(cells[7]){cells[7].innerHTML='<button type="button" class="btn small" data-open-goals-from-history="1">Gerenciar objetivo</button>';cells[7].querySelector('button').onclick=()=>window.openFinanceGoals?.()}
    });
  }

  async function waitCloudIdle(){for(let i=0;i<40;i++){if(!window.financeCloud?.hasPendingLocalWrite)return;await new Promise(r=>setTimeout(r,50))}}
  async function refreshAll(){
    try{await waitCloudIdle();await window.financeCloud?.refresh?.()}catch(e){console.warn('Falha ao atualizar o caixa após alteração de objetivo.',e)}
    try{await window.financeGoalsRefresh?.()}catch(e){console.warn('Falha ao atualizar objetivos.',e)}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    renderExpenseSection();setTimeout(enhanceHistory,0);
  }

  async function handleGoalSubmit(e){
    if(e.target?.id!=='goalForm')return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;const button=e.submitter;if(button)button.disabled=true;
    const payload={id:document.getElementById('goalId')?.value||null,name:document.getElementById('goalName')?.value?.trim()||'',type:document.getElementById('goalType')?.value||'other',targetAmount:Number(document.getElementById('goalTarget')?.value)||0,initialAmount:Number(document.getElementById('goalInitial')?.value)||0,targetMonth:document.getElementById('goalTargetMonth')?.value||null,startMonth:selectedMonth()||null,plannedMonthly:Number(document.getElementById('goalMonthly')?.value)||0,priority:Number(document.getElementById('goalPriority')?.value)||2,status:document.getElementById('goalStatus')?.value||'active',notes:document.getElementById('goalNotes')?.value?.trim()||''};
    try{const {data,error}=await getSb().rpc('finance_upsert_goal',{p_goal:payload});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'save_failed');document.getElementById('goalModal')?.classList.remove('open');await refreshAll();try{if(typeof setSyncStatus==='function')setSyncStatus(payload.id?'Objetivo atualizado':'Objetivo criado e despesas planejadas geradas')}catch(_e){}}
    catch(err){console.error('Falha ao salvar objetivo.',err);alert('Não foi possível salvar o objetivo agora.')}
    finally{busy=false;if(button)button.disabled=false}
  }

  async function handleContributionSubmit(e){
    if(e.target?.id!=='goalContributionForm')return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;const button=e.submitter;if(button)button.disabled=true;
    const id=document.getElementById('goalContributionGoalId')?.value||'',amount=Number(document.getElementById('goalContributionAmount')?.value)||0,date=document.getElementById('goalContributionDate')?.value||'',notes=document.getElementById('goalContributionNotes')?.value?.trim()||'',account=document.getElementById('goalContributionAccount')?.value?.trim()||'';
    try{if(!id||amount<=0)throw new Error('invalid_contribution');const {data,error}=await getSb().rpc('finance_add_goal_contribution',{p_goal_id:id,p_amount:amount,p_date:date||null,p_notes:notes,p_account:account});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'contribution_failed');document.getElementById('goalContributionModal')?.classList.remove('open');await refreshAll();try{if(typeof setSyncStatus==='function')setSyncStatus(`Aporte ${money(amount)} registrado`)}catch(_e){}}
    catch(err){console.error('Falha ao registrar aporte.',err);alert('Não foi possível registrar o aporte agora.')}
    finally{busy=false;if(button)button.disabled=false}
  }

  async function rpcAndRefresh(name,args,button){if(busy)return;busy=true;if(button)button.disabled=true;try{const {data,error}=await getSb().rpc(name,args);if(error)throw error;if(!data?.ok)throw new Error(data?.error||name);await refreshAll()}finally{busy=false;if(button)button.disabled=false}}

  function interceptClicks(e){
    const c=e.target?.closest?.('[data-goal-contrib-delete]');if(c){e.preventDefault();e.stopImmediatePropagation();if(confirm('Excluir este aporte? O planejamento mensal será recalculado.'))rpcAndRefresh('finance_delete_goal_contribution',{p_contribution_id:c.dataset.goalContribDelete},c).catch(err=>{console.error(err);alert('Não foi possível excluir o aporte agora.')});return}
    const g=e.target?.closest?.('[data-goal-delete]');if(g){e.preventDefault();e.stopImmediatePropagation();const title=g.closest('[data-goal-id]')?.querySelector('.goal-title')?.textContent||'este objetivo';if(confirm(`Excluir "${title}"? Os lançamentos planejados e realizados vinculados também serão removidos.`))rpcAndRefresh('finance_delete_goal',{p_goal_id:g.dataset.goalDelete},g).catch(err=>{console.error(err);alert('Não foi possível excluir o objetivo agora.')});return}
    const t=e.target?.closest?.('[data-goal-toggle]');if(t){e.preventDefault();e.stopImmediatePropagation();rpcAndRefresh('finance_set_goal_status',{p_goal_id:t.dataset.goalToggle,p_status:t.dataset.goalStatus},t).catch(err=>{console.error(err);alert('Não foi possível alterar o objetivo agora.')});return}
    if(e.target?.closest?.('[data-goal-contribute]'))setTimeout(()=>{ensureAccountField();const a=document.getElementById('goalContributionAccount');if(a)a.value='';ensureObjectiveCopy()},0);
    if(e.target?.closest?.('.nav [data-page="debts"]'))setTimeout(renderExpenseSection,60);
    if(e.target?.closest?.('.nav [data-page="history"]'))setTimeout(enhanceHistory,60);
  }

  function wrapRenderHistory(){if(typeof window.renderHistory!=='function'||window.renderHistory.__objectiveV3Wrapped)return;const original=window.renderHistory;const wrapped=function(){const r=original.apply(this,arguments);setTimeout(enhanceHistory,0);return r};wrapped.__objectiveV3Wrapped=true;window.renderHistory=wrapped}

  function init(){
    injectStyles();ensureCategory();ensureObjectiveCopy();ensureAccountField();ensureExpenseSection();renderExpenseSection();wrapRenderHistory();enhanceHistory();
    document.addEventListener('submit',handleGoalSubmit,true);document.addEventListener('submit',handleContributionSubmit,true);document.addEventListener('click',interceptClicks,true);
    document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(()=>{renderExpenseSection();enhanceHistory()},0));
    window.addEventListener('focus',()=>{if(document.getElementById('page-debts')?.classList.contains('active'))renderExpenseSection()});
    let tries=0;const ready=setInterval(()=>{tries++;ensureCategory();ensureObjectiveCopy();ensureAccountField();ensureExpenseSection();wrapRenderHistory();if(document.getElementById('goalForm')&&document.getElementById('page-debts')){clearInterval(ready);renderExpenseSection();enhanceHistory()}else if(tries>300)clearInterval(ready)},100);
    window.financeObjectiveExpenseRefresh=()=>{renderExpenseSection();enhanceHistory()};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();