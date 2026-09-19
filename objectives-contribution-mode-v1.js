(function(){
  if(window.__financeGoalContributionModesLoaded)return;
  window.__financeGoalContributionModesLoaded=true;

  const STYLE_ID='finance-goal-contribution-modes-style';
  let bypass=false;
  let goals=new Map();
  let participants=new Map();
  let loadingMeta=false;
  let individualRecurringGoalId='';
  let busy=false;
  let sharedRecurring=new Map();
  const goalManagedProtection={
    transactions:new Set(),
    debtPlans:new Set(),
    incomePlans:new Set()
  };

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}
  function currentYm(){try{return String(state?.settings?.selectedMonth||document.getElementById('monthSelect')?.value||new Date().toISOString().slice(0,7)).slice(0,7)}catch(e){return new Date().toISOString().slice(0,7)}}
  function openModal(id){document.getElementById(id)?.classList.add('open')}
  function closeModal(id){document.getElementById(id)?.classList.remove('open')}
  function protectedTx(txOrId){
    const tx=typeof txOrId==='object'&&txOrId?txOrId:null,id=String(tx?.id||txOrId||'');
    return goalManagedProtection.transactions.has(id)
      ||String(tx?.debtId||'').startsWith('goal-shared-')
      ||String(tx?.incomePlanId||'').startsWith('goal-shared-income-')
      ||/aporte compartilhado vinculado ao objetivo/i.test(String(tx?.notes||''));
  }
  function protectedDebt(id){return goalManagedProtection.debtPlans.has(String(id||''))||String(id||'').startsWith('goal-shared-')}
  function protectedIncome(id){return goalManagedProtection.incomePlans.has(String(id||''))||String(id||'').startsWith('goal-shared-income-')}
  window.financeGoalManagedProtection={
    isTransaction:protectedTx,
    isDebtPlan:protectedDebt,
    isIncomePlan:protectedIncome,
    message:'Este lançamento é gerenciado pela seção Objetivos.'
  };

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .goal-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .goal-mode-option{appearance:none;border:1px solid #2b3b52;border-radius:14px;background:#0d1929;color:#e7edf5;text-align:left;padding:15px;cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease}
      .goal-mode-option:hover{border-color:#48617f;background:#101f32;transform:translateY(-1px)}
      .goal-mode-option strong{display:block;font-size:12px;font-weight:850}
      .goal-mode-option span{display:block;color:#8fa0b5;font-size:10px;line-height:1.45;margin-top:5px}
      .goal-mode-option.shared strong{color:#ddeaac}
      .goal-shared-payer{padding:10px 11px;border:1px solid #30445e;border-radius:11px;background:#101d2e;color:#cbd6e3;font-size:10px;line-height:1.45;margin-bottom:12px}
      .goal-shared-payer strong{color:#f1f5f9}
      .goal-split-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:13px 0 8px}
      .goal-split-head strong{font-size:11px;color:#dce6f2}.goal-split-head button{font-size:9px}
      .goal-split-list{display:grid;gap:7px}
      .goal-split-row{display:grid;grid-template-columns:auto minmax(0,1fr) 100px;align-items:center;gap:9px;padding:9px 10px;border:1px solid #22344b;border-radius:11px;background:#0b1625}
      .goal-split-row input[type="checkbox"]{width:16px;height:16px}
      .goal-split-name{min-width:0;font-size:11px;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .goal-split-name small{display:block;color:#7f90a5;font-size:9px;font-weight:500;margin-top:2px}
      .goal-split-percent{position:relative}.goal-split-percent input{padding-right:26px!important;text-align:right}.goal-split-percent:after{content:'%';position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:10px;color:#8293a8;pointer-events:none}
      .goal-split-summary{display:flex;justify-content:space-between;gap:10px;margin-top:8px;color:#8fa0b5;font-size:10px}.goal-split-summary strong{color:#dce6f2}
      .goal-shared-error{min-height:16px;margin-top:9px;color:#ef8a81;font-size:10px}
      .goal-shared-info{padding:9px 10px;border:1px solid #28513e;border-radius:10px;background:#102a20;color:#a5e2c8;font-size:10px;line-height:1.45;margin-bottom:12px}
      .goal-mode-option:disabled{cursor:not-allowed;opacity:.56;transform:none!important;background:#0b1421;border-color:#243247}
      .goal-mode-option:disabled strong{color:#8290a2}
      .goal-mode-option:disabled span{color:#748296}
      .goal-recurring-current{padding:11px 12px;border:1px solid #314861;border-radius:11px;background:#0c1b2d;margin-bottom:12px;font-size:10px;line-height:1.55;color:#aebed0}
      .goal-recurring-current strong{color:#eef4fb}
      @media(max-width:620px){.goal-mode-grid{grid-template-columns:1fr}.goal-split-row{grid-template-columns:auto minmax(0,1fr) 88px}}
    `;document.head.appendChild(s);
  }

  function ensureModals(){
    if(!document.getElementById('goalContributionModeModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalContributionModeModal"><div class="modal"><div class="modal-head"><h3 id="goalContributionModeTitle">Escolher aporte</h3><button type="button" class="btn ghost" data-goal-mode-close="goalContributionModeModal">✕</button></div><div class="modal-body"><input type="hidden" id="goalContributionModeGoalId"><input type="hidden" id="goalContributionModeKind"><div class="goal-mode-grid"><button type="button" class="goal-mode-option" data-goal-mode-choice="individual"><strong id="goalModeIndividualTitle">Aporte individual</strong><span id="goalModeIndividualText">Somente você participa deste aporte.</span></button><button type="button" class="goal-mode-option shared" data-goal-mode-choice="shared"><strong id="goalModeSharedTitle">Aporte compartilhado</strong><span id="goalModeSharedText">Você paga o total e os participantes reembolsam suas partes.</span></button></div></div></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
    }

    if(!document.getElementById('goalSharedExtraModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalSharedExtraModal"><div class="modal"><form id="goalSharedExtraForm"><div class="modal-head"><h3 id="goalSharedExtraTitle">Aporte extra compartilhado</h3><button type="button" class="btn ghost" data-goal-mode-close="goalSharedExtraModal">✕</button></div><div class="modal-body"><div class="goal-shared-payer"><strong>Você paga o valor total.</strong><br>O objetivo recebe o aporte integral uma única vez. A parte das outras pessoas vira reembolso e não aumenta o objetivo novamente.</div><input type="hidden" id="goalSharedExtraGoalId"><div class="form-grid"><div class="field"><label>Valor total do aporte (R$)</label><input id="goalSharedExtraAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Data</label><input id="goalSharedExtraDate" type="date" required></div><div class="field"><label>Conta de origem</label><input id="goalSharedExtraAccount" placeholder="Ex.: Banco do Brasil"></div><div class="field full"><label>Observação</label><textarea id="goalSharedExtraNotes" rows="2" placeholder="Ex.: Aporte extra de setembro"></textarea></div></div><div class="goal-split-head"><strong>Divisão do aporte</strong><button type="button" class="btn small" data-goal-split-equal="goalSharedExtraSplit">Dividir igualmente</button></div><div class="goal-split-list" id="goalSharedExtraSplit"></div><div class="goal-split-summary"><span>Total da divisão</span><strong id="goalSharedExtraSplitTotal">0%</strong></div><div class="goal-shared-error" id="goalSharedExtraError"></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-mode-close="goalSharedExtraModal">Cancelar</button><button class="btn primary" type="submit">Registrar aporte</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
    }

    if(!document.getElementById('goalSharedRecurringModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalSharedRecurringModal"><div class="modal"><form id="goalSharedRecurringForm"><div class="modal-head"><h3 id="goalSharedRecurringTitle">Aporte recorrente compartilhado</h3><button type="button" class="btn ghost" data-goal-mode-close="goalSharedRecurringModal">✕</button></div><div class="modal-body"><div class="goal-shared-info" id="goalSharedRecurringInfo">Ao salvar, a recorrência será enviada aos demais participantes para <strong>confirmação</strong>. Depois que todos aceitarem, o Prumo criará a <strong>Despesa recorrente</strong> de cada participante e, para o pagador, a <strong>Despesa</strong> do aporte total e as <strong>Receitas recorrentes</strong> de reembolso. Os lançamentos mensais serão ocorrências desses planos.</div><div class="goal-shared-payer"><strong>Você paga o valor total de cada competência.</strong><br>Os demais participantes ficam responsáveis apenas pelas parcelas definidas abaixo.</div><input type="hidden" id="goalSharedRecurringGoalId"><div class="form-grid"><div class="field"><label>Valor recorrente total (R$)</label><input id="goalSharedRecurringAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Primeiro mês</label><input id="goalSharedRecurringStart" type="month" required></div><div class="field"><label>Último mês (opcional)</label><input id="goalSharedRecurringEnd" type="month"></div><div class="field"><label>Conta de origem</label><input id="goalSharedRecurringAccount" placeholder="Ex.: Banco do Brasil"></div></div><div class="goal-split-head"><strong>Divisão mensal</strong><button type="button" class="btn small" data-goal-split-equal="goalSharedRecurringSplit">Dividir igualmente</button></div><div class="goal-split-list" id="goalSharedRecurringSplit"></div><div class="goal-split-summary"><span>Total da divisão</span><strong id="goalSharedRecurringSplitTotal">0%</strong></div><div class="goal-shared-error" id="goalSharedRecurringError"></div></div><div class="modal-foot"><button type="button" class="btn danger" id="goalSharedRecurringDisable" style="margin-right:auto;display:none">Desativar recorrência</button><button type="button" class="btn" data-goal-mode-close="goalSharedRecurringModal">Cancelar</button><button class="btn primary" type="submit">Salvar recorrência</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
    }

    document.querySelectorAll('[data-goal-mode-close]').forEach(btn=>{
      if(btn.dataset.boundGoalMode)return;
      btn.dataset.boundGoalMode='1';
      btn.addEventListener('click',()=>closeModal(btn.dataset.goalModeClose));
    });
    ['goalContributionModeModal','goalSharedExtraModal','goalSharedRecurringModal'].forEach(id=>{
      const el=document.getElementById(id);
      if(el&&!el.dataset.goalModeBackdrop){
        el.dataset.goalModeBackdrop='1';
        el.addEventListener('click',e=>{if(e.target===el)closeModal(id)});
      }
    });
    document.querySelectorAll('[data-goal-mode-choice]').forEach(btn=>{
      if(btn.dataset.boundGoalModeChoice)return;
      btn.dataset.boundGoalModeChoice='1';
      btn.addEventListener('click',()=>chooseMode(btn.dataset.goalModeChoice));
    });
    document.querySelectorAll('[data-goal-split-equal]').forEach(btn=>{
      if(btn.dataset.boundGoalSplit)return;
      btn.dataset.boundGoalSplit='1';
      btn.addEventListener('click',()=>equalize(btn.dataset.goalSplitEqual));
    });
    document.getElementById('goalSharedExtraForm')?.addEventListener('submit',saveSharedExtra);
    document.getElementById('goalSharedRecurringForm')?.addEventListener('submit',saveSharedRecurring);
    document.getElementById('goalSharedRecurringDisable')?.addEventListener('click',disableSharedRecurring);
  }

  async function loadMeta(force=false){
    if(loadingMeta&&!force)return;
    const client=getSb(),uid=getUserId();if(!client||!uid)return;
    loadingMeta=true;
    try{
      const [gRes,pRes,rRes,mRes]=await Promise.all([
        client.rpc('finance_list_goals'),
        client.rpc('finance_list_goal_participants'),
        client.rpc('finance_list_current_goal_shared_recurring_plans'),
        client.rpc('finance_list_goal_managed_items')
      ]);
      if(gRes.error)throw gRes.error;if(pRes.error)throw pRes.error;
      if(rRes.error)throw rRes.error;if(mRes.error)throw mRes.error;
      goals=new Map((gRes.data?.items||[]).map(g=>[String(g.id),g]));
      participants=new Map((pRes.data?.items||[]).map(x=>[String(x.goalId),x.participants||[]]));
      sharedRecurring=new Map((rRes.data?.items||[]).map(x=>[String(x.goalId),x]));
      goalManagedProtection.transactions=new Set((mRes.data?.transactions||[]).map(String));
      goalManagedProtection.debtPlans=new Set((mRes.data?.debtPlans||[]).map(String));
      goalManagedProtection.incomePlans=new Set((mRes.data?.incomePlans||[]).map(String));
      enhanceButtons();
    }catch(e){console.warn('Falha ao carregar dados para aportes compartilhados.',e)}
    finally{loadingMeta=false}
  }

  function eligiblePeople(goalId){
    const uid=getUserId();
    return (participants.get(String(goalId))||[])
      .filter(p=>p.isOwner||p.role==='contributor')
      .map(p=>({...p,isMe:String(p.userId)===uid}));
  }

  function equalize(hostId){
    const host=document.getElementById(hostId);if(!host)return;
    const rows=[...host.querySelectorAll('.goal-split-row')].filter(r=>r.querySelector('[data-split-enabled]')?.checked);
    if(!rows.length)return;
    const base=Math.floor((100/rows.length)*10000)/10000;
    let used=0;
    rows.forEach((row,i)=>{
      const input=row.querySelector('[data-split-percent]');
      const value=i===rows.length-1?Number((100-used).toFixed(4)):base;
      input.value=String(value);used+=value;
    });
    updateSplitSummary(hostId);
  }

  function updateSplitSummary(hostId){
    const host=document.getElementById(hostId);if(!host)return;
    let total=0;
    host.querySelectorAll('.goal-split-row').forEach(row=>{
      const enabled=row.querySelector('[data-split-enabled]')?.checked;
      const input=row.querySelector('[data-split-percent]');
      input.disabled=!enabled;
      if(enabled)total+=Number(input.value)||0;
    });
    const totalEl=document.getElementById(hostId==='goalSharedExtraSplit'?'goalSharedExtraSplitTotal':'goalSharedRecurringSplitTotal');
    if(totalEl)totalEl.textContent=total.toFixed(2).replace('.',',')+'%';
  }

  function renderSplit(hostId,goalId,existing=[]){
    const host=document.getElementById(hostId);if(!host)return false;
    const people=eligiblePeople(goalId),uid=getUserId(),map=new Map((existing||[]).map(p=>[String(p.userId),Number(p.percentage)||0]));
    if(people.length<2){
      host.innerHTML='<div class="goal-shared-error">Para criar um aporte compartilhado, compartilhe este objetivo com pelo menos uma pessoa usando a permissão <strong>Pode aportar</strong>.</div>';
      updateSplitSummary(hostId);return false;
    }
    host.innerHTML=people.map(p=>{
      const hasExisting=map.has(String(p.userId));
      const enabled=existing.length?hasExisting:true;
      const pct=hasExisting?map.get(String(p.userId)):0;
      const lock=p.isMe?'disabled':'';
      return `<label class="goal-split-row"><input type="checkbox" data-split-enabled data-user-id="${esc(p.userId)}" ${enabled?'checked':''} ${lock}><div class="goal-split-name">${esc(p.isMe?'Você':p.name||'Participante')}<small>${p.isMe?'Pagador do valor total':p.isOwner?'Proprietário do objetivo':'Colaborador'}</small></div><div class="goal-split-percent"><input type="number" min="0.0001" max="100" step="0.0001" data-split-percent value="${pct||''}"></div></label>`;
    }).join('');
    host.querySelectorAll('[data-split-enabled]').forEach(input=>input.addEventListener('change',()=>{equalize(hostId)}));
    host.querySelectorAll('[data-split-percent]').forEach(input=>input.addEventListener('input',()=>updateSplitSummary(hostId)));
    if(!existing.length)equalize(hostId);else updateSplitSummary(hostId);
    return true;
  }

  function splitPayload(hostId){
    const host=document.getElementById(hostId);if(!host)return[];
    return [...host.querySelectorAll('.goal-split-row')]
      .filter(row=>row.querySelector('[data-split-enabled]')?.checked)
      .map(row=>({userId:row.querySelector('[data-split-enabled]').dataset.userId,percentage:Number(row.querySelector('[data-split-percent]').value)||0}));
  }

  function validateSplit(list){
    if(list.length<2)return 'Selecione pelo menos duas pessoas.';
    const sum=list.reduce((s,p)=>s+(Number(p.percentage)||0),0);
    if(list.some(p=>p.percentage<=0))return 'Informe um percentual maior que zero para cada participante.';
    if(Math.abs(sum-100)>.0001)return 'A divisão precisa totalizar exatamente 100%.';
    if(!list.some(p=>String(p.userId)===getUserId()))return 'Você precisa fazer parte da divisão.';
    return '';
  }

  function enhanceButtons(){
    const grid=document.getElementById('goalGrid');if(!grid)return;
    grid.querySelectorAll('[data-goal-contribute]').forEach(btn=>{
      if(btn.textContent!=='+ Aporte extra')btn.textContent='+ Aporte extra';
      if(btn.title!=='Registrar aporte extra')btn.title='Registrar aporte extra';
    });
    grid.querySelectorAll('[data-goal-recurring]').forEach(btn=>{
      const current=sharedRecurring.get(String(btn.dataset.goalRecurring||''));
      const label=current?'↻ Aporte recorrente · Gerenciar':'↻ Aporte recorrente';
      if(btn.textContent!==label)btn.textContent=label;
      const title=current?'Gerenciar aporte recorrente compartilhado':'Configurar aporte recorrente';
      if(btn.title!==title)btn.title=title;
    });
  }

  function openChoice(goalId,kind){
    ensureModals();
    const g=goals.get(String(goalId)),current=sharedRecurring.get(String(goalId));
    document.getElementById('goalContributionModeGoalId').value=goalId;
    document.getElementById('goalContributionModeKind').value=kind;
    const extra=kind==='extra';
    document.getElementById('goalContributionModeTitle').textContent=`${extra?'Aporte extra':'Aporte recorrente'} · ${g?.name||'Objetivo'}`;
    document.getElementById('goalModeIndividualTitle').textContent=extra?'Aporte individual':'Aporte recorrente individual';
    document.getElementById('goalModeIndividualText').textContent=extra?'Somente você participa deste aporte.':'Cria uma regra recorrente somente para a sua participação.';
    document.getElementById('goalModeSharedTitle').textContent=extra?'Aporte compartilhado':'Aporte recorrente compartilhado';
    const sharedBtn=document.querySelector('[data-goal-mode-choice="shared"]');
    if(!extra&&current){
      if(sharedBtn)sharedBtn.disabled=true;
      document.getElementById('goalModeSharedText').textContent='Só é permitido um aporte recorrente compartilhado por vez. Exclua o atual para incluir outro';
    }else{
      if(sharedBtn)sharedBtn.disabled=false;
      document.getElementById('goalModeSharedText').textContent=extra?'Você paga o total e os participantes reembolsam suas partes.':'Você paga o total de cada competência e os participantes reembolsam as partes definidas.';
    }
    openModal('goalContributionModeModal');
  }

  function triggerOriginal(goalId,selector){
    const card=document.querySelector(`.goal-card[data-goal-id="${CSS.escape(String(goalId))}"]`);
    const btn=card?.querySelector(selector);if(!btn)return false;
    bypass=true;try{btn.click()}finally{bypass=false}
    return true;
  }

  async function chooseMode(mode){
    const goalId=document.getElementById('goalContributionModeGoalId').value;
    const kind=document.getElementById('goalContributionModeKind').value;
    const g=goals.get(String(goalId));
    closeModal('goalContributionModeModal');

    if(mode==='individual'){
      if(kind==='extra'){
        if(triggerOriginal(goalId,'[data-goal-contribute]')){
          setTimeout(()=>{const title=document.getElementById('goalContributionTitle');if(title)title.textContent=`Aporte extra individual · ${g?.name||'Objetivo'}`},20);
        }
      }else{
        individualRecurringGoalId=goalId;
        if(triggerOriginal(goalId,'[data-goal-recurring]')){
          setTimeout(()=>{
            const title=document.getElementById('goalRecurringTitle');if(title)title.textContent=`Aporte recorrente individual · ${g?.name||'Objetivo'}`;
            const note=document.querySelector('#goalRecurringModal .goal-recurring-summary');if(note)note.innerHTML='O sistema criará <strong>uma ocorrência pendente por mês</strong> somente para você. Ao marcar como paga, ela passa a compor o valor reservado do objetivo.';
          },20);
        }
      }
      return;
    }

    await loadMeta(true);
    if(kind==='extra')openSharedExtra(goalId);
    else await openSharedRecurring(goalId);
  }

  function openSharedExtra(goalId){
    const g=goals.get(String(goalId));
    document.getElementById('goalSharedExtraGoalId').value=goalId;
    document.getElementById('goalSharedExtraTitle').textContent=`Aporte extra compartilhado · ${g?.name||'Objetivo'}`;
    document.getElementById('goalSharedExtraAmount').value='';
    document.getElementById('goalSharedExtraDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('goalSharedExtraAccount').value='';
    document.getElementById('goalSharedExtraNotes').value='';
    document.getElementById('goalSharedExtraError').textContent='';
    renderSplit('goalSharedExtraSplit',goalId,[]);
    openModal('goalSharedExtraModal');
    setTimeout(()=>document.getElementById('goalSharedExtraAmount')?.focus(),50);
  }

  async function openSharedRecurring(goalId){
    const g=goals.get(String(goalId)),client=getSb();
    document.getElementById('goalSharedRecurringGoalId').value=goalId;
    document.getElementById('goalSharedRecurringError').textContent='';
    let existing=null;
    try{
      const {data,error}=await client.rpc('finance_get_current_goal_shared_recurring_plan',{p_goal_id:goalId});
      if(error)throw error;if(data?.found)existing=data;
    }catch(e){console.warn('Falha ao carregar regra compartilhada existente.',e)}
    document.getElementById('goalSharedRecurringTitle').textContent=`${existing?'Gerenciar aporte recorrente compartilhado':'Aporte recorrente compartilhado'} · ${g?.name||'Objetivo'}`;
    document.getElementById('goalSharedRecurringAmount').value=existing?.amount??g?.recurringAmount??g?.plannedMonthly??'';
    document.getElementById('goalSharedRecurringStart').value=existing?.startMonth||g?.recurringStartMonth||currentYm();
    document.getElementById('goalSharedRecurringEnd').value=existing?.endMonth||g?.recurringEndMonth||g?.targetMonth||'';
    document.getElementById('goalSharedRecurringAccount').value=existing?.account||g?.recurringAccount||'';
    const ok=renderSplit('goalSharedRecurringSplit',goalId,existing?.participants||[]);
    const disable=document.getElementById('goalSharedRecurringDisable');
    const info=document.getElementById('goalSharedRecurringInfo');
    const form=document.getElementById('goalSharedRecurringForm');
    const submit=form?.querySelector('button[type="submit"]');
    const approval=existing?.approvalStatus||'';
    const canManage=existing?existing.canManage!==false:true;
    if(submit){
      submit.disabled=!canManage;
      submit.textContent=existing?'Salvar alterações':'Salvar recorrência';
    }
    form?.querySelectorAll('input').forEach(input=>{if(input.type!=='hidden')input.disabled=!canManage});
    form?.querySelectorAll('[data-goal-split-equal]').forEach(button=>button.disabled=!canManage);
    if(disable){
      disable.style.display=existing&&(approval==='pending'||existing.enabled)&&canManage?'inline-flex':'none';
      disable.textContent=approval==='pending'?'Cancelar solicitação':'Cancelar recorrência';
    }
    if(info){
      if(approval==='pending')info.innerHTML='<strong>Aguardando confirmação.</strong> Nenhuma Despesa, Receita ou ocorrência mensal foi criada ainda. Após todos aceitarem, os planos recorrentes serão registrados e passarão a gerar os lançamentos mensais.';
      else if(approval==='accepted'&&existing?.enabled)info.innerHTML='<strong>Recorrência confirmada e ativa.</strong> Este é o aporte recorrente compartilhado cadastrado para o objetivo. Você pode alterar valor, período, conta ou divisão aqui, ou cancelar a recorrência. As Despesas e Receitas derivadas não podem ser excluídas fora da seção Objetivos.';
      else if(approval==='rejected')info.innerHTML='<strong>Solicitação recusada.</strong> Ajuste a divisão ou os dados e salve novamente para enviar uma nova confirmação.';
      else info.innerHTML='Ao salvar, a regra recorrente será enviada aos demais participantes para <strong>confirmação</strong>. Os lançamentos mensais só serão criados depois que todos aceitarem.';
      if(existing&&!canManage)info.innerHTML=`<strong>Aporte recorrente compartilhado já cadastrado.</strong> O pagador é ${esc(existing.payerName||'outro participante')}. Só o pagador pode alterar ou cancelar esta recorrência.`;
    }
    if(!ok)document.getElementById('goalSharedRecurringError').textContent='Adicione pelo menos um colaborador com permissão para aportar.';
    openModal('goalSharedRecurringModal');
  }

  async function refreshEverything(){
    try{await window.financeCloud?.refresh?.()}catch(e){}
    try{await window.financeGoalsRefresh?.()}catch(e){}
    try{await window.financeGoalCollabRefresh?.()}catch(e){}
    try{window.financeObjectiveExpenseRefresh?.()}catch(e){}
    try{window.financeSharedBalancesDetailForceRefresh?.()}catch(e){}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    await loadMeta(true);
  }

  async function saveSharedExtra(e){
    e.preventDefault();if(busy)return;
    const btn=e.submitter,goalId=document.getElementById('goalSharedExtraGoalId').value;
    const amount=Number(document.getElementById('goalSharedExtraAmount').value)||0;
    const date=document.getElementById('goalSharedExtraDate').value;
    const account=document.getElementById('goalSharedExtraAccount').value.trim();
    const notes=document.getElementById('goalSharedExtraNotes').value.trim();
    const split=splitPayload('goalSharedExtraSplit'),msg=document.getElementById('goalSharedExtraError');
    const splitError=validateSplit(split);
    if(amount<=0){msg.textContent='Informe o valor total do aporte.';return}
    if(!date){msg.textContent='Informe a data do aporte.';return}
    if(splitError){msg.textContent=splitError;return}
    busy=true;if(btn)btn.disabled=true;msg.textContent='';
    try{
      const {data,error}=await getSb().rpc('finance_add_shared_goal_contribution',{
        p_goal_id:goalId,p_amount:amount,p_date:date,p_notes:notes,p_account:account,p_participants:split
      });
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'shared_goal_contribution_failed');
      closeModal('goalSharedExtraModal');await refreshEverything();
      try{if(typeof setSyncStatus==='function')setSyncStatus(`Aporte compartilhado de ${money(amount)} registrado`)}catch(_e){}
    }catch(err){console.error('Falha ao registrar aporte compartilhado.',err);msg.textContent='Não foi possível registrar o aporte compartilhado agora.'}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function saveSharedRecurring(e){
    e.preventDefault();if(busy)return;
    const btn=e.submitter,goalId=document.getElementById('goalSharedRecurringGoalId').value;
    const amount=Number(document.getElementById('goalSharedRecurringAmount').value)||0;
    const start=document.getElementById('goalSharedRecurringStart').value;
    const end=document.getElementById('goalSharedRecurringEnd').value;
    const account=document.getElementById('goalSharedRecurringAccount').value.trim();
    const split=splitPayload('goalSharedRecurringSplit'),msg=document.getElementById('goalSharedRecurringError');
    const splitError=validateSplit(split);
    if(amount<=0){msg.textContent='Informe o valor recorrente total.';return}
    if(!start){msg.textContent='Informe o primeiro mês.';return}
    if(splitError){msg.textContent=splitError;return}
    busy=true;if(btn)btn.disabled=true;msg.textContent='';
    try{
      const {data,error}=await getSb().rpc('finance_set_goal_shared_recurring_plan',{
        p_goal_id:goalId,p_enabled:true,p_amount:amount,p_start_month:`${start}-01`,
        p_end_month:end?`${end}-01`:null,p_account:account,p_participants:split
      });
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'shared_goal_recurring_failed');
      closeModal('goalSharedRecurringModal');await refreshEverything();
      try{if(typeof setSyncStatus==='function')setSyncStatus(data?.approvalStatus==='pending'?'Recorrência enviada para confirmação':'Aporte recorrente compartilhado salvo')}catch(_e){}
    }catch(err){console.error('Falha ao salvar aporte recorrente compartilhado.',err);msg.textContent='Não foi possível salvar a recorrência compartilhada agora.'}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function disableSharedRecurring(){
    if(busy)return;
    const goalId=document.getElementById('goalSharedRecurringGoalId').value;
    const cancelRequest=document.getElementById('goalSharedRecurringDisable')?.textContent==='Cancelar solicitação';
    if(!confirm(cancelRequest?'Cancelar esta solicitação de recorrência? Nenhum lançamento mensal será criado.':'Desativar os aportes recorrentes compartilhados futuros? Aportes já pagos e reembolsos históricos serão preservados.'))return;
    busy=true;const btn=document.getElementById('goalSharedRecurringDisable');if(btn)btn.disabled=true;
    try{
      const {data,error}=await getSb().rpc('finance_set_goal_shared_recurring_plan',{
        p_goal_id:goalId,p_enabled:false,p_amount:0,p_start_month:null,p_end_month:null,p_account:'',p_participants:[]
      });
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'disable_failed');
      closeModal('goalSharedRecurringModal');await refreshEverything();
      try{if(typeof setSyncStatus==='function')setSyncStatus(cancelRequest?'Solicitação de recorrência cancelada':'Recorrência compartilhada desativada')}catch(_e){}
    }catch(err){console.error('Falha ao desativar recorrência compartilhada.',err);alert('Não foi possível desativar a recorrência compartilhada agora.')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function saveIndividualRecurring(e){
    if(e.target?.id!=='goalRecurringForm'||!individualRecurringGoalId)return;
    const goalId=document.getElementById('goalRecurringGoalId')?.value||'';
    if(goalId!==individualRecurringGoalId)return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;
    const btn=e.submitter,amount=Number(document.getElementById('goalRecurringAmount')?.value)||0;
    const start=document.getElementById('goalRecurringStart')?.value||'',end=document.getElementById('goalRecurringEnd')?.value||'';
    const account=document.getElementById('goalRecurringAccount')?.value?.trim()||'';
    if(amount<=0||!start){alert('Informe valor e primeiro mês.');return}
    busy=true;if(btn)btn.disabled=true;
    try{
      const {data,error}=await getSb().rpc('finance_set_goal_recurring_plan',{
        p_goal_id:goalId,p_enabled:true,p_amount:amount,p_start_month:`${start}-01`,
        p_end_month:end?`${end}-01`:null,p_account:account
      });
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'recurring_failed');
      const off=await getSb().rpc('finance_disable_goal_shared_recurring_rule',{p_goal_id:goalId});
      if(off.error)throw off.error;if(!off.data?.ok)throw new Error(off.data?.error||'mode_switch_failed');
      individualRecurringGoalId='';closeModal('goalRecurringModal');await refreshEverything();
      try{if(typeof setSyncStatus==='function')setSyncStatus('Aporte recorrente individual salvo')}catch(_e){}
    }catch(err){console.error('Falha ao salvar aporte recorrente individual.',err);alert('Não foi possível salvar o aporte recorrente individual agora.')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function disableIndividualRecurring(e){
    const btn=e.target?.closest?.('#goalRecurringDisable');
    if(!btn||!individualRecurringGoalId)return false;
    const goalId=document.getElementById('goalRecurringGoalId')?.value||'';
    if(goalId!==individualRecurringGoalId)return false;
    e.preventDefault();e.stopImmediatePropagation();
    if(!confirm('Desativar os aportes recorrentes futuros deste objetivo? Aportes já pagos serão preservados.'))return true;
    if(busy)return true;busy=true;btn.disabled=true;
    try{
      const g=goals.get(String(goalId));
      const {data,error}=await getSb().rpc('finance_set_goal_recurring_plan',{
        p_goal_id:goalId,p_enabled:false,p_amount:Number(g?.plannedMonthly)||0,p_start_month:null,p_end_month:null,p_account:g?.recurringAccount||''
      });
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'disable_failed');
      await getSb().rpc('finance_disable_goal_shared_recurring_rule',{p_goal_id:goalId});
      individualRecurringGoalId='';closeModal('goalRecurringModal');await refreshEverything();
    }catch(err){console.error('Falha ao desativar aporte recorrente.',err);alert('Não foi possível desativar a recorrência agora.')}
    finally{busy=false;btn.disabled=false}
    return true;
  }

  function interceptClicks(e){
    if(bypass)return;
    const contribute=e.target?.closest?.('[data-goal-contribute]');
    if(contribute){
      e.preventDefault();e.stopImmediatePropagation();
      openChoice(contribute.dataset.goalContribute,'extra');return;
    }
    const recurring=e.target?.closest?.('[data-goal-recurring]');
    if(recurring){
      e.preventDefault();e.stopImmediatePropagation();
      const goalId=recurring.dataset.goalRecurring;
      const current=sharedRecurring.get(String(goalId));
      if(current){openSharedRecurring(goalId);return}
      openChoice(goalId,'recurring');return;
    }
    disableIndividualRecurring(e);
  }

  function observe(){
    const grid=document.getElementById('goalGrid');if(!grid)return;
    const obs=new MutationObserver(()=>{enhanceButtons();loadMeta(false)});
    obs.observe(grid,{childList:true,subtree:true});
    enhanceButtons();
  }

  function init(){
    injectStyles();ensureModals();observe();loadMeta(true);
    window.openGoalContributionChoice=function(goalId){openChoice(goalId,'extra')};
    window.openGoalRecurringChoice=function(goalId){openChoice(goalId,'recurring')};
    document.addEventListener('click',interceptClicks,true);
    document.addEventListener('submit',saveIndividualRecurring,true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){['goalContributionModeModal','goalSharedExtraModal','goalSharedRecurringModal'].forEach(closeModal)}});
    document.addEventListener('click',e=>{if(e.target?.closest?.('.nav [data-page="goals"]'))setTimeout(()=>loadMeta(true),100)},true);
    window.addEventListener('focus',()=>{if(document.getElementById('page-goals')?.classList.contains('active'))loadMeta(true)});
    window.financeGoalContributionModesRefresh=()=>loadMeta(true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();