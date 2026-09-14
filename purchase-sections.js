(function(){
  if(window.__purchaseSectionsLoaded)return;
  window.__purchaseSectionsLoaded=true;

  const STYLE_ID='purchase-sections-style';
  const STORAGE_KEY='purchaseSectionsCollapsed:v2';
  const NAME_GROUPING_KEY='purchaseNameGrouping:v1';
  const NAME_COLLAPSED_KEY='purchaseNameGroupsCollapsed:v1';
  const GROUPS=[
    {key:'recorrentes',label:'Recorrentes',hint:'Cobranças que se repetem mensalmente'},
    {key:'parceladas',label:'Parceladas',hint:'Compras com duas ou mais parcelas'},
    {key:'unicas',label:'Únicas',hint:'Compras cobradas uma única vez'}
  ];

  function readJson(key,fallback={}){
    try{
      const value=JSON.parse(sessionStorage.getItem(key)||'null');
      return value===null?fallback:value;
    }catch(e){return fallback}
  }

  function writeJson(key,value){
    try{sessionStorage.setItem(key,JSON.stringify(value))}catch(e){}
  }

  function readCollapsed(){
    const value=readJson(STORAGE_KEY,{});
    return value&&typeof value==='object'?value:{};
  }

  // Recolhido por padrão; false significa que o usuário expandiu durante a sessão.
  function isCollapsed(key){return readCollapsed()[key]!==false}

  function setCollapsed(key,value){
    const current=readCollapsed();
    current[key]=!!value;
    writeJson(STORAGE_KEY,current);
  }

  function nameGroupingEnabled(){
    const stored=readJson(NAME_GROUPING_KEY,null);
    return stored===null?true:stored===true;
  }

  function setNameGroupingEnabled(value){writeJson(NAME_GROUPING_KEY,!!value)}

  function nameGroupCollapsedKey(sectionKey,nameKey){return `${sectionKey}|${nameKey}`}

  function isNameGroupCollapsed(sectionKey,nameKey){
    const current=readJson(NAME_COLLAPSED_KEY,{});
    return current[nameGroupCollapsedKey(sectionKey,nameKey)]!==false;
  }

  function setNameGroupCollapsed(sectionKey,nameKey,value){
    const current=readJson(NAME_COLLAPSED_KEY,{});
    current[nameGroupCollapsedKey(sectionKey,nameKey)]=!!value;
    writeJson(NAME_COLLAPSED_KEY,current);
  }

  function money(value){
    if(typeof fmtMoney==='function')return fmtMoney(Number(value)||0);
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  }

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #purchaseManagerBody .purchase-section-row td{padding:0;border-bottom:1px solid #334155;background:#0b1220}
      .purchase-section-toggle{width:100%;display:flex;align-items:center;gap:12px;padding:13px 16px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
      .purchase-section-toggle:hover{background:rgba(148,163,184,.055)}
      .purchase-section-toggle:focus-visible,.purchase-name-toggle:focus-visible{outline:2px solid #60a5fa;outline-offset:-2px}
      .purchase-section-copy{min-width:0;flex:1}
      .purchase-section-title{display:flex;align-items:center;gap:8px;font-weight:800;color:#e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:.055em}
      .purchase-section-count,.purchase-name-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:#1e293b;color:#bfdbfe;font-size:10px;font-weight:800}
      .purchase-section-total{flex:0 0 auto;white-space:nowrap;font-size:12px;font-weight:800;color:#e2e8f0;letter-spacing:0}
      .purchase-section-hint{margin-top:3px;color:#64748b;font-size:10px;text-transform:none;letter-spacing:0;font-weight:500}
      .purchase-section-chevron,.purchase-name-chevron{flex:0 0 auto;color:#94a3b8;font-size:15px;line-height:1;transition:transform .16s ease;transform:rotate(90deg)}
      .purchase-section-toggle[aria-expanded="false"] .purchase-section-chevron,.purchase-name-toggle[aria-expanded="false"] .purchase-name-chevron{transform:rotate(0deg)}
      .purchase-grouping-toggle{white-space:nowrap}
      .purchase-grouping-toggle.active{border-color:#3b82f6;background:rgba(59,130,246,.12);color:#bfdbfe}
      .invoice-purchase-groups{display:block;padding:0 10px}
      .invoice-purchase-group{margin-top:14px;border:1px solid #273449;border-radius:12px;overflow:hidden;background:#0b1220}
      .invoice-purchase-group-head{padding:0;background:#111827;border-bottom:1px solid #273449}
      .invoice-purchase-group.collapsed .invoice-purchase-group-head{border-bottom:0}
      .invoice-purchase-group .detail-line{margin:0 12px!important;padding-left:12px!important;padding-right:12px!important;border-radius:0;border-left:0;border-right:0;border-top:0}
      .invoice-purchase-group .detail-line:first-of-type{margin-top:4px!important}
      .invoice-purchase-group .detail-line:last-child{border-bottom:0;margin-bottom:4px!important}
      .invoice-purchase-group.collapsed .detail-line,.invoice-purchase-group.collapsed .purchase-name-group{display:none!important}
      .purchase-name-group{margin:7px 12px;border:1px solid #243244;border-radius:10px;overflow:hidden;background:#0d1625}
      .purchase-name-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;background:#101a2b;color:inherit;text-align:left;cursor:pointer;font:inherit}
      .purchase-name-toggle:hover{background:#142034}
      .purchase-name-copy{min-width:0;flex:1}
      .purchase-name-title{display:flex;align-items:center;gap:7px;min-width:0;font-size:12px;font-weight:750;color:#dbeafe}
      .purchase-name-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .purchase-name-total{flex:0 0 auto;font-size:12px;font-weight:800;color:#e2e8f0;white-space:nowrap}
      .purchase-name-group.collapsed .detail-line{display:none!important}
      .purchase-name-group .detail-line{margin-left:10px!important;margin-right:10px!important;background:rgba(15,23,42,.28)}
      #purchaseManagerBody tr[data-purchase-section-item] td:first-child{padding-left:26px}
      #purchaseManagerBody tr[data-purchase-section-item] td:last-child{padding-right:18px}
      #purchaseManagerBody tr.purchase-section-item-collapsed{display:none}
      #purchaseManagerBody .purchase-name-group-row td{padding:0 14px 0 24px;background:#0b1220;border-bottom:0}
      #purchaseManagerBody .purchase-name-group-row .purchase-name-toggle{border:1px solid #243244;border-radius:9px;margin:6px 0;padding:9px 11px}
      #purchaseManagerBody tr.purchase-name-item-hidden{display:none}
      #purchaseManagerBody tr.purchase-name-item td:first-child{padding-left:42px}
      @media(max-width:700px){
        .purchase-section-toggle{padding:12px 13px;gap:8px}
        .purchase-section-total,.purchase-name-total{font-size:11px}
        .invoice-purchase-groups{padding:0 4px}
        .invoice-purchase-group .detail-line{margin:0 8px!important;padding-left:8px!important;padding-right:8px!important}
        .purchase-name-group{margin:6px 8px}
        #purchaseManagerBody tr[data-purchase-section-item] td:first-child{padding-left:18px}
        #purchaseManagerBody tr.purchase-name-item td:first-child{padding-left:30px}
      }
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

  function normalizeName(value){
    return String(value||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function displayName(p){return String(p?.description||'Sem descrição').trim()||'Sem descrição'}

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

  function allocationAmount(p,ym){
    const allocator=window.purchaseAllocation||(typeof purchaseAllocation==='function'?purchaseAllocation:null);
    if(typeof allocator!=='function'||!p||!ym)return 0;
    try{
      const alloc=allocator(p,ym);
      const value=Number(alloc&&typeof alloc==='object'?alloc.amount:alloc);
      return Number.isFinite(value)?value:0;
    }catch(e){return 0}
  }

  function purchaseListedValue(p){
    if(!p)return 0;
    if(p.mode==='recorrente'||p.openEnded===true){
      const monthly=Number(p.installmentValue??p.totalAmount);
      return Number.isFinite(monthly)?monthly:0;
    }
    const total=Number(p.totalAmount);
    return Number.isFinite(total)?total:0;
  }

  function sumPurchases(purchases,{invoiceMonth=null,allPurchases=false}={}){
    return purchases.reduce((sum,p)=>sum+(allPurchases?purchaseListedValue(p):allocationAmount(p,invoiceMonth)),0);
  }

  function nameBuckets(entries){
    const map=new Map();
    for(const entry of entries){
      const key=normalizeName(displayName(entry.purchase))||`id:${entry.purchase?.id||Math.random()}`;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(entry);
    }
    return [...map.entries()].map(([key,items])=>({key,items}));
  }

  function toggleMarkup(meta,count,total,collapsed){
    return `<button type="button" class="purchase-section-toggle" aria-expanded="${collapsed?'false':'true'}" data-section-toggle="${meta.key}">
      <span class="purchase-section-copy"><span class="purchase-section-title">${meta.label}<span class="purchase-section-count">${count}</span></span><span class="purchase-section-hint">${meta.hint}</span></span>
      <span class="purchase-section-total">${money(total)}</span>
      <span class="purchase-section-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function nameToggleMarkup(sectionKey,nameKey,label,count,total,collapsed){
    return `<button type="button" class="purchase-name-toggle" aria-expanded="${collapsed?'false':'true'}" data-name-group="${esc(nameKey)}" data-name-section="${esc(sectionKey)}">
      <span class="purchase-name-copy"><span class="purchase-name-title"><span class="purchase-name-label">${esc(label)}</span><span class="purchase-name-count">${count}</span></span></span>
      <span class="purchase-name-total">${money(total)}</span>
      <span class="purchase-name-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function ensureGroupingControls(){
    const invoiceHeading=[...document.querySelectorAll('#cardDetail .section-head h3')].find(h=>String(h.textContent||'').trim()==='Itens da fatura');
    const invoiceHead=invoiceHeading?.closest('.section-head');
    if(invoiceHead&&!invoiceHead.querySelector('.purchase-grouping-toggle')){
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn small purchase-grouping-toggle';btn.textContent='Agrupar nomes iguais';
      const right=invoiceHead.querySelector('.toolbar')||invoiceHead.lastElementChild;
      if(right&&right!==invoiceHeading?.parentElement)right.appendChild(btn);else invoiceHead.appendChild(btn);
      btn.onclick=()=>toggleGrouping();
    }
    const managerToolbar=document.querySelector('#purchaseManagerModal .toolbar');
    if(managerToolbar&&!managerToolbar.querySelector('.purchase-grouping-toggle')){
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn small purchase-grouping-toggle';btn.textContent='Agrupar nomes iguais';
      managerToolbar.appendChild(btn);btn.onclick=()=>toggleGrouping();
    }
    document.querySelectorAll('.purchase-grouping-toggle').forEach(btn=>{
      const on=nameGroupingEnabled();
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.title=on?'Clique para mostrar cada compra separadamente':'Clique para agrupar compras com o mesmo nome';
    });
  }

  function toggleGrouping(){
    setNameGroupingEnabled(!nameGroupingEnabled());
    ensureGroupingControls();
    regroupManager();
    const existing=document.querySelector('#cardDetail .invoice-purchase-groups');
    if(existing){
      const card=existing.closest('.card');
      const rows=[];
      existing.querySelectorAll('.detail-line').forEach(row=>rows.push(row));
      existing.remove();
      if(card)rows.forEach(row=>card.appendChild(row));
    }
    scheduleInvoice();
  }

  let managerObserver=null;
  let observedManagerBody=null;
  let managerScheduled=false;

  function applyManagerCollapsed(body,key,collapsed){
    body.querySelectorAll(`tr[data-purchase-section-item="${key}"]`).forEach(row=>row.classList.toggle('purchase-section-item-collapsed',collapsed));
    body.querySelectorAll(`tr.purchase-name-group-row[data-purchase-section-item="${key}"]`).forEach(row=>row.classList.toggle('purchase-section-item-collapsed',collapsed));
    const btn=body.querySelector(`.purchase-section-row[data-purchase-section="${key}"] .purchase-section-toggle`);
    if(btn)btn.setAttribute('aria-expanded',collapsed?'false':'true');
  }

  function applyManagerNameCollapsed(body,sectionKey,nameKey,collapsed){
    body.querySelectorAll(`tr.purchase-name-item[data-name-section="${CSS.escape(sectionKey)}"][data-name-group="${CSS.escape(nameKey)}"]`).forEach(row=>row.classList.toggle('purchase-name-item-hidden',collapsed));
    const btn=[...body.querySelectorAll('.purchase-name-toggle')].find(b=>b.dataset.nameSection===sectionKey&&b.dataset.nameGroup===nameKey);
    if(btn)btn.setAttribute('aria-expanded',collapsed?'false':'true');
  }

  function regroupManager(){
    managerScheduled=false;
    injectStyles();
    ensureGroupingControls();
    const body=document.getElementById('purchaseManagerBody');
    if(!body||typeof state==='undefined'||!Array.isArray(state?.purchases))return;

    const rawRows=[...body.children].filter(el=>el.tagName==='TR'&&!el.classList.contains('purchase-section-row')&&!el.classList.contains('purchase-name-group-row'));
    if(!rawRows.length)return;
    if(rawRows.length===1&&rawRows[0].querySelector('.empty'))return;

    const buckets={recorrentes:[],parceladas:[],unicas:[]};
    for(const row of rawRows){
      row.classList.remove('purchase-section-item-collapsed','purchase-name-item','purchase-name-item-hidden');
      delete row.dataset.purchaseSectionItem;delete row.dataset.nameGroup;delete row.dataset.nameSection;
      const purchase=purchaseForElement(row);
      buckets[groupFor(purchase)].push({row,purchase});
    }

    const ym=(typeof selectedInvoiceYm!=='undefined'&&selectedInvoiceYm)||state?.settings?.selectedMonth||'';
    const scope=document.getElementById('purchaseManagerScope')?.value||'all';
    const grouping=nameGroupingEnabled();
    managerObserver?.disconnect();
    body.querySelectorAll('.purchase-section-row,.purchase-name-group-row').forEach(row=>row.remove());
    for(const meta of GROUPS){
      const entries=buckets[meta.key];
      if(!entries.length)continue;
      const collapsed=isCollapsed(meta.key);
      const purchases=entries.map(x=>x.purchase).filter(Boolean);
      const total=sumPurchases(purchases,{invoiceMonth:ym,allPurchases:scope!=='invoice'});
      const header=document.createElement('tr');
      header.className='purchase-section-row';header.dataset.purchaseSection=meta.key;
      header.innerHTML=`<td colspan="8">${toggleMarkup(meta,entries.length,total,collapsed)}</td>`;
      body.appendChild(header);

      const groups=grouping?nameBuckets(entries):entries.map((item,i)=>({key:`single:${i}`,items:[item]}));
      for(const ng of groups){
        const duplicate=grouping&&ng.items.length>1;
        if(duplicate){
          const ngCollapsed=isNameGroupCollapsed(meta.key,ng.key);
          const ngPurchases=ng.items.map(x=>x.purchase).filter(Boolean);
          const ngTotal=sumPurchases(ngPurchases,{invoiceMonth:ym,allPurchases:scope!=='invoice'});
          const groupRow=document.createElement('tr');
          groupRow.className='purchase-name-group-row';
          groupRow.dataset.purchaseSectionItem=meta.key;
          groupRow.dataset.purchaseSection=meta.key;
          groupRow.innerHTML=`<td colspan="8">${nameToggleMarkup(meta.key,ng.key,displayName(ng.items[0].purchase),ng.items.length,ngTotal,ngCollapsed)}</td>`;
          groupRow.classList.toggle('purchase-section-item-collapsed',collapsed);
          body.appendChild(groupRow);
          groupRow.querySelector('.purchase-name-toggle').onclick=()=>{
            const next=!isNameGroupCollapsed(meta.key,ng.key);
            setNameGroupCollapsed(meta.key,ng.key,next);
            applyManagerNameCollapsed(body,meta.key,ng.key,next);
            document.querySelectorAll('.purchase-name-group').forEach(group=>{
              if(group.dataset.nameSection===meta.key&&group.dataset.nameGroup===ng.key)applyInvoiceNameCollapsed(group,meta.key,ng.key,next);
            });
          };
          ng.items.forEach(({row})=>{
            row.dataset.purchaseSectionItem=meta.key;row.dataset.nameSection=meta.key;row.dataset.nameGroup=ng.key;
            row.classList.add('purchase-name-item');
            row.classList.toggle('purchase-name-item-hidden',ngCollapsed);
            row.classList.toggle('purchase-section-item-collapsed',collapsed);
            body.appendChild(row);
          });
        }else{
          const {row}=ng.items[0];
          row.dataset.purchaseSectionItem=meta.key;
          row.classList.toggle('purchase-section-item-collapsed',collapsed);
          body.appendChild(row);
        }
      }
      header.querySelector('.purchase-section-toggle').onclick=()=>{
        const next=!isCollapsed(meta.key);
        setCollapsed(meta.key,next);
        applyManagerCollapsed(body,meta.key,next);
        document.querySelectorAll(`.invoice-purchase-group[data-purchase-section="${meta.key}"]`).forEach(group=>applyInvoiceCollapsed(group,meta.key,next));
      };
    }
    if(managerObserver&&observedManagerBody===body)managerObserver.observe(body,{childList:true});
  }

  function scheduleManager(){if(!managerScheduled){managerScheduled=true;requestAnimationFrame(regroupManager)}}

  function attachManager(){
    const body=document.getElementById('purchaseManagerBody');
    if(!body)return false;
    if(observedManagerBody===body&&managerObserver){scheduleManager();return true}
    managerObserver?.disconnect();observedManagerBody=body;
    managerObserver=new MutationObserver(scheduleManager);managerObserver.observe(body,{childList:true});scheduleManager();return true;
  }

  let invoiceScheduled=false;

  function applyInvoiceCollapsed(group,key,collapsed){
    if(!group)return;group.classList.toggle('collapsed',collapsed);
    const btn=group.querySelector(':scope > .invoice-purchase-group-head .purchase-section-toggle');
    if(btn)btn.setAttribute('aria-expanded',collapsed?'false':'true');
  }

  function applyInvoiceNameCollapsed(group,sectionKey,nameKey,collapsed){
    if(!group)return;group.classList.toggle('collapsed',collapsed);
    const btn=group.querySelector('.purchase-name-toggle');
    if(btn)btn.setAttribute('aria-expanded',collapsed?'false':'true');
  }

  function regroupInvoiceDetail(){
    invoiceScheduled=false;injectStyles();ensureGroupingControls();
    const host=document.getElementById('cardDetail');
    if(!host||typeof state==='undefined'||!Array.isArray(state?.purchases))return;
    const heading=[...host.querySelectorAll('.section-head h3')].find(h=>String(h.textContent||'').trim()==='Itens da fatura');
    const sectionHead=heading?.closest('.section-head');const card=sectionHead?.closest('.card');
    if(!sectionHead||!card)return;
    const existing=card.querySelector(':scope > .invoice-purchase-groups');if(existing)return;
    const rows=[...card.children].filter(el=>el.classList?.contains('detail-line')&&(el.querySelector('.purchase-desc')||el.querySelector('button[onclick*="editPurchase("]')));
    if(!rows.length)return;

    const buckets={recorrentes:[],parceladas:[],unicas:[]};
    for(const row of rows){const purchase=purchaseForElement(row);buckets[groupFor(purchase)].push({row,purchase})}
    const ym=(typeof selectedInvoiceYm!=='undefined'&&selectedInvoiceYm)||state?.settings?.selectedMonth||'';
    const grouping=nameGroupingEnabled();
    const container=document.createElement('div');container.className='invoice-purchase-groups';container.dataset.invoicePurchaseGroups='1';

    for(const meta of GROUPS){
      const entries=buckets[meta.key];if(!entries.length)continue;
      const collapsed=isCollapsed(meta.key);const purchases=entries.map(x=>x.purchase).filter(Boolean);
      const total=sumPurchases(purchases,{invoiceMonth:ym,allPurchases:false});
      const group=document.createElement('div');group.className='invoice-purchase-group';group.dataset.purchaseSection=meta.key;
      const head=document.createElement('div');head.className='invoice-purchase-group-head';head.innerHTML=toggleMarkup(meta,entries.length,total,collapsed);group.appendChild(head);

      const groups=grouping?nameBuckets(entries):entries.map((item,i)=>({key:`single:${i}`,items:[item]}));
      for(const ng of groups){
        const duplicate=grouping&&ng.items.length>1;
        if(duplicate){
          const ngCollapsed=isNameGroupCollapsed(meta.key,ng.key);
          const ngPurchases=ng.items.map(x=>x.purchase).filter(Boolean);
          const ngTotal=sumPurchases(ngPurchases,{invoiceMonth:ym,allPurchases:false});
          const nameGroup=document.createElement('div');nameGroup.className='purchase-name-group';nameGroup.dataset.nameSection=meta.key;nameGroup.dataset.nameGroup=ng.key;
          nameGroup.innerHTML=nameToggleMarkup(meta.key,ng.key,displayName(ng.items[0].purchase),ng.items.length,ngTotal,ngCollapsed);
          ng.items.forEach(({row})=>nameGroup.appendChild(row));
          applyInvoiceNameCollapsed(nameGroup,meta.key,ng.key,ngCollapsed);
          nameGroup.querySelector('.purchase-name-toggle').onclick=()=>{
            const next=!isNameGroupCollapsed(meta.key,ng.key);setNameGroupCollapsed(meta.key,ng.key,next);
            document.querySelectorAll('.purchase-name-group').forEach(item=>{if(item.dataset.nameSection===meta.key&&item.dataset.nameGroup===ng.key)applyInvoiceNameCollapsed(item,meta.key,ng.key,next)});
            const manager=document.getElementById('purchaseManagerBody');if(manager)applyManagerNameCollapsed(manager,meta.key,ng.key,next);
          };
          group.appendChild(nameGroup);
        }else group.appendChild(ng.items[0].row);
      }

      applyInvoiceCollapsed(group,meta.key,collapsed);
      head.querySelector('.purchase-section-toggle').onclick=()=>{
        const next=!isCollapsed(meta.key);setCollapsed(meta.key,next);
        document.querySelectorAll(`.invoice-purchase-group[data-purchase-section="${meta.key}"]`).forEach(item=>applyInvoiceCollapsed(item,meta.key,next));
        const manager=document.getElementById('purchaseManagerBody');if(manager)applyManagerCollapsed(manager,meta.key,next);
      };
      container.appendChild(group);
    }
    sectionHead.insertAdjacentElement('afterend',container);
  }

  function scheduleInvoice(){if(!invoiceScheduled){invoiceScheduled=true;requestAnimationFrame(regroupInvoiceDetail)}}

  function init(){
    injectStyles();ensureGroupingControls();
    let tries=0;const timer=setInterval(()=>{tries++;ensureGroupingControls();if(attachManager()||tries>120)clearInterval(timer)},100);
    const bodyObserver=new MutationObserver(()=>{ensureGroupingControls();const body=document.getElementById('purchaseManagerBody');if(body&&body!==observedManagerBody)attachManager()});
    bodyObserver.observe(document.body,{childList:true,subtree:true});
    const cardDetail=document.getElementById('cardDetail');
    if(cardDetail){const invoiceObserver=new MutationObserver(()=>{ensureGroupingControls();scheduleInvoice()});invoiceObserver.observe(cardDetail,{childList:true,subtree:true});scheduleInvoice()}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
