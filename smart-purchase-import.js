(function(){
  const normalizeKey=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const normalizeText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases={
    date:['data','date','data_compra','data_da_compra'],
    description:['descricao','description','estabelecimento','merchant','compra','historico','lancamento'],
    category:['categoria','category'],
    amount:['valor','amount','valor_total','total','preco'],
    installments:['parcelas','installments','qtd_parcelas','numero_parcelas','n_parcelas','parcela_total','parcelas_total'],
    installmentCurrent:['parcela_atual','installment_current','parcela_corrente','numero_parcela'],
    firstInvoice:['primeira_fatura','fatura','competencia','mes_fatura','mes_da_fatura'],
    card:['cartao','card','nome_cartao'],
    notes:['observacao','observacoes','notes','memo'],
    mode:['tipo','mode','modalidade'],
    recurringEnd:['ultima_fatura','fim_recorrencia','fim_da_recorrencia']
  };

  let previewRows=[];
  let invalidRows=0;
  let sourceFileName='';

  function findColumn(headers,names){const n=headers.map(normalizeKey);for(const name of names){const i=n.indexOf(name);if(i>=0)return i}return-1}
  function detectDelimiter(line){let semi=0,comma=0,q=false;for(const ch of line){if(ch==='"')q=!q;else if(!q&&ch===';')semi++;else if(!q&&ch===',')comma++}return semi>=comma?';':','}
  function parseCSV(text){text=String(text||'').replace(/^\uFEFF/,'');const delimiter=detectDelimiter(text.split(/\r?\n/).find(Boolean)||''),rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(ch===delimiter&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>String(v).trim()))rows.push(row);row=[]}else cell+=ch}if(cell!==''||row.length){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row)}return rows}
  function parseMoney(value){let s=String(value??'').trim().replace(/\s/g,'').replace(/R\$/gi,'');if(!s)return NaN;const c=s.lastIndexOf(','),d=s.lastIndexOf('.');if(c>d)s=s.replace(/\./g,'').replace(',','.');else if(d>c)s=s.replace(/,/g,'');else s=s.replace(',','.');s=s.replace(/[^0-9.\-]/g,'');const n=Number(s);return Number.isFinite(n)?Math.abs(n):NaN}
  function parseDate(value,fallbackYm){const s=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m)return`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;return`${fallbackYm}-01`}
  function parseMonth(value,fallback){const s=String(value??'').trim();if(/^\d{4}-\d{2}$/.test(s))return s;let m=s.match(/^(\d{1,2})[\/-](\d{4})$/);if(m)return`${m[2]}-${String(m[1]).padStart(2,'0')}`;m=s.match(/^(\d{4})[\/-](\d{1,2})$/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}`;return fallback}
  function resolveCategory(value,fallback){const raw=String(value??'').trim();if(!raw)return fallback;const key=normalizeKey(raw);return categories.find(c=>normalizeKey(c)===key)||fallback}
  function cents(value){return Math.round((Number(value)||0)*100)}
  function money(value){return typeof fmtMoney==='function'?fmtMoney(Number(value)||0):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0)}
  function similarity(a,b){const x=normalizeText(a),y=normalizeText(b);if(!x||!y)return 0;if(x===y)return 1;const A=new Set(x.split(' ').filter(t=>t.length>1)),B=new Set(y.split(' ').filter(t=>t.length>1));let common=0;A.forEach(t=>{if(B.has(t))common++});return common/Math.max(A.size||1,B.size||1)}
  function allocator(){return window.purchaseAllocation||(typeof purchaseAllocation==='function'?purchaseAllocation:null)}
  function allocationInfo(p,ym){const fn=allocator();if(typeof fn!=='function'||!p||!ym)return null;try{const a=fn(p,ym);if(a==null)return null;if(typeof a==='object')return{amount:Number(a.amount)||0,number:a.number??null,total:a.total??null};return{amount:Number(a)||0,number:null,total:null}}catch(e){return null}}
  function currentTarget(){const value=document.getElementById('csvInvoiceTarget')?.value||'';const [cardId,ym]=value.split('|');return{cardId,ym}}
  function targetExisting(){const {cardId,ym}=currentTarget();if(!cardId||!ym)return[];return state.purchases.filter(p=>p.cardId===cardId).map(p=>({purchase:p,alloc:allocationInfo(p,ym)})).filter(x=>x.alloc&&x.alloc.amount>0)}
  function existingKnownTotal(){return round2(targetExisting().reduce((sum,x)=>sum+(Number(x.alloc.amount)||0),0))}
  function parseInstallments(rawTotal,rawCurrent){
    const combo=String(rawTotal??'').trim().match(/(\d+)\s*[\/\\-]\s*(\d+)/);
    if(combo)return{current:Math.max(1,Number(combo[1])||1),total:Math.max(1,Number(combo[2])||1)};
    const total=Math.max(1,parseInt(String(rawTotal??'').replace(/\D/g,''),10)||1);
    const current=Math.max(1,parseInt(String(rawCurrent??'').replace(/\D/g,''),10)||1);
    return{current:Math.min(current,total),total};
  }
  function classifyMode(rawMode,installmentTotal){
    const key=normalizeKey(rawMode);
    if(key.includes('recorr'))return'recorrente';
    if(key.includes('unica')||key.includes('unico')||key==='avista'||key==='a_vista')return'unica';
    if(key.includes('parcel'))return installmentTotal>1?'parcelada':'unica';
    return installmentTotal>1?'parcelada':'unica';
  }
  function matchExisting(row){
    const candidates=targetExisting();
    const sameAmount=x=>cents(x.alloc.amount)===cents(row.amount);
    const exactName=x=>normalizeText(x.purchase.description)===normalizeText(row.description);
    let found=candidates.find(x=>sameAmount(x)&&exactName(x));
    if(found){
      const type=found.purchase.mode==='recorrente'?'recorrência já cadastrada':((found.alloc.total||Number(found.purchase.installments)||1)>1?'parcelamento já cadastrado':'compra já cadastrada');
      return{level:'exact',label:type,existing:found};
    }
    found=candidates.find(x=>sameAmount(x)&&similarity(x.purchase.description,row.description)>=.72);
    if(found)return{level:'possible',label:'possível correspondência já cadastrada',existing:found};
    return null;
  }
  function groupKey(row){if(row.mode==='recorrente')return'recorrentes';if(row.mode==='parcelada')return'parceladas';return'unicas'}
  function groupLabel(key){return key==='recorrentes'?'Recorrentes':key==='parceladas'?'Parceladas':'Únicas'}
  function selectedRows(){return previewRows.filter(r=>r.selected)}
  function selectedTotal(){return round2(selectedRows().reduce((sum,r)=>sum+(Number(r.amount)||0),0))}
  function statementTotal(){const n=parseMoney(document.getElementById('csvStatementTotal')?.value);return Number.isFinite(n)?n:null}
  function proposedAdjustment(){const total=statementTotal();if(total==null)return null;return round2(total-existingKnownTotal()-selectedTotal())}
  function categoryOptions(selected){return categories.map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}

  function injectImportStyles(){
    if(document.getElementById('smart-csv-import-style'))return;
    const style=document.createElement('style');style.id='smart-csv-import-style';style.textContent=`
      #csvPurchaseModal .modal{width:min(1320px,96vw);max-height:94vh}
      .csv-smart-grid{display:grid;grid-template-columns:minmax(300px,.82fr) minmax(460px,1.35fr);gap:16px;align-items:start}
      .csv-side{border:1px solid var(--line);border-radius:14px;background:#0b1424;overflow:hidden}
      .csv-side-head{padding:14px 16px;border-bottom:1px solid var(--line);background:#101a2b}.csv-side-head h4{margin:0;font-size:14px}.csv-side-head p{margin:4px 0 0;font-size:11px;color:var(--muted)}
      .csv-side-body{padding:14px 16px}.csv-existing-list,.csv-preview-list{display:grid;gap:8px}.csv-existing-section+.csv-existing-section,.csv-preview-section+.csv-preview-section{margin-top:16px}
      .csv-existing-title,.csv-preview-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#cbd5e1}
      .csv-existing-item,.csv-preview-item{border:1px solid #253247;border-radius:10px;background:#0d1625;padding:10px 11px}.csv-existing-item .title,.csv-preview-main{font-size:12px;font-weight:750;color:#e2e8f0}.csv-existing-item .sub,.csv-preview-sub{font-size:10px;color:var(--muted);margin-top:4px}
      .csv-preview-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start}.csv-preview-item.possible{border-color:#6b4f18;background:#1b170e}.csv-preview-item.exact{border-color:#49303a;background:#1b1117}
      .csv-preview-item input[type="checkbox"]{margin-top:3px}.csv-preview-value{font-size:12px;font-weight:800;white-space:nowrap}.csv-preview-category{margin-top:7px;max-width:200px;background:var(--input);color:#fff;border:1px solid #2a3950;border-radius:8px;padding:5px 7px;font-size:10px}
      .csv-match{display:inline-flex;margin-top:6px;padding:3px 6px;border-radius:999px;font-size:9px;font-weight:800;background:#33250d;color:#fde68a;border:1px solid #5e4512}.csv-match.exact{background:#321515;color:#fecaca;border-color:#542020}
      .csv-import-controls{display:grid;grid-template-columns:1.25fr .75fr;gap:10px}.csv-import-controls .full{grid-column:1/-1}.csv-upload-row{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.csv-upload-row .field{flex:1;min-width:220px}
      .csv-reconcile{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.csv-reconcile .mini{padding:9px 10px}.csv-reconcile .mini .v{font-size:14px}.csv-import-actions{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}.csv-import-count{font-size:11px;color:var(--muted)}
      .csv-select-all{font-size:10px;padding:4px 7px}.csv-empty{padding:18px 10px;text-align:center;color:var(--muted);font-size:11px}
      #csvImportSummary{margin-top:12px}
      @media(max-width:900px){.csv-smart-grid{grid-template-columns:1fr}.csv-import-controls{grid-template-columns:1fr}.csv-reconcile{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(style)
  }

  function buildCsvModal(){
    if(document.getElementById('csvPurchaseModal'))return;
    injectImportStyles();
    const addCard=document.getElementById('addCardBtn');
    if(addCard&&!document.getElementById('importPurchasesBtn')){const btn=document.createElement('button');btn.className='btn';btn.id='importPurchasesBtn';btn.textContent='Importar compras';addCard.parentElement.insertBefore(btn,addCard);btn.onclick=openCsvImport}
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="csvPurchaseModal"><div class="modal"><form id="csvPurchaseForm"><div class="modal-head"><h3>Importação inteligente de compras</h3><button type="button" class="btn ghost" id="csvPurchaseClose">✕</button></div><div class="modal-body"><div class="csv-smart-grid"><section class="csv-side"><div class="csv-side-head"><h4>Compras já cadastradas</h4><p>Recorrências e parcelas da fatura selecionada para conferência.</p></div><div class="csv-side-body" id="csvExistingPurchases"></div></section><section class="csv-side"><div class="csv-side-head"><h4>Nova importação</h4><p>Escolha a fatura, envie o arquivo e selecione apenas o que deseja cadastrar.</p></div><div class="csv-side-body"><div class="csv-import-controls"><div class="field full"><label>Fatura correspondente</label><select id="csvInvoiceTarget" required></select></div><div class="field"><label>Categoria padrão</label><select id="csvPurchaseCategory"></select></div><div class="field"><label>Valor da fatura</label><input id="csvStatementTotal" inputmode="decimal" placeholder="R$ 0,00"></div><div class="full csv-upload-row"><div class="field"><label>Arquivo CSV</label><input type="file" id="csvPurchaseFile" accept=".csv,text/csv"></div><button type="button" class="btn" id="csvTemplateBtn">Baixar modelo</button></div></div><div class="csv-reconcile"><div class="mini"><div class="t">Já cadastrado</div><div class="v" id="csvExistingTotal">R$ 0,00</div></div><div class="mini"><div class="t">Selecionado</div><div class="v" id="csvSelectedTotal">R$ 0,00</div></div><div class="mini"><div class="t">Identificado</div><div class="v" id="csvIdentifiedTotal">R$ 0,00</div></div><div class="mini"><div class="t">Ajuste</div><div class="v" id="csvAdjustmentValue">—</div></div></div><div id="csvPreviewArea" style="margin-top:14px"><div class="csv-empty">Envie um CSV para conferir as compras antes de importar.</div></div><div id="csvImportSummary" class="notice" style="display:none"></div><div class="csv-import-actions"><span class="csv-import-count" id="csvImportCount">Nenhuma compra selecionada</span><button class="btn primary" type="submit" id="csvConfirmImport" disabled>Importar selecionadas</button></div></div></section></div></div><div class="modal-foot"><button type="button" class="btn" id="csvPurchaseCancel">Fechar</button></div></form></div></div>`);
    document.getElementById('csvPurchaseClose').onclick=closeCsvImport;document.getElementById('csvPurchaseCancel').onclick=closeCsvImport;document.getElementById('csvPurchaseModal').addEventListener('click',e=>{if(e.target.id==='csvPurchaseModal')closeCsvImport()});document.getElementById('csvTemplateBtn').onclick=downloadTemplate;document.getElementById('csvPurchaseForm').onsubmit=commitImport;document.getElementById('csvPurchaseFile').addEventListener('change',readImportFile);document.getElementById('csvInvoiceTarget').addEventListener('change',()=>{retargetPreview();renderExisting();renderPreview();updateReconcile()});document.getElementById('csvPurchaseCategory').addEventListener('change',e=>{previewRows.forEach(r=>{if(!r.categoryFromFile)r.category=e.target.value});renderPreview();updateReconcile()});document.getElementById('csvStatementTotal').addEventListener('input',updateReconcile);
  }

  function invoiceOptions(){
    const seen=new Set(),items=[];
    const push=(cardId,ym,status='')=>{if(!cardId||!ym)return;const key=`${cardId}|${ym}`;if(seen.has(key))return;const card=state.cards.find(c=>c.id===cardId);if(!card)return;seen.add(key);items.push({key,card,ym,status})};
    push(selectedCardId||state.cards[0]?.id,selectedInvoiceYm||state.settings.selectedMonth,getInvoice(selectedCardId||state.cards[0]?.id,selectedInvoiceYm||state.settings.selectedMonth)?.status||'');
    (state.invoices||[]).forEach(inv=>push(inv.cardId,inv.ym,inv.status||''));
    items.sort((a,b)=>b.ym.localeCompare(a.ym)||a.card.name.localeCompare(b.card.name));
    return items;
  }
  function refreshCsvOptions(){
    const target=document.getElementById('csvInvoiceTarget'),cat=document.getElementById('csvPurchaseCategory');if(!target||!cat)return;
    const options=invoiceOptions();target.innerHTML=options.map(x=>`<option value="${esc(x.key)}">${esc(x.card.name)} — ${esc(typeof fmtMonth==='function'?fmtMonth(x.ym):x.ym)}${x.status?` — ${esc(x.status)}`:''}</option>`).join('');
    const wanted=`${selectedCardId||state.cards[0]?.id}|${selectedInvoiceYm||state.settings.selectedMonth}`;if(options.some(x=>x.key===wanted))target.value=wanted;
    cat.innerHTML=categories.map(c=>`<option>${esc(c)}</option>`).join('');cat.value='Compras';
  }
  function openCsvImport(){
    buildCsvModal();refreshCsvOptions();previewRows=[];invalidRows=0;sourceFileName='';
    const s=document.getElementById('csvImportSummary');s.style.display='none';s.textContent='';
    document.getElementById('csvPurchaseFile').value='';document.getElementById('csvStatementTotal').value='';
    renderExisting();renderPreview();updateReconcile();document.getElementById('csvPurchaseModal').classList.add('open')
  }
  function closeCsvImport(){document.getElementById('csvPurchaseModal')?.classList.remove('open')}

  function downloadTemplate(){
    const csv='\ufeffdata;descricao;categoria;valor;tipo;parcela_atual;parcelas;observacao\n2026-09-12;Supermercado;Alimentação;249,90;unica;;;Compra única\n2026-09-13;Netflix;Assinaturas;55,90;recorrente;;;Assinatura mensal\n2026-09-14;Notebook;Eletrônicos;399,90;parcelada;5;10;Valor da parcela atual';
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modelo-importacao-compras.csv';a.click();URL.revokeObjectURL(a.href)
  }

  function renderExisting(){
    const host=document.getElementById('csvExistingPurchases');if(!host)return;const {cardId,ym}=currentTarget();
    if(!cardId||!ym){host.innerHTML='<div class="csv-empty">Selecione uma fatura.</div>';return}
    const relevant=targetExisting().filter(x=>x.purchase.mode==='recorrente'||x.purchase.openEnded===true||(x.alloc.total||Number(x.purchase.installments)||1)>1||Number(x.purchase?.chatgptImport?.installmentTotal)>1);
    const recurring=relevant.filter(x=>x.purchase.mode==='recorrente');const installments=relevant.filter(x=>x.purchase.mode!=='recorrente');
    const section=(label,rows)=>{if(!rows.length)return'';return`<div class="csv-existing-section"><div class="csv-existing-title"><span>${label}</span><span>${rows.length}</span></div><div class="csv-existing-list">${rows.map(x=>{const parcel=x.alloc.number&&x.alloc.total?` • ${x.alloc.number}/${x.alloc.total}`:'';return`<div class="csv-existing-item"><div class="title">${esc(x.purchase.description)}</div><div class="sub">${esc(x.purchase.category||'Compras')}${parcel} • ${money(x.alloc.amount)}</div></div>`}).join('')}</div></div>`};
    host.innerHTML=section('Recorrentes',recurring)+section('Parceladas',installments)||'<div class="csv-empty">Nenhuma compra recorrente ou parcelada ativa nesta fatura.</div>';
  }

  function retargetPreview(){
    const {cardId,ym}=currentTarget();if(!cardId||!ym)return;previewRows.forEach(r=>{r.cardId=cardId;r.firstInvoiceYm=ym;r.date=parseDate(r.rawDate,ym);r.match=matchExisting(r);r.selected=!r.match})
  }

  async function readImportFile(){
    const input=document.getElementById('csvPurchaseFile'),file=input?.files?.[0],summary=document.getElementById('csvImportSummary');if(!file){previewRows=[];renderPreview();updateReconcile();return}
    sourceFileName=file.name||'compras.csv';summary.style.display='block';summary.textContent='Lendo e analisando o arquivo…';
    try{
      const rows=parseCSV(await file.text());if(rows.length<2)throw new Error('O arquivo não contém linhas de dados.');
      const headers=rows[0].map(v=>String(v).trim()),col={};Object.entries(aliases).forEach(([k,v])=>col[k]=findColumn(headers,v));if(col.description<0||col.amount<0)throw new Error('O CSV precisa ter as colunas descricao e valor.');
      const fallbackCategory=document.getElementById('csvPurchaseCategory').value||'Compras';const {cardId,ym}=currentTarget();previewRows=[];invalidRows=0;
      for(let i=1;i<rows.length;i++){
        const raw=rows[i],get=k=>col[k]>=0?(raw[col[k]]??''):'',description=String(get('description')).trim(),amount=parseMoney(get('amount'));
        if(!description||!Number.isFinite(amount)||amount<=0){invalidRows++;continue}
        const installment=parseInstallments(get('installments'),get('installmentCurrent'));const mode=classifyMode(get('mode'),installment.total);const categoryRaw=String(get('category')).trim();
        const row={id:`csv_${i}_${Date.now().toString(36)}`,description,amount,date:parseDate(get('date'),ym),rawDate:get('date'),category:resolveCategory(categoryRaw,fallbackCategory),categoryFromFile:!!categoryRaw,mode,installmentCurrent:mode==='parcelada'?installment.current:null,installmentTotal:mode==='parcelada'?installment.total:null,cardId,firstInvoiceYm:ym,recurringEnd:mode==='recorrente'?parseMonth(get('recurringEnd'),null):null,notes:String(get('notes')).trim(),selected:true,match:null};
        row.match=matchExisting(row);if(row.match)row.selected=false;previewRows.push(row);
      }
      renderPreview();updateReconcile();summary.textContent=`Arquivo analisado: ${previewRows.length} compra(s) válida(s)${invalidRows?` e ${invalidRows} linha(s) inválida(s) ignorada(s)`:''}. Revise e selecione o que deseja importar.`;
    }catch(err){console.error(err);previewRows=[];renderPreview();updateReconcile();summary.textContent=`Não foi possível ler o arquivo: ${err.message||'arquivo inválido.'}`}
  }

  function renderPreview(){
    const host=document.getElementById('csvPreviewArea');if(!host)return;
    if(!previewRows.length){host.innerHTML='<div class="csv-empty">Envie um CSV para conferir as compras antes de importar.</div>';updateImportButton();return}
    const groups={unicas:[],recorrentes:[],parceladas:[]};previewRows.forEach(r=>groups[groupKey(r)].push(r));
    const section=key=>{const rows=groups[key];if(!rows.length)return'';return`<div class="csv-preview-section"><div class="csv-preview-title"><span>${groupLabel(key)} (${rows.length})</span><button type="button" class="btn small csv-select-all" data-select-group="${key}">Selecionar grupo</button></div><div class="csv-preview-list">${rows.map(r=>{const parcel=r.mode==='parcelada'&&r.installmentTotal>1?` • ${r.installmentCurrent}/${r.installmentTotal}`:'';const match=r.match?`<span class="csv-match ${r.match.level==='exact'?'exact':''}">${esc(r.match.label)}</span>`:'';return`<label class="csv-preview-item ${r.match?.level||''}" data-preview-id="${esc(r.id)}"><input type="checkbox" class="csv-preview-check" ${r.selected?'checked':''}><div><div class="csv-preview-main">${esc(r.description)}</div><div class="csv-preview-sub">${esc(r.date)}${parcel} • ${esc(r.mode==='unica'?'única':r.mode)}</div>${match}<div><select class="csv-preview-category">${categoryOptions(r.category)}</select></div></div><div class="csv-preview-value">${money(r.amount)}</div></label>`}).join('')}</div></div>`};
    host.innerHTML=section('unicas')+section('recorrentes')+section('parceladas');
    host.querySelectorAll('.csv-preview-item').forEach(el=>{const row=previewRows.find(r=>r.id===el.dataset.previewId);if(!row)return;el.querySelector('.csv-preview-check').addEventListener('change',e=>{row.selected=e.target.checked;updateReconcile()});el.querySelector('.csv-preview-category').addEventListener('change',e=>{row.category=e.target.value})});
    host.querySelectorAll('[data-select-group]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.selectGroup;const rows=previewRows.filter(r=>groupKey(r)===key),allSelected=rows.every(r=>r.selected);rows.forEach(r=>r.selected=!allSelected);renderPreview();updateReconcile()});
    updateImportButton();
  }

  function updateReconcile(){
    const existing=existingKnownTotal(),selected=selectedTotal(),identified=round2(existing+selected),adjust=proposedAdjustment();
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};set('csvExistingTotal',money(existing));set('csvSelectedTotal',money(selected));set('csvIdentifiedTotal',money(identified));set('csvAdjustmentValue',adjust==null?'—':money(adjust));updateImportButton();
  }
  function updateImportButton(){const count=selectedRows().length,btn=document.getElementById('csvConfirmImport'),label=document.getElementById('csvImportCount');if(btn){btn.disabled=count===0;btn.textContent=count?`Importar ${count} selecionada(s)`:'Importar selecionadas'}if(label)label.textContent=count?`${count} de ${previewRows.length} compra(s) selecionada(s)`:'Nenhuma compra selecionada'}

  function purchaseFromPreview(row){
    const now=new Date().toISOString();const base={id:uid(),cardId:row.cardId,date:row.date,description:row.description,category:row.category,firstInvoiceYm:row.firstInvoiceYm,recurringEnd:row.recurringEnd||null,notes:[row.notes,`Importado de ${sourceFileName||'CSV'} para a fatura ${row.firstInvoiceYm}.`].filter(Boolean).join(' ')};
    if(row.mode==='recorrente')return{...base,mode:'recorrente',totalAmount:row.amount,installments:null,chatgptImport:{source:'csv_review',invoiceYm:row.firstInvoiceYm,importedAt:now}};
    if(row.mode==='parcelada'&&row.installmentTotal>1)return{...base,mode:'parcelada',totalAmount:row.amount,installments:1,installmentValue:row.amount,chatgptImport:{source:'csv_review',invoiceYm:row.firstInvoiceYm,importedAt:now,installmentCurrent:row.installmentCurrent||1,installmentTotal:row.installmentTotal}};
    return{...base,mode:'parcelada',totalAmount:row.amount,installments:1,chatgptImport:{source:'csv_review',invoiceYm:row.firstInvoiceYm,importedAt:now}};
  }

  function commitImport(e){
    e.preventDefault();const chosen=selectedRows();if(!chosen.length)return;const {cardId,ym}=currentTarget();if(!cardId||!ym)return;const summary=document.getElementById('csvImportSummary');summary.style.display='block';
    try{
      const purchases=chosen.map(purchaseFromPreview);state.purchases.push(...purchases);const inv=ensureInvoice(cardId,ym);const total=statementTotal();if(total!=null){const known=round2(state.purchases.filter(p=>p.cardId===cardId).reduce((sum,p)=>{const a=allocationInfo(p,ym);return sum+(a?.amount||0)},0));inv.statementTotal=round2(total);inv.adjustment=round2(total-known);inv.reconciledAt=new Date().toISOString()}
      selectedCardId=cardId;selectedInvoiceYm=ym;state.settings.selectedMonth=ym;if(typeof save==='function')save();if(typeof renderAll==='function')renderAll();summary.textContent=`Importação concluída: ${purchases.length} compra(s) adicionada(s)${total!=null?` e ajuste da fatura recalculado para ${money(inv.adjustment)}`:''}.`;previewRows=[];document.getElementById('csvPurchaseFile').value='';renderExisting();renderPreview();updateReconcile();
    }catch(err){console.error(err);summary.textContent=`Não foi possível concluir a importação: ${err.message||'erro ao salvar.'}`}
  }

  function install(){
    document.getElementById('csvPurchaseModal')?.remove();
    const btn=document.getElementById('importPurchasesBtn');
    if(btn){btn.textContent='Importar compras';btn.onclick=openCsvImport}
    window.openCsvImport=openCsvImport;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
