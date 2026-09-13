(function(){
  if(window.__chatgptFinanceIntegrationLoaded)return;
  window.__chatgptFinanceIntegrationLoaded=true;

  const schemaUrl=()=>`${location.origin}/api/chatgpt-finance`;
  function randomToken(){
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    const raw=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    return `cf_${raw}`;
  }
  function copy(text){return navigator.clipboard?.writeText(text)}

  function mount(){
    const grid=document.querySelector('#page-settings .settings-grid');
    if(!grid||document.getElementById('chatgptIntegrationCard'))return false;
    const card=document.createElement('div');
    card.className='card';card.id='chatgptIntegrationCard';
    card.innerHTML=`<h3>Integração com ChatGPT</h3><p class="muted">Use o ChatGPT para analisar a fatura e enviar somente compras novas para este Controle Financeiro. A análise acontece no ChatGPT; seu site não usa uma chave da OpenAI.</p><div class="field"><label>Chave da integração</label><div class="toolbar"><input id="chatgptActionToken" readonly placeholder="Gere uma chave para conectar o ChatGPT"><button class="btn" id="chatgptGenerateToken">Gerar nova chave</button><button class="btn" id="chatgptCopyToken" disabled>Copiar</button></div><small class="muted">A chave é mostrada somente nesta sessão. Gerar outra revoga a anterior.</small></div><div class="toolbar" style="margin-top:14px"><button class="btn" id="chatgptCopyEndpoint">Copiar endpoint</button><button class="btn danger" id="chatgptRevokeToken">Revogar integração</button></div><div class="notice" id="chatgptIntegrationStatus" style="margin-top:14px">Endpoint da ação: <strong>/api/chatgpt-finance</strong>. Configure a ação do seu GPT com autenticação por API key no formato Bearer.</div>`;
    grid.appendChild(card);

    const field=card.querySelector('#chatgptActionToken'),status=card.querySelector('#chatgptIntegrationStatus'),copyBtn=card.querySelector('#chatgptCopyToken');
    card.querySelector('#chatgptGenerateToken').onclick=async()=>{
      const token=randomToken();status.textContent='Gerando chave…';
      const {error}=await sb.rpc('set_chatgpt_action_token',{p_token:token});
      if(error){status.textContent=`Falha ao gerar chave: ${error.message}`;return}
      field.value=token;copyBtn.disabled=false;status.textContent='Chave criada. Copie agora e use na autenticação da ação do seu GPT. A chave anterior foi revogada.';
    };
    copyBtn.onclick=async()=>{if(!field.value)return;await copy(field.value);status.textContent='Chave copiada.'};
    card.querySelector('#chatgptCopyEndpoint').onclick=async()=>{await copy(schemaUrl());status.textContent=`Endpoint copiado: ${schemaUrl()}`};
    card.querySelector('#chatgptRevokeToken').onclick=async()=>{
      if(!confirm('Revogar a integração com o ChatGPT?'))return;
      const {error}=await sb.rpc('revoke_chatgpt_action_token');
      if(error){status.textContent=`Falha ao revogar: ${error.message}`;return}
      field.value='';copyBtn.disabled=true;status.textContent='Integração revogada.';
    };
    return true;
  }

  if(!mount()){
    const timer=setInterval(()=>{if(mount())clearInterval(timer)},700);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();
