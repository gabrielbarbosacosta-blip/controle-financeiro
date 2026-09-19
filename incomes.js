(function(){
  const STYLE_ID='income-module-style';
  const OPEN_HORIZON=25;

  function planUid(){return 'income-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function txUid(){return 'itx-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function ensureIncomeState(){
    if(typeof state==='undefined')return false;
    if(!Array.isArray(state.incomePlans))state.incomePlans=[];
    if(!Array.isArray(state.transactions))state.transactions=[];
    return true;
  }
  function addMonth(ym,n){
    const [y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function monthDiffLocal(a,b){
    const [ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);
    return (yb-ya)*12+(mb-ma);
  }
  function safeDate(ym,day){
    const [y,m]=String(ym).split('-').map(Number),last=new Date(y,m,0).getDate(),d=Math.min(Math.max(Number(day)||1,1),last);
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function monthLabel(ym){return typeof fmtMonth==='function'?fmtMonth(ym):ym}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  function amountVersions(plan){
    const raw=Array.isArray(plan?.amountVersions)?plan.amountVersions:(Array.isArray(plan?.amountHistory)?plan.amountHistory:[]);
    return raw.filter(x=>x?.fromMonth).map(x=>({fromMonth:String(x.fromMonth),amount:Number(x.amount)||0})).sort((a,b)=>a.fromMonth.localeCompare(b.fromMonth));
  }
  function monthOverrides(plan){return plan?.monthOverrides&&typeof plan.monthOverrides==='object'?{...plan.monthOverrides}:{}}
  function amountForMonth(plan,ym){
    let value=Number(plan?.amount)||0;
    for(const version of amountVersions(plan)){if(version.fromMonth<=ym)value=version.amount;else break}
    const overrides=monthOverrides(plan);
    if(Object.prototype.hasOwnProperty.call(overrides,ym))value=Number(overrides[ym])||0;
    return value;
  }
  function planEndMonth(plan){
    if(plan.mode!=='mensal')return plan.firstMonth;
    if(plan.openEnded===true){
      const selected=state?.settings?.selectedMonth||plan.firstMonth;
      const base=selected>plan.firstMonth?selected:plan.firstMonth;
      return addMonth(base,OPEN_HORIZON-1);
    }
    return plan.lastMonth||plan.firstMonth;
  }
  function defaultVersionMonth(plan){
    const selected=state?.settings?.selectedMonth||plan.firstMonth;
    return selected<plan.firstMonth?plan.firstMonth:selected;
  }
  function versionSummary(plan){
    const parts=[`Valor-base: ${money(plan.amount)}`];
    amountVersions(plan).forEach(v=>parts.push(`desde ${monthLabel(v.fromMonth)}: ${money(v.amount)}`));
    Object.entries(monthOverrides(plan)).sort().forEach(([ym,v])=>parts.push(`exceção ${monthLabel(ym)}: ${money(v)}`));
    return parts.join(' • ');
  }

  window.incomeAmountForMonth=amountForMonth;
  window.financeValueVersions=window.financeValueVersions||{};
  window.financeValueVersions.income={
    amountAt:amountForMonth,
    versions:plan=>[{fromMonth:plan.firstMonth,amount:Number(plan.amount)||0,base:true},...amountVersions(plan)],
    series:(plan,start,end)=>{
      const out=[];if(!plan)return out;
      for(let ym=start||plan.firstMonth,stop=end||planEndMonth(plan),i=0;i<240&&ym<=stop;i++,ym=addMonth(ym,1))out.push({ym,amount:amountForMonth(plan,ym)});
      return out;
    }
  };

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .income-progress{height:7px;background:#172033;border-radius:999px;overflow:hidden;margin-top:7px}.income-progress span{display:block;height:100%;background:#22c55e;border-radius:999px}
      .income-name{font-weight:750}.pfp-name-button{appearance:none;border:0;background:transparent;padding:0;margin:0;color:inherit;font:inherit;text-align:left;cursor:pointer}.pfp-name-button:hover,.pfp-name-button:focus-visible{color:#8fc2ff;text-decoration:underline;text-underline-offset:3px;outline:none}.income-sub{font-size:12px;color:#94a3b8;margin-top:3px}.income-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
      #page-incomes .summary-strip{margin-bottom:14px}
      #incomeValueChangeBox{grid-column:1/-1}
      .income-counterparty-box{grid-column:1/-1;padding:11px 12px;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:#0b1424}.income-counterparty-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:9px}.income-counterparty-state{grid-column:1/-1;min-height:14px;font-size:10px;color:var(--muted)}.income-counterparty-state.ok{color:#86efac}.income-counterparty-state.warn{color:#fde68a}.income-counterparty-state.bad{color:#fca5a5}@media(max-width:620px){.income-counterparty-row{grid-template-columns:1fr}.income-counterparty-row .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function incomeCpfDigits(v){return String(v||'').replace(/\D/g,'').slice(0,11)}
  function incomeCpfMask(v){return incomeCpfDigits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')}
  function setIncomeCounterpartyState(text,kind=''){const el=document.getElementById('incomeCounterpartyState');if(!el)return;el.textContent=text;el.className=('income-counterparty-state '+kind).trim()}
  function toggleIncomeCounterparty(){const on=!!document.getElementById('incomeCounterpartyEnabled')?.checked,row=document.getElementById('incomeCounterpartyRow');if(row)row.style.display=on?'grid':'none'}
  async function lookupIncomeCounterparty(){
    const input=document.getElementById('incomeCounterpartyCpf'),cpf=incomeCpfDigits(input?.value);
    if(cpf.length!==11){setIncomeCounterpartyState('Informe os 11 dígitos do CPF.','bad');return}
    setIncomeCounterpartyState('Buscando…');
    try{
      const client=typeof sb!=='undefined'?sb:window.sb;
      const {data,error}=await client.rpc('finance_find_profile_by_cpf',{p_cpf:cpf});if(error)throw error;
      const uid=(typeof currentUser!=='undefined'?currentUser?.id:window.currentUser?.id)||'';
      if(data?.found&&String(data.userId||'')===String(uid)){setIncomeCounterpartyState('Use o CPF de outra pessoa.','bad');return}
      input.dataset.userId=data?.found?String(data.userId||''):'';
      input.dataset.personName=data?.found?(data.nickname||data.fullName||'Pessoa cadastrada'):'';
      setIncomeCounterpartyState(data?.found?('✓ '+input.dataset.personName+' · usuário do Prumo'):'CPF não encontrado no Prumo. Será mantido como devedor externo.',data?.found?'ok':'warn');
    }catch(e){console.error('Falha ao buscar devedor por CPF.',e);setIncomeCounterpartyState('Não foi possível consultar este CPF agora.','bad')}
  }

  function categoryOptions(selected='Salário'){
    const list=(typeof categories!=='undefined'&&Array.isArray(categories))?categories:['Salário','Extra','Outros'];
    return list.map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('');
  }

  function buildUi(){
    injectStyles();
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-page="incomes"]')){
      const btn=document.createElement('button');
      btn.dataset.page='incomes';btn.textContent='Receitas';
      const before=nav.querySelector('[data-page="debts"]')||nav.querySelector('[data-page="projection"]');
      before?nav.insertBefore(btn,before):nav.appendChild(btn);
      btn.addEventListener('click',showIncomePage);
    }

    const main=document.querySelector('.main');
    if(main&&!document.getElementById('page-incomes')){
      const page=document.createElement('section');
      page.className='page';page.id='page-incomes';
      page.innerHTML=`
        <div class="section-head">
          <div><h3>Receitas</h3><div class="muted">Cadastre receitas únicas ou recorrentes. Cada competência é criada automaticamente em Lançamentos.</div></div>
          <button class="btn primary" id="addIncomeBtn">+ Nova receita</button>
        </div>
        <div class="summary-strip">
          <div class="mini"><div class="t">Receitas cadastradas</div><div class="v" id="incomePlanCount">0</div></div>
          <div class="mini"><div class="t">Recebimentos pendentes</div><div class="v" id="incomePendingCount">0</div></div>
          <div class="mini"><div class="t">Total pendente</div><div class="v" id="incomePendingTotal">R$ 0,00</div></div>
          <div class="mini"><div class="t">Próxima receita</div><div class="v" id="incomeNextDue">—</div></div>
        </div>
        <div class="notice" style="margin-bottom:14px">As competências aparecem em <strong>Lançamentos</strong> como receitas pendentes. Você pode alterar cada uma para <strong>Recebido</strong> diretamente na coluna Status.</div>
        <div class="card"><div class="table-scroll"><table class="data-table"><thead><tr><th>Receita</th><th>Periodicidade</th><th>Período</th><th>Próxima</th><th class="num">Valor</th><th class="num">Pendente</th><th></th></tr></thead><tbody id="incomeTableBody"></tbody></table></div></div>`;
      main.appendChild(page);
      page.querySelector('#addIncomeBtn').addEventListener('click',()=>openIncomeModal());
    }

    if(!document.getElementById('incomeModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`
        <div class="modal-backdrop" id="incomeModal"><div class="modal"><form id="incomeForm">
          <div class="modal-head"><h3 id="incomeModalTitle">Nova receita</h3><button type="button" class="btn ghost" id="incomeModalClose">✕</button></div>
          <div class="modal-body"><div class="notice" style="margin-bottom:14px">Para receitas recorrentes, defina um último mês ou marque <strong>Sem data final</strong>.</div><div class="form-grid">
            <input type="hidden" id="incomeId">
            <div class="field"><label>Nome da receita</label><input id="incomeName" required placeholder="Ex.: Salário líquido"></div>
            <div class="field"><label>Conta de recebimento</label><input id="incomeAccount" placeholder="Ex.: Banco do Brasil"></div>
            <div class="field"><label>Categoria</label><select id="incomeCategory"></select></div>
            <div class="field"><label>Valor por recebimento (R$)</label><input id="incomeAmount" type="number" min="0" step="0.01" required></div>
            <div class="field full" id="incomeValueChangeBox" style="display:none"><div class="notice"><strong>Versão do valor</strong><div class="form-grid" style="margin-top:10px"><div class="field"><label>Aplicar novo valor</label><select id="incomeValueChangeScope"><option value="fromMonth">A partir de um mês</option><option value="onlyMonth">Somente em um mês</option></select></div><div class="field"><label>Mês da alteração</label><input id="incomeValueChangeMonth" type="month"></div></div><small class="muted">Os valores anteriores ficam preservados. A alteração passa a compor o histórico para gráficos de evolução.</small><div class="income-sub" id="incomeValueHistorySummary" style="margin-top:8px"></div></div></div>
            <div class="field"><label>Periodicidade</label><select id="incomeMode"><option value="unica">Receita única</option><option value="mensal">Recorrente mensal</option></select></div>
            <div class="field"><label>Primeiro mês</label><input id="incomeFirstMonth" type="month" required></div>
            <div class="field" id="incomeLastMonthField"><label>Último mês</label><input id="incomeLastMonth" type="month"><small class="muted">Opcional quando “Sem data final” estiver marcado.</small></div>
            <div class="field" id="incomeNoEndField"><label>Recorrência</label><label class="toggle"><input type="checkbox" id="incomeNoEnd"> Sem data final</label><small class="muted">Mantém até ${OPEN_HORIZON} recebimentos calculados para frente.</small></div>
            <div class="field"><label>Dia do recebimento</label><input id="incomeDueDay" type="number" min="1" max="31" value="1" required></div>
            <div class="income-counterparty-box"><label class="toggle"><input type="checkbox" id="incomeCounterpartyEnabled"> Informar devedor</label><div class="income-counterparty-row" id="incomeCounterpartyRow" style="display:none"><div class="field"><label>CPF do devedor</label><input id="incomeCounterpartyCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div><button type="button" class="btn small" id="incomeCounterpartyLookup">Buscar CPF</button><div class="income-counterparty-state" id="incomeCounterpartyState"></div></div></div>
            <div class="field full"><label>Observação</label><textarea id="incomeNotes" rows="3"></textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn" id="incomeCancel">Cancelar</button><button class="btn primary" type="submit">Salvar receita</button></div>
        </form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('incomeModalClose').addEventListener('click',closeIncomeModal);
      document.getElementById('incomeCancel').addEventListener('click',closeIncomeModal);
      document.getElementById('incomeModal').addEventListener('click',e=>{if(e.target.id==='incomeModal')closeIncomeModal()});
      document.getElementById('incomeMode').addEventListener('change',toggleIncomeMode);
      document.getElementById('incomeNoEnd').addEventListener('change',toggleIncomeMode);
      document.getElementById('incomeCounterpartyEnabled').addEventListener('change',toggleIncomeCounterparty);
      document.getElementById('incomeCounterpartyCpf').addEventListener('input',e=>{e.target.value=incomeCpfMask(e.target.value);e.target.dataset.userId='';e.target.dataset.personName='';setIncomeCounterpartyState('')});
      document.getElementById('incomeCounterpartyLookup').addEventListener('click',lookupIncomeCounterparty);
      document.getElementById('incomeFirstMonth').addEventListener('change',()=>{
        const mode=document.getElementById('incomeMode').value,first=document.getElementById('incomeFirstMonth').value,last=document.getElementById('incomeLastMonth');
        if(mode==='mensal'&&first&&!document.getElementById('incomeNoEnd').checked&&!last.value)last.value=addMonth(first,11);
      });
      document.getElementById('incomeValueChangeMonth').addEventListener('change',()=>{
        const id=document.getElementById('incomeId').value,plan=id?state?.incomePlans?.find(p=>p.id===id):null,ym=document.getElementById('incomeValueChangeMonth').value;
        if(plan&&ym)document.getElementById('incomeAmount').value=amountForMonth(plan,ym);
      });
      document.getElementById('incomeForm').addEventListener('submit',saveIncomeFromForm);
    }
  }

  function showIncomePage(){
    if(!ensureIncomeState())return;buildUi();
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-incomes'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='incomes'));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
    if(title)title.textContent='Receitas';if(sub)sub.textContent='Recebimentos únicos, recorrentes e projeção';renderIncomePage();
  }

  function linkedTransactions(planId){
    if(!ensureIncomeState())return[];
    return state.transactions.filter(t=>t.incomeManaged===true&&t.incomePlanId===planId);
  }

  function syncIncomeTransactions(plan){
    ensureIncomeState();
    const old=linkedTransactions(plan.id),byMonth=new Map(old.map(t=>[String(t.date||'').slice(0,7),t]));
    const first=plan.firstMonth,last=planEndMonth(plan),span=Math.max(0,monthDiffLocal(first,last)),generated=[];
    for(let i=0;i<=span;i++){
      const ym=addMonth(first,i),previous=byMonth.get(ym);
      if(previous&&String(previous.status||'').toLowerCase()!=='pendente'){generated.push({...previous,counterpartyCpf:plan.counterpartyCpf||null,counterpartyUserId:plan.counterpartyUserId||null,counterpartyName:plan.counterpartyName||null,counterpartyRole:plan.counterpartyCpf?'debtor':null});continue}
      generated.push({
        id:previous?.id||txUid(),date:safeDate(ym,plan.dueDay),type:'Receita',category:plan.category||'Salário',description:plan.name,account:plan.account||'',nature:plan.mode==='mensal'?'Fixa':'Extra',amount:amountForMonth(plan,ym),status:previous?.status||'Pendente',notes:[`Receita gerada automaticamente por "${plan.name}".`,plan.notes||''].filter(Boolean).join(' '),projection:true,recurring:false,installmentCurrent:null,installmentTotal:null,incomeManaged:true,incomePlanId:plan.id,incomeOccurrence:i+1,incomeOccurrenceTotal:plan.openEnded?null:span+1,incomeOpenEnded:!!plan.openEnded,counterpartyCpf:plan.counterpartyCpf||null,counterpartyUserId:plan.counterpartyUserId||null,counterpartyName:plan.counterpartyName||null,counterpartyRole:plan.counterpartyCpf?'debtor':null
      });
    }
    old.filter(t=>String(t.status||'').toLowerCase()!=='pendente'&&(String(t.date||'').slice(0,7)<first||String(t.date||'').slice(0,7)>last)).forEach(t=>generated.push(t));
    state.transactions=state.transactions.filter(t=>!(t.incomeManaged===true&&t.incomePlanId===plan.id));
    state.transactions.push(...generated);
  }
  window.syncIncomePlanTransactions=syncIncomeTransactions;

  function toggleIncomeMode(){
    const mode=document.getElementById('incomeMode')?.value,checkbox=document.getElementById('incomeNoEnd'),noEnd=mode==='mensal'&&checkbox?.checked,lastField=document.getElementById('incomeLastMonthField'),last=document.getElementById('incomeLastMonth'),noEndField=document.getElementById('incomeNoEndField'),first=document.getElementById('incomeFirstMonth')?.value;
    if(noEndField)noEndField.style.display=mode==='mensal'?'grid':'none';
    if(mode!=='mensal'&&checkbox)checkbox.checked=false;
    if(lastField)lastField.style.display=mode==='mensal'?'grid':'none';
    if(last){last.disabled=!!noEnd;last.required=mode==='mensal'&&!noEnd;if(noEnd)last.value='';else if(mode==='mensal'&&first&&!last.value)last.value=addMonth(first,11)}
  }

  function openIncomeModal(id=null){
    if(!ensureIncomeState())return;
    if(id&&isGoalManagedIncome(id)){
      alert('Esta receita é gerenciada pela seção Objetivos. Altere ou cancele o aporte recorrente no objetivo correspondente.');
      return;
    }
    buildUi();
    const plan=id?state.incomePlans.find(p=>p.id===id):null;
    document.getElementById('incomeModalTitle').textContent=plan?'Editar receita':'Nova receita';
    document.getElementById('incomeId').value=plan?.id||'';
    document.getElementById('incomeName').value=plan?.name||'';
    document.getElementById('incomeAccount').value=plan?.account||'';
    document.getElementById('incomeCategory').innerHTML=categoryOptions(plan?.category||'Salário');
    document.getElementById('incomeMode').value=plan?.mode||'unica';
    document.getElementById('incomeFirstMonth').value=plan?.firstMonth||state?.settings?.selectedMonth||new Date().toISOString().slice(0,7);
    document.getElementById('incomeNoEnd').checked=plan?.openEnded===true;
    document.getElementById('incomeLastMonth').value=plan?.lastMonth||'';
    document.getElementById('incomeDueDay').value=plan?.dueDay??1;
    const cpInput=document.getElementById('incomeCounterpartyCpf'),cpEnabled=document.getElementById('incomeCounterpartyEnabled');
    cpEnabled.checked=!!plan?.counterpartyCpf;cpInput.value=incomeCpfMask(plan?.counterpartyCpf||'');cpInput.dataset.userId=plan?.counterpartyUserId||'';cpInput.dataset.personName=plan?.counterpartyName||'';
    setIncomeCounterpartyState(plan?.counterpartyCpf?(plan?.counterpartyName?('✓ '+plan.counterpartyName):'Devedor externo vinculado'):'',plan?.counterpartyUserId?'ok':plan?.counterpartyCpf?'warn':'');
    document.getElementById('incomeNotes').value=plan?.notes||'';

    const versionBox=document.getElementById('incomeValueChangeBox');
    if(plan){
      const ym=defaultVersionMonth(plan);
      versionBox.style.display='grid';
      document.getElementById('incomeValueChangeScope').value='fromMonth';
      document.getElementById('incomeValueChangeMonth').value=ym;
      document.getElementById('incomeAmount').value=amountForMonth(plan,ym);
      document.getElementById('incomeValueHistorySummary').textContent=versionSummary(plan);
    }else{
      versionBox.style.display='none';
      document.getElementById('incomeAmount').value='';
      document.getElementById('incomeValueChangeMonth').value='';
      document.getElementById('incomeValueHistorySummary').textContent='';
    }
    toggleIncomeMode();toggleIncomeCounterparty();
    document.getElementById('incomeModal').classList.add('open');
  }
  function closeIncomeModal(){document.getElementById('incomeModal')?.classList.remove('open')}

  async function syncIncomePlanObligation(plan,{persistFirst=false,silent=false}={}){
    if(!plan?.counterpartyCpf)return null;
    try{
      if(persistFirst&&window.financeCloud?.save&&typeof currentUser!=='undefined'&&currentUser?.id){
        await window.financeCloud.save(currentUser.id,state);
      }
      const client=typeof sb!=='undefined'?sb:window.sb;
      const {data,error}=await client.rpc('finance_upsert_plan_obligation',{
        p_plan_kind:'income',
        p_plan_id:String(plan.id),
        p_plan_data:plan,
        p_counterparty_cpf:plan.counterpartyCpf
      });
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.detail||data?.error||'plan_obligation_failed');
      if(data?.linked){
        plan.counterpartyUserId=data.counterpartyUserId||plan.counterpartyUserId||null;
        plan.counterpartyName=data.counterpartyName||plan.counterpartyName||null;
        syncIncomeTransactions(plan);
        if(!silent)try{if(typeof setSyncStatus==='function')setSyncStatus(data.status==='accepted'?'Vínculo com devedor confirmado':'Receita salva · aguardando confirmação do devedor')}catch(_e){}
      }else if(!silent){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Receita salva · devedor externo vinculado')}catch(_e){}
      }
      try{await window.financeSharedExpensesRefresh?.()}catch(_e){}
      return data;
    }catch(err){
      console.error('Falha ao criar pendência para o devedor.',err);
      if(!silent)alert('A receita foi salva, mas não foi possível gerar a pendência de confirmação para o devedor agora.');
      return null;
    }
  }

  async function syncExistingIncomePlanObligations(){
    if(!ensureIncomeState())return;
    const items=(state.incomePlans||[]).filter(p=>p?.counterpartyCpf);
    for(const plan of items)await syncIncomePlanObligation(plan,{persistFirst:false,silent:true});
  }

  async function saveIncomeFromForm(e){
    e.preventDefault();
    if(!ensureIncomeState())return;
    const existingId=document.getElementById('incomeId').value,id=existingId||planUid(),existing=existingId?state.incomePlans.find(p=>p.id===existingId):null;
    const mode=document.getElementById('incomeMode').value,openEnded=mode==='mensal'&&document.getElementById('incomeNoEnd').checked,firstMonth=document.getElementById('incomeFirstMonth').value,lastMonth=mode==='mensal'&&!openEnded?document.getElementById('incomeLastMonth').value:firstMonth;
    if(mode==='mensal'&&!openEnded&&!lastMonth){alert('Informe o último mês da receita recorrente ou marque Sem data final.');return}
    if(lastMonth&&lastMonth<firstMonth){alert('O último mês não pode ser anterior ao primeiro mês.');return}
    if(!openEnded&&monthDiffLocal(firstMonth,lastMonth)+1>120){alert('O período máximo para uma receita recorrente é de 120 meses.');return}
    const enteredAmount=Number(document.getElementById('incomeAmount').value)||0;
    if(enteredAmount<=0){alert('Informe um valor maior que zero.');return}

    let baseAmount=enteredAmount,versions=[],overrides={};
    if(existing){
      baseAmount=Number(existing.amount)||0;
      versions=amountVersions(existing);overrides=monthOverrides(existing);
      const changeMonth=document.getElementById('incomeValueChangeMonth').value||defaultVersionMonth(existing),scope=document.getElementById('incomeValueChangeScope').value||'fromMonth';
      if(changeMonth<firstMonth){alert('O mês da alteração não pode ser anterior ao primeiro mês da receita.');return}
      const oldValue=amountForMonth(existing,changeMonth);
      if(enteredAmount!==oldValue){
        if(scope==='onlyMonth')overrides[changeMonth]=enteredAmount;
        else{
          delete overrides[changeMonth];
          const idx=versions.findIndex(v=>v.fromMonth===changeMonth),entry={fromMonth:changeMonth,amount:enteredAmount};
          if(idx>=0)versions[idx]=entry;else versions.push(entry);
          versions.sort((a,b)=>a.fromMonth.localeCompare(b.fromMonth));
        }
      }
    }

    const plan={
      id,name:document.getElementById('incomeName').value.trim(),account:document.getElementById('incomeAccount').value.trim(),category:document.getElementById('incomeCategory').value||'Salário',amount:baseAmount,mode,firstMonth,lastMonth:openEnded?null:lastMonth,openEnded,dueDay:Math.min(31,Math.max(1,Number(document.getElementById('incomeDueDay').value)||1)),notes:document.getElementById('incomeNotes').value.trim(),amountVersions:versions,monthOverrides:overrides,counterpartyCpf:document.getElementById('incomeCounterpartyEnabled').checked?incomeCpfDigits(document.getElementById('incomeCounterpartyCpf').value):null,counterpartyUserId:document.getElementById('incomeCounterpartyEnabled').checked?(document.getElementById('incomeCounterpartyCpf').dataset.userId||null):null,counterpartyName:document.getElementById('incomeCounterpartyEnabled').checked?(document.getElementById('incomeCounterpartyCpf').dataset.personName||null):null,counterpartyRole:document.getElementById('incomeCounterpartyEnabled').checked?'debtor':null
    };
    if(document.getElementById('incomeCounterpartyEnabled').checked&&plan.counterpartyCpf.length!==11){alert('Informe um CPF válido para o devedor.');return}
    const idx=state.incomePlans.findIndex(p=>p.id===id);
    if(idx>=0)state.incomePlans[idx]=plan;else state.incomePlans.push(plan);
    syncIncomeTransactions(plan);
    if(plan.counterpartyCpf)await syncIncomePlanObligation(plan,{persistFirst:true});
    closeIncomeModal();
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderIncomePage();
  }

  function isGoalManagedIncome(id){
    try{if(window.financeGoalManagedProtection?.isIncomePlan?.(id))return true}catch(_e){}
    return String(id||'').startsWith('goal-shared-income-');
  }

  function deleteIncome(id){
    if(!ensureIncomeState())return;
    const plan=state.incomePlans.find(p=>p.id===id);if(!plan)return;
    if(isGoalManagedIncome(id)){
      alert('Esta receita é gerenciada pela seção Objetivos. Altere ou cancele o aporte recorrente no objetivo correspondente.');
      return;
    }
    if(!confirm(`Excluir a receita "${plan.name}" e todos os lançamentos vinculados?`))return;
    state.incomePlans=state.incomePlans.filter(p=>p.id!==id);
    state.transactions=state.transactions.filter(t=>!(t.incomeManaged===true&&t.incomePlanId===id));
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();renderIncomePage();
  }

  function renderIncomePage(){
    if(!ensureIncomeState())return;buildUi();
    const plans=state.incomePlans||[],allLinked=state.transactions.filter(t=>t.incomeManaged===true),pending=allLinked.filter(t=>String(t.status).toLowerCase()==='pendente');
    const count=document.getElementById('incomePlanCount'),pc=document.getElementById('incomePendingCount'),pt=document.getElementById('incomePendingTotal'),nd=document.getElementById('incomeNextDue');
    if(count)count.textContent=String(plans.length);if(pc)pc.textContent=String(pending.length);if(pt)pt.textContent=money(pending.reduce((s,t)=>s+(Number(t.amount)||0),0));
    if(nd){const next=[...pending].sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];nd.textContent=next?`${monthLabel(String(next.date).slice(0,7))} • ${money(next.amount)}`:'—'}
    const body=document.getElementById('incomeTableBody');if(!body)return;
    body.innerHTML=plans.length?plans.map(p=>{
      const txs=linkedTransactions(p.id).sort((a,b)=>String(a.date).localeCompare(String(b.date))),pend=txs.filter(t=>String(t.status).toLowerCase()==='pendente'),received=txs.length-pend.length,next=pend[0],remaining=pend.reduce((s,t)=>s+(Number(t.amount)||0),0),pct=p.openEnded?0:(txs.length?Math.round(received/txs.length*100):0),selected=state?.settings?.selectedMonth||p.firstMonth,currentValue=amountForMonth(p,selected<p.firstMonth?p.firstMonth:selected),hasVersions=amountVersions(p).length||Object.keys(monthOverrides(p)).length;
      const period=p.mode==='mensal'?(p.openEnded?`${monthLabel(p.firstMonth)} → Sem fim`:`${monthLabel(p.firstMonth)} → ${monthLabel(p.lastMonth)}`):monthLabel(p.firstMonth);
      const progress=p.openEnded?'':`<div class="income-progress"><span style="width:${pct}%"></span></div>`;
      return `<tr>
        <td><button type="button" class="income-name pfp-name-button pfp-panel-btn" data-pfp-kind="income" data-pfp-id="${esc(p.id)}">${esc(p.name)}</button><div class="income-sub">${esc(p.account||'Conta não informada')} • ${esc(p.category||'Salário')}${p.counterpartyCpf?`<br>Devedor: ${esc(p.counterpartyName||'Pessoa externa')} · ${esc(incomeCpfMask(p.counterpartyCpf))}`:''}</div>${progress}</td>
        <td>${p.mode==='mensal'?'Mensal':'Única'}<div class="income-sub">${received} recebida(s) • ${pend.length} pendente(s)</div></td>
        <td>${period}</td>
        <td>${next?`${monthLabel(String(next.date).slice(0,7))}<div class="income-sub">${money(next.amount)}</div>`:(p.openEnded?'—':'Concluída')}</td>
        <td class="num">${money(currentValue)}${hasVersions?'<div class="income-sub">valor vigente</div>':''}</td>
        <td class="num"><strong>${p.openEnded?'Recorrente':money(remaining)}</strong></td>
        <td><div class="income-actions"><button type="button" class="btn small pfp-panel-btn" data-pfp-kind="income" data-pfp-id="${esc(p.id)}">Painel</button>${isGoalManagedIncome(p.id)?'<span class="goal-managed-plan-label">Gerenciado em Objetivos</span>':`<button class="btn small danger" onclick="deleteIncomePlan('${p.id}')">Excluir</button>`}</div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="empty">Nenhuma receita cadastrada.</td></tr>';
  }
  window.renderIncomePage=renderIncomePage;

  const previousEditTx=window.editTx;
  window.editTx=function(id){
    if(ensureIncomeState()){
      const tx=state.transactions.find(t=>t.id===id);
      if(tx?.incomeManaged&&tx.incomePlanId){openIncomeModal(tx.incomePlanId);return}
    }
    if(typeof previousEditTx==='function')return previousEditTx(id);
  };

  window.editIncomePlan=openIncomeModal;
  window.deleteIncomePlan=deleteIncome;

  function init(){if(!ensureIncomeState())return;buildUi();setTimeout(syncExistingIncomePlanObligations,700)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
