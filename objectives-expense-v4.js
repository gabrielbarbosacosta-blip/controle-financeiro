(function(){
  if(window.__financeObjectiveExpenseV4Loaded)return;
  window.__financeObjectiveExpenseV4Loaded=true;

  const STYLE_ID='finance-objective-expense-v4-style';
  let busy=false;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}
  function dateLabel(d){try{return typeof fmtDate==='function'?fmtDate(String(d||'').slice(0,10)):String(d||'')}catch(e){return String(d||'')}}
  function selectedMonth(){try{return String(state?.settings?.selectedMonth||document.getElementById('monthSelect')?.value||'').slice(0,7)}catch(e){return''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function isGoalTx(tx){return !!tx&&(String(tx.id||'').startsWith('goal-plan-')||String(tx.id||'').startsWith('goal-contrib-')||(String(tx.nature||'').toLowerCase()==='objetivo'&&String(tx.category||'').toLowerCase()==='objetivos'))}
  function isPaid(tx){return String(tx?.status||'').toLowerCase()==='pago'}
  function txName(tx){return String(tx?.description||'Aporte').replace(/^Aporte planejado\s*[—-]\s*/i,'').replace(/^Aporte\s*[—-]\s*/i,'')}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .objective-expense-card{margin-top:14px;border-color:rgba(139,92,246,.42)!important;background:linear-gradient(180deg,rgba(76,29,149,.11),rgba(15,23,42,.96))!important}
      .objective-expense-accent{color:#c4b5fd!important}.objective-expense-total{font-size:18px;font-weight:850;color:#c4b5fd}
      #goalExpenseBody tr td{background:rgba(76,29,149,.055)}#goalExpenseBody tr.pending td{background:rgba(49,46,129,.055)}
      #goalExpenseBody tr td:first-child{box-shadow:inset 3px 0 0 #8b5cf6}
      #historyBody tr.goal-contribution-history-row td{background:rgba(76,29,149,.07)!important;border-top-color:rgba(167,139,250,.18)!important;border-bottom-color:rgba(167,139,250,.12)!important}
      #historyBody tr.goal-contribution-history-row.pending td{background:rgba(49,46,129,.07)!important}
      #historyBody tr.goal-contribution-history-row td:first-child{box-shadow:inset 3px 0 0 #8b5cf6}
      #historyBody tr.goal-contribution-history-row .num{color:#c4b5fd!important;font-weight:850}
      .goal-history-badge{display:inline-flex;align-items:center;margin-left:6px;padding:2px 6px;border-radius:999px;background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe;font-size:9px;font-weight:800;vertical-align:middle}
      .goal-history-badge.pending{background:#172554;border-style:dashed;border-color:#6366f1;color:#c7d2fe}
      .goal-objective-status{min-width:100px;border-radius:999px;padding:5px 26px 5px 9px;font-size:10px;font-weight:800;outline:none;cursor:pointer}
      .goal-objective-status.paid{background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe}
      .goal-objective-status.pending{background:#172554;border:1px dashed #6366f1;color:#c7d2fe}
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
    if(intro)intro.innerHTML='<strong>O valor reservado considera somente aportes pagos.</strong> Cada aporte aparece como <strong>Despesa → Objetivos</strong> em Lançamentos e no menu Despesas. Se estiver <strong>Não pago</strong>, ele permanece pendente e não aumenta o valor reservado.';
    const note=document.getElementById('goalContributionModal')?.querySelector('.goal-modal-note');
    if(note)note.innerHTML='Escolha se o aporte já foi <strong>Pago</strong> ou ainda está <strong>Não pago</strong>. Somente aportes pagos aumentam o capital reservado do objetivo.';
  }

  function ensureContributionFields(){
    const form=document.getElementById('goalContributionForm'),grid=form?.querySelector('.form-grid');if(!form||!grid)return false;
    if(!document.getElementById('goalContributionAccount')){
      const f=document.createElement('div');f.className='field';f.innerHTML='<label>Conta de origem</label><input id="goalContributionAccount" placeholder="Ex.: Banco do Brasil"><small class="muted">Conta de onde sairá ou saiu o dinheiro.</small>';
      const notes=document.getElementById('goalContributionNotes')?.closest('.field');grid.insertBefore(f,notes||null);
    }
    if(!document.getElementById('goalContributionStatus')){
      const f=document.createElement('div');f.className='field';f.innerHTML='<label>Status do aporte</label><select id="goalContributionStatus"><option value="Pago">Pago</option><option value="Pendente">Não pago</option></select><small class="muted">Não pago não entra no valor reservado.</small>';
      const notes=document.getElementById('goalContributionNotes')?.closest('.field');grid.insertBefore(f,notes||null);
    }
    return true;
  }

  function statusSelect(tx){
    const paid=isPaid(tx);
    return `<select class="goal-objective-status ${paid?'paid':'pending'}" data-goal-status-tx="${esc(tx.id)}" aria-label="Status do aporte"><option value="Pago" ${paid?'selected':''}>Pago</option><option value="Pendente" ${!paid?'selected':''}>Não pago</option></select>`;
  }

  function ensureExpenseSection(){
    const page=document.getElementById('page-debts');if(!page)return false;
    if(document.getElementById('goalExpenseCard'))return true;
    const card=document.createElement('div');card.className='card objective-expense-card';card.id='goalExpenseCard';
    card.innerHTML=`<div class="section-head"><div><h3 class="objective-expense-accent">Aportes para objetivos</h3><div class="muted" id="goalExpenseContext">Aportes pagos e não pagos da competência selecionada.</div></div><div style="text-align:right"><div class="muted" style="font-size:9px">Reservado no mês</div><div class="objective-expense-total" id="goalExpenseTotal">R$ 0,00</div></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Objetivo</th><th>Conta</th><th>Status</th><th class="num">Valor</th><th></th></tr></thead><tbody id="goalExpenseBody"></tbody></table></div>`;
    page.appendChild(card);return true;
  }

  function renderExpenseSection(){
    if(!ensureExpenseSection())return;
    let txs=[];try{txs=(Array.isArray(state?.transactions)?state.transactions:[]).filter(isGoalTx)}catch(e){}
    const ym=selectedMonth();if(ym)txs=txs.filter(t=>String(t.date||'').slice(0,7)===ym);
    txs.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')));
    const paidTotal=txs.filter(isPaid).reduce((s,t)=>s+(Number(t.amount)||0),0),pendingTotal=txs.filter(t=>!isPaid(t)).reduce((s,t)=>s+(Number(t.amount)||0),0);
    const body=document.getElementById('goalExpenseBody'),sum=document.getElementById('goalExpenseTotal'),ctx=document.getElementById('goalExpenseContext');
    if(sum)sum.textContent=money(paidTotal);if(ctx)ctx.textContent=ym?`Competência ${ym} · reservado ${money(paidTotal)} · não pago ${money(pendingTotal)}`:`Reservado ${money(paidTotal)} · não pago ${money(pendingTotal)}`;
    if(!body)return;
    body.innerHTML=txs.length?txs.map(t=>`<tr class="${isPaid(t)?'paid':'pending'}"><td>${esc(dateLabel(t.date))}</td><td><strong>${esc(txName(t))}</strong><div class="muted" style="font-size:9px">${isPaid(t)?'Aporte realizado':'Aporte pendente'}</div></td><td>${esc(t.account||'Objetivos')}</td><td>${statusSelect(t)}</td><td class="num objective-expense-accent"><strong>${money(t.amount)}</strong></td><td><button type="button" class="btn small" data-open-goals-from-expense="1">Ver objetivo</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhum aporte nesta competência.</td></tr>';
    body.querySelectorAll('[data-open-goals-from-expense]').forEach(b=>b.onclick=()=>window.openFinanceGoals?.());
  }

  function transactionIdFromRow(row){
    if(row.dataset.goalTransactionId)return row.dataset.goalTransactionId;
    const edit=row.querySelector('button[onclick*="editTx("]');
    const code=edit?.getAttribute('onclick')||'';const m=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);
    if(m?.[1])return m[1];
    const cells=row.querySelectorAll('td'),desc=String(cells[2]?.textContent||'').trim(),date=String(cells[0]?.textContent||'').trim(),amount=String(cells[6]?.textContent||'').replace(/[^0-9,.-]/g,'');
    try{
      const candidates=(state?.transactions||[]).filter(t=>isGoalTx(t)&&String(t.description||'').trim()===desc);
      if(candidates.length===1)return candidates[0].id;
    }catch(e){}
    return'';
  }

  function rowGoalTx(row){
    const id=transactionIdFromRow(row);if(id){try{const tx=(state?.transactions||[]).find(t=>t.id===id);if(isGoalTx(tx))return tx}catch(e){}}
    const cells=row.querySelectorAll('td');if(cells.length<8)return null;
    const cat=String(cells[3]?.textContent||'').trim().toLowerCase(),desc=String(cells[2]?.textContent||'').trim();
    if(cat!=='objetivos'&&!/^aporte( planejado)?\s*[—-]/i.test(desc))return null;
    try{return (state?.transactions||[]).find(t=>isGoalTx(t)&&String(t.description||'').trim()===desc)||null}catch(e){return null}
  }

  function enhanceHistory(){
    const body=document.getElementById('historyBody');if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const tx=rowGoalTx(row);if(!tx)return;
      row.dataset.goalTransactionId=tx.id;row.classList.add('goal-contribution-history-row');row.classList.toggle('pending',!isPaid(tx));
      const cells=row.querySelectorAll('td');
      if(cells[1]&&!cells[1].querySelector('.goal-history-badge'))cells[1].insertAdjacentHTML('beforeend',`<span class="goal-history-badge ${isPaid(tx)?'':'pending'}">Aporte</span>`);
      if(cells[5])cells[5].innerHTML=statusSelect(tx);
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

  async function setTransactionStatus(txId,status,select){
    if(!txId||busy)return;busy=true;if(select)select.disabled=true;
    try{
      const {data,error}=await getSb().rpc('finance_set_goal_transaction_status',{p_transaction_id:txId,p_status:status});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'status_failed');
      await refreshAll();
      try{if(typeof setSyncStatus==='function')setSyncStatus(status==='Pago'?`Aporte pago · reservado ${money(data.savedAmount)}`:'Aporte não pago · valor reservado recalculado')}catch(_e){}
    }catch(err){console.error('Falha ao alterar status do aporte.',err);alert('Não foi possível alterar o status do aporte agora.');await refreshAll()}
    finally{busy=false;if(select)select.disabled=false}
  }

  async function handleGoalSubmit(e){
    if(e.target?.id!=='goalForm')return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;const button=e.submitter;if(button)button.disabled=true;
    const payload={id:document.getElementById('goalId')?.value||null,name:document.getElementById('goalName')?.value?.trim()||'',type:document.getElementById('goalType')?.value||'other',targetAmount:Number(document.getElementById('goalTarget')?.value)||0,initialAmount:Number(document.getElementById('goalInitial')?.value)||0,targetMonth:document.getElementById('goalTargetMonth')?.value||null,startMonth:selectedMonth()||null,plannedMonthly:Number(document.getElementById('goalMonthly')?.value)||0,priority:Number(document.getElementById('goalPriority')?.value)||2,status:document.getElementById('goalStatus')?.value||'active',notes:document.getElementById('goalNotes')?.value?.trim()||''};
    try{const {data,error}=await getSb().rpc('finance_upsert_goal',{p_goal:payload});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'save_failed');document.getElementById('goalModal')?.classList.remove('open');await refreshAll();try{if(typeof setSyncStatus==='function')setSyncStatus(payload.id?'Objetivo atualizado':'Objetivo criado')}catch(_e){}}
    catch(err){console.error('Falha ao salvar objetivo.',err);alert('Não foi possível salvar o objetivo agora.')}
    finally{busy=false;if(button)button.disabled=false}
  }

  async function handleContributionSubmit(e){
    if(e.target?.id!=='goalContributionForm')return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;const button=e.submitter;if(button)button.disabled=true;
    const id=document.getElementById('goalContributionGoalId')?.value||'',amount=Number(document.getElementById('goalContributionAmount')?.value)||0,date=document.getElementById('goalContributionDate')?.value||'',notes=document.getElementById('goalContributionNotes')?.value?.trim()||'',account=document.getElementById('goalContributionAccount')?.value?.trim()||'',status=document.getElementById('goalContributionStatus')?.value||'Pago';
    try{
      if(!id||amount<=0)throw new Error('invalid_contribution');
      const {data,error}=await getSb().rpc('finance_add_goal_contribution',{p_goal_id:id,p_amount:amount,p_date:date||null,p_notes:notes,p_account:account,p_status:status});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'contribution_failed');
      document.getElementById('goalContributionModal')?.classList.remove('open');await refreshAll();
      try{if(typeof setSyncStatus==='function')setSyncStatus(status==='Pago'?`Aporte ${money(amount)} pago e reservado`:`Aporte ${money(amount)} criado como não pago`)}catch(_e){}
    }catch(err){console.error('Falha ao registrar aporte.',err);alert('Não foi possível registrar o aporte agora.')}
    finally{busy=false;if(button)button.disabled=false}
  }

  async function rpcAndRefresh(name,args,button){if(busy)return;busy=true;if(button)button.disabled=true;try{const {data,error}=await getSb().rpc(name,args);if(error)throw error;if(!data?.ok)throw new Error(data?.error||name);await refreshAll()}finally{busy=false;if(button)button.disabled=false}}

  function interceptClicks(e){
    const c=e.target?.closest?.('[data-goal-contrib-delete]');if(c){e.preventDefault();e.stopImmediatePropagation();if(confirm('Excluir este aporte? A despesa vinculada também será removida.'))rpcAndRefresh('finance_delete_goal_contribution',{p_contribution_id:c.dataset.goalContribDelete},c).catch(err=>{console.error(err);alert('Não foi possível excluir o aporte agora.')});return}
    const g=e.target?.closest?.('[data-goal-delete]');if(g){e.preventDefault();e.stopImmediatePropagation();const title=g.closest('[data-goal-id]')?.querySelector('.goal-title')?.textContent||'este objetivo';if(confirm(`Excluir "${title}"? Os lançamentos vinculados também serão removidos.`))rpcAndRefresh('finance_delete_goal',{p_goal_id:g.dataset.goalDelete},g).catch(err=>{console.error(err);alert('Não foi possível excluir o objetivo agora.')});return}
    const t=e.target?.closest?.('[data-goal-toggle]');if(t){e.preventDefault();e.stopImmediatePropagation();rpcAndRefresh('finance_set_goal_status',{p_goal_id:t.dataset.goalToggle,p_status:t.dataset.goalStatus},t).catch(err=>{console.error(err);alert('Não foi possível alterar o objetivo agora.')});return}
    if(e.target?.closest?.('[data-goal-contribute]'))setTimeout(()=>{ensureContributionFields();const a=document.getElementById('goalContributionAccount');if(a)a.value='';const s=document.getElementById('goalContributionStatus');if(s)s.value='Pago';ensureObjectiveCopy()},0);
    if(e.target?.closest?.('.nav [data-page="debts"]'))setTimeout(renderExpenseSection,60);
    if(e.target?.closest?.('.nav [data-page="history"]'))setTimeout(enhanceHistory,60);
  }

  function handleStatusChange(e){
    const select=e.target?.closest?.('[data-goal-status-tx]');if(!select)return;
    e.preventDefault();e.stopImmediatePropagation();setTransactionStatus(select.dataset.goalStatusTx,select.value,select);
  }

  function wrapRenderHistory(){if(typeof window.renderHistory!=='function'||window.renderHistory.__objectiveV4Wrapped)return;const original=window.renderHistory;const wrapped=function(){const r=original.apply(this,arguments);setTimeout(enhanceHistory,0);return r};wrapped.__objectiveV4Wrapped=true;window.renderHistory=wrapped}

  function init(){
    injectStyles();ensureCategory();ensureObjectiveCopy();ensureContributionFields();ensureExpenseSection();renderExpenseSection();wrapRenderHistory();enhanceHistory();
    document.addEventListener('submit',handleGoalSubmit,true);document.addEventListener('submit',handleContributionSubmit,true);document.addEventListener('click',interceptClicks,true);document.addEventListener('change',handleStatusChange,true);
    document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(()=>{renderExpenseSection();enhanceHistory()},0));
    window.addEventListener('focus',()=>{if(document.getElementById('page-debts')?.classList.contains('active'))renderExpenseSection()});
    let tries=0;const ready=setInterval(()=>{tries++;ensureCategory();ensureObjectiveCopy();ensureContributionFields();ensureExpenseSection();wrapRenderHistory();if(document.getElementById('goalForm')&&document.getElementById('page-debts')){clearInterval(ready);renderExpenseSection();enhanceHistory()}else if(tries>300)clearInterval(ready)},100);
    window.financeObjectiveExpenseRefresh=()=>{renderExpenseSection();enhanceHistory()};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();