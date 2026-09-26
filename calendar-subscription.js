(function(){
  if(window.__prumoCalendarSubscription)return;
  window.__prumoCalendarSubscription=true;

  const STORAGE_PREFIX='prumo_calendar_token_';
  const defaults={includeExpenses:true,includeIncome:true,includeInvoices:true,pendingOnly:false,showAmount:true};
  const getSb=()=>{try{return typeof sb!=='undefined'?sb:window.sb}catch(_e){return window.sb}};
  const getUserId=()=>{try{return currentUser?.id||window.currentUser?.id||''}catch(_e){return window.currentUser?.id||''}};
  const tokenKey=()=>STORAGE_PREFIX+getUserId();

  function generateToken(){
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function getLocalToken(){try{return localStorage.getItem(tokenKey())||''}catch(_e){return''}}
  function setLocalToken(v){try{if(v)localStorage.setItem(tokenKey(),v);else localStorage.removeItem(tokenKey())}catch(_e){}}
  function optionsFromUi(){
    return {
      includeExpenses:!!document.getElementById('calIncludeExpenses')?.checked,
      includeIncome:!!document.getElementById('calIncludeIncome')?.checked,
      includeInvoices:!!document.getElementById('calIncludeInvoices')?.checked,
      pendingOnly:!!document.getElementById('calPendingOnly')?.checked,
      showAmount:!!document.getElementById('calShowAmount')?.checked
    };
  }
  function applyOptions(o={}){
    const x={...defaults,...o};
    [['calIncludeExpenses','includeExpenses'],['calIncludeIncome','includeIncome'],['calIncludeInvoices','includeInvoices'],['calPendingOnly','pendingOnly'],['calShowAmount','showAmount']].forEach(([id,k])=>{
      const el=document.getElementById(id);if(el)el.checked=!!x[k];
    });
  }
  function endpoint(token,scope='all'){
    return `${location.origin}/api/calendar?token=${encodeURIComponent(token)}&scope=${scope}`;
  }
  function webcal(url){return url.replace(/^https?:/,'webcal:')}
  function setMsg(msg,type=''){
    const el=document.getElementById('calendarSubscriptionMsg');if(!el)return;
    el.textContent=msg;el.dataset.type=type;
  }
  async function copy(text){
    try{await navigator.clipboard.writeText(text);setMsg('Link copiado.','ok')}
    catch(_e){
      const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();setMsg('Link copiado.','ok');
    }
  }
  function renderLinks(active){
    const host=document.getElementById('calendarSubscriptionLinks');if(!host)return;
    const token=getLocalToken();
    if(!active){
      host.innerHTML='<div class="muted">Ative a assinatura para gerar os links de calendário.</div>';return;
    }
    if(!token){
      host.innerHTML='<div class="notice">A assinatura está ativa, mas o link secreto não está salvo neste aparelho. Gere um novo link para substituir o anterior.</div>';return;
    }
    const defs=[['all','Calendário financeiro'],['income','Somente receitas'],['expense','Somente despesas']];
    host.innerHTML=defs.map(([scope,label])=>{
      const url=endpoint(token,scope);
      return `<div class="calendar-sub-row"><div><strong>${label}</strong><div class="calendar-sub-url">${url}</div></div><div class="calendar-sub-actions"><button type="button" class="btn small" data-cal-copy="${scope}">Copiar link</button><a class="btn small" data-cal-subscribe="${scope}" href="${webcal(url)}">Assinar</a></div></div>`;
    }).join('');
    host.querySelectorAll('[data-cal-copy]').forEach(btn=>btn.onclick=()=>copy(endpoint(token,btn.dataset.calCopy)));
  }
  async function refresh(){
    const client=getSb(),uid=getUserId();if(!client||!uid)return;
    const {data,error}=await client.rpc('finance_calendar_get_settings');
    if(error){setMsg('Não foi possível carregar a configuração do calendário.','error');return}
    applyOptions(data?.options||defaults);
    const active=!!data?.active;
    const state=document.getElementById('calendarSubscriptionState');
    if(state){state.textContent=active?'Ativa':'Desativada';state.className='calendar-sub-state '+(active?'active':'')}
    const disable=document.getElementById('calendarDisableBtn');if(disable)disable.style.display=active?'inline-flex':'none';
    const activate=document.getElementById('calendarActivateBtn');if(activate)activate.textContent=active?'Gerar novo link':'Ativar assinatura';
    renderLinks(active);
  }
  async function activate(){
    const client=getSb();if(!client)return;
    const token=generateToken();
    setMsg('Gerando link seguro…');
    const {data,error}=await client.rpc('finance_calendar_set_subscription',{p_token:token,p_options:optionsFromUi()});
    if(error||!data?.ok){setMsg('Não foi possível ativar a assinatura.','error');return}
    setLocalToken(token);
    setMsg('Assinatura ativada. O link anterior, se existia, foi invalidado.','ok');
    await refresh();
  }
  async function saveOptions(){
    const client=getSb();if(!client)return;
    const {data,error}=await client.rpc('finance_calendar_update_options',{p_options:optionsFromUi()});
    if(error||!data?.ok){
      if(data?.error==='not_configured'){setMsg('Ative a assinatura antes de salvar as preferências.','error');return}
      setMsg('Não foi possível salvar as preferências.','error');return;
    }
    setMsg('Preferências do calendário salvas.','ok');
  }
  async function disable(){
    const client=getSb();if(!client)return;
    const {data,error}=await client.rpc('finance_calendar_disable_subscription');
    if(error||!data?.ok){setMsg('Não foi possível desativar a assinatura.','error');return}
    setLocalToken('');
    setMsg('Assinatura desativada. Os links anteriores deixaram de funcionar.','ok');
    await refresh();
  }
  function inject(){
    if(document.getElementById('calendarSubscriptionCard'))return;
    const grid=document.querySelector('#page-settings .settings-grid');if(!grid)return;
    const style=document.createElement('style');
    style.textContent=`
      #calendarSubscriptionCard{grid-column:1/-1}
      .calendar-sub-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}
      .calendar-sub-state{display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid #39495c;background:#121d2b;color:#92a0b1;font-size:10px;font-weight:800}
      .calendar-sub-state.active{border-color:#28513e;background:#10271d;color:#9dd8b6}
      .calendar-sub-options{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0 14px}
      .calendar-sub-option{display:flex;align-items:center;gap:8px;padding:10px 11px;border:1px solid #23334a;border-radius:11px;background:#0a1524;color:#cbd6e3;font-size:10px;font-weight:700}
      .calendar-sub-links{display:grid;gap:8px;margin-top:14px}
      .calendar-sub-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #23334a;border-radius:12px;background:#0a1524}
      .calendar-sub-row strong{font-size:11px;color:#edf3f8}
      .calendar-sub-url{margin-top:4px;font-size:9px;color:#70849b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:760px}
      .calendar-sub-actions{display:flex;gap:7px;align-items:center}
      #calendarSubscriptionMsg{min-height:16px;margin-top:10px;font-size:10px;color:#8193a9}
      #calendarSubscriptionMsg[data-type="ok"]{color:#91d6b9}
      #calendarSubscriptionMsg[data-type="error"]{color:#ef8a81}
      @media(max-width:850px){.calendar-sub-options{grid-template-columns:1fr 1fr}.calendar-sub-row{grid-template-columns:1fr}.calendar-sub-actions{justify-content:flex-start}}
      @media(max-width:520px){.calendar-sub-options{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    const card=document.createElement('div');card.className='card';card.id='calendarSubscriptionCard';
    card.innerHTML=`
      <div class="calendar-sub-head">
        <div><h3>Calendário do Prumo</h3><p class="muted">Assine seus vencimentos e recebimentos no calendário do iPhone, Google Agenda, Outlook e outros apps compatíveis com iCalendar.</p></div>
        <span id="calendarSubscriptionState" class="calendar-sub-state">Desativada</span>
      </div>
      <div class="calendar-sub-options">
        <label class="calendar-sub-option"><input type="checkbox" id="calIncludeExpenses" checked> Despesas</label>
        <label class="calendar-sub-option"><input type="checkbox" id="calIncludeIncome" checked> Receitas</label>
        <label class="calendar-sub-option"><input type="checkbox" id="calIncludeInvoices" checked> Faturas</label>
        <label class="calendar-sub-option"><input type="checkbox" id="calPendingOnly"> Só pendentes</label>
        <label class="calendar-sub-option"><input type="checkbox" id="calShowAmount" checked> Mostrar valores</label>
      </div>
      <div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primary" id="calendarActivateBtn">Ativar assinatura</button>
        <button type="button" class="btn" id="calendarSaveOptionsBtn">Salvar preferências</button>
        <button type="button" class="btn danger" id="calendarDisableBtn" style="display:none">Desativar</button>
      </div>
      <div id="calendarSubscriptionLinks" class="calendar-sub-links"></div>
      <div id="calendarSubscriptionMsg"></div>
      <div class="muted" style="margin-top:8px;font-size:9px">O link funciona como uma chave de leitura. Quem tiver acesso a ele poderá ver os eventos publicados. Gerar um novo link invalida imediatamente o anterior.</div>
    `;
    grid.insertBefore(card,grid.querySelector('.danger-zone')||null);
    document.getElementById('calendarActivateBtn').onclick=activate;
    document.getElementById('calendarSaveOptionsBtn').onclick=saveOptions;
    document.getElementById('calendarDisableBtn').onclick=disable;
    refresh();
  }
  function boot(){
    inject();
    window.addEventListener('finance:cloud-ready',()=>setTimeout(refresh,100));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();