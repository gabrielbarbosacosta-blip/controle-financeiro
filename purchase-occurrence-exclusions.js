(function(){
  if(window.__purchaseOccurrenceExclusionsLoaded)return;
  window.__purchaseOccurrenceExclusionsLoaded=true;

  const isExcluded=(p,ym)=>Array.isArray(p?.excludedInvoiceMonths)&&p.excludedInvoiceMonths.includes(ym);

  function preserveOnEdit(){
    const form=document.getElementById('purchaseForm');
    if(!form||form.dataset.exclusionPreserver==='1')return false;
    form.dataset.exclusionPreserver='1';
    form.addEventListener('submit',()=>{
      const id=document.getElementById('purchaseId')?.value||'';
      if(!id)return;
      const current=state?.purchases?.find(p=>p.id===id);
      const exclusions=Array.isArray(current?.excludedInvoiceMonths)?[...current.excludedInvoiceMonths]:[];
      if(!exclusions.length)return;
      setTimeout(()=>{
        const saved=state?.purchases?.find(p=>p.id===id);
        if(!saved)return;
        const merged=new Set([...(Array.isArray(saved.excludedInvoiceMonths)?saved.excludedInvoiceMonths:[]),...exclusions]);
        saved.excludedInvoiceMonths=[...merged].sort();
        if(typeof renderCards==='function')renderCards();
      },0);
    },true);
    return true;
  }

  let scheduled=false;
  function postProcessManager(){
    scheduled=false;
    const body=document.getElementById('purchaseManagerBody');
    if(!body||typeof state==='undefined')return;
    const ym=(typeof selectedInvoiceYm!=='undefined'&&selectedInvoiceYm)||state?.settings?.selectedMonth||'';
    const invoiceOnly=document.getElementById('purchaseManagerScope')?.value==='invoice';
    for(const row of [...body.children]){
      if(row.classList.contains('purchase-section-row'))continue;
      const button=row.querySelector('[data-id]');
      const id=button?.dataset?.id;
      if(!id)continue;
      const p=state.purchases.find(x=>x.id===id);
      const excluded=isExcluded(p,ym);
      row.style.display=invoiceOnly&&excluded?'none':'';
      const cells=row.querySelectorAll('td');
      if(cells[6]){
        if(excluded){cells[6].textContent='—';cells[6].title='Ocorrência removida desta fatura';}
        else cells[6].removeAttribute('title');
      }
    }
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(postProcessManager)}

  function init(){
    preserveOnEdit();
    const observer=new MutationObserver(()=>{preserveOnEdit();schedule()});
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('change',e=>{if(e.target?.id==='purchaseManagerScope')schedule()});
    schedule();
  }

  window.isPurchaseOccurrenceExcluded=isExcluded;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
