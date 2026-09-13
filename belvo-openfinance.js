(function(){
  if(window.__belvoOpenFinanceLoaded)return;
  window.__belvoOpenFinanceLoaded=true;

  const WIDGET_URL='https://widget.belvo.io/';

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function maskCpf(value){
    const digits=String(value||'').replace(/\D/g,'').slice(0,11);
    return digits.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }

  function financeState(){
    if(typeof state==='undefined')return null;
    if(!state.openFinance||typeof state.openFinance!=='object')state.openFinance={provider:'belvo',links:[]};
    if(!Array.isArray(state.openFinance.links))state.openFinance.links=[];
    return state.openFinance;
  }

  function persist(){
    if(typeof save==='function')save();
  }

  function statusText(){
    const of=financeState();
    if(!of||!of.links.length)return 'Nenhuma instituição conectada.';
    const last=of.links[of.links.length-1];
    const institution=last.institution||'instituição';
    return `${of.links.length} conexão(ões) registrada(s). Última: ${institution}.`;
  }

  function renderStatus(message,bad=false){
    const el=document.getElementById('belvoOpenFinanceStatus');
    if(!el)return;
    el.textContent=message||statusText();
    el.style.color=bad?'#fecaca':'';
  }

  function installSettingsCard(){
    const grid=document.querySelector('#page-settings .settings-grid');
    if(!grid||document.getElementById('belvoOpenFinanceCard'))return false;
    const card=document.createElement('div');
    card.className='card';
    card.id='belvoOpenFinanceCard';
    card.innerHTML=`
      <h3>Open Finance</h3>
      <p class="muted">Conecte suas instituições financeiras pelo Open Finance usando a Belvo. A autorização acontece no ambiente seguro da instituição.</p>
      <div id="belvoOpenFinanceStatus" class="muted" style="margin:10px 0 14px"></div>
      <div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primary" id="belvoConnectBtn">Conectar banco</button>
      </div>`;
    grid.insertBefore(card,grid.firstChild?.nextSibling||grid.firstChild);
    document.getElementById('belvoConnectBtn').addEventListener('click',openModal);
    renderStatus();
    return true;
  }

  function buildModal(){
    if(document.getElementById('belvoConnectModal'))return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`
      <div class="modal-backdrop" id="belvoConnectModal">
        <div class="modal" style="max-width:620px">
          <form id="belvoConnectForm">
            <div class="modal-head"><div><h3>Conectar banco</h3><div class="muted">Open Finance • Belvo</div></div><button type="button" class="btn ghost" id="belvoConnectClose">✕</button></div>
            <div class="modal-body">
              <div class="notice" style="margin-bottom:14px">Seu CPF e nome são enviados somente ao backend do Controle Financeiro para iniciar o consentimento Open Finance. As credenciais bancárias são informadas diretamente no fluxo da instituição financeira.</div>
              <div class="form-grid">
                <div class="field full"><label>Nome completo</label><input id="belvoHolderName" autocomplete="name" required maxlength="150" placeholder="Nome do titular"></div>
                <div class="field full"><label>CPF</label><input id="belvoHolderCpf" inputmode="numeric" autocomplete="off" required maxlength="14" placeholder="000.000.000-00"></div>
              </div>
              <div class="muted" id="belvoConnectMessage" style="margin-top:12px"></div>
            </div>
            <div class="modal-foot"><button type="button" class="btn" id="belvoConnectCancel">Cancelar</button><button type="submit" class="btn primary" id="belvoConnectSubmit">Continuar para o banco</button></div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('belvoConnectClose').addEventListener('click',closeModal);
    document.getElementById('belvoConnectCancel').addEventListener('click',closeModal);
    document.getElementById('belvoConnectModal').addEventListener('click',e=>{if(e.target.id==='belvoConnectModal')closeModal()});
    document.getElementById('belvoHolderCpf').addEventListener('input',e=>{e.target.value=maskCpf(e.target.value)});
    document.getElementById('belvoConnectForm').addEventListener('submit',startConnection);
  }

  function openModal(){
    buildModal();
    const modal=document.getElementById('belvoConnectModal');
    const msg=document.getElementById('belvoConnectMessage');
    if(msg)msg.textContent='';
    modal?.classList.add('open');
  }

  function closeModal(){document.getElementById('belvoConnectModal')?.classList.remove('open')}

  async function startConnection(event){
    event.preventDefault();
    const name=document.getElementById('belvoHolderName')?.value.trim()||'';
    const cpf=(document.getElementById('belvoHolderCpf')?.value||'').replace(/\D/g,'');
    const button=document.getElementById('belvoConnectSubmit');
    const message=document.getElementById('belvoConnectMessage');
    if(name.length<3||cpf.length!==11){if(message)message.textContent='Informe o nome completo e um CPF válido.';return}

    button.disabled=true;button.textContent='Preparando conexão…';
    if(message)message.textContent='Gerando autorização segura…';
    try{
      if(typeof sb==='undefined')throw new Error('supabase_unavailable');
      const {data,error}=await sb.auth.getSession();
      if(error)throw error;
      const session=data?.session;
      if(!session?.access_token||!session?.user?.id)throw new Error('session_required');

      const response=await fetch('/api/belvo-token',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({name,cpf})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload?.access){
        const detail=payload?.details?.[0]?.message||payload?.error||`Erro ${response.status}`;
        throw new Error(detail);
      }

      const url=new URL(WIDGET_URL);
      url.searchParams.set('access_token',payload.access);
      url.searchParams.set('locale','pt');
      url.searchParams.set('integration_type','openfinance');
      url.searchParams.set('country_codes','BR');
      url.searchParams.set('access_mode','recurrent');
      url.searchParams.set('external_id',session.user.id);
      window.location.assign(url.toString());
    }catch(error){
      console.error('Belvo connection error',error);
      if(message)message.textContent=`Não foi possível iniciar o Open Finance: ${error?.message||'erro inesperado'}`;
      button.disabled=false;button.textContent='Continuar para o banco';
    }
  }

  function processCallback(){
    const params=new URLSearchParams(window.location.search);
    const event=params.get('belvo');
    if(!event)return;
    const of=financeState();
    if(event==='success'){
      const link=params.get('link');
      const institution=params.get('institution')||'';
      if(link&&of){
        const existing=of.links.find(x=>x.link===link);
        if(existing){existing.institution=institution||existing.institution;existing.updatedAt=new Date().toISOString()}
        else of.links.push({link,institution,connectedAt:new Date().toISOString(),status:'connected'});
        of.lastSuccessAt=new Date().toISOString();
        persist();
      }
      setTimeout(()=>renderStatus(link?`Conexão concluída com ${institution||'a instituição'}. Aguardando a atualização histórica da Belvo para importar os dados.`:'Conexão concluída. Aguardando sincronização da Belvo.'),50);
    }else if(event==='exit'){
      setTimeout(()=>renderStatus('Conexão cancelada antes da conclusão.'),50);
    }else{
      const error=params.get('error')||params.get('last_encountered_error_code')||'erro no consentimento';
      setTimeout(()=>renderStatus(`A Belvo informou: ${error}.`,true),50);
    }
    params.delete('belvo');params.delete('link');params.delete('institution');params.delete('error');params.delete('error_message');params.delete('last_encountered_error_code');params.delete('last_encountered_error_message');
    const clean=`${window.location.pathname}${params.toString()?`?${params}`:''}${window.location.hash}`;
    window.history.replaceState({},document.title,clean);
  }

  function init(){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(installSettingsCard()||tries>150)clearInterval(timer)},100);
    processCallback();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
