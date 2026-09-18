(function(){
  if(window.__financeObjectivesLoaded)return;
  window.__financeObjectivesLoaded=true;

  const STYLE_ID='finance-objectives-style';
  const TYPES={
    house:{label:'Casa própria',icon:'🏠'},
    motorcycle:{label:'Moto',icon:'🏍️'},
    car:{label:'Carro',icon:'🚗'},
    reserve:{label:'Reserva',icon:'🛟'},
    travel:{label:'Viagem',icon:'✈️'},
    education:{label:'Estudos',icon:'🎓'},
    other:{label:'Outro objetivo',icon:'🎯'}
  };
  const PRIORITIES={1:'Alta',2:'Média',3:'Baixa'};
  let goals=[];
  let loading=false;
  let initialized=false;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  function currentYm(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function addMonth(ym,n){const[y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function monthDiff(a,b){const[ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);return(yb-ya)*12+(mb-ma)}
  function monthLabel(ym){if(!ym)return'—';try{return typeof fmtMonth==='function'?fmtMonth(ym):new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric'}).format(new Date(`${ym}-01T12:00:00`))}catch(e){return ym}}
  function dateLabel(d){try{return typeof fmtDate==='function'?fmtDate(String(d||'').slice(0,10)):String(d||'')}catch(e){return String(d||'')}}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #page-goals .goals-intro{margin-bottom:14px}
      .goals-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .goal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .goal-card{border:1px solid var(--line);border-radius:16px;background:#0f172a;overflow:hidden}
      .goal-head{display:flex;gap:11px;align-items:flex-start;padding:14px 14px 11px}
      .goal-icon{width:42px;height:42px;border-radius:13px;background:#172033;border:1px solid #334155;display:grid;place-items:center;font-size:20px;flex:0 0 42px}
      .goal-title-wrap{min-width:0;flex:1}.goal-title{font-size:14px;font-weight:820;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goal-sub{font-size:10px;color:var(--muted);margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .goal-pill{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;border:1px solid #334155;background:#172033;color:#cbd5e1;font-size:9px;font-weight:750}
      .goal-pill.active{border-color:#245f37;background:#102a19;color:#bbf7d0}.goal-pill.paused{border-color:#6b5318;background:#30230c;color:#fde68a}.goal-pill.completed{border-color:#1d497b;background:#102845;color:#bfdbfe}
      .goal-body{padding:0 14px 14px}.goal-money-line{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:8px}.goal-saved{font-size:19px;font-weight:850}.goal-target{font-size:10px;color:var(--muted);text-align:right}
      .goal-progress{height:9px;background:#172033;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.12)}.goal-progress>span{display:block;height:100%;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:999px;transition:width .25s ease}
      .goal-progress-meta{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:var(--muted);margin-top:6px}
      .goal-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.goal-metric{padding:9px 10px;border:1px solid rgba(148,163,184,.12);border-radius:11px;background:#0b1424}.goal-metric .k{font-size:9px;color:var(--muted)}.goal-metric .v{font-size:11px;font-weight:780;margin-top:3px;line-height:1.35}
      .goal-health{margin-top:10px;padding:9px 10px;border-radius:11px;border:1px solid #243449;background:#111c2f;font-size:10px;color:#cbd5e1;line-height:1.45}.goal-health strong{color:#f8fafc}
      .goal-actions{display:flex;gap:7px;flex-wrap:wrap;padding:11px 14px;border-top:1px solid var(--line);background:rgba(11,20,36,.55)}
      .goal-contribs{padding:0 14px 12px}.goal-contrib-title{font-size:10px;font-weight:800;color:#cbd5e1;margin:2px 0 7px}.goal-contrib-list{display:grid;gap:6px}.goal-contrib-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;font-size:10px;padding:7px 8px;border-radius:9px;background:#0b1424;border:1px solid rgba(148,163,184,.1)}.goal-contrib-row .note{color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goal-contrib-value{font-weight:800;color:#bbf7d0;white-space:nowrap}.goal-contrib-delete{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:15px;padding:2px 4px}.goal-contrib-delete:hover{color:#fca5a5}
      .goals-empty{padding:42px 20px;text-align:center;border:1px dashed #334155;border-radius:16px;background:#0f172a;color:var(--muted)}.goals-empty strong{display:block;color:#f8fafc;font-size:14px;margin-bottom:6px}
      .goal-modal-note{padding:10px 11px;border-radius:11px;background:#10233c;border:1px solid #1e4978;color:#bfdbfe;font-size:10px;line-height:1.45;margin-bottom:12px}
      @media(max-width:1050px){.goals-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.goal-grid{grid-template-columns:1fr}}
      @media(max-width:620px){.goals-kpis{grid-template-columns:1fr}.goal-metrics{grid-template-columns:1fr 1fr}.goal-contrib-row{grid-template-columns:1fr auto}.goal-contrib-delete{grid-column:2;grid-row:1/3}}
    `;document.head.appendChild(s);
  }

  function ensureNav(){
    const nav=document.querySelector('.nav');if(!nav||nav.querySelector('[data-page="goals"]'))return;
    const btn=document.createElement('button');btn.type='button';btn.dataset.page='goals';btn.textContent='Objetivos';btn.onclick=openPage;
    const settings=nav.querySelector('[data-page="settings"]');nav.insertBefore(btn,settings||null);
  }

  function ensurePage(){
    if(document.getElementById('page-goals'))return;
    const settings=document.getElementById('page-settings');if(!settings)return;
    const page=document.createElement('section');page.className='page';page.id='page-goals';
    page.innerHTML=`
      <div class="section-head"><div><h3>Objetivos financeiros</h3><div class="muted">Transforme planos como casa, moto e reserva em metas mensuráveis.</div></div><button type="button" class="btn primary" id="goalAddBtn">+ Novo objetivo</button></div>
      <div class="notice goals-intro"><strong>Aportes não são despesas.</strong> Nesta primeira versão, o valor reservado fica separado conceitualmente do consumo: ele compõe o patrimônio destinado ao objetivo sem reduzir artificialmente seus gastos.</div>
      <div class="goals-kpis">
        <div class="card kpi"><div class="label">Reservado</div><div class="value positive" id="goalKpiSaved">R$ 0,00</div><div class="hint">Capital já destinado</div></div>
        <div class="card kpi"><div class="label">Metas</div><div class="value" id="goalKpiTarget">R$ 0,00</div><div class="hint" id="goalKpiCount">0 objetivos</div></div>
        <div class="card kpi"><div class="label">Falta acumular</div><div class="value" id="goalKpiRemaining">R$ 0,00</div><div class="hint">Até atingir todas as metas</div></div>
        <div class="card kpi"><div class="label">Aporte planejado</div><div class="value" id="goalKpiMonthly">R$ 0,00</div><div class="hint">Por mês nos objetivos ativos</div></div>
      </div>
      <div id="goalGrid" class="goal-grid"></div>`;
    settings.parentNode.insertBefore(page,settings);
    document.getElementById('goalAddBtn').onclick=()=>openGoalModal();
  }

  function ensureModals(){
    if(!document.getElementById('goalModal')){
      const wrap=document.createElement('div');wrap.innerHTML=`<div class="modal-backdrop" id="goalModal"><div class="modal"><form id="goalForm"><div class="modal-head"><h3 id="goalModalTitle">Novo objetivo</h3><button type="button" class="btn ghost" data-goal-close="goalModal">✕</button></div><div class="modal-body"><div class="goal-modal-note">Defina o capital que deseja acumular. Para uma casa, por exemplo, a meta pode ser apenas a entrada + custos de aquisição, e não o valor integral do imóvel.</div><div class="form-grid"><input type="hidden" id="goalId"><input type="hidden" id="goalStatus" value="active"><div class="field"><label>Nome do objetivo</label><input id="goalName" required maxlength="120" placeholder="Ex.: Entrada da casa"></div><div class="field"><label>Tipo</label><select id="goalType">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select></div><div class="field"><label>Meta financeira (R$)</label><input id="goalTarget" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Já reservado (R$)</label><input id="goalInitial" type="number" min="0" step="0.01" value="0"><small class="muted">Valor existente antes de cadastrar aportes no sistema.</small></div><div class="field"><label>Prazo desejado</label><input id="goalTargetMonth" type="month"></div><div class="field"><label>Aporte mensal planejado (R$)</label><input id="goalMonthly" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>Prioridade</label><select id="goalPriority"><option value="1">Alta</option><option value="2" selected>Média</option><option value="3">Baixa</option></select></div><div class="field full"><label>Observação</label><textarea id="goalNotes" rows="3" placeholder="Ex.: Entrada de 20% + documentação"></textarea></div></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-close="goalModal">Cancelar</button><button class="btn primary" type="submit">Salvar objetivo</button></div></form></div></div>`;document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalForm').onsubmit=saveGoal;
    }
    if(!document.getElementById('goalContributionModal')){
      const wrap=document.createElement('div');wrap.innerHTML=`<div class="modal-backdrop" id="goalContributionModal"><div class="modal"><form id="goalContributionForm"><div class="modal-head"><h3 id="goalContributionTitle">Registrar aporte</h3><button type="button" class="btn ghost" data-goal-close="goalContributionModal">✕</button></div><div class="modal-body"><div class="goal-modal-note">O aporte aumenta o valor reservado do objetivo, mas não cria uma despesa no fluxo de caixa.</div><input type="hidden" id="goalContributionGoalId"><div class="form-grid"><div class="field"><label>Valor do aporte (R$)</label><input id="goalContributionAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Data</label><input id="goalContributionDate" type="date" required></div><div class="field full"><label>Observação</label><textarea id="goalContributionNotes" rows="3" placeholder="Ex.: Aporte do salário de setembro"></textarea></div></div></div><div class="modal-foot"><button type="button" class="btn" data-goal-close="goalContributionModal">Cancelar</button><button class="btn primary" type="submit">Registrar aporte</button></div></form></div></div>`;document.body.appendChild(wrap.firstElementChild);
      document.getElementById('goalContributionForm').onsubmit=addContribution;
    }
    document.querySelectorAll('[data-goal-close]').forEach(btn=>btn.onclick=()=>closeModal(btn.dataset.goalClose));
    ['goalModal','goalContributionModal'].forEach(id=>document.getElementById(id)?.addEventListener('click',e=>{if(e.target.id===id)closeModal(id)}));
  }

  function openModal(id){document.getElementById(id)?.classList.add('open')}
  function closeModal(id){document.getElementById(id)?.classList.remove('open')}

  function openPage(){
    ensurePage();
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-goals'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='goals'));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
    if(title)title.textContent='Objetivos';if(sub)sub.textContent='Metas, aportes e previsão de conquista';
    loadGoals();
  }
  window.openFinanceGoals=openPage;

  function projection(g){
    const saved=Number(g.savedAmount)||0,target=Number(g.targetAmount)||0,remaining=Math.max(0,target-saved),monthly=Number(g.plannedMonthly)||0,now=currentYm();
    const percent=target>0?clamp(saved/target*100,0,100):0;
    let forecast=null,monthsNeeded=null;
    if(remaining<=0){forecast=now;monthsNeeded=0}
    else if(monthly>0){monthsNeeded=Math.ceil(remaining/monthly);forecast=addMonth(now,Math.max(0,monthsNeeded-1))}
    let required=null,monthsToTarget=null,delta=null;
    if(g.targetMonth){
      monthsToTarget=monthDiff(now,g.targetMonth)+1;
      if(monthsToTarget>0)required=remaining/monthsToTarget;
      if(forecast)delta=monthDiff(g.targetMonth,forecast);
    }
    return{saved,target,remaining,monthly,percent,forecast,monthsNeeded,required,monthsToTarget,delta};
  }

  function statusInfo(g,p){
    if(p.remaining<=0)return{key:'completed',label:'Concluído'};
    if(g.status==='paused')return{key:'paused',label:'Pausado'};
    return{key:'active',label:'Em andamento'};
  }

  function healthHtml(g,p){
    if(p.remaining<=0)return `<strong>Meta atingida.</strong> O objetivo já possui capital suficiente para o valor definido.`;
    if(!g.targetMonth&&p.forecast)return `No aporte planejado de <strong>${money(p.monthly)}/mês</strong>, a previsão é atingir a meta em <strong>${esc(monthLabel(p.forecast))}</strong>.`;
    if(!g.targetMonth&&!p.forecast)return `Defina um aporte mensal ou prazo para o sistema calcular a previsão de conquista.`;
    if(g.targetMonth&&p.monthsToTarget<=0)return `O prazo de <strong>${esc(monthLabel(g.targetMonth))}</strong> já passou. Ainda faltam <strong>${money(p.remaining)}</strong>.`;
    const req=money(p.required||0);
    if(!p.forecast)return `Para chegar a <strong>${esc(monthLabel(g.targetMonth))}</strong>, reserve aproximadamente <strong>${req}/mês</strong>.`;
    if((p.delta||0)<=0)return `Ritmo compatível com o prazo. Necessário: <strong>${req}/mês</strong> · previsão atual: <strong>${esc(monthLabel(p.forecast))}</strong>.`;
    return `No ritmo atual, a previsão fica <strong>${p.delta} ${p.delta===1?'mês':'meses'} após</strong> o prazo. Para cumprir ${esc(monthLabel(g.targetMonth))}, reserve cerca de <strong>${req}/mês</strong>.`;
  }

  function contribHtml(g){
    const list=Array.isArray(g.contributions)?g.contributions.slice(0,3):[];
    if(!list.length)return'';
    return `<div class="goal-contribs"><div class="goal-contrib-title">Últimos aportes</div><div class="goal-contrib-list">${list.map(c=>`<div class="goal-contrib-row"><div><div>${esc(dateLabel(c.date))}</div>${c.notes?`<div class="note">${esc(c.notes)}</div>`:''}</div><div class="goal-contrib-value">+ ${money(c.amount)}</div><button type="button" class="goal-contrib-delete" title="Excluir aporte" data-goal-contrib-delete="${esc(c.id)}">×</button></div>`).join('')}</div></div>`;
  }

  function cardHtml(g){
    const p=projection(g),type=TYPES[g.type]||TYPES.other,status=statusInfo(g,p),priority=PRIORITIES[Number(g.priority)||2]||'Média';
    return `<article class="goal-card" data-goal-id="${esc(g.id)}"><div class="goal-head"><div class="goal-icon">${type.icon}</div><div class="goal-title-wrap"><div class="goal-title">${esc(g.name)}</div><div class="goal-sub"><span>${esc(type.label)}</span><span class="goal-pill ${status.key}">${status.label}</span><span class="goal-pill">Prioridade ${esc(priority.toLowerCase())}</span></div></div></div><div class="goal-body"><div class="goal-money-line"><div><div class="goal-saved">${money(p.saved)}</div><div class="muted" style="font-size:10px">reservados</div></div><div class="goal-target">Meta<br><strong>${money(p.target)}</strong></div></div><div class="goal-progress"><span style="width:${p.percent.toFixed(2)}%"></span></div><div class="goal-progress-meta"><span>${p.percent.toFixed(1).replace('.',',')}%</span><span>Faltam ${money(p.remaining)}</span></div><div class="goal-metrics"><div class="goal-metric"><div class="k">Aporte planejado</div><div class="v">${p.monthly>0?money(p.monthly)+'/mês':'Não definido'}</div></div><div class="goal-metric"><div class="k">Prazo</div><div class="v">${g.targetMonth?esc(monthLabel(g.targetMonth)):'Sem prazo'}</div></div><div class="goal-metric"><div class="k">Previsão</div><div class="v">${p.remaining<=0?'Atingida':p.forecast?esc(monthLabel(p.forecast)):'—'}</div></div></div><div class="goal-health">${healthHtml(g,p)}</div>${g.notes?`<div class="muted" style="font-size:10px;margin-top:9px">${esc(g.notes)}</div>`:''}</div>${contribHtml(g)}<div class="goal-actions"><button type="button" class="btn small primary" data-goal-contribute="${esc(g.id)}">+ Aportar</button><button type="button" class="btn small" data-goal-edit="${esc(g.id)}">Editar</button>${p.remaining>0?`<button type="button" class="btn small" data-goal-toggle="${esc(g.id)}" data-goal-status="${g.status==='paused'?'active':'paused'}">${g.status==='paused'?'Retomar':'Pausar'}</button>`:''}<button type="button" class="btn small danger" data-goal-delete="${esc(g.id)}">Excluir</button></div></article>`;
  }

  function render(){
    const totalSaved=goals.reduce((s,g)=>s+(Number(g.savedAmount)||0),0),totalTarget=goals.reduce((s,g)=>s+(Number(g.targetAmount)||0),0),remaining=Math.max(0,totalTarget-totalSaved),active=goals.filter(g=>g.status!=='paused'&&projection(g).remaining>0),monthly=active.reduce((s,g)=>s+(Number(g.plannedMonthly)||0),0);
    const byId=id=>document.getElementById(id);
    if(byId('goalKpiSaved'))byId('goalKpiSaved').textContent=money(totalSaved);
    if(byId('goalKpiTarget'))byId('goalKpiTarget').textContent=money(totalTarget);
    if(byId('goalKpiRemaining'))byId('goalKpiRemaining').textContent=money(remaining);
    if(byId('goalKpiMonthly'))byId('goalKpiMonthly').textContent=money(monthly);
    if(byId('goalKpiCount'))byId('goalKpiCount').textContent=`${goals.length} objetivo${goals.length===1?'':'s'} · ${active.length} ativo${active.length===1?'':'s'}`;
    try{window.dispatchEvent(new CustomEvent('finance:goals-kpis-rendered'))}catch(_e){}
    const grid=byId('goalGrid');if(!grid)return;
    grid.innerHTML=goals.length?goals.map(cardHtml).join(''):`<div class="goals-empty" style="grid-column:1/-1"><strong>Nenhum objetivo cadastrado</strong>Crie sua primeira meta para acompanhar capital reservado, prazo e aporte necessário.<div style="margin-top:14px"><button type="button" class="btn primary" id="goalEmptyAdd">+ Criar objetivo</button></div></div>`;
    document.getElementById('goalEmptyAdd')?.addEventListener('click',()=>openGoalModal());
    grid.querySelectorAll('[data-goal-edit]').forEach(b=>b.onclick=()=>openGoalModal(b.dataset.goalEdit));
    grid.querySelectorAll('[data-goal-contribute]').forEach(b=>b.onclick=()=>openContributionModal(b.dataset.goalContribute));
    grid.querySelectorAll('[data-goal-toggle]').forEach(b=>b.onclick=()=>setStatus(b.dataset.goalToggle,b.dataset.goalStatus,b));
    grid.querySelectorAll('[data-goal-delete]').forEach(b=>b.onclick=()=>deleteGoal(b.dataset.goalDelete,b));
    grid.querySelectorAll('[data-goal-contrib-delete]').forEach(b=>b.onclick=()=>deleteContribution(b.dataset.goalContribDelete,b));
  }

  async function loadGoals(){
    const client=getSb(),uid=getUserId();if(loading||!client||!uid)return;loading=true;
    try{const {data,error}=await client.rpc('finance_list_goals');if(error)throw error;if(data?.ok===false)throw new Error(data.error||'load_failed');goals=Array.isArray(data?.items)?data.items:[];render()}
    catch(e){console.error('Falha ao carregar objetivos.',e);const grid=document.getElementById('goalGrid');if(grid)grid.innerHTML='<div class="goals-empty" style="grid-column:1/-1"><strong>Não foi possível carregar os objetivos.</strong>Tente atualizar novamente.</div>'}
    finally{loading=false}
  }

  function openGoalModal(id=''){
    const g=id?goals.find(x=>x.id===id):null;
    document.getElementById('goalModalTitle').textContent=g?'Editar objetivo':'Novo objetivo';
    document.getElementById('goalId').value=g?.id||'';
    document.getElementById('goalStatus').value=g?.status==='paused'?'paused':'active';
    document.getElementById('goalName').value=g?.name||'';
    document.getElementById('goalType').value=g?.type||'house';
    document.getElementById('goalTarget').value=g?.targetAmount??'';
    document.getElementById('goalInitial').value=g?.initialAmount??0;
    document.getElementById('goalTargetMonth').value=g?.targetMonth||addMonth(currentYm(),12);
    document.getElementById('goalMonthly').value=g?.plannedMonthly??0;
    document.getElementById('goalPriority').value=String(g?.priority||2);
    document.getElementById('goalNotes').value=g?.notes||'';
    openModal('goalModal');setTimeout(()=>document.getElementById('goalName')?.focus(),80);
  }

  async function saveGoal(e){
    e.preventDefault();const button=e.submitter;if(button)button.disabled=true;
    const payload={id:document.getElementById('goalId').value||null,name:document.getElementById('goalName').value.trim(),type:document.getElementById('goalType').value,targetAmount:Number(document.getElementById('goalTarget').value)||0,initialAmount:Number(document.getElementById('goalInitial').value)||0,targetMonth:document.getElementById('goalTargetMonth').value||null,plannedMonthly:Number(document.getElementById('goalMonthly').value)||0,priority:Number(document.getElementById('goalPriority').value)||2,status:document.getElementById('goalStatus').value||'active',notes:document.getElementById('goalNotes').value.trim()};
    try{const {data,error}=await getSb().rpc('finance_upsert_goal',{p_goal:payload});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'save_failed');closeModal('goalModal');await loadGoals();try{if(typeof setSyncStatus==='function')setSyncStatus(payload.id?'Objetivo atualizado':'Objetivo criado')}catch(_e){}}
    catch(err){console.error('Falha ao salvar objetivo.',err);alert('Não foi possível salvar o objetivo agora.')}
    finally{if(button)button.disabled=false}
  }

  function openContributionModal(id){
    const g=goals.find(x=>x.id===id);if(!g)return;
    document.getElementById('goalContributionGoalId').value=id;
    document.getElementById('goalContributionTitle').textContent=`Aportar em ${g.name}`;
    document.getElementById('goalContributionAmount').value='';
    document.getElementById('goalContributionDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('goalContributionNotes').value='';
    openModal('goalContributionModal');setTimeout(()=>document.getElementById('goalContributionAmount')?.focus(),80);
  }

  async function addContribution(e){
    e.preventDefault();const button=e.submitter;if(button)button.disabled=true;
    const id=document.getElementById('goalContributionGoalId').value,amount=Number(document.getElementById('goalContributionAmount').value)||0,date=document.getElementById('goalContributionDate').value,notes=document.getElementById('goalContributionNotes').value.trim();
    try{const {data,error}=await getSb().rpc('finance_add_goal_contribution',{p_goal_id:id,p_amount:amount,p_date:date||null,p_notes:notes});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'contribution_failed');closeModal('goalContributionModal');await loadGoals();try{if(typeof setSyncStatus==='function')setSyncStatus('Aporte registrado')}catch(_e){}}
    catch(err){console.error('Falha ao registrar aporte.',err);alert('Não foi possível registrar o aporte agora.')}
    finally{if(button)button.disabled=false}
  }

  async function setStatus(id,status,button){
    if(button)button.disabled=true;
    try{const {data,error}=await getSb().rpc('finance_set_goal_status',{p_goal_id:id,p_status:status});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'status_failed');await loadGoals()}
    catch(e){console.error('Falha ao alterar status do objetivo.',e);alert('Não foi possível alterar o objetivo agora.')}
    finally{if(button)button.disabled=false}
  }

  async function deleteGoal(id,button){
    const g=goals.find(x=>x.id===id);if(!g||!confirm(`Excluir o objetivo "${g.name}" e todo o histórico de aportes?`))return;if(button)button.disabled=true;
    try{const {data,error}=await getSb().rpc('finance_delete_goal',{p_goal_id:id});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_failed');await loadGoals()}
    catch(e){console.error('Falha ao excluir objetivo.',e);alert('Não foi possível excluir o objetivo agora.')}
    finally{if(button)button.disabled=false}
  }

  async function deleteContribution(id,button){
    if(!confirm('Excluir este aporte do histórico?'))return;if(button)button.disabled=true;
    try{const {data,error}=await getSb().rpc('finance_delete_goal_contribution',{p_contribution_id:id});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_contribution_failed');await loadGoals()}
    catch(e){console.error('Falha ao excluir aporte.',e);alert('Não foi possível excluir o aporte agora.')}
    finally{if(button)button.disabled=false}
  }

  function init(){
    if(initialized)return;initialized=true;injectStyles();ensureNav();ensurePage();ensureModals();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('goalModal');closeModal('goalContributionModal')}});
    window.addEventListener('focus',()=>{if(document.getElementById('page-goals')?.classList.contains('active'))loadGoals()});
    let tries=0;const ready=setInterval(()=>{tries++;ensureNav();ensurePage();if(getSb()&&getUserId()){clearInterval(ready);loadGoals()}else if(tries>300)clearInterval(ready)},100);
    window.financeGoalsRefresh=loadGoals;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();