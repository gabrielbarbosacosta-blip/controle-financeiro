(function(){
  const DEBT_STYLE_ID='debt-module-style';
  const OPEN_HORIZON=24;

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
      .debt-name{font-weight:750}.debt-sub{font-size:12px;color:#94a3b8;margin-top:3px}.debt-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
      #page-debts .summary-strip{margin-bottom:14px}
    `;
    document.head.appendChild(style);
  }

  function buildUi(){
    injectStyles();
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-page="debts"]')){
      const btn=document.createElement('button');
      btn.dataset.page='debts';
      btn.textContent='Dívidas';
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
          <div><h3>Dívidas</h3><div class="muted">Cadastre dívidas parceladas ou cobranças sem data final.</div></div>
          <button class="btn primary" id="addDebtBtn">+ Nova dívida</button>
        </div>
        <div class="summary-strip">
          <div class="mini"><div class="t">Dívidas cadastradas</div><div class="v" id="debtCount">0</div></div>
          <div class="mini"><div class="t">Parcelas pendentes</div><div class="v" id="debtPendingCount">0</div></div>
          <div class="mini"><div class="t">Saldo pendente</div><div class="v" id="debtPendingTotal">R$ 0,00</div></div>
          <div class="mini"><div class="t">Próxima parcela</div><div class="v" id="debtNextDue">—</div></div>
        </div>
        <div class="notice" style="margin-bottom:14px">Dívidas sem data final mantêm automaticamente uma janela futura de ${OPEN_HORIZON} meses. As parcelas aparecem em <strong>Lançamentos</strong> como despesas pendentes.</div>
        <div class="card">
          <div class="table-scroll"><table class="data-table"><thead><tr><th>Dívida</th><th>Parcelas</th><th>Primeiro mês</th><th>Próxima</th><th class="num">Parcela</th><th class="num">Saldo pendente</th><th></th></tr></thead><tbody id="debtTableBody"></tbody></table></div>
        </div>`;
      main.appendChild(page);
      page.querySelector('#addDebtBtn').addEventListener('click',()=>openDebtModal());
    }

    if(!document.getElementById('debtModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`
        <div class="modal-backdrop" id="debtModal"><div class="modal"><form id="debtForm">
          <div class="modal-head"><h3 id="debtModalTitle">Nova dívida</h3><button type="button" class="btn ghost" id="debtModalClose">✕</button></div>
          <div class="modal-body"><div class="notice" style="margin-bottom:14px">Para cobranças contínuas, marque <strong>Sem data final</strong>. O sistema manterá automaticamente os próximos ${OPEN_HORIZON} meses na projeção.</div><div class="form-grid">
            <input type="hidden" id="debtId">
            <div class="field"><label>Nome da dívida</label><input id="debtName" required placeholder="Ex.: CDC PREVI"></div>
            <div class="field"><label>Credor / conta</label><input id="debtAccount" placeholder="Ex.: Banco do Brasil"></div>
            <div class="field"><label>Categoria</label><select id="debtCategory"></select></div>
            <div class="field"><label>Valor de cada parcela (R$)</label><input id="debtInstallmentAmount" type="number" min="0" step="0.01" required></div>
            <div class="field" id="debtTotalField"><label>Total de parcelas</label><input id="debtTotalInstallments" type="number" min="1" step="1" required></div>
            <div class="field"><label>Prazo</label><label class="toggle"><input type="checkbox" id="debtOpenEnded"> Sem data final</label><small class="muted">Mantém uma janela móvel de ${OPEN_HORIZON} meses.</small></div>
            <div class="field"><label>Parcela que inicia neste cadastro</label><input id="debtFirstInstallment" type="number" min="1" step="1" value="1" required><small class="muted">Ex.: dívida em 7/108: informe 7.</small></div>
            <div class="field"><label>Mês dessa parcela</label><input id="debtFirstMonth" type="month" required></div>
            <div class="field"><label>Dia do vencimento</label><input id="debtDueDay" type="number" min="1" max="31" value="10" required></div>
            <div class="field full"><label>Observação</label><textarea id="debtNotes" rows="3"></textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn" id="debtCancel">Cancelar</button><button class="btn primary" type="submit">Salvar dívida e gerar parcelas</button></div>
        </form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('debtModalClose').addEventListener('click',closeDebtModal);
      document.getElementById('debtCancel').addEventListener('click',closeDebtModal);
      document.getElementById('debtModal').addEventListener('click',e=>{if(e.target.id==='debtModal')closeDebtModal()});
      document.getElementById('debtOpenEnded').addEventListener('change',toggleOpenEndedFields);
      document.getElementById('debtForm').addEventListener('submit',saveDebtFromForm);
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
    if(title)title.textContent='Dívidas';
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
      generated.push({
        id:previous?.id||txUid(),
        date:safeDate(ym,debt.dueDay),
        type:'Despesa',
        category:debt.category||'Dívidas',
        description:`${debt.name} — parcela ${n}/${denom}`,
        account:debt.account||'',
        nature:'Parcelamento',
        amount:Number(debt.installmentAmount)||0,
        status,
        notes:[`Parcela gerada automaticamente pela dívida "${debt.name}".`,debt.openEnded?'Dívida sem data final.':'',debt.notes||''].filter(Boolean).join(' '),
        projection:true,
        recurring:false,
        installmentCurrent:null,
        installmentTotal:null,
        debtManaged:true,
        debtId:debt.id,
        debtInstallmentNumber:n,
        debtInstallmentTotal:debt.openEnded?null:last,
        debtOpenEnded:!!debt.openEnded
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
    buildUi();
    const debt=id?state.debts.find(d=>d.id===id):null;
    document.getElementById('debtModalTitle').textContent=debt?'Editar dívida':'Nova dívida';
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
    document.getElementById('debtNotes').value=debt?.notes||'';
    toggleOpenEndedFields();
    document.getElementById('debtModal').classList.add('open');
  }
  function closeDebtModal(){document.getElementById('debtModal')?.classList.remove('open')}

  function saveDebtFromForm(e){
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
      openEnded
    };
    const idx=state.debts.findIndex(d=>d.id===id);
    if(idx>=0)state.debts[idx]=debt;else state.debts.push(debt);
    syncDebtTransactions(debt);
    closeDebtModal();
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderDebtPage();
  }

  function deleteDebt(id){
    if(!ensureDebtState())return;
    const debt=state.debts.find(d=>d.id===id);if(!debt)return;
    if(!confirm(`Excluir a dívida "${debt.name}" e todas as parcelas vinculadas, inclusive as já marcadas como pagas?`))return;
    state.debts=state.debts.filter(d=>d.id!==id);
    state.transactions=state.transactions.filter(t=>!(t.debtManaged===true&&t.debtId===id));
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
      const txs=linkedTransactions(d.id).sort((a,b)=>String(a.date).localeCompare(String(b.date))),pend=txs.filter(t=>String(t.status).toLowerCase()==='pendente'),paid=txs.length-pend.length,next=pend[0],remaining=pend.reduce((s,t)=>s+(Number(t.amount)||0),0),pct=d.openEnded?0:(txs.length?Math.round(paid/txs.length*100):0);
      const parcelInfo=d.openEnded?`${paid} paga(s) • ${pend.length} prevista(s)<div class="debt-sub">${d.firstInstallment}/∞ • sem data final</div>`:`${paid} paga(s) • ${pend.length} pendente(s)<div class="debt-sub">${d.firstInstallment}/${d.totalInstallments} até ${d.totalInstallments}/${d.totalInstallments}</div>`;
      const progress=d.openEnded?'':`<div class="debt-progress"><span style="width:${pct}%"></span></div>`;
      const nextLabel=next?`${monthLabel(String(next.date).slice(0,7))}<div class="debt-sub">parcela ${next.debtInstallmentNumber}/${d.openEnded?'∞':d.totalInstallments}</div>`:(d.openEnded?'—':'Quitada');
      return `<tr>
        <td><div class="debt-name">${esc(d.name)}</div><div class="debt-sub">${esc(d.account||'Conta não informada')} • ${esc(d.category||'Dívidas')}${d.openEnded?' • sem data final':''}</div>${progress}</td>
        <td>${parcelInfo}</td>
        <td>${monthLabel(d.firstMonth)}</td>
        <td>${nextLabel}</td>
        <td class="num">${money(d.installmentAmount)}</td>
        <td class="num"><strong>${money(remaining)}</strong>${d.openEnded?`<div class="debt-sub">janela de ${OPEN_HORIZON} meses</div>`:''}</td>
        <td><div class="debt-actions"><button class="btn small" onclick="editDebtPlan('${d.id}')">Editar</button><button class="btn small danger" onclick="deleteDebtPlan('${d.id}')">Excluir</button></div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="empty">Nenhuma dívida cadastrada.</td></tr>';
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

  function init(){
    if(!ensureDebtState())return;
    buildUi();
    extendOpenEndedDebts();
    const month=document.getElementById('monthSelect');
    if(month)month.addEventListener('change',()=>setTimeout(()=>{if(extendOpenEndedDebts()&&document.getElementById('page-debts')?.classList.contains('active'))renderDebtPage()},0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();