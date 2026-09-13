(function(){
  const HORIZON_MONTHS=25;

  function uid(prefix){return prefix+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
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
  function planById(id){return Array.isArray(state?.incomePlans)?state.incomePlans.find(p=>p.id===id):null}
  function targetEnd(plan){
    const selected=state?.settings?.selectedMonth||plan.firstMonth;
    const base=selected>plan.firstMonth?selected:plan.firstMonth;
    return addMonth(base,HORIZON_MONTHS-1);
  }
  function buildTx(plan,ym,index,previous){
    return {
      id:previous?.id||uid('itx'),
      date:safeDate(ym,plan.dueDay),
      type:'Receita',
      category:plan.category||'Salário',
      description:plan.name,
      account:plan.account||'',
      nature:'Fixa',
      amount:Number(plan.amount)||0,
      status:previous?.status||'Pendente',
      notes:[`Receita gerada automaticamente por "${plan.name}".`,plan.notes||''].filter(Boolean).join(' '),
      projection:true,
      recurring:false,
      installmentCurrent:null,
      installmentTotal:null,
      incomeManaged:true,
      incomePlanId:plan.id,
      incomeOccurrence:index+1,
      incomeOccurrenceTotal:null,
      incomeOpenEnded:true
    };
  }
  function syncOpenEndedPlan(plan){
    if(!plan||plan.mode!=='mensal'||plan.openEnded!==true||!plan.firstMonth)return false;
    if(!Array.isArray(state.transactions))state.transactions=[];
    const existing=state.transactions.filter(t=>t.incomeManaged===true&&t.incomePlanId===plan.id);
    const byMonth=new Map(existing.map(t=>[String(t.date||'').slice(0,7),t]));
    const end=targetEnd(plan),span=Math.max(0,monthDiff(plan.firstMonth,end));
    const generated=[];
    for(let i=0;i<=span;i++){
      const ym=addMonth(plan.firstMonth,i);
      generated.push(buildTx(plan,ym,i,byMonth.get(ym)));
    }
    const oldSignature=existing.map(t=>`${t.id}|${t.date}|${t.status}|${t.amount}`).sort().join('~');
    const newSignature=generated.map(t=>`${t.id}|${t.date}|${t.status}|${t.amount}`).sort().join('~');
    state.transactions=state.transactions.filter(t=>!(t.incomeManaged===true&&t.incomePlanId===plan.id));
    state.transactions.push(...generated);
    return oldSignature!==newSignature;
  }
  function ensureCoverage(){
    if(typeof state==='undefined'||!Array.isArray(state?.incomePlans))return false;
    let changed=false;
    state.incomePlans.filter(p=>p.mode==='mensal'&&p.openEnded===true).forEach(p=>{if(syncOpenEndedPlan(p))changed=true});
    return changed;
  }

  function installUi(){
    const modal=document.getElementById('incomeModal'),form=document.getElementById('incomeForm'),lastField=document.getElementById('incomeLastMonthField');
    if(!modal||!form||!lastField)return false;
    if(document.getElementById('incomeNoEnd'))return true;

    const hint=modal.querySelector('.modal-body > .notice');
    if(hint)hint.innerHTML='Para receitas recorrentes, defina um último mês ou marque <strong>Sem data final</strong>.';
    const small=lastField.querySelector('small');
    if(small)small.textContent='Opcional quando “Sem data final” estiver marcado.';

    const field=document.createElement('div');
    field.className='field';
    field.id='incomeNoEndField';
    field.innerHTML='<label>Recorrência</label><label class="toggle"><input type="checkbox" id="incomeNoEnd"> Sem data final</label><small class="muted">Mantém até 25 recebimentos calculados para frente.</small>';
    lastField.insertAdjacentElement('afterend',field);

    const checkbox=field.querySelector('#incomeNoEnd');
    checkbox.addEventListener('change',applyNoEndState);
    document.getElementById('incomeMode')?.addEventListener('change',()=>setTimeout(applyNoEndState,0));

    form.addEventListener('submit',handleOpenEndedSubmit,true);
    new MutationObserver(()=>{if(modal.classList.contains('open'))setTimeout(syncModalFromPlan,0)}).observe(modal,{attributes:true,attributeFilter:['class']});
    return true;
  }

  function applyNoEndState(){
    const mode=document.getElementById('incomeMode')?.value;
    const checkbox=document.getElementById('incomeNoEnd');
    const field=document.getElementById('incomeNoEndField');
    const last=document.getElementById('incomeLastMonth');
    if(!checkbox||!field||!last)return;
    field.style.display=mode==='mensal'?'grid':'none';
    if(mode!=='mensal')checkbox.checked=false;
    const noEnd=mode==='mensal'&&checkbox.checked;
    last.disabled=noEnd;
    last.required=mode==='mensal'&&!noEnd;
    if(noEnd&&last.value)last.value='';
  }

  function syncModalFromPlan(){
    const id=document.getElementById('incomeId')?.value;
    const plan=id?planById(id):null;
    const checkbox=document.getElementById('incomeNoEnd');
    if(!checkbox)return;
    checkbox.checked=!!(plan?.mode==='mensal'&&plan?.openEnded===true);
    applyNoEndState();
  }

  function refreshIncomePageIfVisible(){
    const page=document.getElementById('page-incomes');
    const nav=document.querySelector('.nav [data-page="incomes"]');
    if(page?.classList.contains('active')&&nav)nav.click();
  }

  function handleOpenEndedSubmit(e){
    const mode=document.getElementById('incomeMode')?.value;
    const noEnd=document.getElementById('incomeNoEnd')?.checked;
    if(mode!=='mensal'||!noEnd)return;
    e.preventDefault();
    e.stopImmediatePropagation();

    if(typeof state==='undefined')return;
    if(!Array.isArray(state.incomePlans))state.incomePlans=[];
    if(!Array.isArray(state.transactions))state.transactions=[];

    const existingId=document.getElementById('incomeId').value;
    const id=existingId||uid('income');
    const firstMonth=document.getElementById('incomeFirstMonth').value;
    const plan={
      id,
      name:document.getElementById('incomeName').value.trim(),
      account:document.getElementById('incomeAccount').value.trim(),
      category:document.getElementById('incomeCategory').value||'Salário',
      amount:Number(document.getElementById('incomeAmount').value)||0,
      mode:'mensal',
      firstMonth,
      lastMonth:null,
      openEnded:true,
      dueDay:Math.min(31,Math.max(1,Number(document.getElementById('incomeDueDay').value)||1)),
      notes:document.getElementById('incomeNotes').value.trim()
    };
    const idx=state.incomePlans.findIndex(p=>p.id===id);
    if(idx>=0)state.incomePlans[idx]=plan;else state.incomePlans.push(plan);
    syncOpenEndedPlan(plan);
    document.getElementById('incomeModal')?.classList.remove('open');
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    setTimeout(refreshIncomePageIfVisible,0);
  }

  function decorateTable(){
    if(typeof state==='undefined'||!Array.isArray(state?.incomePlans))return;
    const body=document.getElementById('incomeTableBody');
    if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const edit=row.querySelector('button[onclick*="editIncomePlan("]');
      if(!edit)return;
      const match=(edit.getAttribute('onclick')||'').match(/editIncomePlan\(['\"]([^'\"]+)['\"]\)/);
      const plan=match?planById(match[1]):null;
      if(!plan||plan.openEnded!==true)return;
      const cells=row.querySelectorAll('td');
      const period=`${typeof fmtMonth==='function'?fmtMonth(plan.firstMonth):plan.firstMonth} → Sem fim`;
      if(cells[2]&&cells[2].textContent!==period)cells[2].textContent=period;
      if(cells[5]&&cells[5].textContent.trim()!=='Recorrente')cells[5].innerHTML='<strong>Recorrente</strong>';
    });
  }

  function init(){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(installUi()||attempts>100)clearInterval(timer);
    },50);

    const monthSelect=document.getElementById('monthSelect');
    monthSelect?.addEventListener('change',()=>{
      setTimeout(()=>{
        if(ensureCoverage()){
          if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
        }
        decorateTable();
      },0);
    });

    const tableObserver=new MutationObserver(()=>decorateTable());
    const watchTable=()=>{
      const body=document.getElementById('incomeTableBody');
      if(body){tableObserver.observe(body,{childList:true,subtree:true});decorateTable();return true}
      return false;
    };
    let tableAttempts=0;
    const tableTimer=setInterval(()=>{tableAttempts++;if(watchTable()||tableAttempts>100)clearInterval(tableTimer)},100);

    setTimeout(()=>{
      if(ensureCoverage()&&typeof save==='function')save();
      decorateTable();
    },1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
