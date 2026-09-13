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
      .invoice-purchase-groups{display:block}
      .invoice-purchase-group{margin-top:14px;border:1px solid #273449;border-radius:12px;overflow:hidden;background:#0b1220}
      .invoice-purchase-group-head{padding:10px 12px;background:#111827;border-bottom:1px solid #273449}
      .invoice-purchase-group .detail-line{margin:0;border-radius:0;border-left:0;border-right:0;border-top:0}
      .invoice-purchase-group .detail-line:last-child{border-bottom:0}
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

  function purchaseIdFromElement(el){
    const button=el.querySelector('[data-id]');
    if(button?.dataset?.id)return button.dataset.id;
    const edit=el.querySelector('button[onclick*="editPurchase("]');
    const match=(edit?.getAttribute('onclick')||'').match(/editPurchase\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1]||null;
  }

  function purchaseForElement(el){
    const id=purchaseIdFromElement(el);
    return id&&Array.isArray(state?.purchases)?state.purchases.find(p=>p.id===id):null;
  }

  let managerObserver=null;
  let observedManagerBody=null;
  let managerScheduled=false;

  function regroupManager(){
    managerScheduled=false;
    injectStyles();
    const body=document.getElementById('purchaseManagerBody');
    if(!body||typeof state==='undefined'||!Array.isArray(state?.purchases))return;

    const rawRows=[...body.children].filter(el=>el.tagName==='TR'&&!el.classList.contains('purchase-section-row'));
    if(!rawRows.length)return;
    if(rawRows.length===1&&rawRows[0].querySelector('.empty'))return;

    const buckets={recorrentes:[],parceladas:[],unicas:[]};
    for(const row of rawRows)buckets[groupFor(purchaseForElement(row))].push(row);

    managerObserver?.disconnect();
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
    if(managerObserver&&observedManagerBody===body)managerObserver.observe(body,{childList:true});
  }

  function scheduleManager(){
    if(managerScheduled)return;
    managerScheduled=true;
    requestAnimationFrame(regroupManager);
  }

  function attachManager(){
    const body=document.getElementById('purchaseManagerBody');
    if(!body)return false;
    if(observedManagerBody===body&&managerObserver){scheduleManager();return true}
    managerObserver?.disconnect();
    observedManagerBody=body;
    managerObserver=new MutationObserver(scheduleManager);
    managerObserver.observe(body,{childList:true});
    scheduleManager();
    return true;
  }

  let invoiceScheduled=false;

  function regroupInvoiceDetail(){
    invoiceScheduled=false;
    injectStyles();
    const host=document.getElementById('cardDetail');
    if(!host||typeof state==='undefined'||!Array.isArray(state?.purchases))return;

    const heading=[...host.querySelectorAll('.section-head h3')].find(h=>String(h.textContent||'').trim()==='Itens da fatura');
    const sectionHead=heading?.closest('.section-head');
    const card=sectionHead?.closest('.card');
    if(!sectionHead||!card)return;

    const existing=card.querySelector(':scope > .invoice-purchase-groups');
    if(existing)return;

    const rows=[...card.children].filter(el=>
      el.classList?.contains('detail-line')&&
      (el.querySelector('.purchase-desc')||el.querySelector('button[onclick*="editPurchase("]'))
    );
    if(!rows.length)return;

    const buckets={recorrentes:[],parceladas:[],unicas:[]};
    for(const row of rows)buckets[groupFor(purchaseForElement(row))].push(row);

    const container=document.createElement('div');
    container.className='invoice-purchase-groups';
    container.dataset.invoicePurchaseGroups='1';

    for(const meta of GROUPS){
      const items=buckets[meta.key];
      if(!items.length)continue;
      const group=document.createElement('div');
      group.className='invoice-purchase-group';
      group.dataset.purchaseSection=meta.key;
      const head=document.createElement('div');
      head.className='invoice-purchase-group-head';
      head.innerHTML=`<div class="purchase-section-title">${meta.label}<span class="purchase-section-count">${items.length}</span></div><div class="purchase-section-hint">${meta.hint}</div>`;
      group.appendChild(head);
      items.forEach(row=>group.appendChild(row));
      container.appendChild(group);
    }

    sectionHead.insertAdjacentElement('afterend',container);
  }

  function scheduleInvoice(){
    if(invoiceScheduled)return;
    invoiceScheduled=true;
    requestAnimationFrame(regroupInvoiceDetail);
  }

  function init(){
    injectStyles();

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(attachManager()||tries>120)clearInterval(timer);
    },100);

    const bodyObserver=new MutationObserver(()=>{
      const body=document.getElementById('purchaseManagerBody');
      if(body&&body!==observedManagerBody)attachManager();
    });
    bodyObserver.observe(document.body,{childList:true,subtree:true});

    const cardDetail=document.getElementById('cardDetail');
    if(cardDetail){
      const invoiceObserver=new MutationObserver(scheduleInvoice);
      invoiceObserver.observe(cardDetail,{childList:true,subtree:true});
      scheduleInvoice();
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
