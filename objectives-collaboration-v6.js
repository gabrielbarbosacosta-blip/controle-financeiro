(function(){
  if(window.__financeGoalCollabV6Loaded)return;
  window.__financeGoalCollabV6Loaded=true;

  const STYLE_ID='finance-goal-collab-v6-style';
  let goals=[];
  let shares=[];
  let loading=false;
  let busy=false;
  let observedGrid=null;
  let gridObserver=null;
  let enhanceTimer=null;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}
  function ym(){try{return String(state?.settings?.selectedMonth||document.getElementById('monthSelect')?.value||new Date().toISOString().slice(0,7)).slice(0,7)}catch(e){return new Date().toISOString().slice(0,7)}}
  function digits(v){return String(v||'').replace(/\D/g,'').slice(0,11)}
  function cpfMask(v){return digits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')}
  function roleLabel(v){return v==='contributor'?'Pode aportar':'Somente visualizar'}
  function statusLabel(v){return v==='accepted'?'Aceito':v==='rejected'?'Recusado':'Aguardando aceite'}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .goal-collab-pill{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;border:1px solid #475569;background:#172033;color:#cbd5e1;font-size:9px;font-weight:760}
      .goal-collab-pill.recurring{border-color:#155e75;background:#083344;color:#a5f3fc}.goal-collab-pill.shared{border-color:#5b21b6;background:#2e1065;color:#ddd6fe}.goal-collab-pill.pending{border-color:#854d0e;background:#422006;color:#fde68a}
      .goal-card.goal-share-pending{border-color:rgba(245,158,11,.55);box-shadow:0 0 0 1px rgba(245,158,11,.07) inset}
      .goal-share-invite{margin:0 14px 12px;padding:10px 11px;border:1px solid #854d0e;border-radius:11px;background:#422006;color:#fde68a;font-size:10px;line-height:1.45}
      .goal-collab-note{font-size:9px;color:var(--muted);margin-top:3px}
      .goal-share-list{display:grid;gap:8px;margin-top:12px}.goal-share-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px;border:1px solid rgba(148,163,184,.14);border-radius:11px;background:#0b1424}
      .goal-share-name{font-size:12px;font-weight:780}.goal-share-meta{font-size:10px;color:var(--muted);margin-top:3px}.goal-share-state{font-size:10px;min-height:14px;margin-top:8px}.goal-share-state.ok{color:#86efac}.goal-share-state.bad{color:#fca5a5}
      .goal-recurring-summary{padding:10px 11px;border:1px solid #155e75;border-radius:11px;background:#083344;color:#cffafe;font-size:10px;line-height:1.45;margin-bottom:12px}
      .goal-recurring-danger{margin-right:auto}
      @media(max-width:620px){.goal-share-row{align-items:flex-start;flex-direction:column}.goal-share-row .btn{width:100%}}
    `;document.head.appendChild(s);
  }

  function ensureModals(){
    if(!document.getElementById('goalRecurringModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalRecurringModal"><div class="modal"><form id="goalRecurringForm"><div class="modal-head"><h3 id="goalRecurringTitle">Aporte recorrente individual</h3><button type="button" class="btn ghost" data-goal-collab-close="goalRecurringModal">✕</button></div><div class="modal-body"><div class="goal-recurring-summary">O sistema criará <strong>um aporte pendente por mês</strong> em <strong>Despesa → Objetivos</strong>. Cada competência pode ser paga separadamente; ao marcar como paga, o valor passa a compor o total reservado do objetivo.</div><input type="hidden" id="goalRecurringGoalId"><div class="form-grid"><div class="field"><label>Valor mensal (R$)</label><input id="goalRecurringAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Primeiro mês</label><input id="goalRecurringStart" type="month" required></div><div class="field"><label>Último mês (opcional)</label><input id="goalRecurringEnd" type="month"><small class="muted">Sem preencher, usa o prazo do objetivo; se também não houver prazo, projeta 24 meses.</small></div><div class="field"><label>Conta de origem</label><input id="goalRecurringAccount" placeholder="Ex.: Banco do Brasil"></div></div></div><div class="modal-foot"><button type="button" class="btn danger goal-recurring-danger" id="goalRecurringDisable">Desativar recorrência</button><button type="button" class="btn" data-goal-collab-close="goalRecurringModal">Cancelar</button><button class="btn primary" type="submit">Cadastrar recorrência</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalRecurringForm').addEventListener('submit',saveRecurring);
      document.getElementById('goalRecurringDisable').addEventListener('click',disableRecurring);
    }

    if(!document.getElementById('goalShareModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="goalShareModal"><div class="modal"><form id="goalShareForm"><div class="modal-head"><h3 id="goalShareTitle">Compartilhar objetivo</h3><button type="button" class="btn ghost" data-goal-collab-close="goalShareModal">✕</button></div><div class="modal-body"><div class="goal-modal-note">Convide uma pessoa que já tenha perfil no Controle Financeiro. Você continua sendo o proprietário do objetivo e escolhe se ela poderá apenas acompanhar ou também registrar aportes.</div><input type="hidden" id="goalShareGoalId"><div class="form-grid"><div class="field"><label>CPF da pessoa</label><input id="goalShareCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required></div><div class="field"><label>Permissão</label><select id="goalShareRole"><option value="viewer">Somente visualizar</option><option value="contributor">Visualizar e aportar</option></select></div></div><div class="goal-share-state" id="goalShareState"></div><div class="goal-share-list" id="goalShareList"></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-collab-close="goalShareModal">Fechar</button><button class="btn primary" type="submit">Enviar convite</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalShareForm').addEventListener('submit',shareGoal);
      document.getElementById('goalShareCpf').addEventListener('input',e=>{e.target.value=cpfMask(e.target.value)});
    }

    document.querySelectorAll('[data-goal-collab-close]').forEach(b=>{if(b.dataset.boundGoalCollab)return;b.dataset.boundGoalCollab='1';b.addEventListener('click',()=>closeModal(b.dataset.goalCollabClose))});
    ['goalRecurringModal','goalShareModal'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.dataset.backdropBound){el.dataset.backdropBound='1';el.addEventListener('click',e=>{if(e.target===el)closeModal(id)})}});
  }

  function openModal(id){document.getElementById(id)?.classList.add('open')}
  function closeModal(id){document.getElementById(id)?.classList.remove('open')}
  function goalById(id){return goals.find(g=>g.id===id)||null}

  async function loadGoalsMeta(){
    const client=getSb(),uid=getUserId();if(loading||!client||!uid)return;
    loading=true;
    try{
      const {data,error}=await client.rpc('finance_list_goals');
      if(error)throw error;if(data?.ok===false)throw new Error(data.error||'load_failed');
      goals=Array.isArray(data?.items)?data.items:[];
      enhanceCards();
    }catch(e){console.warn('Falha ao carregar permissões dos objetivos.',e)}
    finally{loading=false}
  }

  function scheduleEnhance(){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhanceCards,0)}

  function observeGrid(){
    const grid=document.getElementById('goalGrid');if(!grid||grid===observedGrid)return;
    gridObserver?.disconnect();observedGrid=grid;
    gridObserver=new MutationObserver(scheduleEnhance);gridObserver.observe(grid,{childList:true,subtree:true});
    scheduleEnhance();
  }

  function addPill(host,text,cls=''){
    if(!host)return;
    const span=document.createElement('span');span.className=`goal-collab-pill ${cls}`.trim();span.textContent=text;host.appendChild(span);
  }

  function button(label,attr,value,cls='btn small'){
    const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.setAttribute(attr,value);return b;
  }

  function enhanceContributionRows(card,g){
    const uid=getUserId(),byId=new Map((g.contributions||[]).map(c=>[String(c.id),c]));
    card.querySelectorAll('[data-goal-contrib-delete]').forEach(btn=>{
      const c=byId.get(String(btn.dataset.goalContribDelete));
      if(!c||String(c.contributorUserId||g.ownerUserId)!==uid){btn.remove();return}
      btn.title='Excluir seu aporte';
    });
    card.querySelectorAll('.goal-contrib-row').forEach(row=>{
      const btn=row.querySelector('[data-goal-contrib-delete]');
      let c=btn?byId.get(String(btn.dataset.goalContribDelete)):null;
      if(!c){
        const rows=[...card.querySelectorAll('.goal-contrib-row')],idx=rows.indexOf(row);c=(g.contributions||[])[idx]||null;
      }
      if(!c||row.querySelector('.goal-collab-note'))return;
      const first=row.firstElementChild;if(!first)return;
      const note=document.createElement('div');note.className='goal-collab-note';
      const who=String(c.contributorUserId||g.ownerUserId)===uid?'Você':(c.contributorName||'Participante');
      note.textContent=`${who}${String(c.status||'').toLowerCase()==='pending'?' · não pago':''}`;
      first.appendChild(note);
    });
  }

  function enhanceCards(){
    observeGrid();
    const grid=document.getElementById('goalGrid');if(!grid)return;
    const map=new Map(goals.map(g=>[String(g.id),g]));
    grid.querySelectorAll('.goal-card[data-goal-id]').forEach(card=>{
      const g=map.get(String(card.dataset.goalId));if(!g)return;
      if(card.dataset.goalCollabVersion==='6')return;
      card.dataset.goalCollabVersion='6';
      const sub=card.querySelector('.goal-sub'),actions=card.querySelector('.goal-actions');
      if(g.recurringEnabled)addPill(sub,'Recorrente','recurring');
      if(!g.isOwner)addPill(sub,g.shareStatus==='pending'?'Convite pendente':g.shareRole==='contributor'?'Objetivo compartilhado · colaborador':'Objetivo compartilhado · visualização',g.shareStatus==='pending'?'pending':'shared');

      if(g.isOwner){
        if(actions){
          const recurring=button('↻ Aporte recorrente','data-goal-recurring',g.id);
          const share=button('Compartilhar','data-goal-share',g.id);
          actions.insertBefore(recurring,actions.querySelector('[data-goal-edit]')||null);
          actions.insertBefore(share,actions.querySelector('[data-goal-edit]')||null);
          recurring.addEventListener('click',()=>{if(typeof window.openGoalRecurringChoice==='function')window.openGoalRecurringChoice(g.id);else openRecurring(g.id)});share.addEventListener('click',()=>openShare(g.id));
        }
      }else{
        card.querySelectorAll('[data-goal-edit],[data-goal-toggle],[data-goal-delete]').forEach(x=>x.remove());
        if(!g.canContribute)card.querySelectorAll('[data-goal-contribute]').forEach(x=>x.remove());
        if(g.shareStatus==='pending'){
          card.classList.add('goal-share-pending');
          const body=card.querySelector('.goal-body');if(body&&!card.querySelector('.goal-share-invite')){
            const n=document.createElement('div');n.className='goal-share-invite';n.innerHTML=`<strong>${esc(g.ownerName||'Alguém')} compartilhou este objetivo com você.</strong><br>${g.shareRole==='contributor'?'O convite permite acompanhar a meta e registrar aportes próprios.':'O convite permite acompanhar o progresso da meta em modo de visualização.'}`;body.insertAdjacentElement('afterend',n);
          }
          if(actions){
            actions.innerHTML='';
            const accept=button('Aceitar','data-goal-share-respond',g.shareId,'btn small primary'),decline=button('Recusar','data-goal-share-decline',g.shareId,'btn small');
            actions.append(accept,decline);accept.addEventListener('click',()=>respondShare(g.shareId,'accepted'));decline.addEventListener('click',()=>respondShare(g.shareId,'rejected'));
          }
        }else if(actions&&g.shareId){
          const leave=button('Sair do objetivo','data-goal-share-leave',g.shareId,'btn small');actions.appendChild(leave);leave.addEventListener('click',()=>removeShare(g.shareId,false));
        }
      }
      enhanceContributionRows(card,g);
    });
  }

  function openRecurring(id){
    ensureModals();const g=goalById(id);if(!g||!g.isOwner)return;
    document.getElementById('goalRecurringGoalId').value=id;
    document.getElementById('goalRecurringTitle').textContent=`Aporte recorrente individual · ${g.name}`;
    document.getElementById('goalRecurringAmount').value=Number(g.plannedMonthly)||'';
    document.getElementById('goalRecurringStart').value=g.recurringStartMonth||ym();
    document.getElementById('goalRecurringEnd').value=g.recurringEndMonth||g.targetMonth||'';
    document.getElementById('goalRecurringAccount').value=g.recurringAccount||'';
    const disable=document.getElementById('goalRecurringDisable');if(disable)disable.style.display=g.recurringEnabled?'inline-flex':'none';
    openModal('goalRecurringModal');setTimeout(()=>document.getElementById('goalRecurringAmount')?.focus(),60);
  }

  async function saveRecurring(e){
    e.preventDefault();if(busy)return;busy=true;const btn=e.submitter;if(btn)btn.disabled=true;
    const id=document.getElementById('goalRecurringGoalId').value,amount=Number(document.getElementById('goalRecurringAmount').value)||0,start=document.getElementById('goalRecurringStart').value,end=document.getElementById('goalRecurringEnd').value,account=document.getElementById('goalRecurringAccount').value.trim();
    try{
      const sharedOff=await getSb().rpc('finance_disable_goal_shared_recurring_rule',{p_goal_id:id});
      if(sharedOff.error)throw sharedOff.error;if(sharedOff.data?.ok===false)throw new Error(sharedOff.data.error||'shared_disable_failed');
      const {data,error}=await getSb().rpc('finance_set_goal_recurring_plan',{p_goal_id:id,p_enabled:true,p_amount:amount,p_start_month:start?`${start}-01`:null,p_end_month:end?`${end}-01`:null,p_account:account});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'recurring_failed');
      closeModal('goalRecurringModal');await refreshGoals(true);statusText('Recorrência do objetivo cadastrada');
    }catch(err){console.error('Falha ao cadastrar recorrência.',err);alert('Não foi possível cadastrar o aporte recorrente do objetivo.')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function disableRecurring(){
    if(busy)return;const id=document.getElementById('goalRecurringGoalId').value,g=goalById(id);if(!g)return;
    if(!confirm('Desativar os aportes recorrentes futuros deste objetivo? Aportes já pagos serão preservados.'))return;
    busy=true;const btn=document.getElementById('goalRecurringDisable');btn.disabled=true;
    try{
      const sharedOff=await getSb().rpc('finance_disable_goal_shared_recurring_rule',{p_goal_id:id});
      if(sharedOff.error)throw sharedOff.error;if(sharedOff.data?.ok===false)throw new Error(sharedOff.data.error||'shared_disable_failed');
      const {data,error}=await getSb().rpc('finance_set_goal_recurring_plan',{p_goal_id:id,p_enabled:false,p_amount:Number(g.plannedMonthly)||0,p_start_month:null,p_end_month:null,p_account:g.recurringAccount||''});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'disable_failed');
      closeModal('goalRecurringModal');await refreshGoals(true);statusText('Recorrência do objetivo desativada');
    }catch(err){console.error('Falha ao desativar recorrência.',err);alert('Não foi possível desativar a recorrência agora.')}
    finally{busy=false;btn.disabled=false}
  }

  async function openShare(id){
    ensureModals();const g=goalById(id);if(!g||!g.isOwner)return;
    document.getElementById('goalShareGoalId').value=id;
    document.getElementById('goalShareTitle').textContent=`Compartilhar · ${g.name}`;
    document.getElementById('goalShareCpf').value='';document.getElementById('goalShareRole').value='viewer';setShareState('');
    shares=[];renderShares();openModal('goalShareModal');await loadShares(id);setTimeout(()=>document.getElementById('goalShareCpf')?.focus(),60);
  }

  function setShareState(text,kind=''){const el=document.getElementById('goalShareState');if(!el)return;el.textContent=text;el.className=`goal-share-state ${kind}`.trim()}

  async function loadShares(id){
    try{const {data,error}=await getSb().rpc('finance_list_goal_shares',{p_goal_id:id});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'shares_failed');shares=Array.isArray(data.items)?data.items:[];renderShares()}
    catch(e){console.error('Falha ao listar compartilhamentos.',e);setShareState('Não foi possível carregar os convites deste objetivo.','bad')}
  }

  function renderShares(){
    const host=document.getElementById('goalShareList');if(!host)return;
    if(!shares.length){host.innerHTML='<div class="muted" style="font-size:10px;padding:4px 0">Este objetivo ainda não foi compartilhado.</div>';return}
    host.innerHTML=shares.map(s=>`<div class="goal-share-row"><div><div class="goal-share-name">${esc(s.name||'Participante')}</div><div class="goal-share-meta">${esc(roleLabel(s.role))} · ${esc(statusLabel(s.status))}</div></div><button type="button" class="btn small danger" data-goal-share-remove="${esc(s.id)}">Remover</button></div>`).join('');
    host.querySelectorAll('[data-goal-share-remove]').forEach(b=>b.addEventListener('click',()=>removeShare(b.dataset.goalShareRemove,true)));
  }

  async function shareGoal(e){
    e.preventDefault();if(busy)return;busy=true;const btn=e.submitter;if(btn)btn.disabled=true;
    const id=document.getElementById('goalShareGoalId').value,cpf=digits(document.getElementById('goalShareCpf').value),role=document.getElementById('goalShareRole').value;
    setShareState('Enviando convite…');
    try{
      const {data,error}=await getSb().rpc('finance_share_goal_by_cpf',{p_goal_id:id,p_cpf:cpf,p_role:role});
      if(error)throw error;
      if(data?.ok===false){const msg={invalid_cpf:'Informe um CPF válido.',cannot_share_with_self:'Você não pode compartilhar um objetivo consigo mesmo.',not_owner:'Somente o proprietário pode compartilhar este objetivo.'}[data.error]||'Não foi possível enviar o convite.';throw new Error(msg)}
      if(!data?.found){setShareState('Nenhum perfil do Controle Financeiro foi encontrado com esse CPF.','bad');return}
      setShareState(`Convite enviado para ${data.name||'a pessoa selecionada'}.`,'ok');document.getElementById('goalShareCpf').value='';await loadShares(id);await loadGoalsMeta();
    }catch(err){console.error('Falha ao compartilhar objetivo.',err);setShareState(err.message||'Não foi possível enviar o convite.','bad')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function respondShare(id,response){
    if(busy||!id)return;busy=true;
    try{const {data,error}=await getSb().rpc('finance_respond_goal_share',{p_share_id:id,p_response:response});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'response_failed');await refreshGoals(false);statusText(response==='accepted'?'Objetivo compartilhado aceito':'Convite recusado')}
    catch(e){console.error('Falha ao responder convite.',e);alert('Não foi possível responder ao convite agora.')}
    finally{busy=false}
  }

  async function removeShare(id,ownerView){
    if(busy||!id)return;const msg=ownerView?'Remover esta pessoa do objetivo compartilhado?':'Sair deste objetivo compartilhado?';if(!confirm(msg))return;busy=true;
    try{const {data,error}=await getSb().rpc('finance_remove_goal_share',{p_share_id:id});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'remove_failed');if(ownerView){shares=shares.filter(s=>s.id!==id);renderShares()}await refreshGoals(false);statusText(ownerView?'Compartilhamento removido':'Você saiu do objetivo compartilhado')}
    catch(e){console.error('Falha ao remover compartilhamento.',e);alert('Não foi possível remover o compartilhamento agora.')}
    finally{busy=false}
  }

  async function refreshGoals(syncPlans){
    try{if(syncPlans&&typeof window.financeSyncGoalPlans==='function')await window.financeSyncGoalPlans()}catch(e){}
    try{if(typeof window.financeGoalsRefresh==='function')await window.financeGoalsRefresh()}catch(e){}
    await loadGoalsMeta();
    try{window.financeObjectiveExpenseRefresh?.()}catch(e){}
  }

  function statusText(text){try{if(typeof setSyncStatus==='function')setSyncStatus(text)}catch(e){}}

  function init(){
    injectStyles();ensureModals();observeGrid();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('goalRecurringModal');closeModal('goalShareModal')}});
    window.addEventListener('focus',()=>{if(document.getElementById('page-goals')?.classList.contains('active'))loadGoalsMeta()});
    document.addEventListener('click',e=>{if(e.target?.closest?.('.nav [data-page="goals"]'))setTimeout(loadGoalsMeta,80)},true);
    document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(loadGoalsMeta,50));
    let tries=0;const ready=setInterval(()=>{tries++;ensureModals();observeGrid();if(getSb()&&getUserId()&&document.getElementById('goalGrid')){clearInterval(ready);loadGoalsMeta()}else if(tries>600)clearInterval(ready)},100);
    window.financeGoalCollabRefresh=loadGoalsMeta;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();