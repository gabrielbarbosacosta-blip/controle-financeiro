(function(){
  if(window.__financeCounterpartyObligationsV1Loaded)return;
  window.__financeCounterpartyObligationsV1Loaded=true;

  const STYLE_ID='finance-counterparty-obligations-v1-style';
  let map=new Map();
  let loading=false;
  let submitting=false;
  let resolvedCpf='';
  let resolvedUserId='';
  let resolvedName='';
  let historyObserver=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,11);
  const cpfMask=v=>digits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');
  const relationLabel=r=>r==='creditor'?'Credor':'Devedor';
  const statusLabel=s=>s==='accepted'?'Confirmado':s==='pending'?'Aguardando confirmação':s==='rejected'?'Vínculo recusado':'CPF externo';

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .counterparty-box{grid-column:1/-1;border:1px solid rgba(148,163,184,.16);border-radius:13px;background:#0b1424;padding:11px 12px}
      .counterparty-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .counterparty-toggle-main{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:760}
      .counterparty-body{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:10px}
      .counterparty-body .field{margin:0}.counterparty-state{grid-column:1/-1;font-size:10px;color:var(--muted);min-height:14px}
      .counterparty-state.ok{color:#86efac}.counterparty-state.bad{color:#fca5a5}.counterparty-state.warn{color:#fde68a}
      .counterparty-history{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
      .counterparty-chip{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;border:1px solid #334155;background:#111827;color:#cbd5e1;font-size:8px;font-weight:760}
      .counterparty-chip.accepted{border-color:#28513e;background:#102a20;color:#a5e2c8}.counterparty-chip.pending{border-color:#5a4824;background:#2a2213;color:#ead38f}.counterparty-chip.rejected{border-color:#7f1d1d;background:#2a1515;color:#fecaca}
      @media(max-width:620px){.counterparty-body{grid-template-columns:1fr}.counterparty-body .btn{width:100%}}
    `;document.head.appendChild(s);
  }

  function ensureField(){
    injectStyles();
    if(document.getElementById('txCounterpartyBox'))return true;
    const grid=document.querySelector('#txForm .form-grid');if(!grid)return false;
    const notes=document.getElementById('txNotes')?.closest('.field');
    const box=document.createElement('div');box.className='counterparty-box';box.id='txCounterpartyBox';
    box.innerHTML=`<div class="counterparty-toggle"><label class="counterparty-toggle-main"><input type="checkbox" id="txCounterpartyEnabled"> <span id="txCounterpartyToggleLabel">Vincular credor</span></label><span class="muted" style="font-size:9px">Opcional</span></div><div class="counterparty-body" id="txCounterpartyBody" style="display:none"><div class="field"><label id="txCounterpartyCpfLabel">CPF do credor</label><input id="txCounterpartyCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div><button type="button" class="btn small" id="txCounterpartyLookup">Buscar CPF</button><div class="counterparty-state" id="txCounterpartyState"></div></div>`;
    grid.insertBefore(box,notes||null);
    document.getElementById('txCounterpartyEnabled').addEventListener('change',syncField);
    document.getElementById('txCounterpartyCpf').addEventListener('input',e=>{e.target.value=cpfMask(e.target.value);resolvedCpf='';resolvedUserId='';resolvedName='';setState('')});
    document.getElementById('txCounterpartyLookup').addEventListener('click',lookupCpf);
    document.getElementById('txType')?.addEventListener('change',syncField);
    return true;
  }

  function setState(text,kind=''){
    const el=document.getElementById('txCounterpartyState');if(!el)return;el.textContent=text;el.className=`counterparty-state ${kind}`.trim();
  }

  function currentType(){return document.getElementById('txType')?.value||'Despesa'}
  function currentRelation(){return currentType()==='Despesa'?'creditor':'debtor'}

  function syncField(){
    if(!ensureField())return;
    const type=currentType(),editing=!!document.getElementById('txId')?.value;
    const box=document.getElementById('txCounterpartyBox'),enabled=document.getElementById('txCounterpartyEnabled');
    const allowed=(type==='Despesa'||type==='Receita')&&!editing;
    box.style.display=allowed?'block':'none';
    if(!allowed){enabled.checked=false;document.getElementById('txCounterpartyBody').style.display='none';return}
    const rel=type==='Despesa'?'credor':'devedor';
    document.getElementById('txCounterpartyToggleLabel').textContent=`Vincular ${rel}`;
    document.getElementById('txCounterpartyCpfLabel').textContent=`CPF do ${rel}`;
    document.getElementById('txCounterpartyBody').style.display=enabled.checked?'grid':'none';
    if(enabled.checked){
      const shared=document.getElementById('sharedExpenseBox');if(shared)shared.open=false;
    }
  }

  async function lookupCpf(){
    const input=document.getElementById('txCounterpartyCpf'),cpf=digits(input?.value);
    if(cpf.length!==11){setState('Informe os 11 dígitos do CPF.','bad');return}
    setState('Buscando…');
    try{
      const {data,error}=await getSb().rpc('finance_find_profile_by_cpf',{p_cpf:cpf});
      if(error)throw error;
      if(data?.ok===false)throw new Error(data.error||'lookup_failed');
      if(data?.found&&String(data.userId||'')===String(getUserId()||'')){setState('Use o CPF de outra pessoa.','bad');return}
      resolvedCpf=cpf;
      if(data?.found){
        resolvedUserId=String(data.userId||'');resolvedName=data.nickname||data.fullName||'Pessoa cadastrada';
        setState(`✓ ${resolvedName} · usuário do Prumo`,'ok');
      }else{
        resolvedUserId='';resolvedName='';
        setState('CPF não encontrado no Prumo. Será salvo como contraparte externa.','warn');
      }
    }catch(e){console.error('Falha ao buscar CPF da contraparte.',e);setState('Não foi possível consultar este CPF agora.','bad')}
  }

  function entryPayload(){
    return{
      date:document.getElementById('txDate')?.value||'',
      type:currentType(),
      category:document.getElementById('txCategory')?.value||'Outros',
      description:document.getElementById('txDescription')?.value?.trim()||'',
      account:document.getElementById('txAccount')?.value?.trim()||'',
      nature:document.getElementById('txNature')?.value||'Extra',
      amount:Number(document.getElementById('txAmount')?.value)||0,
      status:document.getElementById('txStatus')?.value||'Pendente',
      installmentCurrent:Number(document.getElementById('txInstallmentCurrent')?.value)||null,
      installmentTotal:Number(document.getElementById('txInstallmentTotal')?.value)||null,
      recurring:!!document.getElementById('txRecurring')?.checked,
      recurringEnd:document.getElementById('txRecurringEnd')?.value||null,
      projection:!!document.getElementById('txProjection')?.checked,
      notes:document.getElementById('txNotes')?.value?.trim()||''
    };
  }

  async function submitLinked(e){
    if(e.target?.id!=='txForm')return;
    const enabled=document.getElementById('txCounterpartyEnabled')?.checked;
    if(!enabled)return;
    if(document.getElementById('txId')?.value)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(submitting)return;
    const cpf=digits(document.getElementById('txCounterpartyCpf')?.value);
    const entry=entryPayload();
    if(cpf.length!==11){setState('Informe um CPF válido com 11 dígitos.','bad');return}
    if(!entry.description||entry.amount<=0){setState('Preencha descrição e valor do lançamento.','bad');return}
    if(entry.type!=='Despesa'&&entry.type!=='Receita'){setState('Vínculo por CPF está disponível para despesas e receitas.','bad');return}
    submitting=true;setState('Salvando lançamento e vínculo…');
    try{
      const {data,error}=await getSb().rpc('finance_create_direct_obligation',{p_entry:entry,p_counterparty_cpf:cpf});
      if(error)throw error;
      if(!data?.ok){
        const msg={invalid_cpf:'CPF inválido.',counterparty_is_self:'Use o CPF de outra pessoa.',invalid_entry:'Preencha os dados do lançamento.'}[data?.error]||data?.detail||'Não foi possível criar o vínculo.';
        throw new Error(msg);
      }
      try{if(typeof closeModal==='function')closeModal('txModal')}catch(_e){}
      resetFormLink();
      if(window.financeCloud?.refresh)await window.financeCloud.refresh();
      await refreshDirect();
      try{await window.financeSharedExpensesRefresh?.()}catch(_e){}
      try{if(typeof renderAll==='function')renderAll()}catch(_e){}
      try{if(typeof setSyncStatus==='function')setSyncStatus(data.linked?`Lançamento criado · vínculo com ${data.counterpartyName||'contraparte'} aguardando confirmação`:'Lançamento criado · CPF externo vinculado')}catch(_e){}
    }catch(err){console.error('Falha ao criar lançamento com contraparte.',err);setState(err.message||'Não foi possível salvar o lançamento.','bad')}
    finally{submitting=false}
  }

  function resetFormLink(){
    const enabled=document.getElementById('txCounterpartyEnabled'),input=document.getElementById('txCounterpartyCpf');
    if(enabled)enabled.checked=false;if(input)input.value='';
    resolvedCpf='';resolvedUserId='';resolvedName='';setState('');syncField();
  }

  async function refreshDirect(){
    if(loading||!getUserId())return;loading=true;
    try{
      const {data,error}=await getSb().rpc('finance_list_direct_obligations');
      if(error)throw error;
      if(data?.ok===false)throw new Error(data.error||'load_failed');
      map=new Map((data?.items||[]).map(x=>[String(x.transactionId),x]));
      decorateHistory();
    }catch(e){console.warn('Falha ao carregar vínculos de credor/devedor.',e)}
    finally{loading=false}
  }

  function txIdFromRow(row){
    const btn=[...row.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').includes('editTx('));
    const m=String(btn?.getAttribute('onclick')||'').match(/editTx\(['"]([^'"]+)['"]\)/);
    return m?.[1]||'';
  }

  function decorateHistory(){
    const body=document.getElementById('historyBody');if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const id=txIdFromRow(row),info=map.get(String(id));if(!info)return;
      const cells=row.querySelectorAll('td');if(cells.length<3)return;
      const host=cells[2];
      if(!host.querySelector('.counterparty-history')){
        const wrap=document.createElement('div');wrap.className='counterparty-history';
        const rel=document.createElement('span');rel.className='counterparty-chip';rel.textContent=`${relationLabel(info.relationship)}: ${info.counterpartyName||'Pessoa externa'} · ${cpfMask(info.counterpartyCpf)}`;
        const st=document.createElement('span');st.className=`counterparty-chip ${info.linkStatus||''}`;st.textContent=statusLabel(info.linkStatus);
        wrap.append(rel,st);host.appendChild(wrap);
      }
    });
  }

  function ensureHistoryObserver(){
    const body=document.getElementById('historyBody');if(!body||historyObserver)return;
    historyObserver=new MutationObserver(()=>queueMicrotask(decorateHistory));
    historyObserver.observe(body,{childList:true,subtree:true});
  }

  function linkedTxFromClick(e){
    const btn=e.target?.closest?.('button');if(!btn)return null;
    const m=String(btn.getAttribute('onclick')||'').match(/editTx\(['"]([^'"]+)['"]\)/);
    if(!m)return null;
    const info=map.get(String(m[1]));return info?{id:m[1],info,btn}:null;
  }

  function interceptLinkedEdit(e){
    const hit=linkedTxFromClick(e);if(!hit)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const i=hit.info;
    alert(`Lançamento vinculado por CPF.\n\n${relationLabel(i.relationship)}: ${i.counterpartyName||'Pessoa externa'}\nCPF: ${cpfMask(i.counterpartyCpf)}\nVínculo: ${statusLabel(i.linkStatus)}\n\nPara preservar a relação entre as duas contas, a edição direta deste lançamento fica bloqueada por enquanto.`);
  }

  function bindSharedConflict(){
    const shared=document.getElementById('sharedExpenseBox');if(!shared||shared.dataset.counterpartyConflictBound)return;
    shared.dataset.counterpartyConflictBound='1';
    shared.addEventListener('toggle',()=>{if(shared.open){const enabled=document.getElementById('txCounterpartyEnabled');if(enabled?.checked){enabled.checked=false;syncField();setState('')}}});
  }

  function onModalOpen(){
    syncField();bindSharedConflict();
    if(!document.getElementById('txId')?.value)resetFormLink();
  }

  async function init(){
    if(!ensureField())return;
    ensureHistoryObserver();bindSharedConflict();syncField();
    document.addEventListener('submit',submitLinked,true);
    document.addEventListener('click',interceptLinkedEdit,true);
    const modal=document.getElementById('txModal');
    if(modal)new MutationObserver(()=>{if(modal.classList.contains('open'))setTimeout(onModalOpen,0)}).observe(modal,{attributes:true,attributeFilter:['class']});
    await refreshDirect();
    window.addEventListener('focus',refreshDirect);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDirect()});
    window.financeDirectObligationsRefresh=refreshDirect;
  }

  function boot(){
    let tries=0;const timer=setInterval(()=>{tries++;if(document.getElementById('txForm')&&getSb()&&getUserId()){clearInterval(timer);init()}else if(tries>300)clearInterval(timer)},50);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();