(function(){
  window.__prumoCsvPromptUiVersion='ai-prompt-v3';
  const normalizeKey=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const aliases={date:['data','date','data_compra','data_da_compra'],description:['descricao','description','estabelecimento','merchant','compra','historico','lancamento'],category:['categoria','category'],amount:['valor','amount','valor_total','total','preco'],invoiceTotal:['valor_fatura','total_fatura','valor_total_fatura','invoice_total','statement_total'],installments:['parcelas','parcela','installments','qtd_parcelas','numero_parcelas','n_parcelas','total_parcelas','parcela_total'],installmentCurrent:['parcela_atual','parcela_corrente','numero_parcela','n_parcela','installment_current','current_installment'],installmentValue:['valor_parcela','valor_da_parcela','valor_parcela_atual','parcela_valor','installment_value'],firstInvoice:['primeira_fatura','fatura','competencia','mes_fatura','mes_da_fatura'],card:['cartao','card','nome_cartao'],notes:['observacao','observacoes','notes','memo'],mode:['tipo','mode','modalidade'],recurringEnd:['ultima_fatura','fim_recorrencia','fim_da_recorrencia']};
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
  function normalizeDescription(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
  function descriptionSimilarity(a,b){
    const x=normalizeDescription(a),y=normalizeDescription(b);if(!x||!y)return 0;if(x===y)return 1;
    const A=new Set(x.split(' ').filter(t=>t.length>1)),B=new Set(y.split(' ').filter(t=>t.length>1));let common=0;
    A.forEach(t=>{if(B.has(t))common++});return common/Math.max(A.size||1,B.size||1);
  }
  function daysApart(a,b){
    const x=Date.parse(String(a||'')+'T12:00:00Z'),y=Date.parse(String(b||'')+'T12:00:00Z');
    return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/86400000:999;
  }
  function cents(value){return Math.round((Number(value)||0)*100)}
  function candidateInvoiceAmount(p){
    if((p.mode||'parcelada')==='recorrente')return round2(Number(p.totalAmount)||0);
    if(Number.isFinite(Number(p.installmentValue))&&Number(p.installmentValue)>0)return round2(Number(p.installmentValue));
    const n=Math.max(1,Number(p.installments)||1);return round2((Number(p.totalAmount)||0)/n);
  }
  function existingInvoiceEntries(cardId,ym){
    try{return invoiceItems(cardId,ym).map(x=>({purchase:x.purchase,amount:round2(Number(x.alloc?.amount)||0)}))}
    catch(_e){return[]}
  }
  function exactPurchaseMatch(p){
    return state.purchases.find(x=>x.cardId===p.cardId&&x.date===p.date&&normalizeKey(x.description)===normalizeKey(p.description)&&round2(x.totalAmount)===round2(p.totalAmount)&&(x.firstInvoiceYm||'')===(p.firstInvoiceYm||'')&&Number(x.installments||0)===Number(p.installments||0)&&(x.mode||'parcelada')===(p.mode||'parcelada'))||null;
  }
  function classifyCsvCandidates(candidates,cardId,invoiceYm){
    const existing=existingInvoiceEntries(cardId,invoiceYm),used=new Set();
    return candidates.map((item,index)=>{
      const p=item.purchase,amount=candidateInvoiceAmount(p),structural=exactPurchaseMatch(p);
      if(structural){
        const j=existing.findIndex((e,k)=>!used.has(k)&&e.purchase?.id===structural.id);if(j>=0)used.add(j);
        return{...item,index,status:'duplicate',existing:structural,existingAmount:j>=0?existing[j].amount:null};
      }
      let j=existing.findIndex((e,k)=>!used.has(k)&&cents(e.amount)===cents(amount)&&e.purchase?.date===p.date&&descriptionSimilarity(e.purchase?.description,p.description)>=.72);
      if(j>=0){used.add(j);return{...item,index,status:'duplicate',existing:existing[j].purchase,existingAmount:existing[j].amount}}
      j=existing.findIndex((e,k)=>!used.has(k)&&cents(e.amount)===cents(amount)&&descriptionSimilarity(e.purchase?.description,p.description)>=.72&&daysApart(e.purchase?.date,p.date)<=3);
      if(j>=0){used.add(j);return{...item,index,status:'possible',existing:existing[j].purchase,existingAmount:existing[j].amount}}
      return{...item,index,status:'new',existing:null,existingAmount:null};
    });
  }
  function csvFileKey(file){return file?String(file.name||'')+'|'+String(file.size||0)+'|'+String(file.lastModified||0):''}
  let csvReviewState=null;
  function csvSubmitButton(){return document.querySelector('#csvPurchaseForm button[type="submit"]')}
  function resetCsvReview(){
    csvReviewState=null;document.getElementById('csvImportReview')?.remove();
    const btn=csvSubmitButton();if(btn)btn.textContent='Verificar compras';
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function reviewMoney(value){try{return fmtMoney(Number(value)||0)}catch(_e){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0)}}
  function renderCsvReview(review){
    document.getElementById('csvImportReview')?.remove();
    const summary=document.getElementById('csvImportSummary'),panel=document.createElement('div');panel.id='csvImportReview';panel.className='card';
    panel.style.cssText='margin-top:14px;padding:16px;border-color:#334155';
    const counts={new:review.candidates.filter(x=>x.status==='new').length,duplicate:review.candidates.filter(x=>x.status==='duplicate').length,possible:review.candidates.filter(x=>x.status==='possible').length};
    panel.innerHTML='<div class="section-head" style="margin-bottom:10px"><div><h3 style="font-size:15px">3. Revise antes de importar</h3><div class="muted">'+counts.new+' nova(s) • '+counts.duplicate+' já cadastrada(s) • '+counts.possible+' possível(is) duplicata(s)</div></div></div><div class="notice" style="margin-bottom:12px">Compras já cadastradas e possíveis duplicatas começam desmarcadas. Marque <strong>Importar mesmo assim</strong> somente se forem lançamentos diferentes.</div><div id="csvImportReviewList" style="display:grid;gap:9px;max-height:390px;overflow:auto"></div>';
    const list=panel.querySelector('#csvImportReviewList');
    review.candidates.forEach((item,i)=>{
      const p=item.purchase,label=item.status==='new'?'Nova compra':item.status==='duplicate'?'Já cadastrada':'Possível duplicata';
      const color=item.status==='new'?'#86efac':item.status==='duplicate'?'#fca5a5':'#fde68a';
      const checked=item.status==='new'||(item.status==='duplicate'&&!review.skipDuplicates);
      const row=document.createElement('label');row.style.cssText='display:block;padding:11px 12px;border:1px solid #29394f;border-radius:12px;background:#0b1625;cursor:pointer';
      const existing=item.existing?'<div style="margin-top:7px;padding:8px 10px;border-radius:9px;background:#081321;border:1px solid #25364d"><div class="muted" style="font-size:9px;margin-bottom:3px">JÁ CADASTRADA</div><div style="font-size:11px"><strong>'+escapeHtml(item.existing.description||'Compra')+'</strong> • '+escapeHtml(item.existing.date||'—')+' • '+reviewMoney(item.existingAmount??candidateInvoiceAmount(item.existing))+'</div></div>':'';
      row.innerHTML='<div style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" data-csv-review-index="'+i+'" '+(checked?'checked':'')+' style="margin-top:3px"><div style="min-width:0;flex:1"><div style="display:flex;gap:8px;justify-content:space-between;align-items:center"><strong style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(p.description)+'</strong><span style="font-size:9px;font-weight:800;color:'+color+';white-space:nowrap">'+label+'</span></div><div class="muted" style="font-size:10px;margin-top:4px">'+escapeHtml(p.date)+' • '+reviewMoney(candidateInvoiceAmount(p))+(Number(p.installments)>1?' • parcela '+(item.installmentCurrent||'?')+'/'+p.installments:'')+'</div>'+existing+'<div class="muted" style="font-size:9px;margin-top:6px">'+(item.status==='new'?'Será importada.':'Importar mesmo assim')+'</div></div></div>';
      list.appendChild(row);
    });
    summary.insertAdjacentElement('afterend',panel);
    const btn=csvSubmitButton();if(btn)btn.textContent='Confirmar importação';
  }


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
data;descricao;categoria;valor;valor_fatura;parcelas;parcela_atual;valor_parcela;primeira_fatura;cartao;tipo;ultima_fatura;observacao
- Não use bloco Markdown, tabela Markdown ou texto explicativo dentro do CSV.
- Uma linha por lançamento.
- Não use separador de milhar. Para valores, use vírgula decimal: 242,15.
- data: formato AAAA-MM-DD.
- primeira_fatura e ultima_fatura: formato AAAA-MM.
- valor_fatura: valor TOTAL da fatura analisada. Repita o MESMO valor em todas as linhas do CSV.
- cartao: use exatamente "${cardName||'Cartão'}".
- categoria: escolha apenas uma destas categorias: ${cats}.

REGRAS PARA O VALOR DA FATURA
1. Identifique no documento o valor total da fatura / total a pagar.
2. Preencha esse valor na coluna "valor_fatura".
3. Repita exatamente o mesmo "valor_fatura" em TODAS as linhas.
4. "valor_fatura" NÃO é o valor da compra, da parcela ou o somatório parcial de uma seção.
5. Se houver mais de um total no documento, use o total final efetivamente devido na fatura analisada.
6. Se não for possível determinar o total com segurança, deixe "valor_fatura" vazio e explique o motivo em observacao.

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
- Confira se o CSV possui exatamente as 13 colunas solicitadas, sempre na mesma ordem.
- Confira se "valor_fatura" é idêntico em todas as linhas e corresponde ao total final da fatura, não ao subtotal das compras.
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
    el.value=aiCsvPrompt(target?.name||'Cartão',ym,null);
  }

  function buildCsvModal(){
    const existing=document.getElementById('csvPurchaseModal');
    if(existing?.dataset?.csvUiVersion==='ai-prompt-v3')return;
    if(existing)existing.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="csvPurchaseModal" data-csv-ui-version="ai-prompt-v3"><div class="modal" style="max-width:980px"><form id="csvPurchaseForm"><div class="modal-head"><div><h3>Importar compras por CSV</h3><div class="muted">Prepare o arquivo com IA e importe na fatura correta</div></div><button type="button" class="btn ghost" id="csvPurchaseClose">✕</button></div><div class="modal-body"><div class="notice" style="margin-bottom:14px"><strong id="csvImportContext">Fatura selecionada</strong><br>O arquivo importado será vinculado a este cartão e a esta fatura.</div><div class="card" style="margin-bottom:14px;padding:16px"><div class="section-head" style="margin-bottom:10px"><div><h3 style="font-size:15px">1. Copie o prompt para a IA</h3><div class="muted">Anexe a fatura à sua IA, cole o prompt abaixo e peça para ela gerar o arquivo CSV.</div></div><button type="button" class="btn primary" id="csvCopyPromptBtn">Copiar prompt para IA</button></div><textarea id="csvAiPrompt" readonly spellcheck="false" style="width:100%;min-height:210px;resize:vertical;font:11px/1.5 'DM Mono',monospace;background:#081321;color:#cbd7e4;border:1px solid #2a3c55;border-radius:10px;padding:12px;box-sizing:border-box"></textarea></div><div class="card" style="padding:16px"><div class="section-head" style="margin-bottom:10px"><div><h3 style="font-size:15px">2. Importe o arquivo gerado</h3><div class="muted">Depois que a IA gerar o CSV, selecione o arquivo abaixo. O Prumo valida e cadastra os lançamentos na fatura.</div></div></div><div class="form-grid"><div class="field"><label>Cartão</label><select id="csvPurchaseCard"></select></div><div class="field"><label>Fatura em análise</label><input type="month" id="csvPurchaseInvoice" required></div><div class="field"><label>Categoria padrão</label><select id="csvPurchaseCategory"></select></div><div class="field"><label>Arquivo CSV</label><input type="file" id="csvPurchaseFile" accept=".csv,text/csv" required></div><div class="field full"><label class="toggle"><input type="checkbox" id="csvSkipDuplicates" checked> Ignorar compras já importadas</label></div></div><p class="muted" style="margin-top:12px">Formato esperado: data, descricao, categoria, valor, valor_fatura, parcelas, parcela_atual, valor_parcela, primeira_fatura, cartao, tipo, ultima_fatura e observacao.</p><div id="csvImportSummary" class="notice" style="display:none;margin-top:14px"></div></div></div><div class="modal-foot"><button type="button" class="btn" id="csvPurchaseCancel">Cancelar</button><button class="btn primary" type="submit">Importar compras</button></div></form></div></div>`);
    document.getElementById('csvPurchaseClose').onclick=closeCsvImport;
    document.getElementById('csvPurchaseCancel').onclick=closeCsvImport;
    document.getElementById('csvPurchaseModal').addEventListener('click',e=>{if(e.target.id==='csvPurchaseModal')closeCsvImport()});
    document.getElementById('csvCopyPromptBtn').onclick=copyAiPrompt;
    document.getElementById('csvPurchaseForm').onsubmit=importPurchases;
    document.getElementById('csvPurchaseFile').onchange=resetCsvReview;
    const csvSubmit=csvSubmitButton();if(csvSubmit)csvSubmit.textContent='Verificar compras';
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
    updateAiPrompt();
    resetCsvReview();
    const s=document.getElementById('csvImportSummary');s.style.display='none';s.textContent='';
    document.getElementById('csvPurchaseFile').value='';
    document.getElementById('csvPurchaseModal').classList.add('open');
  }
  function closeCsvImport(){
    document.getElementById('csvPurchaseModal')?.classList.remove('open');
    resetCsvReview();
    csvContextCardId='';csvContextYm='';
    const card=document.getElementById('csvPurchaseCard'),invoice=document.getElementById('csvPurchaseInvoice');
    if(card)card.disabled=false;if(invoice)invoice.disabled=false;
  }
  function downloadTemplate(){const csv='\ufeffdata;descricao;categoria;valor;valor_fatura;parcelas;parcela_atual;valor_parcela;primeira_fatura;cartao;tipo;ultima_fatura;observacao\n2026-09-12;Amazon;Compras;1452,90;4012,70;6;1;242,15;2026-09;BB Gabriel;parcelada;;Exemplo de compra parcelada',blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modelo-compras.csv';a.click();URL.revokeObjectURL(a.href)}
  async function importPurchases(e){
    e.preventDefault();
    const file=document.getElementById('csvPurchaseFile').files[0];if(!file)return;
    const fallbackCard=document.getElementById('csvPurchaseCard').value,
      fallbackInvoice=document.getElementById('csvPurchaseInvoice').value||state.settings.selectedMonth,
      fallbackCategory=document.getElementById('csvPurchaseCategory').value||'Compras',
      skip=document.getElementById('csvSkipDuplicates').checked,
      summary=document.getElementById('csvImportSummary'),
      fileKey=csvFileKey(file);

    if(!csvReviewState||csvReviewState.fileKey!==fileKey){
      summary.style.display='block';summary.textContent='Verificando compras já cadastradas…';
      try{
        const rows=parseCSV(await file.text());if(rows.length<2)throw new Error('O arquivo não contém linhas de dados.');
        const headers=rows[0].map(v=>String(v).trim()),col={};Object.entries(aliases).forEach(([k,v])=>col[k]=findColumn(headers,v));
        if(col.description<0||col.amount<0)throw new Error('O CSV precisa ter as colunas descricao e valor.');
        let ignored=0,installmentRows=0,invoiceTotal=null,invoiceTotalConflict=false;
        const candidates=[],importedAt=new Date().toISOString();
        for(let i=1;i<rows.length;i++){
          const r=rows[i],get=k=>col[k]>=0?(r[col[k]]??''):'',
            description=String(get('description')).trim(),amount=parseMoney(get('amount')),
            notes=String(get('notes')).trim(),rowText=r.map(v=>String(v??'')).join(' ');
          if(!description||!Number.isFinite(amount)||amount<=0){ignored++;continue}
          const rowInvoiceTotal=parseMoney(get('invoiceTotal'));
          if(Number.isFinite(rowInvoiceTotal)&&rowInvoiceTotal>=0){
            if(invoiceTotal===null)invoiceTotal=round2(rowInvoiceTotal);
            else if(Math.abs(invoiceTotal-round2(rowInvoiceTotal))>0.009)invoiceTotalConflict=true;
          }
          const firstInvoiceYm=parseMonth(get('firstInvoice'),csvContextYm||fallbackInvoice),
            targetCardId=csvContextCardId||resolveCard(get('card'),fallbackCard),
            mode=normalizeKey(get('mode')).includes('recorr')?'recorrente':'parcelada';
          let installments=null,installmentValue=null,installmentCurrent=null,installmentTotal=null;
          if(mode!=='recorrente'){
            const info=parseInstallmentInfo(get('installments'),get('installmentCurrent'),rowText);
            installmentTotal=info.total;installments=info.total;installmentCurrent=info.current;
            const hasExplicitCurrent=/\bparc(?:ela)?\.?\s*\d{1,3}\s*[\/-]\s*\d{1,3}\b/i.test(rowText)||String(get('installmentCurrent')||'').trim()!=='';
            if(!hasExplicitCurrent&&installments>1&&firstInvoiceYm&&csvContextYm)installmentCurrent=Math.max(1,Math.min(installments,monthDiff(firstInvoiceYm,csvContextYm)+1));
            installmentValue=parseInstallmentValue(get('installmentValue'),rowText,amount,installments);
            if(installments>1||installmentCurrent>1)installmentRows++;
          }
          const p={id:uid(),cardId:targetCardId,date:parseDate(get('date'),firstInvoiceYm),description,category:resolveCategory(get('category'),fallbackCategory),mode,totalAmount:amount,installments,installmentValue,firstInvoiceYm,recurringEnd:mode==='recorrente'?parseMonth(get('recurringEnd'),null):null,notes};
          if(mode!=='recorrente')p.chatgptImport={source:'csv',importedAt,invoiceYm:csvContextYm||fallbackInvoice,installmentCurrent,installmentTotal};
          candidates.push({purchase:p,installmentCurrent,installmentTotal});
        }
        if(invoiceTotalConflict)throw new Error('O CSV contém valores diferentes na coluna valor_fatura. Gere novamente o arquivo com o mesmo total da fatura em todas as linhas.');
        const targetCardId=csvContextCardId||fallbackCard,invoiceYm=csvContextYm||fallbackInvoice;
        const classified=classifyCsvCandidates(candidates,targetCardId,invoiceYm);
        csvReviewState={fileKey,candidates:classified,ignored,installmentRows,invoiceTotal,targetCardId,invoiceYm,skipDuplicates:skip};
        const counts={n:classified.filter(x=>x.status==='new').length,d:classified.filter(x=>x.status==='duplicate').length,p:classified.filter(x=>x.status==='possible').length};
        summary.textContent='Verificação concluída: '+counts.n+' nova(s), '+counts.d+' já cadastrada(s), '+counts.p+' possível(is) duplicata(s) e '+ignored+' linha(s) inválida(s).';
        renderCsvReview(csvReviewState);return;
      }catch(err){
        console.error(err);summary.textContent='Não foi possível verificar: '+(err.message||'arquivo inválido.');resetCsvReview();return;
      }
    }

    summary.style.display='block';summary.textContent='Importando compras selecionadas…';
    try{
      const selected=new Set([...document.querySelectorAll('[data-csv-review-index]:checked')].map(el=>Number(el.dataset.csvReviewIndex)));
      let imported=0,first=null,forcedDuplicates=0,forcedPossible=0;
      csvReviewState.candidates.forEach((item,i)=>{
        if(!selected.has(i))return;
        const p=item.purchase;state.purchases.push(p);ensureInvoice(p.cardId,p.firstInvoiceYm);imported++;if(!first)first=p;
        if(item.status==='duplicate')forcedDuplicates++;if(item.status==='possible')forcedPossible++;
      });
      let reconciliationText='';
      const invoiceTotal=csvReviewState.invoiceTotal;
      if(Number.isFinite(invoiceTotal)&&invoiceTotal>=0&&csvReviewState.targetCardId&&csvReviewState.invoiceYm){
        const inv=ensureInvoice(csvReviewState.targetCardId,csvReviewState.invoiceYm);
        const allocated=round2(invoiceItems(csvReviewState.targetCardId,csvReviewState.invoiceYm).reduce((sum,x)=>sum+(Number(x.alloc?.amount)||0),0));
        inv.statementTotal=round2(invoiceTotal);inv.adjustment=round2(invoiceTotal-allocated);inv.reconciledAt=new Date().toISOString();
        reconciliationText=' Valor da fatura: '+fmtMoney(invoiceTotal)+'; itens: '+fmtMoney(allocated)+'; ajuste de conciliação: '+fmtMoney(inv.adjustment)+'.';
      }
      const excludedDuplicates=csvReviewState.candidates.filter((x,i)=>x.status==='duplicate'&&!selected.has(i)).length;
      const excludedPossible=csvReviewState.candidates.filter((x,i)=>x.status==='possible'&&!selected.has(i)).length;
      if(imported){
        selectedCardId=first.cardId;selectedInvoiceYm=csvReviewState.invoiceYm||first.firstInvoiceYm;state.settings.selectedMonth=selectedInvoiceYm;renderAll();
      }else if(Number.isFinite(invoiceTotal)&&csvReviewState.targetCardId&&csvReviewState.invoiceYm){
        selectedCardId=csvReviewState.targetCardId;selectedInvoiceYm=csvReviewState.invoiceYm;state.settings.selectedMonth=selectedInvoiceYm;renderAll();
      }
      summary.textContent='Importação concluída: '+imported+' compra(s) adicionada(s), '+excludedDuplicates+' já cadastrada(s) mantida(s) fora da importação e '+excludedPossible+' possível(is) duplicata(s) não importada(s).'+(forcedDuplicates||forcedPossible?' Importadas manualmente apesar do alerta: '+(forcedDuplicates+forcedPossible)+'.':'')+reconciliationText;
      document.getElementById('csvPurchaseFile').value='';resetCsvReview();
    }catch(err){
      console.error(err);summary.textContent='Não foi possível importar: '+(err.message||'arquivo inválido.');
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