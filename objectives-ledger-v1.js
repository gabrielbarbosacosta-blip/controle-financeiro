(function(){
  if(window.__financeGoalLedgerV1Loaded)return;
  window.__financeGoalLedgerV1Loaded=true;

  let goals=[],participantsByGoal=new Map(),activeGoalId='',activeMonth='',loading=false;
  const STYLE_ID='finance-goal-ledger-v1-style';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const dateLabel=v=>{try{return typeof fmtDate==='function'?fmtDate(v):new Date(String(v)+'T12:00:00').toLocaleDateString('pt-BR')}catch(_e){return String(v||'')}};
  const monthLabel=v=>{try{return typeof fmtMonth==='function'?fmtMonth(v):new Date(String(v)+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}catch(_e){return String(v||'')}};
  const currentMonth=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
  const getSb=()=>{try{return sb}catch(_e){return window.sb||null}};
  const getUserId=()=>{try{return currentUser?.id||''}catch(_e){return window.currentUser?.id||''}};
  const goalById=id=>goals.find(g=>String(g.id)===String(id))||null;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .goal-ledger-modal .modal{width:min(940px,calc(100vw - 28px));max-width:940px}
      .goal-ledger-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:13px}
      .goal-ledger-month-control{display:flex;align-items:center;gap:6px}.goal-ledger-month-control .btn{min-width:34px;padding-inline:8px}
      .goal-ledger-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}
      .goal-ledger-kpi{padding:11px 12px;border:1px solid var(--line);border-radius:11px;background:var(--panel2)}
      .goal-ledger-kpi .k{font-size:9px;color:var(--muted);margin-bottom:4px}.goal-ledger-kpi .v{font-size:14px;font-weight:820}
      .goal-ledger-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}
      .goal-ledger-table{width:100%;border-collapse:collapse;min-width:720px}.goal-ledger-table th,.goal-ledger-table td{padding:10px 9px;border-bottom:1px solid var(--line);font-size:10px;text-align:left;vertical-align:top}.goal-ledger-table th{font-size:9px;color:var(--muted);font-weight:780;background:var(--panel2);position:sticky;top:0}.goal-ledger-table tr:last-child td{border-bottom:0}.goal-ledger-table .num{text-align:right;white-space:nowrap}
      .goal-ledger-in{color:#86efac;font-weight:800}.goal-ledger-out{color:#fca5a5;font-weight:800}.goal-ledger-balance{font-weight:820}.goal-ledger-person{color:var(--muted)}.goal-ledger-note{color:var(--muted);font-size:9px;margin-top:3px;max-width:330px}
      .goal-ledger-pending{display:inline-flex;padding:2px 5px;border-radius:999px;border:1px solid #5a4824;background:#2a2213;color:#ead38f;font-size:8px;margin-left:5px}
      .goal-ledger-actions{display:flex;gap:7px;flex-wrap:wrap}
      .goal-ledger-help{padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--panel2);font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:12px}
      .goal-ledger-people{margin-bottom:14px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);overflow:hidden}
      .goal-ledger-people>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;font-size:10px;font-weight:820;color:var(--text)}
      .goal-ledger-people>summary::-webkit-details-marker{display:none}
      .goal-ledger-people>summary span{font-size:9px;font-weight:600;color:var(--muted)}
      .goal-ledger-people-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;padding:0 10px 10px}
      .goal-ledger-person-card{padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.04)}
      .goal-ledger-person-name{font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .goal-ledger-owner{display:inline-flex;margin-left:5px;padding:1px 4px;border-radius:999px;border:1px solid var(--line);font-size:7px;color:var(--muted);vertical-align:1px}
      .goal-ledger-person-values{display:grid;gap:4px;margin-top:7px}.goal-ledger-person-value{display:flex;justify-content:space-between;gap:8px;font-size:8px;color:var(--muted)}
      .goal-ledger-person-value strong{font:700 10px 'DM Mono',monospace;color:var(--text)}.goal-ledger-person-value.month strong{color:#91d6b9}
      .goal-ledger-people-empty{padding:0 12px 12px;color:var(--muted);font-size:9px}
      @media(max-width:720px){.goal-ledger-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.goal-ledger-people-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function ensureModals(){
    injectStyles();
    if(!document.getElementById('goalLedgerModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop goal-ledger-modal" id="goalLedgerModal"><div class="modal"><div class="modal-head"><div><h3 id="goalLedgerTitle">Extrato do objetivo</h3><div class="muted" id="goalLedgerSubtitle"></div></div><button type="button" class="btn ghost" data-goal-ledger-close="goalLedgerModal">✕</button></div><div class="modal-body"><div class="goal-ledger-toolbar"><div class="goal-ledger-month-control"><button type="button" class="btn small" id="goalLedgerPrev" aria-label="Mês anterior">‹</button><div class="field" style="margin:0"><label>Mês do extrato</label><input id="goalLedgerMonth" type="month"></div><button type="button" class="btn small" id="goalLedgerNext" aria-label="Próximo mês">›</button></div><div class="goal-ledger-actions" id="goalLedgerActions"></div></div><div class="goal-ledger-summary"><div class="goal-ledger-kpi"><div class="k">Saldo anterior</div><div class="v" id="goalLedgerOpening">—</div></div><div class="goal-ledger-kpi"><div class="k">Entradas</div><div class="v positive" id="goalLedgerIn">—</div></div><div class="goal-ledger-kpi"><div class="k">Saídas</div><div class="v negative" id="goalLedgerOut">—</div></div><div class="goal-ledger-kpi"><div class="k">Saldo final</div><div class="v" id="goalLedgerClosing">—</div></div></div><details class="goal-ledger-people" id="goalLedgerPeople" open><summary><div>Contribuição por participante</div><span id="goalLedgerPeopleContext"></span></summary><div class="goal-ledger-people-grid" id="goalLedgerPeopleGrid"></div></details><div class="goal-ledger-table-wrap"><table class="goal-ledger-table"><thead><tr><th>Data</th><th>Pessoa</th><th>Movimentação</th><th class="num">Entrada</th><th class="num">Saída</th><th class="num">Saldo</th></tr></thead><tbody id="goalLedgerRows"></tbody></table></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-ledger-close="goalLedgerModal">Fechar</button></div></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalLedgerMonth').addEventListener('change',e=>{if(e.target.value)loadStatement(activeGoalId,e.target.value)});
      document.getElementById('goalLedgerPrev').onclick=()=>moveMonth(-1);
      document.getElementById('goalLedgerNext').onclick=()=>moveMonth(1);
    }

    if(!document.getElementById('goalWithdrawalModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalWithdrawalModal"><div class="modal"><form id="goalWithdrawalForm"><div class="modal-head"><h3 id="goalWithdrawalTitle">Resgatar do objetivo</h3><button type="button" class="btn ghost" data-goal-ledger-close="goalWithdrawalModal">✕</button></div><div class="modal-body"><div class="goal-ledger-help" id="goalWithdrawalHelp"></div><input type="hidden" id="goalWithdrawalGoalId"><div class="form-grid"><div class="field"><label>Valor do resgate (R$)</label><input id="goalWithdrawalAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Data</label><input id="goalWithdrawalDate" type="date" required></div><div class="field full"><label>Conta de destino</label><input id="goalWithdrawalAccount" placeholder="Ex.: Banco do Brasil"><small class="muted">O resgate será registrado como receita nessa conta.</small></div><div class="field full"><label>Observação</label><textarea id="goalWithdrawalNotes" rows="3" placeholder="Ex.: Uso parcial do valor reservado"></textarea></div></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-ledger-close="goalWithdrawalModal">Cancelar</button><button class="btn primary" type="submit">Registrar resgate</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalWithdrawalForm').addEventListener('submit',submitWithdrawal);
    }

    if(!document.getElementById('goalAdjustmentModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalAdjustmentModal"><div class="modal"><form id="goalAdjustmentForm"><div class="modal-head"><h3 id="goalAdjustmentTitle">Ajustar saldo do objetivo</h3><button type="button" class="btn ghost" data-goal-ledger-close="goalAdjustmentModal">✕</button></div><div class="modal-body"><div class="goal-ledger-help" id="goalAdjustmentHelp">Use ajustes apenas para corrigir divergências históricas. O ajuste fica permanentemente registrado no extrato e não cria movimentação no fluxo de caixa.</div><input type="hidden" id="goalAdjustmentGoalId"><div class="form-grid"><div class="field"><label>Tipo de ajuste</label><select id="goalAdjustmentDirection"><option value="in">Adicionar ao saldo</option><option value="out">Reduzir o saldo</option></select></div><div class="field"><label>Valor (R$)</label><input id="goalAdjustmentAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Data</label><input id="goalAdjustmentDate" type="date" required></div><div class="field full"><label>Justificativa</label><textarea id="goalAdjustmentNotes" rows="3" required placeholder="Explique por que o saldo precisa ser ajustado"></textarea></div></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-ledger-close="goalAdjustmentModal">Cancelar</button><button class="btn primary" type="submit">Registrar ajuste</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalAdjustmentForm').addEventListener('submit',submitAdjustment);
    }

    document.querySelectorAll('[data-goal-ledger-close]').forEach(btn=>{if(btn.dataset.goalLedgerCloseBound)return;btn.dataset.goalLedgerCloseBound='1';btn.onclick=()=>closeModal(btn.dataset.goalLedgerClose)});
    ['goalLedgerModal','goalWithdrawalModal','goalAdjustmentModal'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.dataset.ledgerBackdropBound){el.dataset.ledgerBackdropBound='1';el.addEventListener('click',e=>{if(e.target===el)closeModal(id)})}});
  }

  function openModal(id){document.getElementById(id)?.classList.add('open')}
  function closeModal(id){document.getElementById(id)?.classList.remove('open')}

  function moveMonth(delta){
    const input=document.getElementById('goalLedgerMonth');if(!input?.value)return;
    const [y,m]=input.value.split('-').map(Number),d=new Date(y,m-1+delta,1);
    input.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function renderRows(data){
    const host=document.getElementById('goalLedgerRows');if(!host)return;
    const rows=[];
    rows.push(`<tr><td>${esc('01/'+String(data.month||'').slice(5,7)+'/'+String(data.month||'').slice(0,4))}</td><td class="goal-ledger-person">—</td><td><strong>Saldo anterior</strong></td><td class="num"></td><td class="num"></td><td class="num goal-ledger-balance">${money(data.openingBalance)}</td></tr>`);
    for(const e of (data.entries||[])){
      const pending=String(e.status||'').toLowerCase()!=='paid';
      const incoming=Number(e.signedAmount)>=0;
      rows.push(`<tr><td>${esc(dateLabel(e.date))}</td><td class="goal-ledger-person">${esc(e.actorName||'Participante')}</td><td><strong>${esc(e.description||'Movimentação')}</strong>${pending?'<span class="goal-ledger-pending">Pendente</span>':''}${e.notes?`<div class="goal-ledger-note">${esc(e.notes)}</div>`:''}</td><td class="num ${incoming?'goal-ledger-in':''}">${incoming?money(e.amount):''}</td><td class="num ${!incoming?'goal-ledger-out':''}">${!incoming?money(e.amount):''}</td><td class="num goal-ledger-balance">${money(e.balanceAfter)}</td></tr>`);
    }
    host.innerHTML=rows.join('');
  }

  function contributionSignedAmount(c){
    if(String(c?.status||'').toLowerCase()!=='paid')return 0;
    const kind=String(c?.movementKind||'');
    const raw=Number(c?.signedAmount);
    if(Number.isFinite(raw)&&raw!==0){
      if(kind==='opening_balance'||kind==='adjustment_in'||kind==='adjustment_out'||kind==='withdrawal')return 0;
      return raw;
    }
    const amount=Math.abs(Number(c?.amount)||0);
    if(!amount)return 0;
    if(kind==='opening_balance'||kind==='adjustment_in'||kind==='adjustment_out'||kind==='withdrawal')return 0;
    if(kind==='refund'||kind==='reversal'||c?.eventType==='redemption')return -amount;
    return amount;
  }

  function participantTotals(goal,userId,month){
    let monthTotal=0,periodTotal=0;
    for(const c of (goal?.contributions||[])){
      if(String(c?.contributorUserId||'')!==String(userId||''))continue;
      const value=contributionSignedAmount(c);
      if(!value)continue;
      periodTotal+=value;
      if(String(c?.date||'').slice(0,7)===String(month||''))monthTotal+=value;
    }
    return{month:Math.round(monthTotal*100)/100,period:Math.round(periodTotal*100)/100};
  }

  function renderParticipantSummary(goal,month){
    const host=document.getElementById('goalLedgerPeopleGrid'),ctx=document.getElementById('goalLedgerPeopleContext');
    if(!host||!goal)return;
    if(ctx)ctx.textContent=monthLabel(month);
    let people=(participantsByGoal.get(String(goal.id))||[])
      .filter(p=>p.isOwner||p.role==='contributor')
      .map(p=>({...p,totals:participantTotals(goal,p.userId,month)}));

    const ownerId=String(goal.ownerUserId||goal.userId||'');
    if(ownerId&&!people.some(p=>String(p.userId)===ownerId)){
      people.unshift({
        userId:ownerId,
        name:goal.ownerName||(goal.isOwner?'Você':'Proprietário'),
        isOwner:true,
        role:'owner',
        totals:participantTotals(goal,ownerId,month)
      });
    }

    if(!people.length){
      host.innerHTML='<div class="goal-ledger-people-empty">Nenhum participante identificado para este objetivo.</div>';
      return;
    }

    host.innerHTML=people.map(p=>`<div class="goal-ledger-person-card"><div class="goal-ledger-person-name" title="${esc((p.name||'Participante')+(p.isOwner?' · Proprietário':''))}">${esc(p.name||'Participante')}${p.isOwner?' <span class="goal-ledger-owner">Proprietário</span>':''}</div><div class="goal-ledger-person-values"><div class="goal-ledger-person-value month"><span>No mês</span><strong>${money(p.totals.month)}</strong></div><div class="goal-ledger-person-value"><span>No período</span><strong>${money(p.totals.period)}</strong></div></div></div>`).join('');
  }

  function renderStatement(data){
    const g=goalById(activeGoalId);
    document.getElementById('goalLedgerTitle').textContent=`Extrato · ${data.goalName||g?.name||'Objetivo'}`;
    document.getElementById('goalLedgerSubtitle').textContent=`Movimentações de ${monthLabel(data.month)} · saldo atual ${money(data.currentBalance)}`;
    document.getElementById('goalLedgerMonth').value=data.month||activeMonth||currentMonth();
    document.getElementById('goalLedgerOpening').textContent=money(data.openingBalance);
    document.getElementById('goalLedgerIn').textContent=money(data.totalIn);
    document.getElementById('goalLedgerOut').textContent=money(data.totalOut);
    document.getElementById('goalLedgerClosing').textContent=money(data.closingBalance);
    const actions=document.getElementById('goalLedgerActions');
    actions.innerHTML=g?.isOwner?`<button type="button" class="btn small" data-ledger-withdraw="${esc(g.id)}">Resgatar</button><button type="button" class="btn small" data-ledger-adjust="${esc(g.id)}">Ajustar saldo</button>`:'';
    actions.querySelector('[data-ledger-withdraw]')?.addEventListener('click',()=>openWithdrawal(g.id));
    actions.querySelector('[data-ledger-adjust]')?.addEventListener('click',()=>openAdjustment(g.id));
    renderParticipantSummary(g,data.month);
    renderRows(data);
  }

  async function loadStatement(goalId,month){
    if(!goalId||!getSb())return;
    activeGoalId=goalId;activeMonth=month||activeMonth||currentMonth();
    const host=document.getElementById('goalLedgerRows');if(host)host.innerHTML='<tr><td colspan="6" class="muted">Carregando extrato…</td></tr>';
    try{
      const {data,error}=await getSb().rpc('finance_list_goal_statement',{p_goal_id:goalId,p_month:`${activeMonth}-01`});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'statement_failed');
      activeMonth=data.month||activeMonth;renderStatement(data);
    }catch(e){
      console.error('Falha ao carregar extrato do objetivo.',e);
      if(host)host.innerHTML='<tr><td colspan="6" class="muted">Não foi possível carregar o extrato deste mês.</td></tr>';
    }
  }

  async function openStatement(id,month=currentMonth()){
    ensureModals();activeGoalId=id;activeMonth=month;
    openModal('goalLedgerModal');await loadStatement(id,month);
  }

  function openWithdrawal(id){
    const g=goalById(id);if(!g?.isOwner)return;
    ensureModals();
    document.getElementById('goalWithdrawalGoalId').value=id;
    document.getElementById('goalWithdrawalTitle').textContent=`Resgatar · ${g.name}`;
    document.getElementById('goalWithdrawalHelp').innerHTML=`Saldo disponível: <strong>${money(g.savedAmount)}</strong>. O resgate reduz o objetivo e cria uma receita correspondente na conta de destino.`;
    document.getElementById('goalWithdrawalAmount').value='';
    document.getElementById('goalWithdrawalDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('goalWithdrawalAccount').value='';
    document.getElementById('goalWithdrawalNotes').value='';
    closeModal('goalLedgerModal');openModal('goalWithdrawalModal');
  }

  function openAdjustment(id){
    const g=goalById(id);if(!g?.isOwner)return;
    ensureModals();
    document.getElementById('goalAdjustmentGoalId').value=id;
    document.getElementById('goalAdjustmentTitle').textContent=`Ajustar saldo · ${g.name}`;
    document.getElementById('goalAdjustmentDirection').value='in';
    document.getElementById('goalAdjustmentAmount').value='';
    document.getElementById('goalAdjustmentDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('goalAdjustmentNotes').value='';
    closeModal('goalLedgerModal');openModal('goalAdjustmentModal');
  }

  async function refreshAll(reopen=false){
    try{await window.financeGoalsRefresh?.()}catch(_e){}
    await refreshMeta();
    if(reopen&&activeGoalId)await openStatement(activeGoalId,activeMonth||currentMonth());
  }

  async function submitWithdrawal(e){
    e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;
    const id=document.getElementById('goalWithdrawalGoalId').value;
    try{
      const {data,error}=await getSb().rpc('finance_add_goal_withdrawal',{
        p_goal_id:id,
        p_amount:Number(document.getElementById('goalWithdrawalAmount').value)||0,
        p_date:document.getElementById('goalWithdrawalDate').value||null,
        p_notes:document.getElementById('goalWithdrawalNotes').value.trim(),
        p_account:document.getElementById('goalWithdrawalAccount').value.trim()
      });
      if(error)throw error;
      if(!data?.ok){
        if(data?.error==='withdrawal_exceeds_balance')throw new Error(`O valor excede o saldo disponível de ${money(data.availableAmount)}.`);
        throw new Error(data?.detail||data?.error||'withdrawal_failed');
      }
      closeModal('goalWithdrawalModal');activeGoalId=id;activeMonth=String(document.getElementById('goalWithdrawalDate').value||'').slice(0,7)||currentMonth();
      await refreshAll(true);
      try{if(typeof setSyncStatus==='function')setSyncStatus('Resgate registrado')}catch(_e){}
    }catch(err){console.error('Falha ao registrar resgate.',err);alert(err.message||'Não foi possível registrar o resgate.')}
    finally{if(btn)btn.disabled=false}
  }

  async function submitAdjustment(e){
    e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;
    const id=document.getElementById('goalAdjustmentGoalId').value,dir=document.getElementById('goalAdjustmentDirection').value;
    const amount=Number(document.getElementById('goalAdjustmentAmount').value)||0,delta=dir==='out'?-amount:amount;
    try{
      const {data,error}=await getSb().rpc('finance_adjust_goal_balance',{
        p_goal_id:id,p_delta:delta,
        p_date:document.getElementById('goalAdjustmentDate').value||null,
        p_notes:document.getElementById('goalAdjustmentNotes').value.trim()
      });
      if(error)throw error;
      if(!data?.ok){
        if(data?.error==='adjustment_below_zero')throw new Error(`O ajuste deixaria o objetivo negativo. Saldo disponível: ${money(data.availableAmount)}.`);
        throw new Error(data?.detail||data?.error||'adjustment_failed');
      }
      closeModal('goalAdjustmentModal');activeGoalId=id;activeMonth=String(document.getElementById('goalAdjustmentDate').value||'').slice(0,7)||currentMonth();
      await refreshAll(true);
      try{if(typeof setSyncStatus==='function')setSyncStatus('Ajuste do objetivo registrado')}catch(_e){}
    }catch(err){console.error('Falha ao ajustar saldo.',err);alert(err.message||'Não foi possível registrar o ajuste.')}
    finally{if(btn)btn.disabled=false}
  }

  function enhanceCards(){
    const grid=document.getElementById('goalGrid');if(!grid)return;
    grid.querySelectorAll('.goal-card[data-goal-id]').forEach(card=>{
      const id=card.dataset.goalId,g=goalById(id),actions=card.querySelector('.goal-actions');if(!actions||!g)return;
      if(!actions.querySelector('[data-goal-ledger]')){
        const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.goalLedger=id;b.textContent='Extrato';b.onclick=()=>openStatement(id);
        actions.insertBefore(b,actions.firstChild);
      }
      if(g.isOwner&&Number(g.savedAmount)>0&&!actions.querySelector('[data-goal-withdraw]')){
        const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.goalWithdraw=id;b.textContent='Resgatar';b.onclick=()=>openWithdrawal(id);
        const edit=actions.querySelector('[data-goal-edit]');actions.insertBefore(b,edit||null);
      }
      if(g.isOwner&&!actions.querySelector('[data-goal-adjust]')){
        const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.goalAdjust=id;b.textContent='Ajustar saldo';b.onclick=()=>openAdjustment(id);
        const edit=actions.querySelector('[data-goal-edit]');actions.insertBefore(b,edit||null);
      }
    });
  }

  async function refreshMeta(){
    if(loading||!getSb()||!getUserId())return;loading=true;
    try{
      const [gRes,pRes]=await Promise.all([
        getSb().rpc('finance_list_goals'),
        getSb().rpc('finance_list_goal_participants')
      ]);
      if(gRes.error)throw gRes.error;if(gRes.data?.ok===false)throw new Error(gRes.data.error||'load_failed');
      if(pRes.error)throw pRes.error;
      goals=Array.isArray(gRes.data?.items)?gRes.data.items:[];
      participantsByGoal=new Map((pRes.data?.items||[]).map(x=>[String(x.goalId),x.participants||[]]));
      enhanceCards();
    }catch(e){console.warn('Falha ao carregar metadados do extrato dos objetivos.',e)}
    finally{loading=false}
  }

  function observe(){
    const attach=()=>{
      const grid=document.getElementById('goalGrid');if(!grid||grid.dataset.goalLedgerObserved==='1')return false;
      grid.dataset.goalLedgerObserved='1';
      new MutationObserver(()=>enhanceCards()).observe(grid,{childList:true,subtree:true});
      enhanceCards();return true;
    };
    if(!attach()){
      const timer=setInterval(()=>{if(attach())clearInterval(timer)},150);
      setTimeout(()=>clearInterval(timer),30000);
    }
  }

  async function init(){
    ensureModals();observe();
    let tries=0;const timer=setInterval(async()=>{
      tries++;
      if(getSb()&&getUserId()&&document.getElementById('goalGrid')){clearInterval(timer);await refreshMeta()}
      else if(tries>300)clearInterval(timer);
    },100);
    window.addEventListener('finance:goals-kpis-rendered',()=>setTimeout(refreshMeta,0));
  }

  window.financeGoalLedger={
    open:openStatement,
    refresh:refreshMeta,
    withdraw:openWithdrawal,
    adjust:openAdjustment
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();