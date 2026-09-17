(function(){
  if(window.__goalParticipantAvatarsV7Loaded)return;
  window.__goalParticipantAvatarsV7Loaded=true;

  const STYLE_ID='goal-participant-avatars-v7-style';
  const BUCKET='profile-photos';
  let byGoal=new Map();
  let signedUrls=new Map();
  let loading=false;
  let loadTimer=null;
  let lastLoadAt=0;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function initials(name){
    const parts=String(name||'Participante').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return'?';
    return (parts.length>1?parts[0][0]+parts[1][0]:parts[0].slice(0,2)).toUpperCase();
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .goal-card.goal-has-participant-avatars .goal-head{position:relative;padding-right:138px}
      .goal-participant-stack{position:absolute;top:11px;right:13px;display:flex;align-items:center;justify-content:flex-end;min-height:42px;z-index:2}
      .goal-participant-avatar{width:40px;height:40px;border-radius:50%;overflow:hidden;display:grid;place-items:center;flex:0 0 40px;margin-left:-10px;border:2px solid #0d1929;background:#19263a;color:#ddeaac;font-size:11px;font-weight:850;letter-spacing:.02em;box-shadow:0 3px 10px rgba(0,0,0,.28)}
      .goal-participant-avatar:first-child{margin-left:0}
      .goal-participant-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .goal-participant-more{background:#101d2e;color:#aab7c8;border-color:#23334a}
      .goal-participant-stack:hover .goal-participant-avatar{margin-left:-5px;transition:margin-left .16s ease}
      .goal-participant-stack:hover .goal-participant-avatar:first-child{margin-left:0}
      @media(max-width:620px){.goal-card.goal-has-participant-avatars .goal-head{padding-right:116px}.goal-participant-avatar{width:34px;height:34px;flex-basis:34px}.goal-participant-stack{top:12px;right:11px;min-height:36px}}
    `;
    document.head.appendChild(style);
  }

  function removeStack(card){
    card.classList.remove('goal-has-participant-avatars');
    card.querySelector('.goal-participant-stack')?.remove();
    delete card.dataset.participantAvatarSignature;
  }

  function renderCard(card){
    const row=byGoal.get(String(card.dataset.goalId));
    const participants=Array.isArray(row?.participants)?row.participants:[];
    if(participants.length<2){removeStack(card);return}

    const visible=participants.slice(0,4);
    const signature=participants.map(p=>`${p.userId||''}:${p.avatarPath||''}:${signedUrls.get(p.avatarPath)||''}`).join('|');
    if(card.dataset.participantAvatarSignature===signature&&card.querySelector('.goal-participant-stack'))return;
    card.dataset.participantAvatarSignature=signature;
    card.classList.add('goal-has-participant-avatars');
    card.querySelector('.goal-participant-stack')?.remove();

    const head=card.querySelector('.goal-head');
    if(!head)return;
    const stack=document.createElement('div');
    stack.className='goal-participant-stack';
    stack.setAttribute('aria-label',`${participants.length} participantes neste objetivo`);

    visible.forEach(p=>{
      const avatar=document.createElement('div');
      avatar.className='goal-participant-avatar';
      const label=`${p.name||'Participante'}${p.isOwner?' · proprietário':''}`;
      avatar.title=label;
      avatar.setAttribute('aria-label',label);
      const url=p.avatarPath?signedUrls.get(p.avatarPath):'';
      if(url){
        const img=document.createElement('img');
        img.src=url;
        img.alt=p.name||'Participante';
        img.loading='lazy';
        img.addEventListener('error',()=>{avatar.textContent=initials(p.name)} ,{once:true});
        avatar.appendChild(img);
      }else avatar.textContent=initials(p.name);
      stack.appendChild(avatar);
    });

    if(participants.length>visible.length){
      const more=document.createElement('div');
      more.className='goal-participant-avatar goal-participant-more';
      more.textContent=`+${participants.length-visible.length}`;
      more.title=`Mais ${participants.length-visible.length} participante(s)`;
      stack.appendChild(more);
    }
    head.appendChild(stack);
  }

  function renderAll(){
    document.querySelectorAll('#goalGrid .goal-card[data-goal-id]').forEach(renderCard);
  }

  async function loadParticipants(force=false){
    const client=getSb(),uid=getUserId();
    if(!client||!uid||loading)return;
    const now=Date.now();
    if(!force&&now-lastLoadAt<1200){renderAll();return}
    loading=true;lastLoadAt=now;
    try{
      const {data,error}=await client.rpc('finance_list_goal_participants');
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'participant_load_failed');
      const items=Array.isArray(data.items)?data.items:[];
      byGoal=new Map(items.map(x=>[String(x.goalId),x]));

      const paths=[...new Set(items.flatMap(x=>Array.isArray(x.participants)?x.participants:[]).map(p=>p.avatarPath).filter(Boolean))];
      signedUrls=new Map();
      if(paths.length){
        const {data:signed,error:signedError}=await client.storage.from(BUCKET).createSignedUrls(paths,3600);
        if(!signedError&&Array.isArray(signed)){
          signed.forEach((item,index)=>{
            const path=item?.path||paths[index];
            const url=item?.signedUrl||item?.signedURL||'';
            if(path&&url)signedUrls.set(path,url);
          });
        }
      }
      renderAll();
    }catch(e){console.warn('Não foi possível carregar os avatares do objetivo compartilhado.',e)}
    finally{loading=false}
  }

  function scheduleLoad(delay=160,force=false){
    clearTimeout(loadTimer);
    loadTimer=setTimeout(()=>loadParticipants(force),delay);
  }

  function observeGoals(){
    const grid=document.getElementById('goalGrid');
    if(!grid||grid.dataset.participantAvatarObserver==='1')return;
    grid.dataset.participantAvatarObserver='1';
    new MutationObserver(mutations=>{
      const onlyOurNodes=mutations.every(m=>[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType!==1||n.classList?.contains('goal-participant-stack')||n.closest?.('.goal-participant-stack')));
      if(onlyOurNodes){renderAll();return}
      scheduleLoad(220,true);
    }).observe(grid,{childList:true,subtree:true});
  }

  function hookRefresh(){
    if(window.__goalParticipantRefreshHooked)return;
    const original=window.financeGoalCollabRefresh;
    if(typeof original!=='function')return;
    window.__goalParticipantRefreshHooked=true;
    window.financeGoalCollabRefresh=async function(){
      const result=await original.apply(this,arguments);
      await loadParticipants(true);
      return result;
    };
  }

  function boot(){
    injectStyles();
    observeGoals();
    hookRefresh();
    scheduleLoad(120,true);
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-page="goals"],[data-goal-share-respond],[data-goal-share-remove],[data-goal-share-leave],#goalShareForm .btn.primary'))setTimeout(()=>scheduleLoad(80,true),350);
    },true);
    window.addEventListener('focus',()=>{if(document.getElementById('page-goals')?.classList.contains('active'))scheduleLoad(80,true)});
    let tries=0;
    const ready=setInterval(()=>{
      tries++;observeGoals();hookRefresh();
      if(getSb()&&getUserId()&&document.getElementById('goalGrid')){clearInterval(ready);scheduleLoad(40,true)}
      else if(tries>300)clearInterval(ready);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
