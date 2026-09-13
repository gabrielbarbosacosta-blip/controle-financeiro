(function(){
  if(window.__invoiceAiUiLoaded)return;
  window.__invoiceAiUiLoaded=true;
  const MAX=3*1024*1024;
  let context=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);

  function current(){
    const cardId=typeof selectedCardId!=='undefined'?selectedCardId:null;
    const ym=(typeof selectedInvoiceYm!=='undefined'&&selectedInvoiceYm)||state?.settings?.selectedMonth;
    const card=state?.cards?.find(c=>c.id===cardId);
    return card&&ym?{cardId,ym,card}:null;
  }

  function ensureModal(){
    if(document.getElementById('aiInvoiceModal'))return;
    const el=document.createElement('div');
    el.id='aiInvoiceModal';
    el.className='modal-backdrop';
    el.innerHTML=`<div class="modal" style="max-width:880px"><div class="modal-head"><div><h3>Analisar fatura com IA</h3><div class="muted" id="aiInvSub"></div></div><button class="btn ghost" id="aiInvX">✕</button></div><div class="modal-body"><div class="notice">A IA adiciona somente compras novas à fatura selecionada. Compras existentes não são editadas nem excluídas. Cada lançamento importado fica restrito a esta fatura e não cria parcelas futuras.</div><div class="field" style="margin-top:14px"><label>PDF ou imagem da fatura</label><input type="file" id="aiInvFile" accept="application/pdf,image/jpeg,image/png,image/webp"><small class="muted">Até 3 MB. PDF, JPG, PNG ou WebP.</small></div><div id="aiInvStatus" class="muted" style="margin-top:12px"></div><div id="aiInvResults" style="margin-top:14px"></div></div><div class="modal-foot"><button class="btn" id="aiInvClose">Fechar</button><button class="btn" id="aiInvReview" style="display:none">Importar selecionadas</button><button class="btn primary" id="aiInvGo">Analisar e incluir novas</button></div></div>`;
    document.body.appendChild(el);
    document.getElementById('aiInvX').onclick=close;
    document.getElementById('aiInvClose').onclick=close;
    document.getElementById('aiInvGo').onclick=analyze;
    document.getElementById('aiInvReview').onclick=importSelected;
    el.onclick=e=>{if(e.target===el)close()};
  }

  function open(){
    ensureModal();
    context=current();
    if(!context)return alert('Selecione um cartão e uma fatura.');
    document.getElementById('aiInvoiceModal').classList.add('open');
    document.getElementById('aiInvSub').textContent=`${context.card.name} • ${typeof fmtMonth==='function'?fmtMonth(context.ym):context.ym}`;
    document.getElementById('aiInvStatus').textContent='';
    document.getElementById('aiInvResults').innerHTML='';
    document.getElementById('aiInvReview').style.display='none';
    document.getElementById('aiInvFile').value='';
  }

  function close(){document.getElementById('aiInvoiceModal')?.classList.remove('open')}

  function toBase64(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));
      reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
      reader.readAsDataURL(file);
    });
  }

  function createPurchase(item,manual){
    const row=item.row;
    openPurchaseModal(context.cardId,context.ym);
    document.getElementById('purchaseDate').value=row.date||`${context.ym}-01`;
    document.getElementById('purchaseDescription').value=row.description;
    document.getElementById('purchaseCategory').value=row.category||'Compras';
    document.getElementById('purchaseMode').value='parcelada';
    document.getElementById('purchaseAmount').value=Number(row.amount)||0;
    document.getElementById('purchaseInstallments').value=1;
    document.getElementById('purchaseFirstInvoice').value=context.ym;
    const installment=row.installmentCurrent&&row.installmentTotal?` Parcela ${row.installmentCurrent}/${row.installmentTotal}.`:'';
    const dateNote=row.date?'':' Data não legível; registrada no primeiro dia do mês da fatura.';
    document.getElementById('purchaseNotes').value=`Importado por IA da fatura ${context.ym}.${installment}${dateNote}${row.note?` ${row.note}`:''} ${item.marker}${manual?' Revisado manualmente.':''}`.trim();
    document.getElementById('purchaseForm').requestSubmit();
  }

  function renderResults(classified,imported,analysis){
    const importedSet=new Set(imported||[]);
    const duplicates=classified.filter(x=>x.status==='duplicate').length;
    const reviews=classified.filter(x=>x.status==='review').length;
    let html=`<div class="notice"><strong>${importedSet.size} nova(s) compra(s) incluída(s).</strong> ${duplicates} já existente(s) ignorada(s). ${reviews} aguardando revisão.${analysis?.statement?.total!=null?` Total identificado: <strong>${money(analysis.statement.total)}</strong>.`:''}</div>`;
    html+=classified.map(item=>{
      const row=item.row,done=importedSet.has(item.index);
      const label=done?'Incluída':item.status==='duplicate'?'Já existia':item.status==='review'?'Revisar':'Pronta';
      const checkbox=item.status==='review'?`<label class="toggle"><input type="checkbox" class="aiInvCheck" data-index="${item.index}"> Importar</label>`:'';
      const parcel=row.installmentCurrent&&row.installmentTotal?` • ${row.installmentCurrent}/${row.installmentTotal}`:'';
      return `<div class="detail-line"><div><div class="purchase-desc">${esc(row.description)}</div><div class="sub">${esc(row.date||'data não identificada')} • ${esc(row.category||'Compras')}${parcel} • confiança ${Math.round((Number(row.confidence)||0)*100)}%</div>${row.note?`<div class="sub">${esc(row.note)}</div>`:''}</div><div style="text-align:right"><strong>${money(row.amount)}</strong><div class="sub">${label}</div>${checkbox}</div></div>`;
    }).join('');
    document.getElementById('aiInvResults').innerHTML=html;
    document.getElementById('aiInvReview').style.display=reviews?'inline-flex':'none';
  }

  async function analyze(){
    context=current();
    const file=document.getElementById('aiInvFile')?.files?.[0];
    if(!context||!file)return alert('Selecione a fatura e o arquivo.');
    if(file.size>MAX)return alert('O arquivo excede 3 MB.');
    if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))return alert('Use PDF, JPG, PNG ou WebP.');
    if(typeof window.invoiceAiRequest!=='function'||!window.invoiceAiImporterCore)return alert('O módulo de IA ainda não terminou de carregar.');
    const button=document.getElementById('aiInvGo'),status=document.getElementById('aiInvStatus');
    button.disabled=true;button.textContent='Analisando…';status.style.color='';status.textContent='Analisando a fatura e comparando com as compras existentes…';
    try{
      const payload=await window.invoiceAiRequest({fileName:file.name,mimeType:file.type,base64:await toBase64(file),cardName:context.card.name,invoiceYm:context.ym});
      context={...context,fileName:file.name,analysis:payload.analysis};
      const classified=window.invoiceAiImporterCore.classify(payload.analysis?.purchases||[],context.cardId,context.ym);
      const automatic=classified.filter(x=>x.status==='automatic');
      automatic.forEach(item=>createPurchase(item,false));
      renderResults(classified,automatic.map(x=>x.index),payload.analysis);
      status.textContent=`${classified.length} lançamento(s) identificado(s).`;
      const inv=typeof getInvoice==='function'?getInvoice(context.cardId,context.ym):null;
      if(inv&&Number(inv.adjustment))status.textContent+=` O ajuste existente de ${money(inv.adjustment)} foi mantido sem alteração.`;
    }catch(error){status.style.color='#fecaca';status.textContent=error?.message||'Falha ao analisar a fatura.'}
    finally{button.disabled=false;button.textContent='Analisar e incluir novas'}
  }

  function importSelected(){
    if(!context?.analysis)return;
    const selected=new Set([...document.querySelectorAll('.aiInvCheck:checked')].map(el=>Number(el.dataset.index)));
    if(!selected.size)return alert('Selecione ao menos um item.');
    const classified=window.invoiceAiImporterCore.classify(context.analysis.purchases||[],context.cardId,context.ym);
    const chosen=classified.filter(item=>selected.has(item.index)&&item.status!=='duplicate');
    chosen.forEach(item=>createPurchase(item,true));
    const after=window.invoiceAiImporterCore.classify(context.analysis.purchases||[],context.cardId,context.ym);
    renderResults(after,chosen.map(x=>x.index),context.analysis);
    document.getElementById('aiInvStatus').textContent=`${chosen.length} item(ns) revisado(s) incluído(s). Compras anteriores permaneceram inalteradas.`;
  }

  function mount(){
    const tools=document.querySelector('#cardDetail .invoice-tools');
    if(!tools||document.getElementById('aiInvoiceAnalyzeBtn'))return;
    const button=document.createElement('button');button.id='aiInvoiceAnalyzeBtn';button.type='button';button.className='btn';button.textContent='Analisar fatura com IA';button.onclick=open;tools.appendChild(button);
  }

  ensureModal();mount();setInterval(mount,1000);window.openAiInvoiceImport=open;
})();
