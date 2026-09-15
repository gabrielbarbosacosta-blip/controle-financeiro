(function(){
  if(window.__chatgptFinanceIntegrationLoaded)return;
  window.__chatgptFinanceIntegrationLoaded=true;
  window.__invoiceAiUiLoaded=true;

  if(!document.querySelector('script[data-invoice-clear-v2]')){
    const clearScript=document.createElement('script');
    clearScript.src='invoice-clear.js';
    clearScript.async=false;
    clearScript.dataset.invoiceClearV2='1';
    document.head.appendChild(clearScript);
  }

  if(!document.querySelector('script[data-installment-import-support]')){
    const installmentScript=document.createElement('script');
    installmentScript.src='installment-import-support.js';
    installmentScript.async=false;
    installmentScript.dataset.installmentImportSupport='1';
    document.head.appendChild(installmentScript);
  }

  if(!document.querySelector('script[data-purchase-occurrence-exclusions]')){
    const exclusionScript=document.createElement('script');
    exclusionScript.src='purchase-occurrence-exclusions.js';
    exclusionScript.async=false;
    exclusionScript.dataset.purchaseOccurrenceExclusions='1';
    document.head.appendChild(exclusionScript);
  }

  if(!document.querySelector('script[data-purchase-sections]')){
    const sectionsScript=document.createElement('script');
    sectionsScript.src='purchase-sections.js';
    sectionsScript.async=false;
    sectionsScript.dataset.purchaseSections='1';
    document.head.appendChild(sectionsScript);
  }

  function fixPurchaseGroupingHeader(){
    const heading=[...document.querySelectorAll('#cardDetail .section-head h3')].find(h=>String(h.textContent||'').trim()==='Itens da fatura');
    const head=heading?.closest('.section-head');
    const btn=head?.querySelector('.purchase-grouping-toggle');
    if(!head||!btn)return false;
    let actions=head.querySelector(':scope > .purchase-grouping-actions');
    if(!actions){
      actions=document.createElement('div');
      actions.className='toolbar purchase-grouping-actions';
      const count=[...head.children].find(el=>el.classList?.contains('muted'));
      if(count)actions.appendChild(count);
      head.appendChild(actions);
    }
    if(btn.parentElement!==actions)actions.appendChild(btn);
    return true;
  }

  const groupingObserver=new MutationObserver(fixPurchaseGroupingHeader);
  if(document.body)groupingObserver.observe(document.body,{childList:true,subtree:true});
  let groupingTries=0;
  const groupingTimer=setInterval(()=>{
    groupingTries++;
    fixPurchaseGroupingHeader();
    if(groupingTries>120){clearInterval(groupingTimer);groupingObserver.disconnect()}
  },250);

  function token(){const b=new Uint8Array(32);crypto.getRandomValues(b);return 'cf_'+btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
  function copy(v){return navigator.clipboard&&navigator.clipboard.writeText(v)}
  function mount(){
    const grid=document.querySelector('#page-settings .settings-grid');
    if(!grid||document.getElementById('chatgptIntegrationCard'))return false;
    const card=document.createElement('div');card.className='card';card.id='chatgptIntegrationCard';
    card.innerHTML='<h3>Integração com ChatGPT</h3><p class="muted">Analise a fatura no ChatGPT e envie somente compras novas para este controle financeiro. A análise acontece no ChatGPT e não usa OPENAI_API_KEY no site.</p><div class="field"><label>Chave da integração</label><div class="toolbar"><input id="chatgptActionToken" readonly placeholder="Gere uma chave"><button class="btn" id="chatgptGenerateToken">Gerar nova chave</button><button class="btn" id="chatgptCopyToken" disabled>Copiar</button></div><small class="muted">Gerar outra chave revoga a anterior.</small></div><div class="toolbar" style="margin-top:14px"><button class="btn danger" id="chatgptRevokeToken">Revogar integração</button></div><div class="notice" id="chatgptIntegrationStatus" style="margin-top:14px">Schema da Ação: https://eqolnqnsyomgybyrtrzt.supabase.co/functions/v1/chatgpt-finance/schema</div>';
    grid.appendChild(card);
    const field=card.querySelector('#chatgptActionToken'),status=card.querySelector('#chatgptIntegrationStatus'),copyBtn=card.querySelector('#chatgptCopyToken');
    card.querySelector('#chatgptGenerateToken').onclick=async()=>{const value=token();status.textContent='Gerando chave…';const {error}=await sb.rpc('set_chatgpt_action_token',{p_token:value});if(error){status.textContent='Falha ao gerar chave: '+error.message;return}field.value=value;copyBtn.disabled=false;status.textContent='Chave criada. Copie agora e use como API key Bearer na ação do seu GPT.'};
    copyBtn.onclick=async()=>{if(field.value){await copy(field.value);status.textContent='Chave copiada.'}};
    card.querySelector('#chatgptRevokeToken').onclick=async()=>{if(!confirm('Revogar a integração com o ChatGPT?'))return;const {error}=await sb.rpc('revoke_chatgpt_action_token');if(error){status.textContent='Falha ao revogar: '+error.message;return}field.value='';copyBtn.disabled=true;status.textContent='Integração revogada.'};
    return true;
  }
  if(!mount()){const t=setInterval(()=>{if(mount())clearInterval(t)},700);setTimeout(()=>clearInterval(t),15000)}
})();