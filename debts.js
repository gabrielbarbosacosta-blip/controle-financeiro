(function(){
  const DEBT_STYLE_ID='debt-module-style';
  const OPEN_HORIZON=25;

  function debtUid(){return 'debt-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function txUid(){return 'dtx-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function ensureDebtState(){
    if(typeof state==='undefined')return false;
    if(!Array.isArray(state.debts))state.debts=[];
    if(!Array.isArray(state.transactions))state.transactions=[];
    return true;
  }
  function addMonth(ym,n){
    const [y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function monthDiff(a,b){
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

  function injectStyles(){
    if(document.getElementById(DEBT_STYLE_ID))return;
    const style=document.createElement('style');
    style.id=DEBT_STYLE_ID;
    style.textContent=`
      .debt-progress{height:7px;background:#172033;border-radius:999px;overflow:hidden;margin-top:7px}.debt-progress span{display:block;height:100%;background:#60a5fa;border-radius:999px}
      .debt-name{font-weight:750}.pfp-name-button{appearance:none;border:0;background:transparent;padding:0;margin:0;color:inherit;font:inherit;text-align:left;cursor:pointer}.pfp-name-button:hover,.pfp-name-button:focus-visible{color:#8fc2ff;text-decoration:underline;text-underline-offset:3px;outline:none}.debt-sub{font-size:12px;color:#94a3b8;margin-top:3px}.debt-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
      #page-debts .summary-strip{margin-bottom:14px}
      .debt-counterparty-box{grid-column:1/-1;padding:11px 12px;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:#0b1424}.debt-counterparty-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:9px}.debt-counterparty-state{grid-column:1/-1;min-height:14px;font-size:10px;color:var(--muted)}.debt-counterparty-state.ok{color:#86efac}.debt-counterparty-state.warn{color:#fde68a}.debt-counterparty-state.bad{color:#fca5a5}
      .debt-advance-list{display:grid;gap:8px;max-height:320px;overflow:auto;padding-right:2px}.debt-advance-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.025);cursor:pointer}.debt-advance-row:hover{background:rgba(255,255,255,.045)}.debt-advance-row input{width:17px;height:17px}.debt-advance-main{min-width:0}.debt-advance-title{font-size:12px;font-weight:780}.debt-advance-meta{font-size:10px;color:var(--muted);margin-top:2px}.debt-advance-value{font-size:12px;font-weight:800;white-space:nowrap}.debt-advance-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.debt-advance-summary .mini{min-height:76px}.debt-advance-saving{color:#91d6b9!important}
      @media(max-width:620px){.debt-counterparty-row{grid-template-columns:1fr}.debt-counterparty-row .btn{width:100%}.debt-advance-summary{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function buildUi(){
    injectStyles();
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-page="debts"]')){
      const btn=document.createElement('button');
      btn.dataset.page='debts';
      btn.textContent='Despesas';
      const before=nav.querySelector('[data-page="projection"]');
      before?nav.insertBefore(btn,before):nav.appendChild(btn);
      btn.addEventListener('click',showDebtsPage);
    }

    const main=document.querySelector('.main');
    if(main&&!document.getElementById('page-debts')){
      const page=document.createElement('section');
      page.className='page';
      page.id='page-debts';
      page.innerHTML=`
        <div class="section-head">
          <div><h3>Despesas</h3><div class="muted">Cadastre despesas parceladas ou cobranças sem data final.</div></div>
          <button class="btn primary" id="addDebtBtn">+ Nova despesa</button>
        </div>
        <div class="summary-strip">
          <div class="mini"><div class="t">Despesas cadastradas</div><div class="v" id="debtCount">0</div></div>
          <div class="mini"><div class="t">Parcelas pendentes</div><div class="v" id="debtPendingCount">0</div></div>
          <div class="mini"><div class="t">Saldo pendente</div><div class="v" id="debtPendingTotal">R$ 0,00</div></div>
          <div class="mini"><div class="t">Próxima parcela</div><div class="v" id="debtNextDue">—</div></div>
        </div>
        <div class="notice" style="margin-bottom:14px">Despesas sem data final mantêm automaticamente uma janela futura de ${OPEN_HORIZON} meses. As parcelas aparecem em <strong>Lançamentos</strong> como despesas pendentes.</div>
        <div class="card">
          <div class="table-scroll"><table class="data-table"><thead><tr><th>Despesa</th><th>Parcelas</th><th>Primeiro mês</th><th>Próxima</th><th class="num">Parcela</th><th class="num">Saldo pendente</th><th></th></tr></thead><tbody id="debtTableBody"></tbody></table></div>
        </div>`;
      main.appendChild(page);
      page.querySelector('#addDebtBtn').addEventListener('click',()=>openDebtModal());
    }

    if(!document.getElementById('debtModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`
        <div class="modal-backdrop" id="debtModal"><div class="modal"><form id="debtForm">
          <div class="modal-head"><h3 id="debtModalTitle">Nova despesa</h3><button type="button" class="btn ghost" id="debtModalClose">✕</button></div>
          <div class="modal-body"><div class="notice" style="margin-bottom:14px">Para cobranças contínuas, marque <strong>Sem data final</strong>. O sistema manterá automaticamente os próximos ${OPEN_HORIZON} meses na projeção.</div><div class="form-grid">
            <input type="hidden" id="debtId">
            <div class="field"><label>Nome da despesa</label><input id="debtName" required placeholder="Ex.: CDC PREVI"></div>
            <div class="field"><label>Conta / instituição</label><input id="debtAccount" placeholder="Ex.: Banco do Brasil"></div>
            <div class="field"><label>Categoria</label><select id="debtCategory"></select></div>
            <div class="field"><label>Valor de cada parcela (R$)</label><input id="debtInstallmentAmount" type="number" min="0" step="0.01" required></div>
            <div class="field" id="debtTotalField"><label>Total de parcelas</label><input id="debtTotalInstallments" type="number" min="1" step="1" required></div>
            <div class="field"><label>Prazo</label><label class="toggle"><input type="checkbox" id="debtOpenEnded"> Sem data final</label><small class="muted">Mantém uma janela móvel de ${OPEN_HORIZON} meses.</small></div>
            <div class="field"><label>Parcela que inicia neste cadastro</label><input id="debtFirstInstallment" type="number" min="1" step="1" value="1" required><small class="muted">Ex.: despesa em 7/108: informe 7.</small></div>
            <div class="field"><label>Mês dessa parcela</label><input id="debtFirstMonth" type="month" required></div>
            <div class="field"><label>Dia do vencimento</label><input id="debtDueDay" type="number" min="1" max="31" value="10" required></div>
            <div class="debt-counterparty-box"><label class="toggle"><input type="checkbox" id="debtCounterpartyEnabled"> Informar credor</label><div class="debt-counterparty-row" id="debtCounterpartyRow" style="display:none"><div class="field"><label>CPF do credor</label><input id="debtCounterpartyCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div><button type="button" class="btn small" id="debtCounterpartyLookup">Buscar CPF</button><div class="debt-counterparty-state" id="debtCounterpartyState"></div></div></div>
            <div class="field full"><label>Observação</label><textarea id="debtNotes" rows="3"></textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn" id="debtCancel">Cancelar</button><button class="btn primary" type="submit">Salvar despesa e gerar parcelas</button></div>
        </form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('debtModalClose').addEventListener('click',closeDebtModal);
      document.getElementById('debtCancel').addEventListener('click',closeDebtModal);
      document.getElementById('debtModal').addEventListener('click',e=>{if(e.target.id==='debtModal')closeDebtModal()});
      document.getElementById('debtOpenEnded').addEventListener('change',toggleOpenEndedFields);
      document.getElementById('debtCounterpartyEnabled').addEventListener('change',toggleDebtCounterparty);
      document.getElementById('debtCounterpartyCpf').addEventListener('input',e=>{e.target.value=debtCpfMask(e.target.value);e.target.dataset.userId='';e.target.dataset.personName='';setDebtCounterpartyState('')});
      document.getElementById('debtCounterpartyLookup').addEventListener('click',lookupDebtCounterparty);
      document.getElementById('debtForm').addEventListener('submit',saveDebtFromForm);
    }

    if(!document.getElementById('debtAdvanceModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`
        <div class="modal-backdrop" id="debtAdvanceModal"><div class="modal"><form id="debtAdvanceForm">
          <div class="modal-head"><h3 id="debtAdvanceTitle">Antecipar parcelas</h3><button type="button" class="btn ghost" id="debtAdvanceClose">✕</button></div>
          <div class="modal-body">
            <input type="hidden" id="debtAdvanceDebtId">
            <div class="notice" style="margin-bottom:14px">Selecione as parcelas que serão quitadas antecipadamente. Elas deixarão de pesar nos meses futuros e o valor efetivamente pago será lançado no caixa na data escolhida.</div>
            <div class="debt-advance-list" id="debtAdvanceList"></div>
            <div class="debt-advance-summary">
              <div class="mini"><div class="t">Total nominal selecionado</div><div class="v" id="debtAdvanceNominal">R$ 0,00</div></div>
              <div class="mini"><div class="t">Economia estimada</div><div class="v debt-advance-saving" id="debtAdvanceSaving">R$ 0,00</div></div>
            </div>
            <div class="form-grid" style="margin-top:14px">
              <div class="field"><label>Data do pagamento</label><input id="debtAdvanceDate" type="date" required></div>
              <div class="field"><label>Valor que será pago (R$)</label><input id="debtAdvancePaidAmount" type="number" min="0.01" step="0.01" required><small class="muted">Pode ser menor que o total nominal quando houver desconto.</small></div>
            </div>
          </div>
          <div class="modal-foot"><button type="button" class="btn" id="debtAdvanceCancel">Cancelar</button><button class="btn primary" type="submit">Confirmar antecipação</button></div>
        </form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('debtAdvanceClose').addEventListener('click',closeDebtAdvanceModal);
      document.getElementById('debtAdvanceCancel').addEventListener('click',closeDebtAdvanceModal);
      document.getElementById('debtAdvanceModal').addEventListener('click',e=>{if(e.target.id==='debtAdvanceModal')closeDebtAdvanceModal()});
      document.getElementById('debtAdvanceList').addEventListener('change',updateDebtAdvanceSummary);
      document.getElementById('debtAdvancePaidAmount').addEventListener('input',e=>{e.target.dataset.userEdited='1';updateDebtAdvanceSummary()});
      document.getElementById('debtAdvanceForm').addEventListener('submit',submitDebtAdvance);
    }
  }

  function toggleOpenEndedFields(){
    const open=document.getElementById('debtOpenEnded')?.checked;
    const total=document.getElementById('debtTotalInstallments');
    const field=document.getElementById('debtTotalField');
    if(!total)return;
    total.disabled=!!open;
    total.required=!open;
    if(field)field.style.opacity=open?'.45':'1';
  }

  function debtCpfDigits(v){return String(v||'').replace(/\D/g,'').slice(0,11)}
  function debtCpfMask(v){return debtCpfDigits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')}
  function setDebtCounterpartyState(text,kind=''){const el=document.getElementById('debtCounterpartyState');if(!el)return;el.textContent=text;el.className=('debt-counterparty-state '+kind).trim()}
  function toggleDebtCounterparty(){const on=!!document.getElementById('debtCounterpartyEnabled')?.checked,row=document.getElementById('debtCounterpartyRow');if(row)row.style.display=on?'grid':'none'}
  async function lookupDebtCounterparty(){
    const input=document.getElementById('debtCounterpartyCpf'),cpf=debtCpfDigits(input?.value);
    if(cpf.length!==11){setDebtCounterpartyState('Informe os 11 dígitos do CPF.','bad');return}
    setDebtCounterpartyState('Buscando…');
    try{
      const client=typeof sb!=='undefined'?sb:window.sb;
      const {data,error}=await client.rpc('finance_find_profile_by_cpf',{p_cpf:cpf});if(error)throw error;
      const uid=(typeof currentUser!=='undefined'?currentUser?.id:window.currentUser?.id)||'';
      if(data?.found&&String(data.userId||'')===String(uid)){setDebtCounterpartyState('Use o CPF de outra pessoa.','bad');return}
      input.dataset.userId=data?.found?String(data.userId||''):'';
      input.dataset.personName=data?.found?(data.nickname||data.fullName||'Pessoa cadastrada'):'';
      setDebtCounterpartyState(data?.found?('✓ '+input.dataset.personName+' · usuário do Prumo'):'CPF não encontrado no Prumo. Será mantido como credor externo.',data?.found?'ok':'warn');
    }catch(e){console.error('Falha ao buscar credor por CPF.',e);setDebtCounterpartyState('Não foi possível consultar este CPF agora.','bad')}
  }

  function categoryOptions(selected='Dívidas'){
    const list=(typeof categories!=='undefined'&&Array.isArray(categories))?categories:['Dívidas','Moradia','Educação','Saúde','Serviços','Outros'];
    const values=list.includes('Dívidas')?list:['Dívidas',...list];
    return values.map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('');
  }

  function showDebtsPage(){
    if(!ensureDebtState())return;
    buildUi();
    extendOpenEndedDebts();
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-debts'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='debts'));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
    if(title)title.textContent='Despesas';
    if(sub)sub.textContent='Parcelas, vencimentos e impacto no caixa';
    renderDebtPage();
  }

  function linkedTransactions(debtId){
    if(!ensureDebtState())return[];
    return state.transactions.filter(t=>t.debtManaged===true&&t.debtId===debtId);
  }

  function desiredLastNumber(debt){
    const first=Math.max(1,Number(debt.firstInstallment)||1);
    if(!debt.openEnded)return Math.max(first,Number(debt.totalInstallments)||first);
    const selected=state?.settings?.selectedMonth||debt.firstMonth;
    const elapsed=Math.max(0,monthDiff(debt.firstMonth,selected));
    return first+elapsed+OPEN_HORIZON-1;
  }

  function syncDebtTransactions(debt){
    ensureDebtState();
    const old=linkedTransactions(debt.id),byNumber=new Map(old.map(t=>[Number(t.debtInstallmentNumber),t]));
    state.transactions=state.transactions.filter(t=>!(t.debtManaged===true&&t.debtId===debt.id));
    const generated=[];
    const first=Math.max(1,Number(debt.firstInstallment)||1),last=desiredLastNumber(debt);
    for(let n=first;n<=last;n++){
      const ym=addMonth(debt.firstMonth,n-first),previous=byNumber.get(n),status=previous?.status||'Pendente',denom=debt.openEnded?'∞':String(last);
      const monthAmount=typeof window.expenseAmountForMonth==='function'?window.expenseAmountForMonth(debt,ym):(Object.prototype.hasOwnProperty.call(debt.monthOverrides||{},ym)?Number(debt.monthOverrides[ym])||0:Number(debt.installmentAmount)||0);
      generated.push({
        id:previous?.id||txUid(),
        date:safeDate(ym,debt.dueDay),
        type:'Despesa',
        category:debt.category||'Dívidas',
        description:`${debt.name} — parcela ${n}/${denom}`,
        account:debt.account||'',
        nature:'Parcelamento',
        amount:String(status).toLowerCase()==='antecipada'?0:monthAmount,
        status,
        notes:[`Parcela gerada automaticamente pela despesa "${debt.name}".`,debt.openEnded?'Despesa sem data final.':'',debt.notes||''].filter(Boolean).join(' '),
        projection:true,
        recurring:false,
        installmentCurrent:null,
        installmentTotal:null,
        debtManaged:true,
        debtId:debt.id,
        debtInstallmentNumber:n,
        debtInstallmentTotal:debt.openEnded?null:last,
        debtOpenEnded:!!debt.openEnded,
        counterpartyCpf:debt.counterpartyCpf||null,
        counterpartyUserId:debt.counterpartyUserId||null,
        counterpartyName:debt.counterpartyName||null,
        counterpartyRole:debt.counterpartyCpf?'creditor':null
      });
    }
    state.transactions.push(...generated);
  }

  function extendOpenEndedDebts(){
    if(!ensureDebtState())return false;
    let changed=false;
    for(const debt of state.debts.filter(d=>d.openEnded===true)){
      const current=linkedTransactions(debt.id);
      const wanted=desiredLastNumber(debt);
      const max=current.reduce((m,t)=>Math.max(m,Number(t.debtInstallmentNumber)||0),0);
      if(max<wanted){syncDebtTransactions(debt);changed=true}
    }
    if(changed&&typeof save==='function')save();
    return changed;
  }

  function openDebtModal(id=null){
    if(!ensureDebtState())return;
    if(id&&isGoalManagedDebt(id)){
      alert('Esta despesa é gerenciada pela seção Objetivos. Altere ou cancele o aporte recorrente no objetivo correspondente.');
      return;
    }
    buildUi();
    const debt=id?state.debts.find(d=>d.id===id):null;
    document.getElementById('debtModalTitle').textContent=debt?'Editar despesa':'Nova despesa';
    document.getElementById('debtId').value=debt?.id||'';
    document.getElementById('debtName').value=debt?.name||'';
    document.getElementById('debtAccount').value=debt?.account||'';
    document.getElementById('debtCategory').innerHTML=categoryOptions(debt?.category||'Dívidas');
    document.getElementById('debtInstallmentAmount').value=debt?.installmentAmount??'';
    document.getElementById('debtTotalInstallments').value=debt?.openEnded?'':(debt?.totalInstallments??'');
    document.getElementById('debtOpenEnded').checked=debt?.openEnded===true;
    document.getElementById('debtFirstInstallment').value=debt?.firstInstallment??1;
    document.getElementById('debtFirstMonth').value=debt?.firstMonth||state?.settings?.selectedMonth||new Date().toISOString().slice(0,7);
    document.getElementById('debtDueDay').value=debt?.dueDay??10;
    const cpInput=document.getElementById('debtCounterpartyCpf'),cpEnabled=document.getElementById('debtCounterpartyEnabled');
    cpEnabled.checked=!!debt?.counterpartyCpf;cpInput.value=debtCpfMask(debt?.counterpartyCpf||'');cpInput.dataset.userId=debt?.counterpartyUserId||'';cpInput.dataset.personName=debt?.counterpartyName||'';
    setDebtCounterpartyState(debt?.counterpartyCpf?(debt?.counterpartyName?('✓ '+debt.counterpartyName):'Credor externo vinculado'):'',debt?.counterpartyUserId?'ok':debt?.counterpartyCpf?'warn':'');
    document.getElementById('debtNotes').value=debt?.notes||'';
    toggleOpenEndedFields();toggleDebtCounterparty();
    document.getElementById('debtModal').classList.add('open');
  }
  function closeDebtModal(){document.getElementById('debtModal')?.classList.remove('open')}

  async function syncDebtPlanObligation(debt,{persistFirst=false,silent=false}={}){
    if(!debt?.counterpartyCpf)return null;
    try{
      if(persistFirst&&window.financeCloud?.save&&typeof currentUser!=='undefined'&&currentUser?.id){
        await window.financeCloud.save(currentUser.id,state);
      }
      const client=typeof sb!=='undefined'?sb:window.sb;
      const {data,error}=await client.rpc('finance_upsert_plan_obligation',{
        p_plan_kind:'debt',
        p_plan_id:String(debt.id),
        p_plan_data:debt,
        p_counterparty_cpf:debt.counterpartyCpf
      });
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.detail||data?.error||'plan_obligation_failed');
      if(data?.linked){
        debt.counterpartyUserId=data.counterpartyUserId||debt.counterpartyUserId||null;
        debt.counterpartyName=data.counterpartyName||debt.counterpartyName||null;
        syncDebtTransactions(debt);
        if(!silent)try{if(typeof setSyncStatus==='function')setSyncStatus(data.status==='accepted'?'Vínculo com credor confirmado':'Despesa salva · aguardando confirmação do credor')}catch(_e){}
      }else if(!silent){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Despesa salva · credor externo vinculado')}catch(_e){}
      }
      try{await window.financeSharedExpensesRefresh?.()}catch(_e){}
      return data;
    }catch(err){
      console.error('Falha ao criar pendência para o credor.',err);
      if(!silent)alert('A despesa foi salva, mas não foi possível gerar a pendência de confirmação para o credor agora.');
      return null;
    }
  }

  async function syncExistingDebtPlanObligations(){
    if(!ensureDebtState())return;
    const items=(state.debts||[]).filter(d=>d?.counterpartyCpf);
    for(const debt of items)await syncDebtPlanObligation(debt,{persistFirst:false,silent:true});
  }

  async function saveDebtFromForm(e){
    e.preventDefault();
    if(!ensureDebtState())return;
    const id=document.getElementById('debtId').value||debtUid();
    const openEnded=document.getElementById('debtOpenEnded').checked;
    const first=Math.max(1,Number(document.getElementById('debtFirstInstallment').value)||1);
    const total=openEnded?null:Math.max(1,Number(document.getElementById('debtTotalInstallments').value)||1);
    if(!openEnded&&first>total){alert('A parcela inicial não pode ser maior que o total de parcelas.');return}
    const debt={
      id,
      name:document.getElementById('debtName').value.trim(),
      account:document.getElementById('debtAccount').value.trim(),
      category:document.getElementById('debtCategory').value||'Dívidas',
      installmentAmount:Number(document.getElementById('debtInstallmentAmount').value)||0,
      totalInstallments:total,
      firstInstallment:first,
      firstMonth:document.getElementById('debtFirstMonth').value,
      dueDay:Math.min(31,Math.max(1,Number(document.getElementById('debtDueDay').value)||10)),
      notes:document.getElementById('debtNotes').value.trim(),
      openEnded,
      counterpartyCpf:document.getElementById('debtCounterpartyEnabled').checked?debtCpfDigits(document.getElementById('debtCounterpartyCpf').value):null,
      counterpartyUserId:document.getElementById('debtCounterpartyEnabled').checked?(document.getElementById('debtCounterpartyCpf').dataset.userId||null):null,
      counterpartyName:document.getElementById('debtCounterpartyEnabled').checked?(document.getElementById('debtCounterpartyCpf').dataset.personName||null):null,
      counterpartyRole:document.getElementById('debtCounterpartyEnabled').checked?'creditor':null
    };
    if(document.getElementById('debtCounterpartyEnabled').checked&&debt.counterpartyCpf.length!==11){alert('Informe um CPF válido para o credor.');return}
    const idx=state.debts.findIndex(d=>d.id===id);
    if(idx>=0)state.debts[idx]=debt;else state.debts.push(debt);
    syncDebtTransactions(debt);
    if(debt.counterpartyCpf)await syncDebtPlanObligation(debt,{persistFirst:true});
    closeDebtModal();
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderDebtPage();
  }

  function localToday(){
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function pendingDebtInstallments(debt){
    return linkedTransactions(debt.id)
      .filter(t=>String(t.status||'').toLowerCase()==='pendente'&&(Number(t.amount)||0)>0)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }

  function closeDebtAdvanceModal(){document.getElementById('debtAdvanceModal')?.classList.remove('open')}

  function openDebtAdvanceModal(id){
    if(!ensureDebtState())return;
    const debt=state.debts.find(d=>d.id===id);if(!debt)return;
    if(isGoalManagedDebt(id)){alert('Esta despesa é gerenciada pela seção Objetivos e não pode ser antecipada por este painel.');return}
    if(typeof window.reconcileExpenseValueHistory==='function')window.reconcileExpenseValueHistory();
    const items=pendingDebtInstallments(debt);
    if(!items.length){alert('Esta despesa não possui parcelas pendentes para antecipar.');return}
    document.getElementById('debtAdvanceDebtId').value=id;
    document.getElementById('debtAdvanceTitle').textContent=`Antecipar parcelas · ${debt.name}`;
    document.getElementById('debtAdvanceDate').value=localToday();
    const paid=document.getElementById('debtAdvancePaidAmount');paid.value='';delete paid.dataset.userEdited;
    document.getElementById('debtAdvanceList').innerHTML=items.map(t=>{
      const n=Number(t.debtInstallmentNumber)||0,denom=debt.openEnded?'∞':(debt.totalInstallments||t.debtInstallmentTotal||'—');
      return `<label class="debt-advance-row"><input type="checkbox" data-debt-advance-tx="${esc(t.id)}" data-amount="${Number(t.amount)||0}"><span class="debt-advance-main"><span class="debt-advance-title">Parcela ${n}/${denom}</span><span class="debt-advance-meta">${esc(monthLabel(String(t.date).slice(0,7)))} · venc. ${esc(String(t.date).slice(8,10))}</span></span><span class="debt-advance-value">${money(t.amount)}</span></label>`;
    }).join('');
    updateDebtAdvanceSummary();
    document.getElementById('debtAdvanceModal').classList.add('open');
  }

  function selectedDebtAdvanceRows(){
    return [...document.querySelectorAll('#debtAdvanceList [data-debt-advance-tx]:checked')];
  }

  function updateDebtAdvanceSummary(){
    const rows=selectedDebtAdvanceRows(),nominal=rows.reduce((s,x)=>s+(Number(x.dataset.amount)||0),0);
    const paid=document.getElementById('debtAdvancePaidAmount');
    if(paid&&!paid.dataset.userEdited)paid.value=nominal?nominal.toFixed(2):'';
    const paidValue=Number(paid?.value)||0,saving=Math.max(0,nominal-paidValue);
    const nominalEl=document.getElementById('debtAdvanceNominal'),savingEl=document.getElementById('debtAdvanceSaving');
    if(nominalEl)nominalEl.textContent=money(nominal);
    if(savingEl)savingEl.textContent=money(saving);
  }

  function submitDebtAdvance(e){
    e.preventDefault();
    if(!ensureDebtState())return;
    const debtId=document.getElementById('debtAdvanceDebtId').value,debt=state.debts.find(d=>d.id===debtId);if(!debt)return;
    const rows=selectedDebtAdvanceRows();
    if(!rows.length){alert('Selecione pelo menos uma parcela para antecipar.');return}
    const selectedIds=new Set(rows.map(x=>x.dataset.debtAdvanceTx));
    const selected=linkedTransactions(debtId).filter(t=>selectedIds.has(String(t.id)));
    const nominal=selected.reduce((s,t)=>s+(Number(t.amount)||0),0);
    const paidAmount=Number(document.getElementById('debtAdvancePaidAmount').value)||0;
    const paymentDate=document.getElementById('debtAdvanceDate').value;
    if(!paymentDate){alert('Informe a data do pagamento.');return}
    if(paidAmount<=0){alert('Informe o valor efetivamente pago.');return}
    if(paidAmount>nominal+0.009){alert('O valor pago não pode ser maior que o total nominal das parcelas selecionadas.');return}

    debt.monthOverrides=debt.monthOverrides&&typeof debt.monthOverrides==='object'?{...debt.monthOverrides}:{};
    const parcelNumbers=[];
    selected.forEach(t=>{
      const ym=String(t.date).slice(0,7);
      debt.monthOverrides[ym]=0;
      t.amount=0;
      t.status='Antecipada';
      t.projection=false;
      t.notes=[String(t.notes||'').trim(),`Parcela antecipada em ${paymentDate}.`].filter(Boolean).join(' ');
      parcelNumbers.push(Number(t.debtInstallmentNumber)||0);
    });

    const saving=Math.max(0,nominal-paidAmount);
    const advanceMeta=selected.map(t=>({
      n:Number(t.debtInstallmentNumber)||0,
      ym:String(t.date).slice(0,7),
      amount:Number(rows.find(r=>r.dataset.debtAdvanceTx===String(t.id))?.dataset.amount)||0
    }));
    const advanceMarker='[[PRUMO_ADVANCE|'+encodeURIComponent(JSON.stringify(advanceMeta))+']]';
    state.transactions.push({
      id:`debt-advance-${debt.id}-${txUid()}`,
      date:paymentDate,
      type:'Despesa',
      category:debt.category||'Dívidas',
      description:`Antecipação — ${debt.name}`,
      account:debt.account||'',
      nature:'Antecipação',
      amount:paidAmount,
      debtId:debt.id,
      debtManaged:false,
      status:'Pago',
      notes:`Parcelas antecipadas: ${parcelNumbers.sort((a,b)=>a-b).join(', ')}. Valor nominal: ${money(nominal)}. Valor pago: ${money(paidAmount)}. Economia: ${money(saving)}. ${advanceMarker}`,
      projection:false,
      recurring:false
    });

    if(typeof window.reconcileExpenseValueHistory==='function')window.reconcileExpenseValueHistory();
    closeDebtAdvanceModal();
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderDebtPage();
    try{if(typeof setSyncStatus==='function')setSyncStatus('Antecipação registrada')}catch(_e){}
  }

  function isDebtAdvanceTransaction(tx){
    return !!tx&&(String(tx.nature||'').toLowerCase()==='antecipação'||String(tx.id||'').startsWith('debt-advance-'));
  }

  function advanceMetaFromTransaction(tx,debt){
    const notes=String(tx?.notes||'');
    const marker=notes.match(/\[\[PRUMO_ADVANCE\|([^\]]+)\]\]/);
    if(marker){
      try{
        const parsed=JSON.parse(decodeURIComponent(marker[1]));
        if(Array.isArray(parsed))return parsed.filter(x=>Number(x?.n)>0&&x?.ym).map(x=>({n:Number(x.n),ym:String(x.ym),amount:Number(x.amount)||0}));
      }catch(_e){}
    }
    const legacy=notes.match(/Parcelas antecipadas:\s*([0-9,\s]+)/i);
    const nums=legacy?legacy[1].split(',').map(x=>Number(x.trim())).filter(Boolean):[];
    return nums.map(n=>{
      const t=linkedTransactions(debt?.id).find(x=>Number(x.debtInstallmentNumber)===n);
      const ym=t?String(t.date).slice(0,7):addMonth(debt.firstMonth,n-(Number(debt.firstInstallment)||1));
      let amount=0;
      if(typeof window.expenseAmountForMonth==='function'){
        const copy={...debt,monthOverrides:{...(debt.monthOverrides||{})}};
        delete copy.monthOverrides[ym];
        amount=Number(window.expenseAmountForMonth(copy,ym))||Number(debt.installmentAmount)||0;
      }else amount=Number(debt.installmentAmount)||0;
      return{n,ym,amount};
    });
  }

  function cancelDebtAdvanceTransaction(txId,{confirmUser=true}={}){
    if(!ensureDebtState())return false;
    const tx=state.transactions.find(t=>String(t.id)===String(txId));
    if(!isDebtAdvanceTransaction(tx))return false;
    let debt=tx.debtId?state.debts.find(d=>String(d.id)===String(tx.debtId)):null;
    if(!debt){
      const name=String(tx.description||'').replace(/^Antecipação\s*[—-]\s*/i,'').trim();
      debt=state.debts.find(d=>String(d.name||'').trim()===name)||null;
    }
    if(!debt){alert('Não foi possível localizar a despesa vinculada a esta antecipação.');return false}
    if(confirmUser&&!confirm(`Cancelar a antecipação de "${debt.name}"? As parcelas selecionadas voltarão a ficar pendentes nos meses originais.`))return false;

    const meta=advanceMetaFromTransaction(tx,debt);
    debt.monthOverrides=debt.monthOverrides&&typeof debt.monthOverrides==='object'?{...debt.monthOverrides}:{};
    const linked=linkedTransactions(debt.id);
    for(const item of meta){
      debt.monthOverrides[item.ym]=Number(item.amount)||0;
      const parcel=linked.find(t=>Number(t.debtInstallmentNumber)===Number(item.n));
      if(parcel){
        parcel.amount=Number(item.amount)||0;
        parcel.status='Pendente';
        parcel.projection=true;
        parcel.notes=String(parcel.notes||'').replace(/\s*Parcela antecipada em \d{4}-\d{2}-\d{2}\.?/g,'').trim();
      }
    }

    state.transactions=state.transactions.filter(t=>String(t.id)!==String(txId));
    if(typeof window.reconcileExpenseValueHistory==='function')window.reconcileExpenseValueHistory();
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderDebtPage();
    try{if(typeof setSyncStatus==='function')setSyncStatus('Antecipação cancelada')}catch(_e){}
    return true;
  }

  function isGoalManagedDebt(id){
    try{if(window.financeGoalManagedProtection?.isDebtPlan?.(id))return true}catch(_e){}
    return String(id||'').startsWith('goal-shared-');
  }

  function deleteDebt(id){
    if(!ensureDebtState())return;
    const debt=state.debts.find(d=>d.id===id);if(!debt)return;
    if(isGoalManagedDebt(id)){
      alert('Esta despesa é gerenciada pela seção Objetivos. Altere ou cancele o aporte recorrente no objetivo correspondente.');
      return;
    }
    if(!confirm(`Excluir a despesa "${debt.name}" e todas as parcelas vinculadas, inclusive as já marcadas como pagas?`))return;
    state.debts=state.debts.filter(d=>d.id!==id);
    state.transactions=state.transactions.filter(t=>!(t.debtManaged===true&&t.debtId===id)&&!String(t.id||'').startsWith('debt-advance-'+id+'-'));
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderDebtPage();
  }

  function renderDebtPage(){
    if(!ensureDebtState())return;
    buildUi();
    extendOpenEndedDebts();
    const debts=state.debts||[],allLinked=state.transactions.filter(t=>t.debtManaged===true),pending=allLinked.filter(t=>String(t.status).toLowerCase()==='pendente');
    const count=document.getElementById('debtCount'),pc=document.getElementById('debtPendingCount'),pt=document.getElementById('debtPendingTotal'),nd=document.getElementById('debtNextDue');
    if(count)count.textContent=String(debts.length);
    if(pc)pc.textContent=String(pending.length);
    if(pt)pt.textContent=money(pending.reduce((s,t)=>s+(Number(t.amount)||0),0));
    if(nd){const next=[...pending].sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];nd.textContent=next?`${monthLabel(String(next.date).slice(0,7))} • ${money(next.amount)}`:'—'}
    const body=document.getElementById('debtTableBody');if(!body)return;
    body.innerHTML=debts.length?debts.map(d=>{
      const txs=linkedTransactions(d.id).sort((a,b)=>String(a.date).localeCompare(String(b.date))),pend=txs.filter(t=>String(t.status).toLowerCase()==='pendente'),anticipated=txs.filter(t=>String(t.status).toLowerCase()==='antecipada'),paid=txs.length-pend.length-anticipated.length,next=pend[0],remaining=pend.reduce((s,t)=>s+(Number(t.amount)||0),0),settledCount=paid+anticipated.length,pct=d.openEnded?0:(txs.length?Math.round(settledCount/txs.length*100):0);
      const anticipatedInfo=anticipated.length?` • ${anticipated.length} antecipada(s)`:'';
      const parcelInfo=d.openEnded?`${paid} paga(s)${anticipatedInfo} • ${pend.length} prevista(s)<div class="debt-sub">${d.firstInstallment}/∞ • sem data final</div>`:`${paid} paga(s)${anticipatedInfo} • ${pend.length} pendente(s)<div class="debt-sub">${d.firstInstallment}/${d.totalInstallments} até ${d.totalInstallments}/${d.totalInstallments}</div>`;
      const progress=d.openEnded?'':`<div class="debt-progress"><span style="width:${pct}%"></span></div>`;
      const nextLabel=next?`${monthLabel(String(next.date).slice(0,7))}<div class="debt-sub">parcela ${next.debtInstallmentNumber}/${d.openEnded?'∞':d.totalInstallments}</div>`:(d.openEnded?'—':'Quitada');
      return `<tr>
        <td><button type="button" class="debt-name pfp-name-button pfp-panel-btn" data-pfp-kind="expense" data-pfp-id="${esc(d.id)}">${esc(d.name)}</button><div class="debt-sub">${esc(d.account||'Conta não informada')} • ${esc(d.category||'Dívidas')}${d.openEnded?' • sem data final':''}${d.counterpartyCpf?`<br>Credor: ${esc(d.counterpartyName||'Pessoa externa')} · ${esc(debtCpfMask(d.counterpartyCpf))}`:''}</div>${progress}</td>
        <td>${parcelInfo}</td>
        <td>${monthLabel(d.firstMonth)}</td>
        <td>${nextLabel}</td>
        <td class="num">${money(d.installmentAmount)}</td>
        <td class="num"><strong>${money(remaining)}</strong>${d.openEnded?`<div class="debt-sub">janela de ${OPEN_HORIZON} meses</div>`:''}</td>
        <td><div class="debt-actions"><button type="button" class="btn small pfp-panel-btn" data-pfp-kind="expense" data-pfp-id="${esc(d.id)}">Painel</button>${!isGoalManagedDebt(d.id)&&pend.length?`<button type="button" class="btn small" onclick="openDebtAdvance('${d.id}')">Antecipar</button>`:''}${isGoalManagedDebt(d.id)?'<span class="goal-managed-plan-label">Gerenciado em Objetivos</span>':`<button class="btn small danger" onclick="deleteDebtPlan('${d.id}')">Excluir</button>`}</div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="empty">Nenhuma despesa cadastrada.</td></tr>';
  }

  const originalEditTx=window.editTx;
  window.editTx=function(id){
    if(ensureDebtState()){
      const tx=state.transactions.find(t=>t.id===id);
      if(tx?.debtManaged&&tx.debtId){openDebtModal(tx.debtId);return}
    }
    if(typeof originalEditTx==='function')return originalEditTx(id);
  };

  window.editDebtPlan=openDebtModal;
  window.deleteDebtPlan=deleteDebt;
  window.openDebtAdvance=openDebtAdvanceModal;
  window.isDebtAdvanceTransaction=isDebtAdvanceTransaction;
  window.cancelDebtAdvanceTransaction=cancelDebtAdvanceTransaction;

  function init(){
    if(!ensureDebtState())return;
    buildUi();
    extendOpenEndedDebts();
    setTimeout(syncExistingDebtPlanObligations,600);
    const month=document.getElementById('monthSelect');
    if(month)month.addEventListener('change',()=>setTimeout(()=>{if(extendOpenEndedDebts()&&document.getElementById('page-debts')?.classList.contains('active'))renderDebtPage()},0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();