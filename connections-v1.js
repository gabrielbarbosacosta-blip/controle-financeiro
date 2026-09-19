(function(){
  if(window.__financeConnectionsV1Loaded)return;
  window.__financeConnectionsV1Loaded=true;

  let connections=[],incoming=[],outgoing=[],loading=false,initialized=false;
  const STYLE_ID='finance-connections-v1-style';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,11);
  const cpfMask=v=>digits(v).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');
  const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?';

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .connections-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
      .connection-card{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid #26374d;border-radius:13px;background:#0b1424}
      .connection-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#18263a;border:1px solid #31445d;font-weight:850;font-size:11px;flex:0 0 auto}
      .connection-main{min-width:0;flex:1}.connection-name{font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.connection-meta{font-size:9px;color:var(--muted);margin-top:3px;line-height:1.4}
      .connection-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.connection-empty{padding:16px;border:1px dashed #334155;border-radius:12px;color:var(--muted);font-size:10px}
      .connection-section+.connection-section{margin-top:16px}.connection-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .connection-count{font-size:9px;color:var(--muted)}.connection-picker-wrap{grid-column:1/-1}
      .connection-picker-note{font-size:9px;color:var(--muted);margin-top:4px}
      @media(max-width:620px){.connections-grid{grid-template-columns:1fr}.connection-card{align-items:flex-start}}
    `;document.head.appendChild(s);
  }

  function ensureUi(){
    injectStyles();
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-page="connections"]')){
      const btn=document.createElement('button');
      btn.dataset.page='connections';btn.textContent='Conexões';
      const before=nav.querySelector('[data-page="settings"]');
      before?nav.insertBefore(btn,before):nav.appendChild(btn);
      btn.addEventListener('click',showConnectionsPage);
    }

    const main=document.querySelector('.main');
    if(main&&!document.getElementById('page-connections')){
      const page=document.createElement('section');page.className='page';page.id='page-connections';
      page.innerHTML=`
        <div class="section-head">
          <div><h3>Conexões</h3><div class="muted">Pessoas que você pode reutilizar como credor ou devedor sem informar o CPF novamente.</div></div>
          <button class="btn primary" id="createConnectionBtn">+ Criar conexão</button>
        </div>
        <div class="summary-strip" style="margin-bottom:14px">
          <div class="mini"><div class="t">Conexões</div><div class="v" id="connectionsCount">0</div></div>
          <div class="mini"><div class="t">Recebidas</div><div class="v" id="connectionsIncomingCount">0</div></div>
          <div class="mini"><div class="t">Enviadas</div><div class="v" id="connectionsOutgoingCount">0</div></div>
        </div>
        <div class="card connection-section" id="connectionsIncomingCard">
          <div class="connection-section-head"><div><h3 style="margin:0">Solicitações recebidas</h3><div class="muted">Aceite para adicionar a pessoa à sua lista.</div></div><span class="connection-count" id="connectionsIncomingLabel"></span></div>
          <div class="connections-grid" id="connectionsIncomingList"></div>
        </div>
        <div class="card connection-section">
          <div class="connection-section-head"><div><h3 style="margin:0">Minhas conexões</h3><div class="muted">Disponíveis nos cadastros de despesa e receita.</div></div><span class="connection-count" id="connectionsAcceptedLabel"></span></div>
          <div class="connections-grid" id="connectionsList"></div>
        </div>
        <div class="card connection-section" id="connectionsOutgoingCard">
          <div class="connection-section-head"><div><h3 style="margin:0">Solicitações enviadas</h3><div class="muted">Aguardando resposta da outra pessoa.</div></div><span class="connection-count" id="connectionsOutgoingLabel"></span></div>
          <div class="connections-grid" id="connectionsOutgoingList"></div>
        </div>`;
      main.appendChild(page);
    }

    if(!document.getElementById('connectionModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal-backdrop" id="connectionModal"><div class="modal"><form id="connectionForm"><div class="modal-head"><h3>Criar conexão</h3><button type="button" class="btn ghost" id="connectionModalClose">✕</button></div><div class="modal-body"><div class="notice" style="margin-bottom:12px">Informe o CPF de uma pessoa que já possui conta no Prumo. Ela receberá uma solicitação e só entrará na sua lista depois de aceitar.</div><div class="field"><label>CPF</label><input id="connectionCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required></div><div class="muted" id="connectionFormStatus" style="min-height:16px;margin-top:8px"></div></div><div class="modal-foot"><button type="button" class="btn" id="connectionCancel">Cancelar</button><button type="submit" class="btn primary" id="connectionSubmit">Enviar solicitação</button></div></form></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('connectionModalClose').onclick=closeConnectionModal;
      document.getElementById('connectionCancel').onclick=closeConnectionModal;
      document.getElementById('connectionModal').addEventListener('click',e=>{if(e.target.id==='connectionModal')closeConnectionModal()});
      document.getElementById('connectionCpf').addEventListener('input',e=>{e.target.value=cpfMask(e.target.value);setFormStatus('')});
      document.getElementById('connectionForm').addEventListener('submit',createConnection);
    }

    document.getElementById('createConnectionBtn')?.addEventListener('click',openConnectionModal);
  }

  function setFormStatus(text,bad=false){
    const el=document.getElementById('connectionFormStatus');if(!el)return;
    el.textContent=text;el.style.color=bad?'#fca5a5':'';
  }

  function openConnectionModal(){
    ensureUi();
    document.getElementById('connectionCpf').value='';
    setFormStatus('');
    document.getElementById('connectionModal').classList.add('open');
    setTimeout(()=>document.getElementById('connectionCpf')?.focus(),0);
  }
  function closeConnectionModal(){document.getElementById('connectionModal')?.classList.remove('open')}

  function showConnectionsPage(){
    ensureUi();
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-connections'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='connections'));
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
    if(title)title.textContent='Conexões';if(sub)sub.textContent='Pessoas vinculadas à sua vida financeira';
    loadConnections();
  }

  function personCard(item,{incomingCard=false,outgoingCard=false}={}){
    const meta=item.cpf?cpfMask(item.cpf):(incomingCard?'Solicitação recebida':'');
    const actions=incomingCard
      ? `<div class="connection-actions"><button class="btn small primary" data-connection-accept="${esc(item.id)}">Aceitar</button><button class="btn small danger" data-connection-reject="${esc(item.id)}">Recusar</button></div>`
      : outgoingCard
        ? `<div class="connection-actions"><button class="btn small danger" data-connection-remove="${esc(item.id)}">Cancelar solicitação</button></div>`
        : `<div class="connection-actions"><button class="btn small danger" data-connection-remove="${esc(item.id)}">Remover conexão</button></div>`;
    return `<div class="connection-card"><div class="connection-avatar">${esc(initials(item.name))}</div><div class="connection-main"><div class="connection-name">${esc(item.name||'Usuário do Prumo')}</div><div class="connection-meta">${esc(meta)}</div>${actions}</div></div>`;
  }

  function bindListActions(root=document){
    root.querySelectorAll?.('[data-connection-accept]').forEach(b=>b.onclick=()=>respondConnection(b.dataset.connectionAccept,true));
    root.querySelectorAll?.('[data-connection-reject]').forEach(b=>b.onclick=()=>respondConnection(b.dataset.connectionReject,false));
    root.querySelectorAll?.('[data-connection-remove]').forEach(b=>b.onclick=()=>removeConnection(b.dataset.connectionRemove));
  }

  function renderConnections(){
    ensureUi();
    document.getElementById('connectionsCount').textContent=String(connections.length);
    document.getElementById('connectionsIncomingCount').textContent=String(incoming.length);
    document.getElementById('connectionsOutgoingCount').textContent=String(outgoing.length);
    document.getElementById('connectionsAcceptedLabel').textContent=`${connections.length} conexão${connections.length===1?'':'ões'}`;
    document.getElementById('connectionsIncomingLabel').textContent=`${incoming.length} pendente${incoming.length===1?'':'s'}`;
    document.getElementById('connectionsOutgoingLabel').textContent=`${outgoing.length} pendente${outgoing.length===1?'':'s'}`;

    const acceptedHost=document.getElementById('connectionsList');
    acceptedHost.innerHTML=connections.length?connections.map(x=>personCard(x)).join(''):'<div class="connection-empty">Nenhuma conexão criada ainda.</div>';

    const incomingHost=document.getElementById('connectionsIncomingList');
    incomingHost.innerHTML=incoming.length?incoming.map(x=>personCard(x,{incomingCard:true})).join(''):'<div class="connection-empty">Nenhuma solicitação recebida.</div>';

    const outgoingHost=document.getElementById('connectionsOutgoingList');
    outgoingHost.innerHTML=outgoing.length?outgoing.map(x=>personCard(x,{outgoingCard:true})).join(''):'<div class="connection-empty">Nenhuma solicitação enviada aguardando resposta.</div>';

    bindListActions(document.getElementById('page-connections'));
    refreshPickers();
    window.dispatchEvent(new CustomEvent('finance:connections-updated',{detail:{connections:[...connections]}}));
  }

  async function loadConnections(){
    if(loading||!getUserId()||!getSb())return;loading=true;
    try{
      const {data,error}=await getSb().rpc('finance_list_connections');
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'connection_list_failed');
      connections=data.items||[];incoming=data.incoming||[];outgoing=data.outgoing||[];
      renderConnections();
    }catch(e){console.error('Falha ao carregar conexões.',e)}
    finally{loading=false}
  }

  async function createConnection(e){
    e.preventDefault();
    const cpf=digits(document.getElementById('connectionCpf').value);
    if(cpf.length!==11){setFormStatus('Informe um CPF válido com 11 dígitos.',true);return}
    const btn=document.getElementById('connectionSubmit');btn.disabled=true;setFormStatus('Enviando solicitação…');
    try{
      const {data,error}=await getSb().rpc('finance_create_connection',{p_cpf:cpf});
      if(error)throw error;
      if(!data?.ok){
        const msg={profile_not_found:'Nenhum usuário do Prumo foi encontrado com este CPF.',cannot_connect_self:'Você não pode criar uma conexão consigo mesmo.',invalid_cpf:'CPF inválido.'}[data?.error]||data?.detail||'Não foi possível criar a conexão.';
        throw new Error(msg);
      }
      if(data.status==='accepted'){
        setFormStatus('Essa pessoa já está nas suas conexões.');
      }else if(data.alreadyExists&&data.incoming){
        setFormStatus('Essa pessoa já enviou uma solicitação para você. Aceite-a na lista de recebidas.');
      }else if(data.alreadyExists){
        setFormStatus('Já existe uma solicitação aguardando resposta.');
      }else{
        setFormStatus('Solicitação enviada.');
      }
      await loadConnections();
      if(!data.alreadyExists||data.status==='accepted')setTimeout(closeConnectionModal,350);
    }catch(err){console.error('Falha ao criar conexão.',err);setFormStatus(err.message||'Não foi possível criar a conexão.',true)}
    finally{btn.disabled=false}
  }

  async function respondConnection(id,accept){
    try{
      const {data,error}=await getSb().rpc('finance_respond_connection',{p_connection_id:id,p_accept:accept});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'connection_response_failed');
      await loadConnections();
      try{if(typeof setSyncStatus==='function')setSyncStatus(accept?'Conexão adicionada':'Solicitação recusada')}catch(_e){}
    }catch(e){console.error('Falha ao responder conexão.',e);alert('Não foi possível responder esta solicitação.')}
  }

  async function removeConnection(id){
    if(!confirm('Remover esta conexão? Os lançamentos existentes não serão alterados.'))return;
    try{
      const {data,error}=await getSb().rpc('finance_remove_connection',{p_connection_id:id});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'connection_remove_failed');
      await loadConnections();
    }catch(e){console.error('Falha ao remover conexão.',e);alert('Não foi possível remover esta conexão.')}
  }

  function pickerOptions(){
    return '<option value="">Digitar CPF manualmente</option>'+connections.map(x=>`<option value="${esc(x.userId)}">${esc(x.name)} · ${esc(cpfMask(x.cpf))}</option>`).join('');
  }

  function enhancePicker(cfg){
    const input=document.getElementById(cfg.input),enabled=document.getElementById(cfg.enabled),lookup=document.getElementById(cfg.lookup);
    if(!input||!enabled||!lookup)return;
    let select=document.getElementById(cfg.select);
    if(!select){
      const field=input.closest('.field');if(!field)return;
      const wrap=document.createElement('div');wrap.className='field connection-picker-wrap';
      wrap.innerHTML=`<label>Pessoa conectada</label><select id="${cfg.select}"></select><div class="connection-picker-note">Selecione uma conexão ou informe o CPF manualmente.</div>`;
      field.parentNode.insertBefore(wrap,field);
      select=wrap.querySelector('select');
      select.addEventListener('change',()=>{
        const item=connections.find(x=>String(x.userId)===String(select.value));
        if(!item)return;
        enabled.checked=true;enabled.dispatchEvent(new Event('change',{bubbles:true}));
        input.value=cpfMask(item.cpf||'');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        setTimeout(()=>lookup.click(),0);
      });
    }
    const current=select.value;
    select.innerHTML=pickerOptions();
    if([...select.options].some(o=>o.value===current))select.value=current;
  }

  function refreshPickers(){
    enhancePicker({input:'txCounterpartyCpf',enabled:'txCounterpartyEnabled',lookup:'txCounterpartyLookup',select:'txConnectionSelect'});
    enhancePicker({input:'debtCounterpartyCpf',enabled:'debtCounterpartyEnabled',lookup:'debtCounterpartyLookup',select:'debtConnectionSelect'});
    enhancePicker({input:'incomeCounterpartyCpf',enabled:'incomeCounterpartyEnabled',lookup:'incomeCounterpartyLookup',select:'incomeConnectionSelect'});
  }

  function observeForms(){
    const obs=new MutationObserver(()=>refreshPickers());
    obs.observe(document.body,{childList:true,subtree:true});
    refreshPickers();
  }

  async function init(){
    if(initialized)return;initialized=true;
    ensureUi();observeForms();
    await loadConnections();
    window.addEventListener('focus',loadConnections);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadConnections()});
  }

  window.financeConnections={
    refresh:loadConnections,
    getAccepted:()=>[...connections],
    getIncoming:()=>[...incoming],
    getOutgoing:()=>[...outgoing]
  };

  function boot(){
    let tries=0;const timer=setInterval(()=>{
      tries++;
      if(getSb()&&getUserId()&&document.querySelector('.nav')&&document.querySelector('.main')){clearInterval(timer);init()}
      else if(tries>300)clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();