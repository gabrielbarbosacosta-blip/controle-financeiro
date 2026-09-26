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

  function aiCsvPrompt(cardName,invoiceYm,invoiceTotal){
    const cats=Array.isArray(categories)?categories.join(', '):'Compras, Alimentação, Transporte, Saúde, Lazer, Assinaturas, Serviços, Outros';
    const totalLabel=Number.isFinite(Number(invoiceTotal))&&Number(invoiceTotal)>0
      ?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(invoiceTotal))
      :'não informado';
    return `Vou anexar uma fatura de cartão de crédito. Analise TODOS os lançamentos da fatura e gere um arquivo CSV pronto para importação no sistema Prumo.

CONTEXTO DA FATURA
- Cartão: ${cardName||'Cartão'}
- Competência/fatura em análise: ${invoiceYm||'AAAA-MM'}
- Valor total informado da fatura: ${totalLabel}

FORMATO OBRIGATÓRIO
- Gere CSV UTF-8 separado por ponto e vírgula (;).
- Entregue também o arquivo .csv para download, se a interface permitir.
- A primeira linha deve ser EXATAMENTE:
data;descricao;categoria;valor;parcelas;parcela_atual;valor_parcela;primeira_fatura;cartao;tipo;ultima_fatura;observacao
- Não use bloco Markdown, tabela Markdown ou texto explicativo dentro do CSV.
- Uma linha por lançamento.
- Não use separador de milhar. Para valores, use vírgula decimal: 242,15.
- data: formato AAAA-MM-DD.
- primeira_fatura e ultima_fatura: formato AAAA-MM.
- cartao: use exatamente "${cardName||'Cartão'}".
- categoria: escolha apenas uma destas categorias: ${cats}.

REGRAS PARA COMPRAS PARCELADAS
1. "valor" é o VALOR TOTAL DA COMPRA, não o valor da parcela.
2. "parcelas" é a quantidade TOTAL de parcelas.
3. "parcela_atual" é o número da parcela que aparece nesta fatura.
4. "valor_parcela" é somente o valor cobrado NESTA fatura.
5. "primeira_fatura" é a competência da parcela 1.
6. Se a fatura mostrar algo como "PARC 07/11" e esta fatura for ${invoiceYm||'AAAA-MM'}:
   - parcelas = 11
   - parcela_atual = 7
   - valor_parcela = valor efetivamente cobrado nesta fatura
   - primeira_fatura = seis meses antes de ${invoiceYm||'AAAA-MM'}
   - valor = valor_parcela × 11, salvo se o documento informar explicitamente outro valor total.
7. Se houver arredondamento entre parcelas, preserve o valor_parcela exatamente como aparece na fatura e use o valor total informado no documento quando disponível.
8. Não transforme compra parcelada em compra à vista só porque o valor total aparece no documento.

REGRAS PARA COMPRAS À VISTA
- parcelas = 1
- parcela_atual = 1
- valor_parcela = valor
- primeira_fatura = ${invoiceYm||'AAAA-MM'}
- tipo = parcelada

REGRAS PARA COBRANÇAS RECORRENTES
- tipo = recorrente
- valor = valor mensal cobrado
- parcelas, parcela_atual e valor_parcela podem ficar vazios
- primeira_fatura = primeira competência que puder ser determinada; se não for possível, use ${invoiceYm||'AAAA-MM'}
- ultima_fatura fica vazia se não houver término conhecido.

O QUE INCLUIR
- Compras, assinaturas, tarifas, juros e IOF que efetivamente compõem o valor da fatura.
- Preserve a descrição do estabelecimento de forma fiel, apenas removendo ruído evidente.

O QUE NÃO INCLUIR
- Pagamento da própria fatura.
- Limite disponível, limite total, saldo anterior, totalizadores, subtotais e textos informativos.
- Estornos/créditos negativos, salvo se eu pedir explicitamente.

VALIDAÇÃO ANTES DE GERAR
- Para toda linha parcelada com parcelas > 1, confirme que parcela_atual, valor_parcela e primeira_fatura foram preenchidos.
- Confira se primeira_fatura + (parcela_atual - 1 meses) = ${invoiceYm||'AAAA-MM'}.
- Confira se nenhuma compra parcelada foi convertida para parcelas=1.
- Confira se o CSV possui exatamente as 12 colunas solicitadas, sempre na mesma ordem.
- Se o valor total da fatura tiver sido informado, use-o apenas como referência de conferência. Não invente lançamentos para forçar o fechamento; o Prumo fará a conciliação de eventual diferença.

Na coluna observacao, registre informações úteis para auditoria, por exemplo: "Na fatura ${invoiceYm||'AAAA-MM'} aparece como PARC 07/11; valor da parcela R$ 386,65; valor total inferido pela multiplicação da parcela pelo total de parcelas.".`;
  }

  async function copyAiPrompt(){
    const el=document.getElementById('csvAiPrompt');if(!el)return;
    const textValue=el.value;
    try{await navigator.clipboard.writeText(textValue)}
    catch(_e){el.focus();el.select();document.execCommand('copy')}
    const btn=document.getElementById('csvCopyPromptBtn');
    if(btn){const old=btn.textContent;btn.textContent='Prompt copiado ✓';setTimeout(()=>btn.textContent=old,1600)}
  }

  function updateAiPrompt(){
    const el=document.getElementById('csvAiPrompt');if(!el)return;
    const target=getCard(csvContextCardId||selectedCardId);
    const ym=csvContextYm||selectedInvoiceYm||state.settings.selectedMonth;
    const invoiceTotal=parseMoney(document.getElementById('csvInvoiceTotal')?.value);
    el.value=aiCsvPrompt(target?.name||'Cartão',ym,invoiceTotal);
  }

  function buildCsvModal(){
    if(document.getElementById('csvPurchaseModal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="csvPurchaseModal"><div class="modal" style="max-width:980px"><form id="csvPurchaseForm"><div class="modal-head"><div><h3>Importar compras por CSV</h3><div class="muted">Prepare o arquivo com IA e importe na fatura correta</div></div><button type="button" class="btn ghost" id="csvPurchaseClose">✕</button></div><div class="modal-body"><div class="notice" style="margin-bottom:14px"><strong id="csvImportContext">Fatura selecionada</strong><br>O arquivo importado será vinculado a este cartão e a esta fatura.</div><div class="card" style="margin-bottom:14px;padding:16px"><div class="section-head" style="margin-bottom:10px"><div><h3 style="font-size:15px">1. Prepare o CSV com uma IA</h3><div class="muted">Anexe sua fatura à IA, cole este prompt e peça o arquivo CSV.</div></div><button type="button" class="btn primary" id="csvCopyPromptBtn">Copiar prompt</button></div><textarea id="csvAiPrompt" readonly spellcheck="false" style="width:100%;min-height:210px;resize:vertical;font:11px/1.5 'DM Mono',monospace;background:#081321;color:#cbd7e4;border:1px solid #2a3c55;border-radius:10px;padding:12px;box-sizing:border-box"></textarea></div><div class="card" style="padding:16px"><div class="section-head" style="margin-bottom:10px"><div><h3 style="font-size:15px">2. Importe o arquivo gerado</h3><div class="muted">O Prumo valida e cadastra os lançamentos na fatura.</div></div><button type="button" class="btn" id="csvTemplateBtn">Baixar modelo CSV</button></div><div class="form-grid"><div class="field"><label>Cartão</label><select id="csvPurchaseCard"></select></div><div class="field"><label>Fatura em análise</label><input type="month" id="csvPurchaseInvoice" required></div><div class="field"><label>Valor da fatura (R$)</label><input id="csvInvoiceTotal" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"><small class="muted">Opcional. O Prumo usa este valor para conciliar a soma dos itens importados.</small></div><div class="field"><label>Categoria padrão</label><select id="csvPurchaseCategory"></select></div><div class="field"><label>Arquivo CSV</label><input type="file" id="csvPurchaseFile" accept=".csv,text/csv" required></div><div class="field full"><label class="toggle"><input type="checkbox" id="csvSkipDuplicates" checked> Ignorar compras já importadas</label></div></div><p class="muted" style="margin-top:12px">Formato esperado: data, descricao, categoria, valor, parcelas, parcela_atual, valor_parcela, primeira_fatura, cartao, tipo, ultima_fatura e observacao.</p><div id="csvImportSummary" class="notice" style="display:none;margin-top:14px"></div></div></div><div class="modal-foot"><button type="button" class="btn" id="csvPurchaseCancel">Cancelar</button><button class="btn primary" type="submit">Importar compras</button></div></form></div></div>`);
    document.getElementById('csvPurchaseClose').onclick=closeCsvImport;
    document.getElementById('csvPurchaseCancel').onclick=closeCsvImport;
    document.getElementById('csvPurchaseModal').addEventListener('click',e=>{if(e.target.id==='csvPurchaseModal')closeCsvImport()});
    document.getElementById('csvTemplateBtn').onclick=downloadTemplate;
    document.getElementById('csvCopyPromptBtn').onclick=copyAiPrompt;
    document.getElementById('csvInvoiceTotal').addEventListener('input',updateAiPrompt);
    document.getElementById('csvPurchaseForm').onsubmit=importPurchases;
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
    const targetInvoice=getInvoice(csvContextCardId,csvContextYm);
    const totalInput=document.getElementById('csvInvoiceTotal');
    if(totalInput)totalInput.value=Number(targetInvoice?.statementTotal)>0?Number(targetInvoice.statementTotal).toFixed(2):'';
    if(ctx)ctx.textContent=`${target?.name||'Cartão'} • ${typeof fmtMonth==='function'?fmtMonth(csvContextYm):csvContextYm}`;
    updateAiPrompt();
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
      invoiceTotal=parseMoney(document.getElementById('csvInvoiceTotal')?.value),
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
      let reconciliationText='';
      if(Number.isFinite(invoiceTotal)&&invoiceTotal>=0&&csvContextCardId&&csvContextYm){
        const inv=ensureInvoice(csvContextCardId,csvContextYm);
        const allocated=round2(invoiceItems(csvContextCardId,csvContextYm).reduce((sum,x)=>sum+(Number(x.alloc?.amount)||0),0));
        inv.statementTotal=round2(invoiceTotal);
        inv.adjustment=round2(invoiceTotal-allocated);
        inv.reconciledAt=new Date().toISOString();
        reconciliationText=` Valor da fatura: ${fmtMoney(invoiceTotal)}; itens: ${fmtMoney(allocated)}; ajuste de conciliação: ${fmtMoney(inv.adjustment)}.`;
      }
      if(imported){
        selectedCardId=first.cardId;selectedInvoiceYm=csvContextYm||first.firstInvoiceYm;state.settings.selectedMonth=selectedInvoiceYm;renderAll();
      }else if(Number.isFinite(invoiceTotal)&&csvContextCardId&&csvContextYm){
        selectedCardId=csvContextCardId;selectedInvoiceYm=csvContextYm;state.settings.selectedMonth=csvContextYm;renderAll();
      }
      summary.textContent=`Importação concluída: ${imported} compra(s) adicionada(s), ${installmentRows} parcelada(s) reconhecida(s), ${duplicates} duplicata(s) ignorada(s) e ${ignored} linha(s) inválida(s).${reconciliationText}`;
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