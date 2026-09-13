(function(){
  const STYLE_ID='income-module-style';

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

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .income-progress{height:7px;background:#172033;border-radius:999px;overflow:hidden;margin-top:7px}.income-progress span{display:block;height:100%;background:#22c55e;border-radius:999px}
      .income-name{font-weight:750}.income-sub{font-size:12px;color:#94a3b8;margin-top:3px}.income-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
      #page-incomes .summary-strip{margin-bottom:14px}
    `;
    document.head.appendChild(style);
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
      btn.dataset.page='incomes';
      btn.textContent='Receitas';
      const before=nav.querySelector('[data-page="debts"]')||nav.querySelector('[data-page="projection"]');
      before?nav.insertBefore(btn,before):nav.appendChild(btn);
      btn.addEventListener('click',showIncomePage);
    }

    const main=document.querySelector('.main');
    if(main&&!document.getElementById('page-incomes')){
      const page=document.createElement('section');
      page.className='page';
      page.id='page-incomes';
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
        <div class="card">
          <div class="table-scroll"><table class="data-table"><thead><tr><th>Receita</th><th>Periodicidade</th><th>Período</th><th>Próxima</th><th class="num">Valor</th><th class="num">Pendente</th><th></th></tr></thead><tbody id="incomeTableBody"></tbody></table></div>
        </div>`;
      main.appendChild(page);
      page.querySelector('#addIncomeBtn').addEventListener('click',()=>openIncomeModal());
    }

    if(!document.getElementById('incomeModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`
        <div class="modal-backdrop" id="incomeModal"><div class="modal"><form id="incomeForm">
          <div class="modal-head"><h3 id="incomeModalTitle">Nova receita</h3><button type="button" class="btn ghost" id="incomeModalClose">✕</button></div>
          <div class="modal-body"><div class="notice" style="margin-bottom:14px">Para receitas recorrentes, informe o primeiro e o último mês. O sistema criará um lançamento para cada competência do período.</div><div class="form-grid">
            <input type="hidden" id="incomeId">
            <div class="field"><label>Nome da receita</label><input id="incomeName" required placeholder="Ex.: Salário líquido"></div>
            <div class="field"><label>Conta de recebimento</label><input id="incomeAccount" placeholder="Ex.: Banco do Brasil"></div>
            <div class="field"><label>Categoria</label><select id="incomeCategory"></select></div>
            <div class="field"><label>Valor por recebimento (R$)</label><input id="incomeAmount" type="number" min="0" step="0.01" required></div>
            <div class="field"><label>Periodicidade</label><select id="incomeMode"><option value="unica">Receita única</option><option value="mensal">Recorrente mensal</option></select></div>
            <div class="field"><label>Primeiro mês</label><input id="incomeFirstMonth" type="month" required></div>
            <div class="field" id="incomeLastMonthField"><label>Último mês</label><input id="incomeLastMonth" type="month"><small class="muted">Obrigatório para receita recorrente.</small></div>
            <div class="field"><label>Dia do recebimento</label><input id="incomeDueDay" type="number" min="1" max="31" value="1" required></div>
            <div class="field full"><label>Observação</label><textarea id="incomeNotes" rows="3"></textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn" id="incomeCancel">Cancelar</button><button class="btn primary" type="submit">Salvar receita</button></div>
        </form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('incomeModalClose').addEventListener('click',closeIncomeModal);
      document.getElementById('incomeCancel').addEventListener('click',closeIncomeModal);
      document.getElementById('incomeModal').addEventListener('click',e=>{if(e.target.id==='incomeModal')closeIncomeModal()});
      document.getElementById('incomeMode').addEventListener('change',toggleIncomeMode);
      document.getElementById('incomeFirstMonth').addEventListener('change',()=>{
        const mode=document.getElementById('incomeMode').value;
        const first=document.getElementById('incomeFirstMonth').value;
        const last=document.getElementById('incomeLastMonth');
        if(mode==='mensal'&&first&&!last.value)last.value=addMonth(first,11);
      });
      document.getElementById('incomeForm').addEventListener('submit',saveIncomeFromForm);
    }
  }

  function showIncomePage(){
    if(!ensureIncomeState())return;
    buildUi();
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-incomes'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='incomes'));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
    if(title)title.textContent='Receitas';
    if(sub)sub.textContent='Recebimentos únicos, recorrentes e projeção';
    renderIncomePage();
  }

  function linkedTransactions(planId){
    if(!ensureIncomeState())return[];
    return state.transactions.filter(t=>t.incomeManaged===true&&t.incomePlanId===planId);
  }

  function syncIncomeTransactions(plan){
    ensureIncomeState();
    const old=linkedTransactions(plan.id),byMonth=new Map(old.map(t=>[String(t.date).slice(0,7),t]));
    state.transactions=state.transactions.filter(t=>!(t.incomeManaged===true&&t.incomePlanId===plan.id));
    const first=plan.firstMonth;
    const last=plan.mode==='mensal'?plan.lastMonth:plan.firstMonth;
    const span=Math.max(0,monthDiffLocal(first,last));
    const generated=[];
    for(let i=0;i<=span;i++){
      const ym=addMonth(first,i),previous=byMonth.get(ym),status=previous?.status||'Pendente';
      generated.push({
        id:previous?.id||txUid(),
        date:safeDate(ym,plan.dueDay),
        type:'Receita',
        category:plan.category||'Salário',
        description:plan.name,
        account:plan.account||'',
        nature:plan.mode==='mensal'?'Fixa':'Extra',
        amount:Number(plan.amount)||0,
        status,
        notes:[`Receita gerada automaticamente por "${plan.name}".`,plan.notes||''].filter(Boolean).join(' '),
        projection:true,
        recurring:false,
        installmentCurrent:null,
        installmentTotal:null,
        incomeManaged:true,
        incomePlanId:plan.id,
        incomeOccurrence:i+1,
        incomeOccurrenceTotal:span+1
      });
    }
    state.transactions.push(...generated);
  }

  function toggleIncomeMode(){
    const mode=document.getElementById('incomeMode')?.value;
    const field=document.getElementById('incomeLastMonthField'),last=document.getElementById('incomeLastMonth'),first=document.getElementById('incomeFirstMonth')?.value;
    if(!field||!last)return;
    field.style.display=mode==='mensal'?'grid':'none';
    last.required=mode==='mensal';
    if(mode==='mensal'&&first&&!last.value)last.value=addMonth(first,11);
  }

  function openIncomeModal(id=null){
    if(!ensureIncomeState())return;
    buildUi();
    const plan=id?state.incomePlans.find(p=>p.id===id):null;
    document.getElementById('incomeModalTitle').textContent=plan?'Editar receita':'Nova receita';
    document.getElementById('incomeId').value=plan?.id||'';
    document.getElementById('incomeName').value=plan?.name||'';
    document.getElementById('incomeAccount').value=plan?.account||'';
    document.getElementById('incomeCategory').innerHTML=categoryOptions(plan?.category||'Salário');
    document.getElementById('incomeAmount').value=plan?.amount??'';
    document.getElementById('incomeMode').value=plan?.mode||'unica';
    document.getElementById('incomeFirstMonth').value=plan?.firstMonth||state?.settings?.selectedMonth||new Date().toISOString().slice(0,7);
    document.getElementById('incomeLastMonth').value=plan?.lastMonth||'';
    document.getElementById('incomeDueDay').value=plan?.dueDay??1;
    document.getElementById('incomeNotes').value=plan?.notes||'';
    toggleIncomeMode();
    document.getElementById('incomeModal').classList.add('open');
  }
  function closeIncomeModal(){document.getElementById('incomeModal')?.classList.remove('open')}

  function saveIncomeFromForm(e){
    e.preventDefault();
    if(!ensureIncomeState())return;
    const id=document.getElementById('incomeId').value||planUid();
    const mode=document.getElementById('incomeMode').value;
    const firstMonth=document.getElementById('incomeFirstMonth').value;
    const lastMonth=mode==='mensal'?document.getElementById('incomeLastMonth').value:firstMonth;
    if(mode==='mensal'&&!lastMonth){alert('Informe o último mês da receita recorrente.');return}
    if(lastMonth<firstMonth){alert('O último mês não pode ser anterior ao primeiro mês.');return}
    const months=monthDiffLocal(firstMonth,lastMonth)+1;
    if(months>120){alert('O período máximo para uma receita recorrente é de 120 meses.');return}
    const plan={
      id,
      name:document.getElementById('incomeName').value.trim(),
      account:document.getElementById('incomeAccount').value.trim(),
      category:document.getElementById('incomeCategory').value||'Salário',
      amount:Number(document.getElementById('incomeAmount').value)||0,
      mode,
      firstMonth,
      lastMonth,
      dueDay:Math.min(31,Math.max(1,Number(document.getElementById('incomeDueDay').value)||1)),
      notes:document.getElementById('incomeNotes').value.trim()
    };
    const idx=state.incomePlans.findIndex(p=>p.id===id);
    if(idx>=0)state.incomePlans[idx]=plan;else state.incomePlans.push(plan);
    syncIncomeTransactions(plan);
    closeIncomeModal();
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderIncomePage();
  }

  function deleteIncome(id){
    if(!ensureIncomeState())return;
    const plan=state.incomePlans.find(p=>p.id===id);if(!plan)return;
    if(!confirm(`Excluir a receita "${plan.name}" e todos os lançamentos vinculados?`))return;
    state.incomePlans=state.incomePlans.filter(p=>p.id!==id);
    state.transactions=state.transactions.filter(t=>!(t.incomeManaged===true&&t.incomePlanId===id));
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderIncomePage();
  }

  function renderIncomePage(){
    if(!ensureIncomeState())return;
    buildUi();
    const plans=state.incomePlans||[],allLinked=state.transactions.filter(t=>t.incomeManaged===true),pending=allLinked.filter(t=>String(t.status).toLowerCase()==='pendente');
    const count=document.getElementById('incomePlanCount'),pc=document.getElementById('incomePendingCount'),pt=document.getElementById('incomePendingTotal'),nd=document.getElementById('incomeNextDue');
    if(count)count.textContent=String(plans.length);
    if(pc)pc.textContent=String(pending.length);
    if(pt)pt.textContent=money(pending.reduce((s,t)=>s+(Number(t.amount)||0),0));
    if(nd){const next=[...pending].sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];nd.textContent=next?`${monthLabel(String(next.date).slice(0,7))} • ${money(next.amount)}`:'—'}
    const body=document.getElementById('incomeTableBody');if(!body)return;
    body.innerHTML=plans.length?plans.map(p=>{
      const txs=linkedTransactions(p.id).sort((a,b)=>String(a.date).localeCompare(String(b.date))),pend=txs.filter(t=>String(t.status).toLowerCase()==='pendente'),received=txs.length-pend.length,next=pend[0],remaining=pend.reduce((s,t)=>s+(Number(t.amount)||0),0),pct=txs.length?Math.round(received/txs.length*100):0;
      const period=p.mode==='mensal'?`${monthLabel(p.firstMonth)} → ${monthLabel(p.lastMonth)}`:monthLabel(p.firstMonth);
      return `<tr>
        <td><div class="income-name">${esc(p.name)}</div><div class="income-sub">${esc(p.account||'Conta não informada')} • ${esc(p.category||'Salário')}</div><div class="income-progress"><span style="width:${pct}%"></span></div></td>
        <td>${p.mode==='mensal'?'Mensal':'Única'}<div class="income-sub">${received} recebida(s) • ${pend.length} pendente(s)</div></td>
        <td>${period}</td>
        <td>${next?`${monthLabel(String(next.date).slice(0,7))}<div class="income-sub">${money(next.amount)}</div>`:'Concluída'}</td>
        <td class="num">${money(p.amount)}</td>
        <td class="num"><strong>${money(remaining)}</strong></td>
        <td><div class="income-actions"><button class="btn small" onclick="editIncomePlan('${p.id}')">Editar</button><button class="btn small danger" onclick="deleteIncomePlan('${p.id}')">Excluir</button></div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="empty">Nenhuma receita cadastrada.</td></tr>';
  }

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

  function init(){
    if(!ensureIncomeState())return;
    buildUi();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
