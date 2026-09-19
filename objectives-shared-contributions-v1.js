(function(){
  if(window.__financeGoalSharedContributionsV1Loaded)return;
  window.__financeGoalSharedContributionsV1Loaded=true;

  var STYLE_ID='finance-goal-shared-contributions-v1-style';
  var goals=[];
  var participantGroups=new Map();
  var busy=false;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser&&currentUser.id||''}catch(e){return window.currentUser&&window.currentUser.id||''}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c})}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}
  function today(){return new Date().toISOString().slice(0,10)}
  function currentYm(){try{return String((state&&state.settings&&state.settings.selectedMonth)||document.getElementById('monthSelect')&&document.getElementById('monthSelect').value||new Date().toISOString().slice(0,7)).slice(0,7)}catch(e){return new Date().toISOString().slice(0,7)}}
  function openModal(id){var el=document.getElementById(id);if(el)el.classList.add('open')}
  function closeModal(id){var el=document.getElementById(id);if(el)el.classList.remove('open')}
  function goalById(id){return goals.find(function(g){return String(g.id)===String(id)})||null}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;
    s.textContent=[
      '.goal-contribution-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '.goal-contribution-choice{appearance:none;text-align:left;padding:15px;border:1px solid #2a3c55;border-radius:14px;background:#0d1929;color:#e7edf5;cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease}',
      '.goal-contribution-choice:hover{border-color:#4b617d;background:#101f32;transform:translateY(-1px)}',
      '.goal-contribution-choice strong{display:block;font-size:13px;font-weight:850}',
      '.goal-contribution-choice span{display:block;margin-top:5px;color:#8fa0b5;font-size:10px;line-height:1.45}',
      '.goal-choice-icon{width:32px;height:32px;margin-bottom:10px;border-radius:10px;display:grid!important;place-items:center;background:#132238;border:1px solid #30445e;color:#ddeaac!important;font-size:15px!important}',
      '.goal-shared-intro{padding:11px 12px;border-radius:12px;background:#101d2e;border:1px solid #2a3c55;color:#aab7c8;font-size:10px;line-height:1.5;margin-bottom:12px}',
      '.goal-shared-intro strong{color:#e7edf5}',
      '.goal-share-participants{display:grid;gap:8px;margin-top:8px}',
      '.goal-share-participant{display:grid;grid-template-columns:auto minmax(0,1fr) 132px;align-items:center;gap:10px;padding:10px;border:1px solid #23334a;border-radius:12px;background:#0b1625}',
      '.goal-share-participant input[type="checkbox"]{width:16px;height:16px}',
      '.goal-share-participant-name{font-size:11px;font-weight:800;color:#e3eaf2}',
      '.goal-share-participant-meta{font-size:9px;color:#8192a7;margin-top:2px}',
      '.goal-share-percent{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:center}',
      '.goal-share-percent input{min-width:0;text-align:right}',
      '.goal-share-percent span{color:#8192a7;font-size:10px}',
      '.goal-share-percent small{grid-column:1/-1;text-align:right;color:#8fa0b5;font-size:9px}',
      '.goal-share-participant.is-disabled{opacity:.45}',
      '.goal-share-distribution-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 7px}',
      '.goal-share-distribution-head strong{font-size:11px;color:#dfe7f0}',
      '.goal-share-distribution-total{font-size:10px;color:#8fa0b5}',
      '.goal-share-distribution-total.ok{color:#91d6b9}.goal-share-distribution-total.bad{color:#ef8a81}',
      '.goal-share-preview{margin-top:10px;padding:10px 11px;border-radius:11px;border:1px solid #23334a;background:#0a1524;color:#8fa0b5;font-size:10px;line-height:1.5}',
      '.goal-share-preview strong{color:#dfe7f0}',
      '.goal-shared-state{min-height:15px;margin-top:9px;font-size:10px;color:#8fa0b5}.goal-shared-state.bad{color:#ef8a81}.goal-shared-state.ok{color:#91d6b9}',
      '@media(max-width:620px){.goal-contribution-choice-grid{grid-template-columns:1fr}.goal-share-participant{grid-template-columns:auto minmax(0,1fr)}.goal-share-percent{grid-column:2}}'
    ].join('');
    document.head.appendChild(s);
  }

  async function loadMeta(force){
    var client=getSb(),uid=getUserId();if(!client||!uid)return;
    if(!force&&goals.length&&participantGroups.size)return;
    var results=await Promise.all([client.rpc('finance_list_goals'),client.rpc('finance_list_goal_participants')]);
    var gRes=results[0],pRes=results[1];
    if(gRes.error)throw gRes.error;if(gRes.data&&gRes.data.ok===false)throw new Error(gRes.data.error||'goals_failed');
    if(pRes.error)throw pRes.error;if(pRes.data&&pRes.data.ok===false)throw new Error(pRes.data.error||'participants_failed');
    goals=Array.isArray(gRes.data&&gRes.data.items)?gRes.data.items:[];
    participantGroups=new Map((Array.isArray(pRes.data&&pRes.data.items)?pRes.data.items:[]).map(function(x){return [String(x.goalId),Array.isArray(x.participants)?x.participants:[]]}));
  }

  function eligibleParticipants(goalId){
    var uid=getUserId();
    return (participantGroups.get(String(goalId))||[]).filter(function(p){return p.isOwner||p.role==='contributor'}).map(function(p){
      var copy=Object.assign({},p);copy.isSelf=String(p.userId)===String(uid);return copy;
    });
  }

  function updateDistribution(host){
    if(!host)return;
    var form=host.closest('form'),amount=Number(form&&form.querySelector('[data-goal-shared-amount]')&&form.querySelector('[data-goal-shared-amount]').value)||0,total=0;
    host.querySelectorAll('.goal-share-participant').forEach(function(row){
      var check=row.querySelector('input[type="checkbox"]'),pct=row.querySelector('[data-goal-share-percent]');
      var enabled=check&&check.disabled?true:!!(check&&check.checked);
      row.classList.toggle('is-disabled',!enabled);if(pct)pct.disabled=!enabled;
      var value=enabled?(Number(pct&&pct.value)||0):0;total+=value;
      var preview=row.querySelector('[data-goal-share-value]');if(preview)preview.textContent=money(amount*value/100);
    });
    var totalEl=host.parentElement&&host.parentElement.querySelector('.goal-share-distribution-total');
    if(totalEl){totalEl.textContent=total.toFixed(2).replace('.',',')+'%';totalEl.className='goal-share-distribution-total '+(Math.abs(total-100)<0.01?'ok':'bad')}
  }

  function equalize(host){
    var rows=[].slice.call(host.querySelectorAll('.goal-share-participant'));
    var active=rows.filter(function(row){var c=row.querySelector('input[type="checkbox"]');return c&&c.disabled?true:!!(c&&c.checked)});
    if(!active.length)return;
    var base=Math.floor((100/active.length)*100)/100,used=0;
    active.forEach(function(row,index){
      var input=row.querySelector('[data-goal-share-percent]');
      var value=index===active.length-1?Math.round((100-used)*100)/100:base;
      input.value=value.toFixed(2);used+=value;
    });
    rows.filter(function(row){var c=row.querySelector('input[type="checkbox"]');return !(c&&c.disabled)&&!(c&&c.checked)}).forEach(function(row){row.querySelector('[data-goal-share-percent]').value='0.00'});
    updateDistribution(host);
  }

  function participantRows(goalId,selectedMap){
    var uid=getUserId(),parts=eligibleParticipants(goalId);
    if(parts.length<2)return '<div class="goal-shared-state bad">Para usar aporte compartilhado, compartilhe o objetivo com pelo menos uma pessoa na permissão <strong>Visualizar e aportar</strong> e aguarde o aceite.</div>';
    return parts.map(function(p){
      var selected=selectedMap?selectedMap.has(String(p.userId)):true;
      var pct=selectedMap&&selectedMap.has(String(p.userId))?selectedMap.get(String(p.userId)):0;
      var locked=String(p.userId)===String(uid);
      return '<div class="goal-share-participant">'+
        '<input type="checkbox" data-goal-share-check="'+esc(p.userId)+'" '+(selected?'checked ':'')+(locked?'disabled':'')+'>'+
        '<div><div class="goal-share-participant-name">'+esc(p.isSelf?'Você':p.name||'Participante')+'</div>'+
        '<div class="goal-share-participant-meta">'+(p.isSelf?'Você paga o valor total':p.isOwner?'Proprietário · reembolsa sua parte':'Participante · reembolsa sua parte')+'</div></div>'+
        '<div class="goal-share-percent"><input type="number" min="0" max="100" step="0.01" value="'+Number(pct).toFixed(2)+'" data-goal-share-percent="'+esc(p.userId)+'"><span>%</span><small data-goal-share-value>R$ 0,00</small></div></div>';
    }).join('');
  }

  function bindDistribution(form,selectedMap){
    var host=form.querySelector('.goal-share-participants');if(!host)return;
    if(eligibleParticipants(form.dataset.goalId).length<2)return;
    if(selectedMap)updateDistribution(host);else equalize(host);
    host.querySelectorAll('[data-goal-share-check]').forEach(function(check){if(!check.disabled)check.addEventListener('change',function(){equalize(host)})});
    host.querySelectorAll('[data-goal-share-percent]').forEach(function(input){input.addEventListener('input',function(){updateDistribution(host)})});
    var amount=form.querySelector('[data-goal-shared-amount]');if(amount)amount.addEventListener('input',function(){updateDistribution(host)});
    var eq=form.querySelector('[data-goal-equalize]');if(eq)eq.addEventListener('click',function(){equalize(host)});
  }

  function distributionPayload(form){
    var payload=[],total=0;
    form.querySelectorAll('.goal-share-participant').forEach(function(row){
      var check=row.querySelector('input[type="checkbox"]'),pct=row.querySelector('[data-goal-share-percent]');
      var active=check&&check.disabled?true:!!(check&&check.checked);if(!active)return;
      var userId=pct&&pct.dataset.goalSharePercent||'',percentage=Number(pct&&pct.value)||0;if(percentage<=0)return;
      payload.push({userId:userId,percentage:percentage});total+=percentage;
    });
    if(payload.length<2)throw new Error('Selecione pelo menos duas pessoas.');
    if(Math.abs(total-100)>=0.01)throw new Error('A divisão precisa totalizar 100%.');
    if(!payload.some(function(p){return String(p.userId)===String(getUserId())}))throw new Error('Quem paga o total precisa participar da divisão.');
    return payload;
  }

  function choiceMarkup(id,title,lead,individualText,sharedText){
    return '<div class="modal-backdrop" id="'+id+'"><div class="modal"><div class="modal-head"><h3>'+title+'</h3><button type="button" class="btn ghost" data-goal-shared-close="'+id+'">✕</button></div>'+
      '<div class="modal-body"><div class="goal-shared-intro">'+lead+'</div><div class="goal-contribution-choice-grid">'+
      '<button type="button" class="goal-contribution-choice" data-goal-choice="individual"><span class="goal-choice-icon">1</span><strong>Individual</strong><span>'+individualText+'</span></button>'+
      '<button type="button" class="goal-contribution-choice" data-goal-choice="shared"><span class="goal-choice-icon">↔</span><strong>Compartilhado</strong><span>'+sharedText+'</span></button>'+
      '</div></div></div></div>';
  }

  function ensureModals(){
    if(!document.getElementById('goalContributionChoiceModal')){
      var w1=document.createElement('div');w1.innerHTML=choiceMarkup('goalContributionChoiceModal','Aporte extra','Escolha como este aporte será financiado.','Somente você participa deste aporte.','Você paga o valor total agora e os participantes reembolsam suas partes.');document.body.appendChild(w1.firstElementChild);
    }
    if(!document.getElementById('goalRecurringChoiceModal')){
      var w2=document.createElement('div');w2.innerHTML=choiceMarkup('goalRecurringChoiceModal','Aporte recorrente','Escolha como a regra mensal deste objetivo funcionará.','Uma regra recorrente somente para você.','Uma pessoa paga o total mensal e os participantes reembolsam suas partes.');document.body.appendChild(w2.firstElementChild);
    }
    if(!document.getElementById('goalSharedContributionModal')){
      var w3=document.createElement('div');w3.innerHTML=
        '<div class="modal-backdrop" id="goalSharedContributionModal"><div class="modal"><form id="goalSharedContributionForm">'+
        '<div class="modal-head"><h3 id="goalSharedContributionTitle">Aporte extra compartilhado</h3><button type="button" class="btn ghost" data-goal-shared-close="goalSharedContributionModal">✕</button></div>'+
        '<div class="modal-body"><div class="goal-shared-intro"><strong>Você paga o valor total.</strong> O objetivo recebe esse aporte uma única vez. As partes dos demais participantes viram reembolsos em <strong>Te devem</strong>; quando forem pagos, não aumentam novamente o objetivo.</div>'+
        '<div class="form-grid"><div class="field"><label>Valor total do aporte (R$)</label><input id="goalSharedContributionAmount" data-goal-shared-amount type="number" min="0.01" step="0.01" required></div>'+
        '<div class="field"><label>Data</label><input id="goalSharedContributionDate" type="date" required></div><div class="field"><label>Conta de origem</label><input id="goalSharedContributionAccount" placeholder="Ex.: Banco do Brasil"></div>'+
        '<div class="field full"><label>Observação</label><textarea id="goalSharedContributionNotes" rows="3" placeholder="Ex.: Aporte extra de setembro"></textarea></div></div>'+
        '<div class="goal-share-distribution-head"><strong>Divisão do aporte</strong><div style="display:flex;align-items:center;gap:8px"><span class="goal-share-distribution-total">0,00%</span><button class="btn small" type="button" data-goal-equalize>Dividir igualmente</button></div></div>'+
        '<div class="goal-share-participants"></div><div class="goal-shared-state"></div></div>'+
        '<div class="modal-foot"><button type="button" class="btn" data-goal-shared-close="goalSharedContributionModal">Cancelar</button><button class="btn primary" type="submit">Registrar aporte compartilhado</button></div></form></div></div>';
      document.body.appendChild(w3.firstElementChild);
      document.getElementById('goalSharedContributionForm').addEventListener('submit',saveSharedContribution);
    }
    if(!document.getElementById('goalSharedRecurringModal')){
      var w4=document.createElement('div');w4.innerHTML=
        '<div class="modal-backdrop" id="goalSharedRecurringModal"><div class="modal"><form id="goalSharedRecurringForm">'+
        '<div class="modal-head"><h3 id="goalSharedRecurringTitle">Aporte recorrente compartilhado</h3><button type="button" class="btn ghost" data-goal-shared-close="goalSharedRecurringModal">✕</button></div>'+
        '<div class="modal-body"><div class="goal-shared-intro"><strong>Uma regra mensal, um único aporte por competência.</strong> Você paga o valor total quando marcar o aporte mensal como pago; nesse momento o objetivo recebe o valor integral e as partes dos demais viram reembolsos.</div>'+
        '<div class="form-grid"><div class="field"><label>Valor total mensal (R$)</label><input id="goalSharedRecurringAmount" data-goal-shared-amount type="number" min="0.01" step="0.01" required></div>'+
        '<div class="field"><label>Primeiro mês</label><input id="goalSharedRecurringStart" type="month" required></div><div class="field"><label>Último mês (opcional)</label><input id="goalSharedRecurringEnd" type="month"></div>'+
        '<div class="field"><label>Conta de origem</label><input id="goalSharedRecurringAccount" placeholder="Ex.: Banco do Brasil"></div></div>'+
        '<div class="goal-share-distribution-head"><strong>Divisão mensal</strong><div style="display:flex;align-items:center;gap:8px"><span class="goal-share-distribution-total">0,00%</span><button class="btn small" type="button" data-goal-equalize>Dividir igualmente</button></div></div>'+
        '<div class="goal-share-participants"></div><div class="goal-share-preview">Os meses futuros começam como <strong>pendentes</strong>. O reembolso só nasce quando o aporte daquela competência for marcado como <strong>Pago</strong>.</div><div class="goal-shared-state"></div></div>'+
        '<div class="modal-foot"><button type="button" class="btn danger" id="goalSharedRecurringDisable">Desativar recorrência</button><button type="button" class="btn" data-goal-shared-close="goalSharedRecurringModal">Cancelar</button><button class="btn primary" type="submit">Cadastrar recorrência compartilhada</button></div></form></div></div>';
      document.body.appendChild(w4.firstElementChild);
      document.getElementById('goalSharedRecurringForm').addEventListener('submit',saveSharedRecurring);
      document.getElementById('goalSharedRecurringDisable').addEventListener('click',disableSharedRecurring);
    }
    document.querySelectorAll('[data-goal-shared-close]').forEach(function(btn){
      if(btn.dataset.goalSharedBound)return;btn.dataset.goalSharedBound='1';btn.addEventListener('click',function(){closeModal(btn.dataset.goalSharedClose)});
    });
    ['goalContributionChoiceModal','goalRecurringChoiceModal','goalSharedContributionModal','goalSharedRecurringModal'].forEach(function(id){
      var el=document.getElementById(id);if(el&&!el.dataset.goalSharedBackdrop){el.dataset.goalSharedBackdrop='1';el.addEventListener('click',function(e){if(e.target===el)closeModal(id)})}
    });
  }

  function setState(form,text,kind){
    var el=form&&form.querySelector('.goal-shared-state');if(!el)return;el.textContent=text||'';el.className='goal-shared-state '+(kind||'');
  }

  async function refreshEverything(){
    try{if(window.financeCloud&&window.financeCloud.refresh)await window.financeCloud.refresh()}catch(e){}
    try{if(window.financeGoalsRefresh)await window.financeGoalsRefresh()}catch(e){}
    try{if(window.financeObjectiveExpenseRefresh)window.financeObjectiveExpenseRefresh()}catch(e){}
    try{if(window.financeSharedBalancesDetailForceRefresh)window.financeSharedBalancesDetailForceRefresh()}catch(e){}
    await loadMeta(true);
  }

  function openIndividualContribution(id){
    var g=goalById(id);if(!g||!document.getElementById('goalContributionModal'))return;
    document.getElementById('goalContributionGoalId').value=id;
    document.getElementById('goalContributionTitle').textContent='Aporte extra individual · '+g.name;
    document.getElementById('goalContributionAmount').value='';
    document.getElementById('goalContributionDate').value=today();
    if(document.getElementById('goalContributionAccount'))document.getElementById('goalContributionAccount').value='';
    if(document.getElementById('goalContributionStatus'))document.getElementById('goalContributionStatus').value='Pago';
    document.getElementById('goalContributionNotes').value='';
    openModal('goalContributionModal');setTimeout(function(){var x=document.getElementById('goalContributionAmount');if(x)x.focus()},60);
  }

  function openIndividualRecurring(id){
    var g=goalById(id);if(!g||!document.getElementById('goalRecurringModal'))return;
    document.getElementById('goalRecurringGoalId').value=id;
    document.getElementById('goalRecurringTitle').textContent='Aporte recorrente individual · '+g.name;
    document.getElementById('goalRecurringAmount').value=Number(g.recurringAmount||g.plannedMonthly)||'';
    document.getElementById('goalRecurringStart').value=g.recurringStartMonth||currentYm();
    document.getElementById('goalRecurringEnd').value=g.recurringEndMonth||g.targetMonth||'';
    document.getElementById('goalRecurringAccount').value=g.recurringAccount||'';
    var disable=document.getElementById('goalRecurringDisable');if(disable)disable.style.display=g.recurringEnabled?'inline-flex':'none';
    openModal('goalRecurringModal');
  }

  async function openContributionChoice(id){
    ensureModals();await loadMeta(true);var g=goalById(id);if(!g||!g.canContribute)return;
    var modal=document.getElementById('goalContributionChoiceModal');
    modal.querySelector('.modal-head h3').textContent='Aporte extra · '+g.name;
    modal.querySelector('[data-goal-choice="individual"]').onclick=function(){closeModal('goalContributionChoiceModal');openIndividualContribution(id)};
    modal.querySelector('[data-goal-choice="shared"]').onclick=function(){closeModal('goalContributionChoiceModal');openSharedContribution(id)};
    openModal('goalContributionChoiceModal');
  }

  async function openRecurringChoice(id){
    ensureModals();await loadMeta(true);var g=goalById(id);if(!g||!g.isOwner)return;
    var modal=document.getElementById('goalRecurringChoiceModal');
    modal.querySelector('.modal-head h3').textContent='Aporte recorrente · '+g.name;
    modal.querySelector('[data-goal-choice="individual"]').onclick=function(){closeModal('goalRecurringChoiceModal');openIndividualRecurring(id)};
    modal.querySelector('[data-goal-choice="shared"]').onclick=function(){closeModal('goalRecurringChoiceModal');openSharedRecurring(id)};
    openModal('goalRecurringChoiceModal');
  }

  async function openSharedContribution(id){
    ensureModals();await loadMeta(true);var g=goalById(id);if(!g)return;
    var form=document.getElementById('goalSharedContributionForm');form.dataset.goalId=id;
    document.getElementById('goalSharedContributionTitle').textContent='Aporte extra compartilhado · '+g.name;
    document.getElementById('goalSharedContributionAmount').value='';
    document.getElementById('goalSharedContributionDate').value=today();
    document.getElementById('goalSharedContributionAccount').value='';
    document.getElementById('goalSharedContributionNotes').value='';
    form.querySelector('.goal-share-participants').innerHTML=participantRows(id,null);setState(form,'');bindDistribution(form,null);
    openModal('goalSharedContributionModal');
  }

  async function saveSharedContribution(e){
    e.preventDefault();if(busy)return;var form=e.currentTarget,btn=e.submitter;busy=true;if(btn)btn.disabled=true;
    try{
      var id=form.dataset.goalId,amount=Number(document.getElementById('goalSharedContributionAmount').value)||0;if(amount<=0)throw new Error('Informe o valor total do aporte.');
      var participants=distributionPayload(form);setState(form,'Registrando aporte e preparando os reembolsos…');
      var res=await getSb().rpc('finance_add_shared_goal_contribution',{p_goal_id:id,p_amount:amount,p_date:document.getElementById('goalSharedContributionDate').value||null,p_notes:document.getElementById('goalSharedContributionNotes').value.trim(),p_account:document.getElementById('goalSharedContributionAccount').value.trim(),p_participants:participants});
      if(res.error)throw res.error;if(!res.data||!res.data.ok)throw new Error(res.data&&res.data.detail||res.data&&res.data.error||'shared_contribution_failed');
      closeModal('goalSharedContributionModal');await refreshEverything();try{if(typeof setSyncStatus==='function')setSyncStatus('Aporte compartilhado de '+money(amount)+' registrado')}catch(_e){}
    }catch(err){console.error('Falha ao registrar aporte compartilhado.',err);setState(form,err.message||'Não foi possível registrar o aporte compartilhado.','bad')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function openSharedRecurring(id){
    ensureModals();await loadMeta(true);var g=goalById(id);if(!g)return;
    var form=document.getElementById('goalSharedRecurringForm');form.dataset.goalId=id,plan=null;
    try{var res=await getSb().rpc('finance_get_goal_shared_recurring_plan',{p_goal_id:id});if(res.error)throw res.error;if(res.data&&res.data.ok===false)throw new Error(res.data.error||'plan_failed');if(res.data&&res.data.found)plan=res.data}catch(err){console.warn('Falha ao carregar recorrência compartilhada.',err)}
    document.getElementById('goalSharedRecurringTitle').textContent='Aporte recorrente compartilhado · '+g.name;
    document.getElementById('goalSharedRecurringAmount').value=Number(plan&&plan.amount||g.recurringAmount||g.plannedMonthly)||'';
    document.getElementById('goalSharedRecurringStart').value=plan&&plan.startMonth||g.recurringStartMonth||currentYm();
    document.getElementById('goalSharedRecurringEnd').value=plan&&plan.endMonth||g.recurringEndMonth||g.targetMonth||'';
    document.getElementById('goalSharedRecurringAccount').value=plan&&plan.account||g.recurringAccount||'';
    var selected=plan?new Map((plan.participants||[]).map(function(p){return [String(p.userId),Number(p.percentage)||0]})):null;
    form.querySelector('.goal-share-participants').innerHTML=participantRows(id,selected);setState(form,'');bindDistribution(form,selected);
    var disable=document.getElementById('goalSharedRecurringDisable');if(disable)disable.style.display=plan&&plan.enabled?'inline-flex':'none';
    openModal('goalSharedRecurringModal');
  }

  async function saveSharedRecurring(e){
    e.preventDefault();if(busy)return;var form=e.currentTarget,btn=e.submitter;busy=true;if(btn)btn.disabled=true;
    try{
      var id=form.dataset.goalId,amount=Number(document.getElementById('goalSharedRecurringAmount').value)||0;if(amount<=0)throw new Error('Informe o valor mensal.');
      var participants=distributionPayload(form),start=document.getElementById('goalSharedRecurringStart').value,end=document.getElementById('goalSharedRecurringEnd').value;
      setState(form,'Salvando regra recorrente compartilhada…');
      var res=await getSb().rpc('finance_set_goal_shared_recurring_plan',{p_goal_id:id,p_enabled:true,p_amount:amount,p_start_month:start?start+'-01':null,p_end_month:end?end+'-01':null,p_account:document.getElementById('goalSharedRecurringAccount').value.trim(),p_participants:participants});
      if(res.error)throw res.error;if(!res.data||!res.data.ok)throw new Error(res.data&&res.data.detail||res.data&&res.data.error||'shared_recurring_failed');
      closeModal('goalSharedRecurringModal');await refreshEverything();try{if(typeof setSyncStatus==='function')setSyncStatus('Recorrência compartilhada cadastrada')}catch(_e){}
    }catch(err){console.error('Falha ao cadastrar recorrência compartilhada.',err);setState(form,err.message||'Não foi possível cadastrar a recorrência compartilhada.','bad')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function disableSharedRecurring(){
    if(busy)return;var form=document.getElementById('goalSharedRecurringForm'),id=form&&form.dataset.goalId;if(!id)return;
    if(!confirm('Desativar os aportes recorrentes compartilhados futuros? Aportes já pagos e seus acertos serão preservados.'))return;
    busy=true;var btn=document.getElementById('goalSharedRecurringDisable');btn.disabled=true;
    try{
      var res=await getSb().rpc('finance_set_goal_shared_recurring_plan',{p_goal_id:id,p_enabled:false,p_amount:0,p_start_month:null,p_end_month:null,p_account:'',p_participants:[]});
      if(res.error)throw res.error;if(!res.data||!res.data.ok)throw new Error(res.data&&res.data.detail||res.data&&res.data.error||'disable_failed');
      closeModal('goalSharedRecurringModal');await refreshEverything();try{if(typeof setSyncStatus==='function')setSyncStatus('Recorrência compartilhada desativada')}catch(_e){}
    }catch(err){console.error('Falha ao desativar recorrência compartilhada.',err);setState(form,'Não foi possível desativar a recorrência agora.','bad')}
    finally{busy=false;btn.disabled=false}
  }

  function enhanceButtons(){
    document.querySelectorAll('[data-goal-contribute]').forEach(function(btn){
      btn.textContent='+ Aporte extra';
      if(btn.dataset.goalChoiceV1==='1')return;btn.dataset.goalChoiceV1='1';
      btn.onclick=function(){openContributionChoice(btn.dataset.goalContribute)};
    });
  }

  function init(){
    injectStyles();ensureModals();window.openGoalContributionChoice=openContributionChoice;window.openGoalRecurringChoice=openRecurringChoice;
    document.addEventListener('keydown',function(e){if(e.key==='Escape')['goalContributionChoiceModal','goalRecurringChoiceModal','goalSharedContributionModal','goalSharedRecurringModal'].forEach(closeModal)});
    var observer=new MutationObserver(enhanceButtons);observer.observe(document.documentElement,{childList:true,subtree:true});enhanceButtons();
    window.addEventListener('focus',function(){if(document.getElementById('page-goals')&&document.getElementById('page-goals').classList.contains('active'))loadMeta(true).catch(function(){})});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();