(function(){
  if(window.__openingBalanceAdjustmentV1Loaded)return;
  window.__openingBalanceAdjustmentV1Loaded=true;

  const STYLE_ID='opening-balance-adjustment-v1-style';

  const fmt=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const round=v=>Math.round((Number(v)||0)*100)/100;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #openingBalanceAdjustBtn{align-self:flex-start}
      .opening-adjust-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
      .opening-adjust-box{padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--panel2)}
      .opening-adjust-box .k{font-size:9px;color:var(--muted);margin-bottom:4px}.opening-adjust-box .v{font-size:13px;font-weight:820}
      .opening-adjust-preview{padding:10px 11px;border-radius:11px;border:1px solid var(--line);background:var(--panel2);font-size:10px;line-height:1.5;margin-top:10px}
      .opening-adjust-preview.income{border-color:#28513e;background:#102a20;color:#bbf7d0}
      .opening-adjust-preview.expense{border-color:#7f1d1d;background:#2a1515;color:#fecaca}
      .opening-adjust-preview.ok{border-color:#334155;color:var(--muted)}
      @media(max-width:620px){.opening-adjust-summary{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function previousDayForMonth(ym){
    const [y,m]=String(ym||'').split('-').map(Number);
    const d=new Date(y,m-1,1);
    d.setDate(d.getDate()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function monthName(ym){
    try{return typeof fmtMonth==='function'?fmtMonth(ym):ym}catch(_e){return ym}
  }

  function currentContext(){
    if(typeof state==='undefined'||!state?.settings||typeof actualForMonth!=='function')return null;
    const ym=state.settings.selectedMonth;
    const opening=Number(actualForMonth(ym)?.opening)||0;
    return{ym,opening,adjustmentDate:previousDayForMonth(ym)};
  }

  function ensureModal(){
    injectStyles();
    if(document.getElementById('openingBalanceAdjustModal'))return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="modal-backdrop" id="openingBalanceAdjustModal"><div class="modal"><form id="openingBalanceAdjustForm"><div class="modal-head"><h3>Conciliar saldo inicial</h3><button type="button" class="btn ghost" data-opening-adjust-close="1">✕</button></div><div class="modal-body"><div class="notice">Informe o saldo real existente no início do mês. O Prumo calculará a diferença e registrará uma movimentação na categoria <strong>Ajuste</strong>, preservando a conciliação no histórico.</div><div class="opening-adjust-summary"><div class="opening-adjust-box"><div class="k">Saldo calculado</div><div class="v" id="openingAdjustCalculated">—</div></div><div class="opening-adjust-box"><div class="k">Saldo real</div><div class="v" id="openingAdjustRealPreview">—</div></div><div class="opening-adjust-box"><div class="k">Diferença</div><div class="v" id="openingAdjustDifference">—</div></div></div><div class="form-grid"><div class="field"><label>Saldo real no início do mês (R$)</label><input id="openingAdjustReal" type="number" step="0.01" required></div><div class="field"><label>Conta</label><input id="openingAdjustAccount" placeholder="Ex.: Banco do Brasil"></div><div class="field full"><label>Observação</label><textarea id="openingAdjustNotes" rows="3" placeholder="Ex.: Conciliação com saldo bancário"></textarea></div></div><div class="opening-adjust-preview ok" id="openingAdjustPreview"></div></div><div class="modal-foot"><button type="button" class="btn" data-opening-adjust-close="1">Cancelar</button><button class="btn primary" type="submit" id="openingAdjustSubmit">Registrar ajuste</button></div></form></div></div>`;
    document.body.appendChild(wrap.firstElementChild);

    document.querySelectorAll('[data-opening-adjust-close]').forEach(b=>b.onclick=closeModal);
    document.getElementById('openingBalanceAdjustModal').addEventListener('click',e=>{if(e.target.id==='openingBalanceAdjustModal')closeModal()});
    document.getElementById('openingAdjustReal').addEventListener('input',updatePreview);
    document.getElementById('openingBalanceAdjustForm').addEventListener('submit',submitAdjustment);
  }

  function openModal(){
    ensureModal();
    const ctx=currentContext();if(!ctx){alert('Não foi possível calcular o saldo inicial deste mês.');return}
    document.getElementById('openingAdjustReal').value=ctx.opening.toFixed(2);
    document.getElementById('openingAdjustAccount').value='';
    document.getElementById('openingAdjustNotes').value='';
    document.getElementById('openingBalanceAdjustModal').dataset.ym=ctx.ym;
    document.getElementById('openingBalanceAdjustModal').dataset.opening=String(ctx.opening);
    document.getElementById('openingBalanceAdjustModal').dataset.adjustmentDate=ctx.adjustmentDate;
    updatePreview();
    document.getElementById('openingBalanceAdjustModal').classList.add('open');
    setTimeout(()=>document.getElementById('openingAdjustReal')?.select(),40);
  }

  function closeModal(){document.getElementById('openingBalanceAdjustModal')?.classList.remove('open')}

  function updatePreview(){
    const modal=document.getElementById('openingBalanceAdjustModal');if(!modal)return;
    const opening=Number(modal.dataset.opening)||0,real=Number(document.getElementById('openingAdjustReal').value);
    const valid=Number.isFinite(real),diff=valid?round(real-opening):0;
    document.getElementById('openingAdjustCalculated').textContent=fmt(opening);
    document.getElementById('openingAdjustRealPreview').textContent=valid?fmt(real):'—';
    document.getElementById('openingAdjustDifference').textContent=valid?fmt(diff):'—';
    const preview=document.getElementById('openingAdjustPreview'),submit=document.getElementById('openingAdjustSubmit');
    preview.className='opening-adjust-preview '+(diff>0?'income':diff<0?'expense':'ok');
    if(!valid){
      preview.textContent='Informe o saldo real para calcular a conciliação.';
      submit.disabled=true;
    }else if(Math.abs(diff)<0.005){
      preview.innerHTML='Os valores já estão conciliados. <strong>Nenhum lançamento é necessário.</strong>';
      submit.disabled=true;
    }else{
      const type=diff>0?'Receita':'Despesa',amount=Math.abs(diff),ym=modal.dataset.ym,date=modal.dataset.adjustmentDate;
      preview.innerHTML=`Será criada uma <strong>${type} de ${esc(fmt(amount))}</strong> na categoria <strong>Ajuste</strong>, datada de <strong>${esc(typeof fmtDate==='function'?fmtDate(date):date)}</strong>, para que o saldo inicial de <strong>${esc(monthName(ym))}</strong> passe a ${esc(fmt(real))}.`;
      submit.disabled=false;
    }
  }

  function makeId(){
    try{if(typeof uid==='function')return uid()}catch(_e){}
    return 'adjust-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  }

  function submitAdjustment(e){
    e.preventDefault();
    const modal=document.getElementById('openingBalanceAdjustModal');
    if(!modal||typeof state==='undefined'||!Array.isArray(state?.transactions))return;
    const opening=Number(modal.dataset.opening)||0,real=Number(document.getElementById('openingAdjustReal').value),diff=round(real-opening);
    if(!Number.isFinite(real)||Math.abs(diff)<0.005)return;

    const type=diff>0?'Receita':'Despesa',amount=Math.abs(diff),ym=modal.dataset.ym,date=modal.dataset.adjustmentDate;
    const account=document.getElementById('openingAdjustAccount').value.trim();
    const notes=document.getElementById('openingAdjustNotes').value.trim();
    state.transactions.push({
      id:makeId(),
      date,
      type,
      category:'Ajuste',
      description:`Ajuste de conciliação — saldo inicial de ${monthName(ym)}`,
      account,
      nature:'Extra',
      amount,
      status:type==='Receita'?'Recebido':'Pago',
      installmentCurrent:null,
      installmentTotal:null,
      recurring:false,
      recurringEnd:null,
      projection:false,
      notes:notes||`Conciliação do saldo inicial de ${monthName(ym)}. Saldo calculado: ${fmt(opening)}; saldo informado: ${fmt(real)}.`,
      reconciliation:true,
      reconciliationMonth:ym,
      reconciliationOpeningBefore:opening,
      reconciliationOpeningAfter:real
    });

    closeModal();
    if(typeof renderAll==='function')renderAll();
    else if(typeof save==='function')save();

    try{if(typeof setSyncStatus==='function')setSyncStatus('Ajuste de conciliação registrado')}catch(_e){}
  }

  function bind(){
    ensureModal();
    const btn=document.getElementById('openingBalanceAdjustBtn');
    if(!btn)return false;
    btn.onclick=openModal;
    return true;
  }

  function init(){
    if(bind())return;
    let tries=0;const timer=setInterval(()=>{tries++;if(bind()||tries>300)clearInterval(timer)},100);
  }

  window.openOpeningBalanceAdjustment=openModal;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();