(function(){
  if(window.__greetingNicknameV1Loaded)return;
  window.__greetingNicknameV1Loaded=true;

  function fallbackName(){
    try{
      const meta=currentUser?.user_metadata||{};
      const full=String(meta.full_name||meta.name||meta.nome||'').trim();
      const email=String(currentUser?.email||'').trim();
      const base=full||email.split('@')[0].replace(/[._-]+/g,' ')||'Gabriel';
      return base.split(/\s+/)[0]||'Gabriel';
    }catch(e){return'Gabriel'}
  }

  function nickname(){
    const input=document.getElementById('profileNickname');
    const value=String(input?.value||'').trim();
    return value||fallbackName();
  }

  function greeting(){
    const h=new Date().getHours();
    return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  }

  function isDashboard(){
    const active=document.querySelector('.nav button.active')?.dataset.page;
    return !active||active==='dashboard';
  }

  function apply(){
    if(!isDashboard())return;
    const title=document.getElementById('pageTitle');
    if(!title)return;
    const wanted=`${greeting()}, ${nickname()}.`;
    if(title.textContent!==wanted)title.textContent=wanted;
  }

  document.addEventListener('input',e=>{
    if(e.target?.id==='profileNickname')apply();
  });
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.nav button'))setTimeout(apply,0);
    if(e.target?.id==='profileSaveBtn')setTimeout(apply,250);
  });

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    apply();
    const input=document.getElementById('profileNickname');
    if(input&&String(input.value||'').trim()&&tries>10)clearInterval(timer);
    if(tries>150)clearInterval(timer);
  },100);

  new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true});
  apply();
})();
