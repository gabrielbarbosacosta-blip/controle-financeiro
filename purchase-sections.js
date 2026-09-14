(function(){
  if(window.__purchaseSectionsLoaded)return;
  window.__purchaseSectionsLoaded=true;

  const STYLE_ID='purchase-sections-style';
  const STORAGE_KEY='purchaseSectionsCollapsed:v1';
  const GROUPS=[
    {key:'recorrentes',label:'Recorrentes',hint:'Cobranças que se repetem mensalmente'},
    {key:'parceladas',label:'Parceladas',hint:'Compras com duas ou mais parcelas'},
    {key:'unicas',label:'Únicas',hint:'Compras cobradas uma única vez'}
  ];

  function readCollapsed(){
    try{
      const value=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'{}');
      return value&&typeof value==='object'?value:{};
    }catch(e){return{}}
  }

  function isCollapsed(key){return readCollapsed()[key]===true}

  function setCollapsed(key,value){
    const current=readCollapsed();
    current[key]=!!value;
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(current))}catch(e){}
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #purchaseManagerBody .purchase-section-row td{padding:0;border-bottom:1px solid #334155;background:#0b1220}
      .purchase-section-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:12px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
      .purchase-section-toggle:hover{background:rgba(148,163,184,.055)}
      .purchase-section-toggle:focus-visible{outline:2px solid #60a5fa;outline-offset:-2px}
      .purchase-section-copy{min-width:0;flex:1}
      .purchase-section-title{display:flex;align-items:center;gap:8px;font-weight:800;color:#e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:.055em}
      .purchase-section-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:#1e293b;color:#bfdbfe;font-size:10px;font-weight:800}
      .purchase-section-hint{margin-top:3px;color:#64748b;font-size:10px;text-transform:none;letter-spacing:0;font-weight:500}
      .purchase-section-chevron{flex:0 0 auto;color:#94a3b8;font-size:15px;line-height:1;transition:transform .16s ease;transform:rotate(90deg)}
      .purchase-section-toggle[aria-expanded="false"] .purchase-section-chevron{transform:rotate(0deg)}
      .invoice-purchase-groups{display:block}
      .invoice-purchase-group{margin-top:14px;border:1px solid #273449;border-radius:12px;overflow:hidden;background:#0b1220}
      .invoice-purchase-group-head{padding:0;background:#111827;border-bottom:1px solid #273449}
      .invoice-purchase-group.collapsed .invoice-purchase-group-head{border-bottom:0}
      .invoice-purchase-group .detail-line{margin:0;border-radius:0;border-left:0;border-right:0;border-top:0}
      .invoice-purchase-group .detail-line:last-child{border-bottom:0}
      .invoice-purchase-group.collapsed .detail-line{display:none!important}
      #purchaseManagerBody tr.purchase-section-item-collapsed{display:none}
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

  function toggleMarkup(meta,count,collapsed){
    return `<button type="button" class="purchase-section-toggle" aria-expanded="${collapsed?'false':'true'}" data-section-toggle="${meta.key}">
      <span class="purchase-section-copy"><span class="purchase-section-title">${meta.label}<span class="purchase-section-count">${count}</span></span><span class="purchase-section-hint">${meta.hint}</span></span>
      <span class="purchase-section-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  let managerObserver=null;
  let observedManagerBody=null;
  let managerScheduled=false;

  function applyManagerCollapsed(body,key,collapsed){
    body.querySelectorAll(`tr[data-purchase-section-item="${key}"]`).forEach(row=>row.classList.toggle('purchase-section-item-collapsed',collapsed));
    const btn=body.querySelector(`.purchase-section-row[data-purchase-section="${key}"] .purchase-section-toggle`);
    if(btn)btn.setAttribute('aria-expanded',collapsed?'false':'true');
  }

  function regroupManager(){
    managerScheduled=false;
    injectStyles();
    const body=document.getElementById('purchaseManagerBody');
    if(!body||typeof state==='undefined'||!Array.isArray(state?.purchases))return;

    const rawRows=[...body.children].filter(el=>el.tagName==='TR'&&!el.classList.contains('purchase-section-row'));
    if(!rawRows.length)return;
    if(rawRows.length===1&&rawRows[0].querySelector('.empty'))return;

    const buckets={recorrentes:[],parceladas:[],unicas:[]};
    for(const row of rawRows){
      row.classList.remove('purchase-section-item-collapsed');
      delete row.dataset.purchaseSectionItem;
      buckets[groupFor(purchaseForElement(row))].push(row);
    }

    managerObserver?.disconnect();
    body.querySelectorAll('.purchase-section-row').forEach(row=>row.remove());
    for(const meta of GROUPS){
      const rows=buckets[meta.key];
      if(!rows.length)continue;
      const collapsed=isCollapsed(meta.key);
      const header=document.createElement('tr');
      header.className='purchase-section-row';
      header.dataset.purchaseSection=meta.key;
      header.innerHTML=`<td colspan="8">${toggleMarkup(meta,rows.length,collapsed)}</td>`;
      body.appendChild(header);
      rows.forEach(row=>{
        row.dataset.purchaseSectionItem=meta.key;
        row.classList.toggle('purchase-section-item-collapsed',collapsed);
        body.appendChild(row);
      });
      header.querySelector('.purchase-section-toggle').onclick=()=>{
        const next=!isCollapsed(meta.key);
        setCollapsed(meta.key,next);
        applyManagerCollapsed(body,meta.key,next);
        document.querySelectorAll(`.invoice-purchase-group[data-purchase-section="${meta.key}"]`).forEach(group=>applyInvoiceCollapsed(group,meta.key,next));
      };
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

  function applyInvoiceCollapsed(group,key,collapsed){
    if(!group)return;
    group.classList.toggle('collapsed',collapsed);
    const btn=group.querySelector('.purchase-section-toggle');
    if(btn)btn.setAttribute('aria-expanded',collapsed?'false':'true');
  }

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
      const collapsed=isCollapsed(meta.key);
      const group=document.createElement('div');
      group.className='invoice-purchase-group';
      group.dataset.purchaseSection=meta.key;
      const head=document.createElement('div');
      head.className='invoice-purchase-group-head';
      head.innerHTML=toggleMarkup(meta,items.length,collapsed);
      group.appendChild(head);
      items.forEach(row=>group.appendChild(row));
      applyInvoiceCollapsed(group,meta.key,collapsed);
      head.querySelector('.purchase-section-toggle').onclick=()=>{
        const next=!isCollapsed(meta.key);
        setCollapsed(meta.key,next);
        document.querySelectorAll(`.invoice-purchase-group[data-purchase-section="${meta.key}"]`).forEach(item=>applyInvoiceCollapsed(item,meta.key,next));
        const manager=document.getElementById('purchaseManagerBody');
        if(manager)applyManagerCollapsed(manager,meta.key,next);
      };
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
