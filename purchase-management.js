(function(){
  let reopenAfterEdit=false;
  let managerCardId=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function month(v){return typeof fmtMonth==='function'?fmtMonth(v):v}

  function purchaseEndMonth(p){
    if(p.mode==='recorrente')return p.recurringEnd||null;
    const n=Math.max(1,Number(p.installments)||1);
    return typeof ymAdd==='function'?ymAdd(p.firstInvoiceYm,n-1):p.firstInvoiceYm;
  }

  function termLabel(p){
    if(p.mode==='recorrente')return p.recurringEnd?`Mensal até ${month(p.recurringEnd)}`:'Mensal • sem data final';
    const n=Math.max(1,Number(p.installments)||1),end=purchaseEndMonth(p);
    return n===1?'À vista':`${n}x • ${month(p.firstInvoiceYm)} a ${month(end)}`;
  }

  function deletePurchase(id){
    const p=state.purchases.find(x=>x.id===id);if(!p)return;
    if(!confirm(`Excluir a compra "${p.description}"?${Number(p.installments)>1?' Todas as parcelas futuras também serão removidas.':''}`))return;
    state.purchases=state.purchases.filter(x=>x.id!==id);
    if(typeof renderAll==='function')renderAll();else if(typeof save==='function')save();
    renderManager();
  }

  function editManagedPurchase(id){
    const p=state.purchases.find(x=>x.id===id);if(!p)return;
    managerCardId=p.cardId;
    reopenAfterEdit=true;
    closeManager();
    if(typeof editPurchase==='function')editPurchase(id);else if(typeof window.editPurchase==='function')window.editPurchase(id);
  }

  function goToPurchase(id){
    const p=state.purchases.find(x=>x.id===id);if(!p)return;
    selectedCardId=p.cardId;
    selectedInvoiceYm=p.firstInvoiceYm;
    closeManager();
    if(typeof renderCards==='function')renderCards();
  }

  function buildManager(){
    if(document.getElementById('purchaseManagerModal'))return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="modal-backdrop" id="purchaseManagerModal"><div class="modal" style="max-width:1050px"><div class="modal-head"><div><h3>Gerenciar compras do cartão</h3><div class="muted" id="purchaseManagerSubtitle"></div></div><button type="button" class="btn ghost" id="purchaseManagerClose">✕</button></div><div class="modal-body"><div class="toolbar" style="gap:10px;flex-wrap:wrap"><input id="purchaseManagerSearch" placeholder="Buscar compra..." style="min-width:240px"><select id="purchaseManagerScope"><option value="all">Todas as compras do cartão</option><option value="invoice">Somente itens da fatura selecionada</option></select><button class="btn primary" type="button" id="purchaseManagerAdd">+ Nova compra</button></div><div class="notice" id="purchaseManagerNotice" style="margin-top:12px">Editar prazo, número de parcelas ou primeira fatura pode mover a compra para outra competência. Ela continuará disponível nesta gestão geral.</div><div class="table-scroll" style="margin-top:14px"><table class="data-table"><thead><tr><th>Compra</th><th>Data</th><th>Primeira fatura</th><th>Prazo</th><th class="num">Valor total</th><th class="num">Nesta fatura</th><th>Ações</th></tr></thead><tbody id="purchaseManagerBody"></tbody></table></div></div></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('purchaseManagerClose').onclick=closeManager;
    document.getElementById('purchaseManagerModal').addEventListener('click',e=>{if(e.target.id==='purchaseManagerModal')closeManager()});
    document.getElementById('purchaseManagerSearch').addEventListener('input',renderManager);
    document.getElementById('purchaseManagerScope').addEventListener('change',renderManager);
    document.getElementById('purchaseManagerAdd').onclick=()=>{const cid=managerCardId||selectedCardId,ym=selectedInvoiceYm||state.settings.selectedMonth;closeManager();openPurchaseModal(cid,ym)};
  }

  function openManager(cardId=selectedCardId){
    buildManager();
    managerCardId=cardId||selectedCardId||state.cards[0]?.id||null;
    document.getElementById('purchaseManagerModal').classList.add('open');
    renderManager();
  }
  function closeManager(){document.getElementById('purchaseManagerModal')?.classList.remove('open')}

  function renderManager(){
    const body=document.getElementById('purchaseManagerBody');if(!body)return;
    const card=typeof getCard==='function'?getCard(managerCardId):state.cards.find(c=>c.id===managerCardId);
    const ym=selectedInvoiceYm||state.settings.selectedMonth;
    const q=(document.getElementById('purchaseManagerSearch')?.value||'').trim().toLowerCase();
    const scope=document.getElementById('purchaseManagerScope')?.value||'all';
    let rows=state.purchases.filter(p=>p.cardId===managerCardId);
    if(scope==='invoice'&&typeof purchaseAllocation==='function')rows=rows.filter(p=>purchaseAllocation(p,ym));
    if(q)rows=rows.filter(p=>`${p.description||''} ${p.category||''} ${p.notes||''}`.toLowerCase().includes(q));
    rows=[...rows].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.description||'').localeCompare(String(b.description||'')));
    const sub=document.getElementById('purchaseManagerSubtitle');if(sub)sub.textContent=`${card?.name||'Cartão'} • ${rows.length} compra(s) • fatura em foco: ${month(ym)}`;
    body.innerHTML=rows.length?rows.map(p=>{
      const alloc=typeof purchaseAllocation==='function'?purchaseAllocation(p,ym):null;
      return `<tr><td><strong>${esc(p.description||'Sem descrição')}</strong><div class="muted">${esc(p.category||'Outros')}${p.notes?` • ${esc(p.notes)}`:''}</div></td><td>${esc(p.date||'—')}</td><td>${month(p.firstInvoiceYm)}</td><td>${esc(termLabel(p))}</td><td class="num">${money(p.totalAmount)}</td><td class="num">${alloc?money(alloc.amount):'<span class="muted">—</span>'}</td><td style="white-space:nowrap"><button class="btn small pm-edit" data-id="${esc(p.id)}">Editar</button> <button class="btn small pm-go" data-id="${esc(p.id)}">Ver fatura</button> <button class="btn small danger pm-delete" data-id="${esc(p.id)}">Excluir</button></td></tr>`;
    }).join(''):'<tr><td colspan="7" class="empty">Nenhuma compra encontrada.</td></tr>';
    body.querySelectorAll('.pm-edit').forEach(b=>b.onclick=()=>editManagedPurchase(b.dataset.id));
    body.querySelectorAll('.pm-go').forEach(b=>b.onclick=()=>goToPurchase(b.dataset.id));
    body.querySelectorAll('.pm-delete').forEach(b=>b.onclick=()=>deletePurchase(b.dataset.id));
  }

  function enhanceInvoiceItems(){
    const tools=document.querySelector('#cardDetail .invoice-tools');
    if(tools&&!document.getElementById('manageCardPurchasesBtn')){
      const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.id='manageCardPurchasesBtn';btn.textContent='Gerenciar compras';btn.onclick=()=>openManager(selectedCardId);tools.insertBefore(btn,tools.lastElementChild);
    }
    document.querySelectorAll('#cardDetail button[onclick*="editPurchase("]').forEach(edit=>{
      const holder=edit.parentElement;if(!holder||holder.querySelector('.purchase-delete-inline'))return;
      const code=edit.getAttribute('onclick')||'',m=code.match(/editPurchase\(['\"]([^'\"]+)['\"]\)/);if(!m)return;
      const del=document.createElement('button');del.type='button';del.className='btn small danger purchase-delete-inline';del.textContent='Excluir';del.style.marginLeft='5px';del.onclick=()=>deletePurchase(m[1]);holder.appendChild(del);
    });
  }

  const baseRender=window.renderCardDetail;
  if(typeof baseRender==='function')window.renderCardDetail=function(){const r=baseRender.apply(this,arguments);enhanceInvoiceItems();return r};

  const form=document.getElementById('purchaseForm');
  if(form)form.addEventListener('submit',()=>{if(!reopenAfterEdit)return;reopenAfterEdit=false;setTimeout(()=>openManager(managerCardId),120)});

  buildManager();
  enhanceInvoiceItems();
  window.openPurchaseManager=openManager;
})();