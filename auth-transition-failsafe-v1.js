(function(){
  if(window.__prumoAuthTransitionFailsafeLoaded)return;
  window.__prumoAuthTransitionFailsafeLoaded=true;

  function revealApp(){
    const auth=document.getElementById('authScreen');
    const app=document.getElementById('appRoot');
    document.body?.classList.remove('prumo-login-mode','prumo-app-splash','caderno-splash-exit');
    document.body?.classList.add('caderno-splash-done');
    if(auth){
      auth.classList.add('hidden');
      auth.hidden=true;
      auth.setAttribute('aria-hidden','true');
      auth.style.pointerEvents='none';
    }
    if(app){
      app.classList.remove('auth-hidden');
      app.hidden=false;
      app.removeAttribute('aria-hidden');
    }
    try{
      if(typeof showPage==='function')showPage('dashboard');
      else document.querySelector('.nav button[data-page="dashboard"]')?.click();
    }catch(_e){}
  }

  async function reconcile(){
    try{
      if(typeof sb==='undefined'||!sb?.auth?.getSession)return;
      const {data}=await sb.auth.getSession();
      if(data?.session?.user)revealApp();
    }catch(e){
      console.warn('Falha ao reconciliar transição de autenticação.',e);
    }
  }

  function bind(){
    const btn=document.getElementById('authLogin');
    if(btn&&!btn.dataset.transitionFailsafe){
      btn.dataset.transitionFailsafe='1';
      btn.addEventListener('click',()=>{
        setTimeout(reconcile,250);
        setTimeout(reconcile,900);
        setTimeout(reconcile,1800);
      });
    }
    const passkey=document.getElementById('authPasskey');
    if(passkey&&!passkey.dataset.transitionFailsafe){
      passkey.dataset.transitionFailsafe='1';
      passkey.addEventListener('click',()=>{
        setTimeout(reconcile,400);
        setTimeout(reconcile,1400);
      });
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();

  window.addEventListener('pageshow',reconcile);
})();