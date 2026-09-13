(function(){
  let reopenAfterEdit=false;
  let managerCardId=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function month(v){return typeof fmtMonth==='function'?fmtMonth(v):v}
  function round(v){return typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100}

  function installmentValue(p){
    if(p.mode==='recorrente')return Number(p.totalAmount)||0;
    const n=Math.max(1,Number(p.installments)||1);
    if(typeof installmentAmount==='function')return installmentAmount(p,0);
    return round((Number(p.totalAmount)||0)/n);
  }

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

  function enhancePurchaseForm(){
    const form=document.getElementById('purchaseForm');
    if(!form)return;
    const amount=document.getElementById('purchaseAmount');
    const installments=document.getElementById('purchaseInstallments');
    const installmentsField=document.getElementById('installmentsField');
    if(!amount||!installments||!installmentsField)return;

    if(!document.getElementById('purchaseInstallmentValueField')){
      const field=document.createElement('div');
      field.className='field';
      field.id='purchaseInstallmentValueField';
      field.innerHTML='<label>Valor da parcela (R$)</label><input id="purchaseInstallmentValue" type="number" step="0.01" readonly tabindex="-1"><small class="muted">Calculado automaticamente pelo valor total ÷ parcelas.</small>';
      installmentsField.insertAdjacentElement('afterend',field);
    }

    function sync(){
      const mode=document.getElementById('purchaseMode')?.value||'parcelada';
      const total=Number(amount.value)||0;
      const n=Math.max(1,Number(installments.value)||1);
      const value=document.getElementById('purchaseInstallmentValue');
      const field=document.getElementById('purchaseInstallmentValueField');
      if(mode==='recorrente'){
        if(field)field.style.display='none';
        return;
      }
      if(field)field.style.display='grid';
      if(value)value.value=round(total/n).toFixed(2);
      const label=document.getElementById('purchaseAmountLabel');
      if(label)label.textContent='Valor total (R$)';
    }

    amount.addEventListener('input',sync);
    installments.addEventListener('input',sync);
    document.getElementById('purchaseMode')?.addEventListener('change',()=>setTimeout(sync,0));

    const baseOpen=window.openPurchaseModal;
    if(typeof baseOpen==='function'&&!baseOpen.__pmEnhanced){
      const wrapped=function(){const r=baseOpen.apply(this,arguments);setTimeout(sync,0);return r};
      wrapped.__pmEnhanced=true;
      window.openPurchaseModal=wrapped;
      try{openPurchaseModal=wrapped}catch(e){}
    }
    const baseEdit=window.editPurchase;
    if(typeof baseEdit==='function'&&!baseEdit.__pmEnhanced){
      const wrapped=function(){const r=baseEdit.apply(this,arguments);setTimeout(sync,0);return r};
      wrapped.__pmEnhanced=true;
      window.editPurchase=wrapped;
      try{editPurchase=wrapped}catch(e){}
    }
    sync();
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
    if(typeof window.editPurchase==='function')window.editPurchase(id);
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
    wrap.innerHTML=`<div class="modal-backdrop" id="purchaseManagerModal"><div class="modal" style="max-width:1150px"><div class="modal-head"><div><h3>Gerenciar compras do cartão</h3><div class="muted" id="purchaseManagerSubtitle"></div></div><button type="button" class="btn ghost" id="purchaseManagerClose">✕</button></div><div class="modal-body"><div class="toolbar" style="gap:10px;flex-wrap:wrap"><input id="purchaseManagerSearch" placeholder="Buscar compra..." style="min-width:240px"><select id="purchaseManagerScope"><option value="all">Todas as compras do cartão</option><option value="invoice">Somente itens da fatura selecionada</option></select><button class="btn primary" type="button" id="purchaseManagerAdd">+ Nova compra</button></div><div class="notice" id="purchaseManagerNotice" style="margin-top:12px">Cada compra mantém três valores centrais: <strong>valor total</strong>, <strong>parcelas</strong> e <strong>valor da parcela</strong>. Ao editar o prazo, a compra pode mudar de fatura, mas permanece nesta gestão geral.</div><div class="table-scroll" style="margin-top:14px"><table class="data-table"><thead><tr><th>Compra</th><th>Data</th><th>Primeira fatura</th><th class="num">Valor total</th><th class="num">Parcelas</th><th class="num">Valor da parcela</th><th class="num">Nesta fatura</th><th>Ações</th></tr></thead><tbody id="purchaseManagerBody"></tbody></table></div></div></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('purchaseManagerClose').onclick=closeManager;
    document.getElementById('purchaseManagerModal').addEventListener('click',e=>{if(e.target.id==='purchaseManagerModal')closeManager()});
    document.getElementById('purchaseManagerSearch').addEventListener('input',renderManager);
    document.getElementById('purchaseManagerScope').addEventListener('change',renderManager);
    document.getElementById('purchaseManagerAdd').onclick=()=>{const cid=managerCardId||selectedCardId,ym=selectedInvoiceYm||state.settings.selectedMonth;closeManager();window.openPurchaseModal(cid,ym)};
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
      const n=p.mode==='recorrente'?'Mensal':Math.max(1,Number(p.installments)||1);
      return `<tr><td><strong>${esc(p.description||'Sem descrição')}</strong><div class="muted">${esc(p.category||'Outros')} • ${esc(termLabel(p))}${p.notes?` • ${esc(p.notes)}`:''}</div></td><td>${esc(p.date||'—')}</td><td>${month(p.firstInvoiceYm)}</td><td class="num"><strong>${money(p.totalAmount)}</strong></td><td class="num">${esc(n)}</td><td class="num"><strong>${money(installmentValue(p))}</strong></td><td class="num">${alloc?money(alloc.amount):'<span class="muted">—</span>'}</td><td style="white-space:nowrap"><button class="btn small pm-edit" data-id="${esc(p.id)}">Editar</button> <button class="btn small pm-go" data-id="${esc(p.id)}">Ver fatura</button> <button class="btn small danger pm-delete" data-id="${esc(p.id)}">Excluir</button></td></tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">Nenhuma compra encontrada.</td></tr>';
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
  enhancePurchaseForm();
  enhanceInvoiceItems();
  window.openPurchaseManager=openManager;
})();