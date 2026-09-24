(function(){
  if(window.__financePwaLoaded)return;
  window.__financePwaLoaded=true;

  let deferredPrompt=null;
  const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;

  function ensureHead(){
    if(!document.querySelector('link[rel="manifest"]')){const link=document.createElement('link');link.rel='manifest';link.href='/manifest.webmanifest';document.head.appendChild(link)}
    if(!document.querySelector('meta[name="theme-color"]')){const meta=document.createElement('meta');meta.name='theme-color';meta.content='#07101d';document.head.appendChild(meta)}
    if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){const meta=document.createElement('meta');meta.name='apple-mobile-web-app-capable';meta.content='yes';document.head.appendChild(meta)}
    if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){const meta=document.createElement('meta');meta.name='apple-mobile-web-app-status-bar-style';meta.content='black-translucent';document.head.appendChild(meta)}
    if(!document.querySelector('meta[name="apple-mobile-web-app-title"]')){const meta=document.createElement('meta');meta.name='apple-mobile-web-app-title';meta.content='prumo';document.head.appendChild(meta)}
    if(!document.querySelector('link[rel="icon"]')){const icon=document.createElement('link');icon.rel='icon';icon.href='/pwa-icon.svg';icon.type='image/svg+xml';document.head.appendChild(icon)}
    if(!document.querySelector('link[rel="apple-touch-icon"]')){const icon=document.createElement('link');icon.rel='apple-touch-icon';icon.href='/pwa-icon.svg';document.head.appendChild(icon)}
  }

  function injectStyles(){
    if(document.getElementById('pwa-install-style'))return;
    const style=document.createElement('style');style.id='pwa-install-style';style.textContent=`
      .pwa-install-card{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:14px;background:rgba(15,23,42,.68)}
      .pwa-install-title{font-size:12px;font-weight:760}.pwa-install-copy{font-size:11px;color:var(--muted);line-height:1.45;margin-top:4px}.pwa-install-card .btn{margin-top:9px;width:100%}
      .pwa-installed-device{position:relative;width:31px;height:31px;min-width:31px;display:grid;place-items:center;color:#aab7c8;border:1px solid transparent;border-radius:9px;background:transparent;pointer-events:none}
      .pwa-installed-device>svg{width:19px;height:19px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .pwa-installed-check{position:absolute;right:1px;bottom:1px;width:11px;height:11px;border-radius:50%;display:grid;place-items:center;background:#091321;color:var(--accent);box-shadow:0 0 0 1.5px #091321}
      .pwa-installed-check svg{width:9px;height:9px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
    `;document.head.appendChild(style);
  }

  function ensureInstalledIndicator(){
    const card=document.getElementById('profileSidebarCard');
    if(!card)return false;
    let tools=card.querySelector('.profile-card-tools');
    if(!tools)return false;
    let indicator=tools.querySelector('#pwaInstalledIndicator');
    if(!indicator){
      indicator=document.createElement('span');
      indicator.id='pwaInstalledIndicator';
      indicator.className='pwa-installed-device';
      indicator.setAttribute('role','img');
      indicator.setAttribute('aria-label','Aplicativo instalado');
      indicator.setAttribute('title','Aplicativo instalado');
      indicator.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.2"></rect><path d="M10 18.5h4"></path></svg><span class="pwa-installed-check"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 8.2 2.5 2.5L12 5.3"></path></svg></span>';
      tools.insertBefore(indicator,tools.firstChild);
    }
    document.getElementById('pwaInstallCard')?.remove();
    return true;
  }

  function renderInstalledState(card){
    if(card)card.remove();
    if(ensureInstalledIndicator())return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(ensureInstalledIndicator()||tries>80)clearInterval(timer);
    },100);
  }

  function ensureInstallUi(){
    injectStyles();const sidebar=document.querySelector('.sidebar');if(!sidebar||document.getElementById('pwaInstallCard'))return;
    const card=document.createElement('div');card.id='pwaInstallCard';card.className='pwa-install-card';
    if(standalone){renderInstalledState(card);return}
    else if(isIos)card.innerHTML='<div class="pwa-install-title">Instalar no iPhone</div><div class="pwa-install-copy">No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</div>';
    else card.innerHTML='<div class="pwa-install-title">Instalar aplicativo</div><div class="pwa-install-copy">Adicione o prumo à tela inicial para abrir como aplicativo.</div><button class="btn small" type="button" id="pwaInstallBtn" disabled>Instalar app</button>';
    sidebar.appendChild(card);const button=document.getElementById('pwaInstallBtn');if(button){button.disabled=!deferredPrompt;button.onclick=async()=>{if(!deferredPrompt)return;button.disabled=true;deferredPrompt.prompt();try{const choice=await deferredPrompt.userChoice;if(choice?.outcome==='accepted')renderInstalledState(card)}catch(_e){}deferredPrompt=null}}
  }

  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;const button=document.getElementById('pwaInstallBtn');if(button)button.disabled=false;ensureInstallUi()});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;const card=document.getElementById('pwaInstallCard');renderInstalledState(card)});

  if(standalone){
    const observer=new MutationObserver(()=>{
      if(ensureInstalledIndicator()){
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    observer._pwaTag='pwa-profile-indicator-observer';
  }

  async function register(){
    ensureHead();
    const host=String(location.hostname||'').toLowerCase();
    const localHost=host==='localhost'||host==='127.0.0.1'||host==='::1'||/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if('serviceWorker' in navigator){
      if(localHost){
        try{
          const registrations=await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(registration=>registration.unregister()));
        }catch(error){console.warn('Falha ao limpar service worker local.',error)}
      }else{
        try{const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});registration.update().catch(()=>{})}catch(error){console.warn('Falha ao registrar PWA.',error)}
      }
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureInstallUi,{once:true});else ensureInstallUi();
  }
  register();
})();