(function(){
  if(window.__financePwaLoaded)return;
  window.__financePwaLoaded=true;

  let deferredPrompt=null;
  const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;

  function ensureHead(){
    if(!document.querySelector('link[rel="manifest"]')){
      const link=document.createElement('link');link.rel='manifest';link.href='/manifest.webmanifest';document.head.appendChild(link);
    }
    if(!document.querySelector('meta[name="theme-color"]')){
      const meta=document.createElement('meta');meta.name='theme-color';meta.content='#0f172a';document.head.appendChild(meta);
    }
    if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){
      const meta=document.createElement('meta');meta.name='apple-mobile-web-app-capable';meta.content='yes';document.head.appendChild(meta);
    }
    if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){
      const meta=document.createElement('meta');meta.name='apple-mobile-web-app-status-bar-style';meta.content='black-translucent';document.head.appendChild(meta);
    }
    if(!document.querySelector('meta[name="apple-mobile-web-app-title"]')){
      const meta=document.createElement('meta');meta.name='apple-mobile-web-app-title';meta.content='Financeiro';document.head.appendChild(meta);
    }
    if(!document.querySelector('link[rel="icon"]')){
      const icon=document.createElement('link');icon.rel='icon';icon.href='/pwa-icon.svg';icon.type='image/svg+xml';document.head.appendChild(icon);
    }
    if(!document.querySelector('link[rel="apple-touch-icon"]')){
      const icon=document.createElement('link');icon.rel='apple-touch-icon';icon.href='/pwa-icon.svg';document.head.appendChild(icon);
    }
  }

  function injectStyles(){
    if(document.getElementById('pwa-install-style'))return;
    const style=document.createElement('style');style.id='pwa-install-style';style.textContent=`
      .pwa-install-card{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:14px;background:rgba(15,23,42,.68)}
      .pwa-install-title{font-size:12px;font-weight:760}.pwa-install-copy{font-size:11px;color:var(--muted);line-height:1.45;margin-top:4px}.pwa-install-card .btn{margin-top:9px;width:100%}
      .pwa-installed-badge{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:5px 8px;border-radius:999px;background:#102a19;border:1px solid #245f37;color:#bbf7d0;font-size:10px;font-weight:700}
    `;document.head.appendChild(style);
  }

  function ensureInstallUi(){
    injectStyles();
    const sidebar=document.querySelector('.sidebar');if(!sidebar||document.getElementById('pwaInstallCard'))return;
    const card=document.createElement('div');card.id='pwaInstallCard';card.className='pwa-install-card';
    if(standalone){
      card.innerHTML='<div class="pwa-install-title">Aplicativo instalado</div><div class="pwa-installed-badge">✓ Modo aplicativo</div>';
    }else if(isIos){
      card.innerHTML='<div class="pwa-install-title">Instalar no iPhone</div><div class="pwa-install-copy">No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</div>';
    }else{
      card.innerHTML='<div class="pwa-install-title">Instalar aplicativo</div><div class="pwa-install-copy">Adicione o Controle Financeiro à tela inicial para abrir como aplicativo.</div><button class="btn small" type="button" id="pwaInstallBtn" disabled>Instalar app</button>';
    }
    sidebar.appendChild(card);
    const button=document.getElementById('pwaInstallBtn');
    if(button){
      button.disabled=!deferredPrompt;
      button.onclick=async()=>{
        if(!deferredPrompt)return;
        button.disabled=true;
        deferredPrompt.prompt();
        try{await deferredPrompt.userChoice}catch(_e){}
        deferredPrompt=null;
        card.innerHTML='<div class="pwa-install-title">Aplicativo</div><div class="pwa-install-copy">A instalação foi processada pelo navegador.</div>';
      };
    }
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();deferredPrompt=event;
    const button=document.getElementById('pwaInstallBtn');if(button)button.disabled=false;
    ensureInstallUi();
  });
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;const card=document.getElementById('pwaInstallCard');if(card)card.innerHTML='<div class="pwa-install-title">Aplicativo instalado</div><div class="pwa-installed-badge">✓ Modo aplicativo</div>'});

  async function register(){
    ensureHead();
    if('serviceWorker' in navigator){
      try{await navigator.serviceWorker.register('/sw.js',{scope:'/'});}catch(error){console.warn('Falha ao registrar PWA.',error)}
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureInstallUi,{once:true});else ensureInstallUi();
  }
  register();
})();
