(function(){
  function importedMeta(p){
    const current=Number(p?.chatgptImport?.installmentCurrent);
    const total=Number(p?.chatgptImport?.installmentTotal);
    if(!Number.isInteger(current)||!Number.isInteger(total)||current<1||total<current)return null;
    let value=Number(p?.installmentValue);
    if(!(value>0)&&Number(p?.installments||1)===1&&Number(p?.totalAmount)>0)value=Number(p.totalAmount);
    if(!(value>0))return null;
    return{current,total,value,remaining:total-current+1};
  }

  function diff(a,b){
    if(typeof monthDiff==='function')return monthDiff(a,b);
    const[ya,ma]=String(a||'').split('-').map(Number),[yb,mb]=String(b||'').split('-').map(Number);
    return(yb-ya)*12+(mb-ma);
  }

  function install(){
    const base=window.purchaseAllocation||(typeof purchaseAllocation==='function'?purchaseAllocation:null);
    if(typeof base!=='function')return false;
    if(base.__importedInstallmentsSupport)return true;
    const wrapped=function(p,ym){
      const meta=importedMeta(p);
      if(meta){
        const d=diff(p.firstInvoiceYm,ym);
        if(!Number.isFinite(d)||d<0||d>=meta.remaining)return null;
        return{amount:meta.value,number:meta.current+d,total:meta.total};
      }
      return base(p,ym);
    };
    wrapped.__importedInstallmentsSupport=true;
    wrapped.__base=base;
    window.purchaseAllocation=wrapped;
    try{purchaseAllocation=wrapped}catch(e){}
    if(typeof renderAll==='function')setTimeout(()=>renderAll(),0);
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer)},250);
  }else{
    // purchase-management.js pode substituir purchaseAllocation depois deste arquivo.
    // Reaplica o suporte quando necessário.
    let tries=0;
    const timer=setInterval(()=>{tries++;install();if(tries>40)clearInterval(timer)},250);
  }
})();
