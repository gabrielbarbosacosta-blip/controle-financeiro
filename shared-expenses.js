(function(){
  if(window.__sharedExpensesLoaded)return;
  window.__sharedExpensesLoaded=true;

  const STYLE_ID='shared-expenses-style';
  let me=null;
  let participants=[];
  let payerUserId='';
  let items=[];
  let balances=[];
  let loading=false;
  let submitting=false;
  let initialized=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]||c));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,11);
  const cpfMask=v=>digits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');
  const localId=()=>`p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      .shared-expense-box{grid-column:1/-1;margin-top:4px;border:1px solid var(--line);border-radius:14px;background:rgba(15,23,42,.58);overflow:hidden}
      .shared-expense-box summary{list-style:none;cursor:pointer;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:750;color:#dbeafe}
      .shared-expense-box summary::-webkit-details-marker{display:none}
      .shared-expense-box summary:after{content:'＋';font-size:17px;color:#94a3b8;transition:transform .16s ease}
      .shared-expense-box[open] summary:after{content:'−'}
      .shared-expense-body{padding:0 14px 14px;border-top:1px solid rgba(148,163,184,.12)}
      .shared-expense-lead{font-size:12px;color:var(--muted);line-height:1.5;margin:12px 0}
      .shared-person-list{display:grid;gap:8px}
      .shared-person-row{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(92px,.45fr) auto;gap:8px;align-items:end;padding:10px;border:1px solid rgba(148,163,184,.13);border-radius:12px;background:rgba(11,20,36,.62)}
      .shared-person-row.self{grid-template-columns:minmax(0,1.35fr) minmax(92px,.45fr)}
      .shared-person-identity{min-width:0}
      .shared-person-name{font-size:12px;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .shared-person-sub{font-size:10px;color:var(--muted);margin-top:3px}
      .shared-cpf-line{display:flex;gap:6px;align-items:center}
      .shared-cpf-line input{min-width:0;flex:1}
      .shared-lookup-state{font-size:10px;color:var(--muted);margin-top:4px;min-height:12px}
      .shared-lookup-state.ok{color:#86efac}.shared-lookup-state.bad{color:#fca5a5}
      .shared-remove{align-self:center;width:32px;height:32px;padding:0!important;border-radius:999px!important}
      .shared-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
      .shared-total{font-size:12px;font-weight:760}.shared-total.ok{color:#86efac}.shared-total.bad{color:#fca5a5}
      .shared-payer-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.7fr);gap:10px;margin-top:12px;align-items:end}
      .shared-hint{padding:10px 11px;border-radius:11px;background:#10233c;border:1px solid #1e4978;color:#bfdbfe;font-size:11px;line-height:1.45}
      .shared-page-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
      .shared-list{display:grid;gap:10px}
      .shared-item{padding:13px 14px;border:1px solid var(--line);border-radius:13px;background:#0f172a}
      .shared-item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .shared-item-title{font-weight:760}.shared-item-sub{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.45}
      .shared-item-value{font-weight:780;white-space:nowrap}.shared-item-actions{display:flex;gap:7px;margin-top:11px;flex-wrap:wrap}
      .shared-pill{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;border:1px solid #334155;font-size:10px;color:#cbd5e1;margin-right:5px;margin-top:5px}
      .shared-pill.pending{color:#fde68a;border-color:#6b5318;background:#30230c}.shared-pill.accepted{color:#bbf7d0;border-color:#245f37;background:#102a19}.shared-pill.rejected{color:#fecaca;border-color:#713333;background:#351717}
      .shared-balance-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,minmax(90px,.35fr));gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px}.shared-balance-row:last-child{border-bottom:0}
      .shared-dashboard{margin-top:14px}.shared-dashboard .shared-item{background:#0b1424}
      @media(max-width:800px){.shared-person-row,.shared-person-row.self{grid-template-columns:1fr}.shared-payer-wrap{grid-template-columns:1fr}.shared-page-grid{grid-template-columns:1fr}.shared-balance-row{grid-template-columns:1fr 1fr}.shared-balance-row>div:nth-child(n+2){text-align:left!important}}
    `;
    document.head.appendChild(style);
  }

  function txForm(){return document.getElementById('txForm')}
  function shareBox(){return document.getElementById('sharedExpenseBox')}

  function ensureShareBox(){
    const form=txForm();const grid=form?.querySelector('.modal-body .form-grid');
    if(!grid||document.getElementById('sharedExpenseBox'))return;
    const details=document.createElement('details');details.id='sharedExpenseBox';details.className='shared-expense-box';
    details.innerHTML=`<summary>Despesa compartilhada</summary><div class="shared-expense-body"><div class="shared-expense-lead">Divida a responsabilidade da despesa e escolha quem fará o pagamento integral. Os demais participantes receberão uma solicitação para confirmar.</div><div class="shared-person-list" id="sharedPersonList"></div><div class="shared-toolbar"><button type="button" class="btn small" id="sharedAddPerson">+ Adicionar pessoa por CPF</button><div class="shared-total" id="sharedPercentTotal">Total: 100%</div></div><div class="shared-payer-wrap"><div class="shared-hint">O pagador terá a despesa integral no caixa. Para cada participante que confirmar, o pagador receberá um lançamento de <strong>reembolso pendente</strong> correspondente à parte dessa pessoa.</div><div class="field"><label>Quem vai pagar o valor integral?</label><select id="sharedPayer"></select></div></div><div class="shared-lookup-state bad" id="sharedSubmitState"></div></div>`;
    grid.appendChild(details);
    document.getElementById('sharedAddPerson').onclick=addPerson;
    document.getElementById('sharedPayer').onchange=e=>{payerUserId=e.target.value};
    details.addEventListener('toggle',()=>{if(details.open)prepareParticipants()});
  }

  async function loadMe(){
    if(!currentUser?.id)return null;
    const {data,error}=await sb.from('finance_profiles').select('user_id,full_name,nickname,cpf').eq('user_id',currentUser.id).maybeSingle();
    if(error){console.warn('Falha ao carregar perfil para compartilhamento.',error);return null}
    me=data||null;return me;
  }

  function personName(p){return p?.nickname||p?.fullName||p?.full_name||'Participante'}

  function prepareParticipants(force=false){
    if(!me?.user_id)return;
    if(participants.length&&!force)return;
    participants=[{localId:localId(),userId:me.user_id,fullName:me.full_name||'',nickname:me.nickname||'',cpf:me.cpf||'',percentage:100,resolved:true,isSelf:true}];
    payerUserId=me.user_id;renderParticipants();
  }

  function resetSharing(){
    participants=[];payerUserId='';
    const box=shareBox();if(box)box.open=false;
    const stateEl=document.getElementById('sharedSubmitState');if(stateEl)stateEl.textContent='';
  }

  function addPerson(){
    if(!me?.user_id){alert('Complete seu perfil antes de compartilhar despesas.');return}
    participants.push({localId:localId(),userId:null,fullName:'',nickname:'',cpf:'',percentage:0,resolved:false,isSelf:false,lookup:''});
    renderParticipants();
  }

  function removePerson(id){
    const target=participants.find(p=>p.localId===id);if(target?.isSelf)return;
    participants=participants.filter(p=>p.localId!==id);
    if(target?.userId&&payerUserId===target.userId)payerUserId=me?.user_id||'';
    renderParticipants();
  }

  async function lookupPerson(id){
    const p=participants.find(x=>x.localId===id);if(!p||p.isSelf)return;
    const cpf=digits(p.cpf);
    p.lookup='Buscando…';p.resolved=false;p.userId=null;renderParticipants();
    if(cpf.length!==11){p.lookup='Informe os 11 dígitos do CPF.';renderParticipants();return}
    try{
      const {data,error}=await sb.rpc('finance_find_profile_by_cpf',{p_cpf:cpf});
      if(error)throw error;
      if(!data?.ok||!data?.found){p.lookup='Nenhum perfil encontrado com este CPF.';renderParticipants();return}
      if(data.userId===me?.user_id){p.lookup='Este CPF é o seu próprio perfil.';renderParticipants();return}
      if(participants.some(x=>x.localId!==id&&x.userId===data.userId)){p.lookup='Esta pessoa já foi adicionada.';renderParticipants();return}
      p.userId=data.userId;p.fullName=data.fullName||'';p.nickname=data.nickname||'';p.resolved=true;p.lookup=`✓ ${personName(p)}`;renderParticipants();
    }catch(e){console.error('Falha ao buscar CPF.',e);p.lookup='Não foi possível buscar este CPF.';renderParticipants()}
  }

  function updatePercent(id,value){
    const p=participants.find(x=>x.localId===id);if(!p)return;
    p.percentage=Math.max(0,Math.min(100,Number(value)||0));
    renderTotalsAndPayer(false);
  }

  function renderParticipants(){
    const host=document.getElementById('sharedPersonList');if(!host)return;
    host.innerHTML=participants.map(p=>p.isSelf?`<div class="shared-person-row self"><div class="shared-person-identity"><div class="shared-person-name">${esc(personName(p))} <span class="shared-pill accepted">Você</span></div><div class="shared-person-sub">${p.cpf?cpfMask(p.cpf):'Complete o CPF no Perfil'}</div></div><div class="field"><label>Responsabilidade (%)</label><input type="number" min="0.01" max="100" step="0.01" value="${Number(p.percentage)||0}" data-share-percent="${esc(p.localId)}"></div></div>`:`<div class="shared-person-row"><div><div class="shared-cpf-line"><input inputmode="numeric" maxlength="14" placeholder="CPF da pessoa" value="${esc(cpfMask(p.cpf))}" data-share-cpf="${esc(p.localId)}"><button type="button" class="btn small" data-share-lookup="${esc(p.localId)}">Buscar</button></div><div class="shared-lookup-state ${p.resolved?'ok':p.lookup?'bad':''}">${esc(p.lookup||'Busque o CPF para identificar a pessoa.')}</div></div><div class="field"><label>Responsabilidade (%)</label><input type="number" min="0.01" max="100" step="0.01" value="${Number(p.percentage)||0}" data-share-percent="${esc(p.localId)}"></div><button type="button" class="btn ghost shared-remove" title="Remover" data-share-remove="${esc(p.localId)}">×</button></div>`).join('');
    host.querySelectorAll('[data-share-percent]').forEach(input=>input.oninput=e=>updatePercent(e.target.dataset.sharePercent,e.target.value));
    host.querySelectorAll('[data-share-cpf]').forEach(input=>input.oninput=e=>{const p=participants.find(x=>x.localId===e.target.dataset.shareCpf);if(!p)return;p.cpf=digits(e.target.value);p.resolved=false;p.userId=null;p.lookup='';e.target.value=cpfMask(p.cpf);renderTotalsAndPayer(false)});
    host.querySelectorAll('[data-share-lookup]').forEach(btn=>btn.onclick=()=>lookupPerson(btn.dataset.shareLookup));
    host.querySelectorAll('[data-share-remove]').forEach(btn=>btn.onclick=()=>removePerson(btn.dataset.shareRemove));
    renderTotalsAndPayer(true);
  }

  function renderTotalsAndPayer(rebuildPayer=true){
    const total=participants.reduce((s,p)=>s+(Number(p.percentage)||0),0);
    const el=document.getElementById('sharedPercentTotal');if(el){el.textContent=`Total: ${total.toFixed(2).replace('.',',')}%`;el.className=`shared-total ${Math.abs(total-100)<.001?'ok':'bad'}`}
    if(rebuildPayer){
      const sel=document.getElementById('sharedPayer');if(sel){
        const resolved=participants.filter(p=>p.resolved&&p.userId);
        sel.innerHTML=resolved.map(p=>`<option value="${esc(p.userId)}">${esc(personName(p))}${p.isSelf?' (você)':''}</option>`).join('');
        if(!resolved.some(p=>p.userId===payerUserId))payerUserId=resolved[0]?.userId||'';
        sel.value=payerUserId;
      }
    }
  }

  function validateShare(){
    if(!me?.user_id||!me?.cpf)return'Complete nome e CPF no Perfil antes de compartilhar.';
    if(participants.length<2)return'Adicione pelo menos uma outra pessoa.';
    if(participants.some(p=>!p.resolved||!p.userId))return'Busque e confirme todos os CPFs adicionados.';
    if(participants.some(p=>(Number(p.percentage)||0)<=0))return'Todas as pessoas precisam ter percentual maior que zero.';
    const total=participants.reduce((s,p)=>s+(Number(p.percentage)||0),0);
    if(Math.abs(total-100)>.001)return'A soma dos percentuais precisa ser exatamente 100%.';
    if(!payerUserId||!participants.some(p=>p.userId===payerUserId))return'Selecione quem realizará o pagamento.';
    return'';
  }

  async function submitShared(event){
    const box=shareBox();
    if(!box?.open||document.getElementById('txType')?.value!=='Despesa'||document.getElementById('txId')?.value)return false;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(submitting)return true;
    const error=validateShare();const status=document.getElementById('sharedSubmitState');
    if(error){if(status)status.textContent=error;return true}
    const expense={
      date:document.getElementById('txDate')?.value,
      category:document.getElementById('txCategory')?.value,
      description:document.getElementById('txDescription')?.value.trim(),
      account:document.getElementById('txAccount')?.value.trim(),
      nature:document.getElementById('txNature')?.value,
      amount:Number(document.getElementById('txAmount')?.value)||0,
      status:document.getElementById('txStatus')?.value||'Pendente',
      projection:!!document.getElementById('txProjection')?.checked,
      notes:document.getElementById('txNotes')?.value.trim()||''
    };
    if(!expense.description||expense.amount<=0){if(status)status.textContent='Preencha descrição e valor da despesa.';return true}
    submitting=true;if(status){status.className='shared-lookup-state';status.textContent='Criando despesa compartilhada…'}
    try{
      const payload=participants.map(p=>({userId:p.userId,percentage:Number(p.percentage)}));
      const {data,error:rpcError}=await sb.rpc('finance_create_shared_expense',{p_expense:expense,p_participants:payload,p_payer_user_id:payerUserId});
      if(rpcError)throw rpcError;
      if(!data?.ok)throw new Error(data?.error||'create_failed');
      try{if(typeof closeModal==='function')closeModal('txModal')}catch(e){}
      resetSharing();
      if(window.financeCloud?.refresh)await window.financeCloud.refresh();
      await loadShared();
      try{if(typeof setSyncStatus==='function')setSyncStatus('Despesa compartilhada criada')}catch(e){}
    }catch(e){console.error('Falha ao criar despesa compartilhada.',e);if(status){status.className='shared-lookup-state bad';status.textContent='Não foi possível criar a despesa compartilhada. Verifique os dados e tente novamente.'}}
    finally{submitting=false}
    return true;
  }

  function ensureSharingPage(){
    if(document.getElementById('page-sharing'))return;
    const profile=document.getElementById('page-profile'),settings=document.getElementById('page-settings');const anchor=profile||settings;if(!anchor)return;
    const section=document.createElement('section');section.className='page';section.id='page-sharing';
    section.innerHTML=`<div class="shared-page-grid"><div class="card kpi"><div class="label">A receber</div><div class="value positive" id="sharedToReceive">—</div><div class="hint">Após compensações por pessoa</div></div><div class="card kpi"><div class="label">A pagar</div><div class="value negative" id="sharedToPay">—</div><div class="hint">Após compensações por pessoa</div></div><div class="card kpi"><div class="label">Saldo líquido</div><div class="value" id="sharedNet">—</div><div class="hint">Resultado final dos acertos</div></div></div><div class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>Convites pendentes</h3><div class="muted">Confirme antes de a despesa entrar nos seus lançamentos.</div></div><button type="button" class="btn small" id="sharedRefresh">Atualizar</button></div><div class="shared-list" id="sharedPendingList"></div></div><div class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>Acertos por pessoa</h3><div class="muted">Veja quem te deve e para quem você deve nesta competência.</div></div></div><div id="sharedBalances"></div></div><div class="card"><div class="section-head"><div><h3>Despesas compartilhadas</h3><div class="muted">Histórico de despesas das quais você participa.</div></div></div><div class="shared-list" id="sharedAllList"></div></div>`;
    anchor.parentNode.insertBefore(section,anchor);
    document.getElementById('sharedRefresh').onclick=loadShared;
  }

  function ensureNav(){
    const nav=document.querySelector('.nav');if(!nav||nav.querySelector('[data-page="sharing"]'))return;
    const profile=nav.querySelector('[data-page="profile"]'),settings=nav.querySelector('[data-page="settings"]');
    const btn=document.createElement('button');btn.type='button';btn.dataset.page='sharing';btn.textContent='Compartilhamentos';btn.onclick=openSharingPage;
    nav.insertBefore(btn,profile||settings||null);
  }

  function openSharingPage(){
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-sharing'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='sharing'));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');if(title)title.textContent='Compartilhamentos';if(sub)sub.textContent='Despesas divididas, confirmações e acertos';
    loadShared();
  }
  window.openSharedExpenses=openSharingPage;

  function ensureDashboard(){
    const page=document.getElementById('page-dashboard');if(!page||document.getElementById('sharedDashboardCard'))return;
    const card=document.createElement('div');card.className='card shared-dashboard';card.id='sharedDashboardCard';
    card.innerHTML=`<div class="section-head"><div><h3>Pendências entre pessoas</h3><div class="muted">Despesas compartilhadas e vínculos por CPF aguardando sua confirmação</div></div><button type="button" class="btn small" id="sharedDashboardOpen">Ver todos</button></div><div class="shared-list" id="sharedDashboardList"></div>`;
    page.appendChild(card);document.getElementById('sharedDashboardOpen').onclick=openSharingPage;
  }

  function statusLabel(s){return s==='accepted'?'Confirmado':s==='rejected'?'Recusado':'Pendente'}
  function fmtDateSafe(d){try{return typeof fmtDate==='function'?fmtDate(d):d}catch(e){return d}}

  function itemHtml(item,compact=false){
    const pending=item.myStatus==='pending';
    const direct=item.sourceKind==='direct_obligation'||item.sourceKind==='direct_plan_obligation';
    const recurringRule=item.sourceKind==='goal_recurring_rule';
    const role=recurringRule?(item.isPayer?'Você propôs esta recorrência':'Sua confirmação é necessária'):direct?(item.isPayer?'Você é credor':'Você é devedor'):(item.isPayer?'Você paga':item.isCreator?'Criada por você':'Compartilhada com você');
    const myValue=direct?item.amount:(item.isPayer?item.amount:item.myAmount);
    const participantPills=(item.participants||[]).map(p=>direct
      ?`<span class="shared-pill ${esc(p.status)}">${esc(p.nickname||p.fullName)} · ${p.isPayer?'credor':'devedor'} · ${esc(statusLabel(p.status))}</span>`
      :`<span class="shared-pill ${esc(p.status)}">${esc(p.nickname||p.fullName)} · ${Number(p.percentage).toFixed(0)}% · ${esc(statusLabel(p.status))}${p.isPayer?' · pagador':''}</span>`
    ).join('');
    const context=recurringRule?`Regra mensal · Pagador: ${item.payerName} · ${role}`:direct?`Vínculo por CPF · ${role}`:`Pagador: ${item.payerName} · ${role}`;
    const acceptLabel=recurringRule?'Confirmar recorrência':direct?'Confirmar vínculo':'Confirmar';
    return `<div class="shared-item" data-shared-id="${esc(item.id)}"><div class="shared-item-head"><div><div class="shared-item-title">${esc(item.description)}</div><div class="shared-item-sub">${esc(item.category||'Outros')} · ${esc(fmtDateSafe(item.date))}<br>${esc(context)}</div></div><div class="shared-item-value">${money(myValue)}</div></div>${compact?'':`<div>${participantPills}</div>`}${pending?`<div class="shared-item-actions"><button class="btn small primary" data-share-accept="${esc(item.id)}">${acceptLabel}</button><button class="btn small danger" data-share-reject="${esc(item.id)}">Recusar</button></div>`:''}</div>`;
  }

  function bindResponseButtons(root=document){
    root.querySelectorAll?.('[data-share-accept]').forEach(btn=>btn.onclick=()=>respond(btn.dataset.shareAccept,true));
    root.querySelectorAll?.('[data-share-reject]').forEach(btn=>btn.onclick=()=>respond(btn.dataset.shareReject,false));
  }

  function renderShared(){
    const pending=items.filter(i=>i.myStatus==='pending');
    const dash=document.getElementById('sharedDashboardList');if(dash){dash.innerHTML=pending.length?pending.slice(0,3).map(i=>itemHtml(i,true)).join(''):'<div class="empty">Nenhuma despesa aguardando sua confirmação.</div>';bindResponseButtons(dash)}
    const pl=document.getElementById('sharedPendingList');if(pl){pl.innerHTML=pending.length?pending.map(i=>itemHtml(i,false)).join(''):'<div class="empty">Nenhum convite pendente.</div>';bindResponseButtons(pl)}
    const all=document.getElementById('sharedAllList');if(all){all.innerHTML=items.length?items.map(i=>itemHtml(i,false)).join(''):'<div class="empty">Nenhuma despesa compartilhada ainda.</div>';bindResponseButtons(all)}

    const receive=balances.reduce((s,b)=>s+(Number(b.toReceive)||0),0),pay=balances.reduce((s,b)=>s+(Number(b.toPay)||0),0),net=receive-pay;
    const rec=document.getElementById('sharedToReceive'),payEl=document.getElementById('sharedToPay'),netEl=document.getElementById('sharedNet');if(rec)rec.textContent=money(receive);if(payEl)payEl.textContent=money(pay);if(netEl){netEl.textContent=money(net);netEl.className=`value ${net>=0?'positive':'negative'}`}
    const bh=document.getElementById('sharedBalances');if(bh){bh.innerHTML=balances.length?balances.map(b=>`<div class="shared-balance-row"><div><strong>${esc(b.name)}</strong></div><div style="text-align:right"><span class="muted">A receber</span><br><strong>${money(b.toReceive)}</strong></div><div style="text-align:right"><span class="muted">A pagar</span><br><strong>${money(b.toPay)}</strong></div><div style="text-align:right"><span class="muted">Líquido</span><br><strong class="${Number(b.net)>=0?'positive':'negative'}">${money(b.net)}</strong></div></div>`).join(''):'<div class="empty">Nenhum acerto pendente.</div>'}
  }

  async function respond(id,accept){
    const item=items.find(x=>String(x.id)===String(id));
    const direct=item?.sourceKind==='direct_obligation'||item?.sourceKind==='direct_plan_obligation';
    const recurringRule=item?.sourceKind==='goal_recurring_rule';
    const subject=recurringRule?'esta recorrência compartilhada':direct?'este vínculo financeiro':'esta despesa compartilhada';
    const action=accept?'confirmar':'recusar';if(!confirm(`${accept?'Confirmar':'Recusar'} ${subject}?`))return;
    try{
      const rpc=item?.sourceKind==='direct_plan_obligation'?'finance_respond_plan_obligation':direct?'finance_respond_direct_obligation':'finance_respond_shared_expense';
      const {data,error}=await sb.rpc(rpc,{p_shared_id:id,p_accept:accept});if(error)throw error;if(!data?.ok)throw new Error(data?.detail||data?.error||'respond_failed');
      if(window.financeCloud?.refresh)await window.financeCloud.refresh();
      await loadShared();
      try{await window.financeDirectObligationsRefresh?.()}catch(_e){}
      try{if(typeof setSyncStatus==='function')setSyncStatus(recurringRule?`Recorrência ${accept?'confirmada':'recusada'}`:direct?`Vínculo financeiro ${accept?'confirmado':'recusado'}`:`Despesa ${accept?'confirmada':'recusada'}`)}catch(e){}
    }catch(e){console.error(`Falha ao ${action} compartilhamento.`,e);alert(`Não foi possível ${action} ${recurringRule?'esta recorrência':direct?'este vínculo':'esta despesa'}.`)}
  }

  async function loadShared(){
    if(loading||!currentUser?.id)return;loading=true;
    try{
      const [listRes,balanceRes]=await Promise.all([sb.rpc('finance_list_shared_expenses'),sb.rpc('finance_shared_balances')]);
      if(listRes.error)throw listRes.error;if(balanceRes.error)throw balanceRes.error;
      items=listRes.data?.items||[];balances=balanceRes.data?.items||[];renderShared();
    }catch(e){console.error('Falha ao carregar compartilhamentos.',e)}finally{loading=false}
  }

  function syncShareVisibility(){
    const box=shareBox();if(!box)return;
    const isExpense=document.getElementById('txType')?.value==='Despesa';const editing=!!document.getElementById('txId')?.value;
    box.style.display=isExpense&&!editing?'block':'none';if(!isExpense||editing)box.open=false;
  }

  async function init(){
    if(initialized)return;initialized=true;injectStyles();ensureShareBox();ensureSharingPage();ensureNav();ensureDashboard();
    await loadMe();prepareParticipants(true);syncShareVisibility();
    const form=txForm();if(form)form.addEventListener('submit',submitShared,true);
    document.getElementById('txType')?.addEventListener('change',syncShareVisibility);
    const modal=document.getElementById('txModal');if(modal){new MutationObserver(()=>{if(modal.classList.contains('open')){syncShareVisibility();if(!document.getElementById('txId')?.value)prepareParticipants(true)}}).observe(modal,{attributes:true,attributeFilter:['class']})}
    document.getElementById('quickAdd')?.addEventListener('click',()=>setTimeout(()=>{prepareParticipants(true);syncShareVisibility()},0));
    document.getElementById('addFromHistory')?.addEventListener('click',()=>setTimeout(()=>{prepareParticipants(true);syncShareVisibility()},0));
    await loadShared();
    window.addEventListener('focus',loadShared);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadShared()});
    setInterval(loadShared,60000);
  }

  function boot(){
    let tries=0;const timer=setInterval(()=>{tries++;if(document.getElementById('txForm')&&typeof sb!=='undefined'&&typeof currentUser!=='undefined'){clearInterval(timer);init()}else if(tries>160)clearInterval(timer)},50);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
