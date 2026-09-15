(function(){
  if(window.__sharedDebtsUiLoaded)return;
  window.__sharedDebtsUiLoaded=true;

  let me=null;
  let people=[];
  let payerUserId='';
  let submitting=false;
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,11);
  const cpfMask=v=>digits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>`sd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

  function removeGenericShareBox(){
    const box=document.getElementById('sharedExpenseBox');
    if(box&&box.closest('#txForm'))box.remove();
  }

  function injectStyles(){
    if(document.getElementById('shared-debts-ui-style'))return;
    const s=document.createElement('style');s.id='shared-debts-ui-style';s.textContent=`
      #sharedDebtBox{grid-column:1/-1;margin-top:4px;border:1px solid var(--line);border-radius:14px;background:rgba(15,23,42,.58);overflow:hidden}
      #sharedDebtBox summary{list-style:none;cursor:pointer;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:750;color:#dbeafe}
      #sharedDebtBox summary::-webkit-details-marker{display:none}
      #sharedDebtBox summary:after{content:'＋';font-size:17px;color:#94a3b8}#sharedDebtBox[open] summary:after{content:'−'}
      .shared-debt-body{padding:0 14px 14px;border-top:1px solid rgba(148,163,184,.12)}
      .shared-debt-lead{font-size:12px;color:var(--muted);line-height:1.5;margin:12px 0}
      .shared-debt-list{display:grid;gap:8px}
      .shared-debt-row{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(96px,.45fr) auto;gap:8px;align-items:end;padding:10px;border:1px solid rgba(148,163,184,.13);border-radius:12px;background:rgba(11,20,36,.62)}
      .shared-debt-row.self{grid-template-columns:minmax(0,1.35fr) minmax(96px,.45fr)}
      .shared-debt-name{font-size:12px;font-weight:760}.shared-debt-sub{font-size:10px;color:var(--muted);margin-top:3px}
      .shared-debt-cpf{display:flex;gap:6px}.shared-debt-cpf input{min-width:0;flex:1}
      .shared-debt-state{font-size:10px;min-height:13px;margin-top:4px;color:var(--muted)}.shared-debt-state.ok{color:#86efac}.shared-debt-state.bad{color:#fca5a5}
      .shared-debt-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}.shared-debt-total.ok{color:#86efac}.shared-debt-total.bad{color:#fca5a5}
      .shared-debt-payer{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.7fr);gap:10px;align-items:end;margin-top:12px}
      .shared-debt-hint{padding:10px 11px;border-radius:11px;background:#10233c;border:1px solid #1e4978;color:#bfdbfe;font-size:11px;line-height:1.45}
      @media(max-width:800px){.shared-debt-row,.shared-debt-row.self,.shared-debt-payer{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  async function loadMe(){
    if(!currentUser?.id)return null;
    const {data,error}=await sb.from('finance_profiles').select('user_id,full_name,nickname,cpf').eq('user_id',currentUser.id).maybeSingle();
    if(error)throw error;me=data||null;return me;
  }
  const personName=p=>p?.nickname||p?.fullName||p?.full_name||'Participante';
  function resetPeople(){
    if(!me?.user_id)return;
    people=[{localId:id(),userId:me.user_id,fullName:me.full_name||'',nickname:me.nickname||'',cpf:me.cpf||'',percentage:100,resolved:true,isSelf:true,state:''}];
    payerUserId=me.user_id;renderPeople();
  }
  function addPerson(){people.push({localId:id(),userId:null,fullName:'',nickname:'',cpf:'',percentage:0,resolved:false,isSelf:false,state:''});renderPeople()}
  function removePerson(localId){const p=people.find(x=>x.localId===localId);people=people.filter(x=>x.localId!==localId);if(p?.userId===payerUserId)payerUserId=me?.user_id||'';renderPeople()}
  async function lookup(localId){
    const p=people.find(x=>x.localId===localId);if(!p)return;
    const cpf=digits(p.cpf);p.state='Buscando…';p.resolved=false;p.userId=null;renderPeople();
    if(cpf.length!==11){p.state='Informe os 11 dígitos do CPF.';renderPeople();return}
    try{
      const {data,error}=await sb.rpc('finance_find_profile_by_cpf',{p_cpf:cpf});if(error)throw error;
      if(!data?.ok||!data?.found){p.state='Nenhum perfil encontrado.';renderPeople();return}
      if(data.userId===me?.user_id){p.state='Este CPF é o seu próprio perfil.';renderPeople();return}
      if(people.some(x=>x.localId!==localId&&x.userId===data.userId)){p.state='Pessoa já adicionada.';renderPeople();return}
      p.userId=data.userId;p.fullName=data.fullName||'';p.nickname=data.nickname||'';p.resolved=true;p.state=`✓ ${personName(p)}`;renderPeople();
    }catch(e){console.error(e);p.state='Falha ao buscar CPF.';renderPeople()}
  }
  function totalPct(){return people.reduce((s,p)=>s+(Number(p.percentage)||0),0)}
  function renderPayer(){
    const sel=document.getElementById('sharedDebtPayer');if(!sel)return;
    const resolved=people.filter(p=>p.resolved&&p.userId);
    sel.innerHTML=resolved.map(p=>`<option value="${esc(p.userId)}">${esc(personName(p))}${p.isSelf?' (você)':''}</option>`).join('');
    if(!resolved.some(p=>p.userId===payerUserId))payerUserId=resolved[0]?.userId||'';
    sel.value=payerUserId;
  }
  function renderTotal(){const el=document.getElementById('sharedDebtTotal');if(!el)return;const t=totalPct();el.textContent=`Total: ${t.toFixed(2).replace('.',',')}%`;el.className=`shared-debt-total ${Math.abs(t-100)<.001?'ok':'bad'}`}
  function renderPeople(){
    const host=document.getElementById('sharedDebtPeople');if(!host)return;
    host.innerHTML=people.map(p=>p.isSelf?`<div class="shared-debt-row self"><div><div class="shared-debt-name">${esc(personName(p))} <span class="badge">Você</span></div><div class="shared-debt-sub">${p.cpf?cpfMask(p.cpf):'Complete seu CPF no Perfil'}</div></div><div class="field"><label>Responsabilidade (%)</label><input type="number" min="0.01" max="100" step="0.01" value="${Number(p.percentage)||0}" data-sd-pct="${esc(p.localId)}"></div></div>`:`<div class="shared-debt-row"><div><div class="shared-debt-cpf"><input inputmode="numeric" maxlength="14" placeholder="CPF da pessoa" value="${esc(cpfMask(p.cpf))}" data-sd-cpf="${esc(p.localId)}"><button type="button" class="btn small" data-sd-find="${esc(p.localId)}">Buscar</button></div><div class="shared-debt-state ${p.resolved?'ok':p.state?'bad':''}">${esc(p.state||'Busque o CPF para identificar a pessoa.')}</div></div><div class="field"><label>Responsabilidade (%)</label><input type="number" min="0.01" max="100" step="0.01" value="${Number(p.percentage)||0}" data-sd-pct="${esc(p.localId)}"></div><button type="button" class="btn ghost" data-sd-remove="${esc(p.localId)}">×</button></div>`).join('');
    host.querySelectorAll('[data-sd-pct]').forEach(el=>el.oninput=e=>{const p=people.find(x=>x.localId===e.target.dataset.sdPct);if(p)p.percentage=Math.max(0,Math.min(100,Number(e.target.value)||0));renderTotal()});
    host.querySelectorAll('[data-sd-cpf]').forEach(el=>el.oninput=e=>{const p=people.find(x=>x.localId===e.target.dataset.sdCpf);if(!p)return;p.cpf=digits(e.target.value);p.resolved=false;p.userId=null;p.state='';e.target.value=cpfMask(p.cpf);renderPayer()});
    host.querySelectorAll('[data-sd-find]').forEach(el=>el.onclick=()=>lookup(el.dataset.sdFind));
    host.querySelectorAll('[data-sd-remove]').forEach(el=>el.onclick=()=>removePerson(el.dataset.sdRemove));
    renderTotal();renderPayer();
  }

  function ensureBox(){
    const form=document.getElementById('debtForm');const grid=form?.querySelector('.modal-body .form-grid');if(!grid)return false;
    if(document.getElementById('sharedDebtBox'))return true;
    const d=document.createElement('details');d.id='sharedDebtBox';d.innerHTML=`<summary>Despesa compartilhada</summary><div class="shared-debt-body"><div class="shared-debt-lead">Adicione as pessoas pelo CPF, defina o percentual de responsabilidade e escolha quem pagará o valor integral da despesa.</div><div class="shared-debt-list" id="sharedDebtPeople"></div><div class="shared-debt-toolbar"><button type="button" class="btn small" id="sharedDebtAdd">+ Adicionar pessoa por CPF</button><strong id="sharedDebtTotal" class="shared-debt-total">Total: 100%</strong></div><div class="shared-debt-payer"><div class="shared-debt-hint">O pagador mantém a despesa integral. A parte confirmada dos demais gera um reembolso pendente para o pagador. Em parcelamentos e despesas sem data final, a mesma divisão é aplicada à série inteira.</div><div class="field"><label>Quem vai pagar o valor integral?</label><select id="sharedDebtPayer"></select></div></div><div class="shared-debt-state bad" id="sharedDebtError"></div></div>`;
    grid.appendChild(d);document.getElementById('sharedDebtAdd').onclick=addPerson;document.getElementById('sharedDebtPayer').onchange=e=>payerUserId=e.target.value;
    d.addEventListener('toggle',()=>{if(d.open)resetPeople()});
    return true;
  }
  function safeDate(ym,day){const [y,m]=String(ym).split('-').map(Number);const last=new Date(y,m,0).getDate();return `${y}-${String(m).padStart(2,'0')}-${String(Math.min(Math.max(Number(day)||1,1),last)).padStart(2,'0')}`}
  function validate(){
    if(!me?.user_id||!me?.cpf)return'Complete nome e CPF no Perfil antes de compartilhar.';
    if(people.length<2)return'Adicione pelo menos uma outra pessoa.';
    if(people.some(p=>!p.resolved||!p.userId))return'Busque e confirme todos os CPFs.';
    if(people.some(p=>(Number(p.percentage)||0)<=0))return'Todos os percentuais precisam ser maiores que zero.';
    if(Math.abs(totalPct()-100)>.001)return'A soma dos percentuais precisa ser exatamente 100%.';
    if(!payerUserId)return'Selecione quem realizará o pagamento.';
    return'';
  }
  async function submit(e){
    const box=document.getElementById('sharedDebtBox');if(!box?.open||document.getElementById('debtId')?.value)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(submitting)return;
    const err=validate(),out=document.getElementById('sharedDebtError');if(err){if(out)out.textContent=err;return}
    const openEnded=!!document.getElementById('debtOpenEnded')?.checked;
    const first=Math.max(1,Number(document.getElementById('debtFirstInstallment')?.value)||1);
    const total=openEnded?null:Math.max(1,Number(document.getElementById('debtTotalInstallments')?.value)||1);
    if(!openEnded&&first>total){if(out)out.textContent='A parcela inicial não pode ser maior que o total.';return}
    const firstMonth=document.getElementById('debtFirstMonth')?.value;
    const dueDay=Math.min(31,Math.max(1,Number(document.getElementById('debtDueDay')?.value)||10));
    const expense={sourceKind:'debt',date:safeDate(firstMonth,dueDay),firstMonth:`${firstMonth}-01`,dueDay,openEnded,installmentCurrent:first,installmentTotal:total,description:document.getElementById('debtName')?.value.trim(),account:document.getElementById('debtAccount')?.value.trim(),category:document.getElementById('debtCategory')?.value||'Dívidas',nature:'Parcelamento',amount:Number(document.getElementById('debtInstallmentAmount')?.value)||0,status:'Pendente',projection:true,notes:document.getElementById('debtNotes')?.value.trim()||''};
    if(!expense.description||expense.amount<=0||!firstMonth){if(out)out.textContent='Preencha nome, valor e mês inicial.';return}
    submitting=true;if(out){out.className='shared-debt-state';out.textContent='Criando despesa compartilhada…'}
    try{
      const participants=people.map(p=>({userId:p.userId,percentage:Number(p.percentage)}));
      const {data,error}=await sb.rpc('finance_create_shared_expense',{p_expense:expense,p_participants:participants,p_payer_user_id:payerUserId});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'create_failed');
      document.getElementById('debtModal')?.classList.remove('open');
      if(window.financeCloud?.refresh)await window.financeCloud.refresh();
      try{if(typeof renderAll==='function')renderAll()}catch(_e){}
      try{document.querySelector('[data-page="debts"]')?.click()}catch(_e){}
      if(out)out.textContent='';box.open=false;resetPeople();
      try{if(typeof setSyncStatus==='function')setSyncStatus('Despesa compartilhada criada')}catch(_e){}
    }catch(error){console.error('Falha ao criar despesa compartilhada no menu Despesas.',error);if(out){out.className='shared-debt-state bad';out.textContent='Não foi possível criar a despesa compartilhada.'}}
    finally{submitting=false}
  }

  async function init(){
    injectStyles();removeGenericShareBox();if(!ensureBox())return false;
    try{await loadMe()}catch(e){console.warn('Falha ao carregar perfil.',e)}
    resetPeople();
    const form=document.getElementById('debtForm');if(form&&!form.dataset.sharedDebtBound){form.dataset.sharedDebtBound='1';form.addEventListener('submit',submit,true)}
    const modal=document.getElementById('debtModal');if(modal&&!modal.dataset.sharedDebtObserved){modal.dataset.sharedDebtObserved='1';new MutationObserver(()=>{removeGenericShareBox();if(modal.classList.contains('open')){const editing=!!document.getElementById('debtId')?.value;const box=document.getElementById('sharedDebtBox');if(box){box.style.display=editing?'none':'block';if(!editing)resetPeople()}}}).observe(modal,{attributes:true,attributeFilter:['class']})}
    return true;
  }
  function boot(){let tries=0;const timer=setInterval(async()=>{tries++;removeGenericShareBox();let ready=false;try{ready=!!(currentUser?.id&&window.financeCloud&&document.getElementById('debtForm'))}catch(e){}if(ready){clearInterval(timer);await init()}else if(tries>600)clearInterval(timer)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();