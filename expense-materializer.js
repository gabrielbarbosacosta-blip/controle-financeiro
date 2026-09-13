(function(){
  const OPEN_HORIZON=25;
  function txUid(){return 'dtx-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function addMonth(ym,n){const [y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function diff(a,b){const [ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);return(yb-ya)*12+(mb-ma)}
  function safeDate(ym,day){const[y,m]=String(ym).split('-').map(Number),last=new Date(y,m,0).getDate(),d=Math.min(Math.max(Number(day)||1,1),last);return`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
  function amountForMonth(expense,ym){
    if(typeof window.expenseAmountForMonth==='function')return window.expenseAmountForMonth(expense,ym);
    let amount=Number(expense.installmentAmount)||0;
    const raw=Array.isArray(expense.amountVersions)?expense.amountVersions:(Array.isArray(expense.amountHistory)?expense.amountHistory:[]);
    const history=raw.filter(x=>x?.fromMonth).slice().sort((a,b)=>String(a.fromMonth).localeCompare(String(b.fromMonth)));
    for(const item of history){if(String(item.fromMonth)<=ym)amount=Number(item.amount)||0;else break}
    const overrides=expense.monthOverrides&&typeof expense.monthOverrides==='object'?expense.monthOverrides:{};
    if(Object.prototype.hasOwnProperty.call(overrides,ym))amount=Number(overrides[ym])||0;
    return amount;
  }
  function expectedLast(expense){const first=Math.max(1,Number(expense.firstInstallment)||1);if(!expense.openEnded)return Math.max(first,Number(expense.totalInstallments)||first);const selected=state?.settings?.selectedMonth||expense.firstMonth;return first+Math.max(0,diff(expense.firstMonth,selected))+OPEN_HORIZON-1}
  function reconcileExpense(expense){
    const current=state.transactions.filter(t=>t.debtManaged===true&&t.debtId===expense.id),byNumber=new Map(current.map(t=>[Number(t.debtInstallmentNumber),t]));
    const first=Math.max(1,Number(expense.firstInstallment)||1),last=expectedLast(expense);let changed=current.length!==last-first+1;
    const generated=[];
    for(let n=first;n<=last;n++){
      const ym=addMonth(expense.firstMonth,n-first),old=byNumber.get(n),denom=expense.openEnded?'∞':String(last),date=safeDate(ym,expense.dueDay),amount=amountForMonth(expense,ym);
      if(old&&String(old.status||'').toLowerCase()!=='pendente'){generated.push(old);continue}
      const tx={id:old?.id||txUid(),date,type:'Despesa',category:expense.category||'Dívidas',description:`${expense.name} — parcela ${n}/${denom}`,account:expense.account||'',nature:'Parcelamento',amount,status:old?.status||'Pendente',notes:[`Parcela gerada automaticamente pela despesa "${expense.name}".`,expense.openEnded?'Despesa sem data final.':'',expense.notes||''].filter(Boolean).join(' '),projection:true,recurring:false,installmentCurrent:null,installmentTotal:null,debtManaged:true,debtId:expense.id,debtInstallmentNumber:n,debtInstallmentTotal:expense.openEnded?null:last,debtOpenEnded:!!expense.openEnded};
      if(!old||old.date!==date||Number(old.amount)!==amount||old.description!==tx.description||old.category!==tx.category||old.account!==tx.account||old.debtOpenEnded!==tx.debtOpenEnded)changed=true;
      generated.push(tx);
    }
    const settledOutside=current.filter(t=>{const n=Number(t.debtInstallmentNumber)||0;return String(t.status||'').toLowerCase()!=='pendente'&&(n<first||n>last)});
    if(settledOutside.length){generated.push(...settledOutside);changed=true}
    if(changed){state.transactions=state.transactions.filter(t=>!(t.debtManaged===true&&t.debtId===expense.id));state.transactions.push(...generated)}
    return changed;
  }
  function reconcileAll(){if(typeof state==='undefined'||!Array.isArray(state?.debts)||!Array.isArray(state?.transactions))return false;let changed=false;for(const expense of state.debts)if(expense?.id&&expense?.firstMonth)changed=reconcileExpense(expense)||changed;return changed}
  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'&&!baseRenderAll.__expenseMaterializer){const wrapped=function(){const changed=reconcileAll();const result=baseRenderAll.apply(this,arguments);if(changed&&typeof save==='function')save();return result};wrapped.__expenseMaterializer=true;window.renderAll=wrapped;try{renderAll=wrapped}catch(e){}}
  const baseRenderHistory=window.renderHistory;
  if(typeof baseRenderHistory==='function'&&!baseRenderHistory.__expenseMaterializer){const wrapped=function(){reconcileAll();return baseRenderHistory.apply(this,arguments)};wrapped.__expenseMaterializer=true;window.renderHistory=wrapped;try{renderHistory=wrapped}catch(e){}}
  window.reconcileExpenseValueHistory=reconcileAll;
  if(reconcileAll()&&typeof save==='function')save();
})();