(function(){
  if(window.__purchaseSectionsLoaded)return;
  window.__purchaseSectionsLoaded=true;

  const STYLE_ID='purchase-sections-style';
  const GROUPS=[
    {key:'recorrentes',label:'Recorrentes',hint:'Cobranças que se repetem mensalmente'},
    {key:'parceladas',label:'Parceladas',hint:'Compras com duas ou mais parcelas'},
    {key:'unicas',label:'Únicas',hint:'Compras cobradas uma única vez'}
  ];

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #purchaseManagerBody .purchase-section-row td{padding:14px 12px 8px;border-bottom:1px solid #334155;background:#0b1220}
      .purchase-section-title{display:flex;align-items:center;gap:8px;font-weight:800;color:#e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:.055em}
      .purchase-section-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:#1e293b;color:#bfdbfe;font-size:10px;font-weight:800}
      .purchase-section-hint{margin-top:3px;color:#64748b;font-size:10px;text-transform:none;letter-spacing:0;font-weight:500}
    `;
    document.head.appendChild(style);
  }

  function installmentTotal(p){
    const imported=Number(p?.chatgptImport?.installmentTotal);
    if(Number.isFinite(imported)&&imported>0)return imported;
    const n=Number(p?.installments);
    return Number.isFinite(n)&&n>0?n:1;
  }

  function groupFor(p){
    if(!p)return'unicas';
    if(p.mode==='recorrente')return'recorrentes';
    if(p.openEnded===true)return'parceladas';
    return installmentTotal(p)>1?'parceladas':'unicas';
  }

  function purchaseIdFromRow(row){
    const button=row.querySelector('[data-id]');
    if(button?.dataset?.id)return button.dataset.id;
    const edit=row.querySelector('button[onclick*="editPurchase("]');
    const match=(edit?.getAttribute('onclick')||'').match(/editPurchase\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1]||null;
  }

  let observer=null;
  let observedBody=null;
  let scheduled=false;

  function regroup(){
    scheduled=false;
    injectStyles();
    const body=document.getElementById('purchaseManagerBody');
    if(!body||typeof state==='undefined'||!Array.isArray(state?.purchases))return;

    const rawRows=[...body.children].filter(el=>el.tagName==='TR'&&!el.classList.contains('purchase-section-row'));
    if(!rawRows.length)return;
    if(rawRows.length===1&&rawRows[0].querySelector('.empty'))return;

    const buckets={recorrentes:[],parceladas:[],unicas:[]};
    for(const row of rawRows){
      const id=purchaseIdFromRow(row);
      const purchase=id?state.purchases.find(p=>p.id===id):null;
      buckets[groupFor(purchase)].push(row);
    }

    observer?.disconnect();
    body.querySelectorAll('.purchase-section-row').forEach(row=>row.remove());
    for(const meta of GROUPS){
      const rows=buckets[meta.key];
      if(!rows.length)continue;
      const header=document.createElement('tr');
      header.className='purchase-section-row';
      header.dataset.purchaseSection=meta.key;
      header.innerHTML=`<td colspan="8"><div class="purchase-section-title">${meta.label}<span class="purchase-section-count">${rows.length}</span></div><div class="purchase-section-hint">${meta.hint}</div></td>`;
      body.appendChild(header);
      rows.forEach(row=>body.appendChild(row));
    }
    if(observer&&observedBody===body)observer.observe(body,{childList:true});
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(regroup);
  }

  function attach(){
    const body=document.getElementById('purchaseManagerBody');
    if(!body)return false;
    if(observedBody===body&&observer){schedule();return true}
    observer?.disconnect();
    observedBody=body;
    observer=new MutationObserver(schedule);
    observer.observe(body,{childList:true});
    schedule();
    return true;
  }

  function init(){
    injectStyles();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(attach()||tries>120)clearInterval(timer);
    },100);
    const bodyObserver=new MutationObserver(()=>{
      const body=document.getElementById('purchaseManagerBody');
      if(body&&body!==observedBody)attach();
    });
    bodyObserver.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
