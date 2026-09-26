(function(){
  const normalizeKey=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const aliases={date:['data','date','data_compra','data_da_compra'],description:['descricao','description','estabelecimento','merchant','compra','historico','lancamento'],category:['categoria','category'],amount:['valor','amount','valor_total','total','preco'],installments:['parcelas','parcela','installments','qtd_parcelas','numero_parcelas','n_parcelas','total_parcelas','parcela_total'],installmentCurrent:['parcela_atual','parcela_corrente','numero_parcela','n_parcela','installment_current','current_installment'],installmentValue:['valor_parcela','valor_da_parcela','valor_parcela_atual','parcela_valor','installment_value'],firstInvoice:['primeira_fatura','fatura','competencia','mes_fatura','mes_da_fatura'],card:['cartao','card','nome_cartao'],notes:['observacao','observacoes','notes','memo'],mode:['tipo','mode','modalidade'],recurringEnd:['ultima_fatura','fim_recorrencia','fim_da_recorrencia']};
  function findColumn(headers,names){const n=headers.map(normalizeKey);for(const name of names){const i=n.indexOf(name);if(i>=0)return i}return-1}
  function detectDelimiter(line){let semi=0,comma=0,q=false;for(const ch of line){if(ch==='"')q=!q;else if(!q&&ch===';')semi++;else if(!q&&ch===',')comma++}return semi>=comma?';':','}
  function parseCSV(text){text=String(text||'').replace(/^\uFEFF/,'');const delimiter=detectDelimiter(text.split(/\r?\n/).find(Boolean)||''),rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(ch===delimiter&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>String(v).trim()))rows.push(row);row=[]}else cell+=ch}if(cell!==''||row.length){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row)}return rows}
  function parseMoney(value){let s=String(value??'').trim().replace(/\s/g,'').replace(/R\$/gi,'');if(!s)return NaN;const c=s.lastIndexOf(','),d=s.lastIndexOf('.');if(c>d)s=s.replace(/\./g,'').replace(',','.');else if(d>c)s=s.replace(/,/g,'');else s=s.replace(',','.');s=s.replace(/[^0-9.\-]/g,'');const n=Number(s);return Number.isFinite(n)?Math.abs(n):NaN}
  function parseDate(value,fallbackYm){const s=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m)return`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;return`${fallbackYm}-01`}
  function parseMonth(value,fallback){const s=String(value??'').trim();if(/^\d{4}-\d{2}$/.test(s))return s;let m=s.match(/^(\d{1,2})[\/-](\d{4})$/);if(m)return`${m[2]}-${String(m[1]).padStart(2,'0')}`;m=s.match(/^(\d{4})[\/-](\d{1,2})$/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}`;return fallback}
  function resolveCategory(value,fallback){const raw=String(value??'').trim();if(!raw)return fallback;const key=normalizeKey(raw);return categories.find(c=>normalizeKey(c)===key)||fallback}
  function resolveCard(value,fallbackId){const raw=String(value??'').trim();if(!raw)return fallbackId;const key=normalizeKey(raw),found=state.cards.find(c=>normalizeKey(c.name)===key||normalizeKey(c.account)===key);return found?.id||fallbackId}
  function parseInstallmentInfo(raw,currentRaw,rowText){
    const sources=[raw,currentRaw,rowText].map(v=>String(v??''));
    for(const source of sources){
      const patterns=[
        /\bparc(?:ela)?\.?\s*(\d{1,3})\s*[\/-]\s*(\d{1,3})\b/i,
        /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/
      ];
      for(const re of patterns){
        const m=source.match(re);
        if(!m)continue;
        const current=Math.max(1,Number(m[1])||1),total=Math.max(1,Number(m[2])||1);
        if(current<=total)return{current,total};
      }
    }
    const total=Math.max(1,parseInt(String(raw??'').replace(/\D/g,''),10)||1);
    const current=Math.max(1,Math.min(total,parseInt(String(currentRaw??'').replace(/\D/g,''),10)||1));
    return{current,total};
  }
  function parseInstallmentValue(raw,notes,totalAmount,totalInstallments){
    const explicit=parseMoney(raw);
    if(Number.isFinite(explicit)&&explicit>0)return round2(explicit);
    const source=String(notes??'');
    const match=source.match(/valor\s+da\s+parcela(?:\s+atual)?\s*(?:R\$)?\s*([0-9.]+(?:,[0-9]{1,2})?)/i);
    if(match){
      const fromNote=parseMoney(match[1]);
      if(Number.isFinite(fromNote)&&fromNote>0)return round2(fromNote);
    }
    return totalInstallments>1?round2(totalAmount/totalInstallments):round2(totalAmount);
  }
  function duplicateExists(p){return state.purchases.some(x=>x.cardId===p.cardId&&x.date===p.date&&normalizeKey(x.description)===normalizeKey(p.description)&&round2(x.totalAmount)===round2(p.totalAmount)&&(x.firstInvoiceYm||'')===(p.firstInvoiceYm||'')&&Number(x.installments||0)===Number(p.installments||0)&&(x.mode||'parcelada')===(p.mode||'parcelada'))}

  let csvContextCardId='';
  let csvContextYm='';

  function buildCsvModal(){
    if(document.getElementById('csvPurchaseModal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="csvPurchaseModal"><div class="modal"><form id="csvPurchaseForm"><div class="modal-head"><h3>Importar compras por CSV</h3><button type="button" class="btn ghost" id="csvPurchaseClose">✕</button></div><div class="modal-body"><div class="notice" style="margin-bottom:14px"><strong id="csvImportContext">Fatura selecionada</strong><br>Cada linha será cadastrada diretamente nesta fatura. O CSV pode usar <strong>;</strong> ou <strong>,</strong>. Colunas mínimas: <strong>descricao</strong> e <strong>valor</strong>.</div><div class="form-grid"><div class="field"><label>Cartão padrão</label><select id="csvPurchaseCard"></select></div><div class="field"><label>Primeira fatura padrão</label><input type="month" id="csvPurchaseInvoice" required></div><div class="field"><label>Categoria padrão</label><select id="csvPurchaseCategory"></select></div><div class="field"><label>Arquivo CSV</label><input type="file" id="csvPurchaseFile" accept=".csv,text/csv" required></div><div class="field full"><label class="toggle"><input type="checkbox" id="csvSkipDuplicates" checked> Ignorar compras já importadas</label></div></div><div class="toolbar" style="margin-top:14px"><button type="button" class="btn" id="csvTemplateBtn">Baixar modelo CSV</button></div><p class="muted" style="margin-top:12px">Colunas reconhecidas: data, descricao, categoria, valor, parcelas, parcela_atual, valor_parcela, primeira_fatura, cartao, tipo, ultima_fatura e observacao. Em parcelas, também aceitamos formatos como 07/12.</p><div id="csvImportSummary" class="notice" style="display:none;margin-top:14px"></div></div><div class="modal-foot"><button type="button" class="btn" id="csvPurchaseCancel">Cancelar</button><button class="btn primary" type="submit">Importar compras</button></div></form></div></div>`);
    document.getElementById('csvPurchaseClose').onclick=closeCsvImport;document.getElementById('csvPurchaseCancel').onclick=closeCsvImport;document.getElementById('csvPurchaseModal').addEventListener('click',e=>{if(e.target.id==='csvPurchaseModal')closeCsvImport()});document.getElementById('csvTemplateBtn').onclick=downloadTemplate;document.getElementById('csvPurchaseForm').onsubmit=importPurchases;
  }
  function refreshCsvOptions(){const card=document.getElementById('csvPurchaseCard'),cat=document.getElementById('csvPurchaseCategory');if(!card||!cat)return;card.innerHTML=state.cards.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');cat.innerHTML=categories.map(c=>`<option>${c}</option>`).join('');card.value=selectedCardId||state.cards[0]?.id||'';cat.value='Compras';document.getElementById('csvPurchaseInvoice').value=selectedInvoiceYm||state.settings.selectedMonth}
  function openCsvImport(cardId=selectedCardId,ym=selectedInvoiceYm||state.settings.selectedMonth){
    buildCsvModal();refreshCsvOptions();
    csvContextCardId=cardId||selectedCardId||state.cards[0]?.id||'';
    csvContextYm=ym||selectedInvoiceYm||state.settings.selectedMonth;
    const card=document.getElementById('csvPurchaseCard'),invoice=document.getElementById('csvPurchaseInvoice'),ctx=document.getElementById('csvImportContext');
    if(card){card.value=csvContextCardId;card.disabled=true}
    if(invoice){invoice.value=csvContextYm;invoice.disabled=true}
    const target=getCard(csvContextCardId);
    if(ctx)ctx.textContent=`${target?.name||'Cartão'} • ${typeof fmtMonth==='function'?fmtMonth(csvContextYm):csvContextYm}`;
    const s=document.getElementById('csvImportSummary');s.style.display='none';s.textContent='';
    document.getElementById('csvPurchaseFile').value='';
    document.getElementById('csvPurchaseModal').classList.add('open');
  }
  function closeCsvImport(){
    document.getElementById('csvPurchaseModal')?.classList.remove('open');
    csvContextCardId='';csvContextYm='';
    const card=document.getElementById('csvPurchaseCard'),invoice=document.getElementById('csvPurchaseInvoice');
    if(card)card.disabled=false;if(invoice)invoice.disabled=false;
  }
  function downloadTemplate(){const csv='\ufeffdata;descricao;categoria;valor;parcelas;parcela_atual;valor_parcela;primeira_fatura;cartao;tipo;ultima_fatura;observacao\n2026-09-12;Amazon;Compras;1452,90;6;1;242,15;2026-09;BB Gabriel;parcelada;;Exemplo de compra parcelada',blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modelo-compras.csv';a.click();URL.revokeObjectURL(a.href)}
  async function importPurchases(e){
    e.preventDefault();
    const file=document.getElementById('csvPurchaseFile').files[0];if(!file)return;
    const fallbackCard=document.getElementById('csvPurchaseCard').value,
      fallbackInvoice=document.getElementById('csvPurchaseInvoice').value||state.settings.selectedMonth,
      fallbackCategory=document.getElementById('csvPurchaseCategory').value||'Compras',
      skip=document.getElementById('csvSkipDuplicates').checked,
      summary=document.getElementById('csvImportSummary');
    summary.style.display='block';summary.textContent='Lendo arquivo…';
    try{
      const rows=parseCSV(await file.text());if(rows.length<2)throw new Error('O arquivo não contém linhas de dados.');
      const headers=rows[0].map(v=>String(v).trim()),col={};
      Object.entries(aliases).forEach(([k,v])=>col[k]=findColumn(headers,v));
      if(col.description<0||col.amount<0)throw new Error('O CSV precisa ter as colunas descricao e valor.');
      let imported=0,duplicates=0,ignored=0,installmentRows=0,first=null;
      const importedAt=new Date().toISOString();
      for(let i=1;i<rows.length;i++){
        const r=rows[i],get=k=>col[k]>=0?(r[col[k]]??''):'',
          description=String(get('description')).trim(),amount=parseMoney(get('amount')),
          notes=String(get('notes')).trim(),rowText=r.map(v=>String(v??'')).join(' ');
        if(!description||!Number.isFinite(amount)||amount<=0){ignored++;continue}
        const firstInvoiceYm=parseMonth(get('firstInvoice'),csvContextYm||fallbackInvoice),
          targetCardId=csvContextCardId||resolveCard(get('card'),fallbackCard),
          mode=normalizeKey(get('mode')).includes('recorr')?'recorrente':'parcelada';
        let installments=null,installmentValue=null,installmentCurrent=null,installmentTotal=null;
        if(mode!=='recorrente'){
          const info=parseInstallmentInfo(get('installments'),get('installmentCurrent'),rowText);
          installmentTotal=info.total;installments=info.total;
          installmentCurrent=info.current;
          const hasExplicitCurrent=/\bparc(?:ela)?\.?\s*\d{1,3}\s*[\/-]\s*\d{1,3}\b/i.test(rowText)||String(get('installmentCurrent')||'').trim()!=='';
          if(!hasExplicitCurrent&&installments>1&&firstInvoiceYm&&csvContextYm){
            installmentCurrent=Math.max(1,Math.min(installments,monthDiff(firstInvoiceYm,csvContextYm)+1));
          }
          installmentValue=parseInstallmentValue(get('installmentValue'),rowText,amount,installments);
          if(installments>1||installmentCurrent>1)installmentRows++;
        }
        const p={
          id:uid(),
          cardId:targetCardId,
          date:parseDate(get('date'),firstInvoiceYm),
          description,
          category:resolveCategory(get('category'),fallbackCategory),
          mode,
          totalAmount:amount,
          installments,
          installmentValue,
          firstInvoiceYm,
          recurringEnd:mode==='recorrente'?parseMonth(get('recurringEnd'),null):null,
          notes
        };
        if(mode!=='recorrente'){
          p.chatgptImport={
            source:'csv',
            importedAt,
            invoiceYm:firstInvoiceYm,
            installmentCurrent,
            installmentTotal
          };
        }
        if(skip&&duplicateExists(p)){duplicates++;continue}
        state.purchases.push(p);ensureInvoice(p.cardId,p.firstInvoiceYm);imported++;if(!first)first=p;
      }
      if(imported){
        selectedCardId=first.cardId;selectedInvoiceYm=first.firstInvoiceYm;state.settings.selectedMonth=first.firstInvoiceYm;renderAll();
      }
      summary.textContent=`Importação concluída: ${imported} compra(s) adicionada(s), ${installmentRows} parcelada(s) reconhecida(s), ${duplicates} duplicata(s) ignorada(s) e ${ignored} linha(s) inválida(s).`;
      document.getElementById('csvPurchaseFile').value='';
    }catch(err){
      console.error(err);summary.textContent=`Não foi possível importar: ${err.message||'arquivo inválido.'}`;
    }
  }

  const baseRenderCardDetail=renderCardDetail;
  function setInvoicePaymentStatus(paid){const cardId=selectedCardId,ym=selectedInvoiceYm||state.settings.selectedMonth;if(!cardId||!ym)return;const inv=ensureInvoice(cardId,ym);if(paid){if(inv.status!=='Paga')inv.lastNonPaidStatus=inv.status||'Fechada';inv.status='Paga'}else inv.status=inv.lastNonPaidStatus&&inv.lastNonPaidStatus!=='Paga'?inv.lastNonPaidStatus:'Fechada';renderAll()}
  function mountInvoicePaymentToggle(){const card=getCard(selectedCardId);if(!card)return;const ym=selectedInvoiceYm||state.settings.selectedMonth,inv=getInvoice(card.id,ym),paid=inv?.status==='Paga',tools=document.querySelector('#cardDetail .invoice-tools');if(!tools||document.getElementById('invoicePaymentToggle'))return;const box=document.createElement('div');box.id='invoicePaymentToggle';box.style.cssText='display:flex;gap:6px;align-items:center;padding:3px;border:1px solid #273449;border-radius:10px;background:#0b1424';const yes=document.createElement('button');yes.type='button';yes.className='btn small';yes.textContent='✓ Paga';yes.style.cssText=paid?'background:#166534;border-color:#22c55e;color:#dcfce7':'opacity:.68';yes.onclick=()=>setInvoicePaymentStatus(true);const no=document.createElement('button');no.type='button';no.className='btn small';no.textContent='Não paga';no.style.cssText=!paid?'background:#7f1d1d;border-color:#ef4444;color:#fee2e2':'opacity:.68';no.onclick=()=>setInvoicePaymentStatus(false);box.append(yes,no);tools.prepend(box)}
  renderCardDetail=function(){baseRenderCardDetail();mountInvoicePaymentToggle()};

  function mountMonthNav(){
    const sel=document.getElementById('monthSelect');if(!sel||document.getElementById('monthNav'))return;
    const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const style=document.createElement('style');style.textContent='#monthNav{display:flex;align-items:center;height:40px;border:1px solid #273449;border-radius:11px;background:#182235;overflow:hidden}.month-nav-btn{width:38px;height:38px;border:0;background:transparent;color:#cbd5e1;font-size:23px;line-height:1}.month-nav-btn:hover{background:#223049;color:#fff}.month-nav-label{min-width:72px;padding:0 10px;text-align:center;font-size:13px;font-weight:700;color:#fff;text-transform:lowercase;font-variant-numeric:tabular-nums}.month-nav-sep{width:1px;height:20px;background:#2a3950}';document.head.appendChild(style);
    const nav=document.createElement('div');nav.id='monthNav';nav.innerHTML='<button type="button" class="month-nav-btn" id="monthPrev" aria-label="Mês anterior">‹</button><span class="month-nav-sep"></span><span class="month-nav-label" id="monthNavLabel">—</span><span class="month-nav-sep"></span><button type="button" class="month-nav-btn" id="monthNext" aria-label="Próximo mês">›</button>';
    sel.parentElement.insertBefore(nav,sel);sel.style.display='none';
    function syncLabel(){const ym=sel.value||state.settings.selectedMonth;if(!/^\d{4}-\d{2}$/.test(ym))return;const[y,m]=ym.split('-').map(Number);document.getElementById('monthNavLabel').textContent=`${months[m-1]}/${String(y).slice(-2)}`}
    function go(delta){const ym=sel.value||state.settings.selectedMonth;const[y,m]=ym.split('-').map(Number),d=new Date(y,m-1+delta,1),next=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;if(![...sel.options].some(o=>o.value===next)){const o=document.createElement('option');o.value=next;o.textContent=next;sel.appendChild(o)}sel.value=next;sel.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(syncLabel,0)}
    document.getElementById('monthPrev').onclick=()=>go(-1);document.getElementById('monthNext').onclick=()=>go(1);sel.addEventListener('change',syncLabel);new MutationObserver(syncLabel).observe(sel,{childList:true,subtree:true});syncLabel();
  }

  buildCsvModal();mountInvoicePaymentToggle();mountMonthNav();window.openCsvImport=openCsvImport;
})();