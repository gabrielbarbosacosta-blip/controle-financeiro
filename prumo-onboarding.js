(function(){
  if(window.__prumoOnboardingLoaded)return;
  window.__prumoOnboardingLoaded=true;

  const VERSION='v1';
  const BASE_KEY='prumo:onboarding:'+VERSION;
  let overlay=null;
  let current=0;
  let userKey='device';
  let shownThisSession=false;

  const slides=[
    {
      eyebrow:'Bem-vindo ao Prumo',
      title:'Seu dinheiro, com direção.',
      text:'Receitas, despesas, cartões, objetivos e projeções reunidos em uma visão simples do seu mês.',
      icon:'home'
    },
    {
      eyebrow:'1 de 4 · Comece pelo básico',
      title:'Registre o que entra e o que sai.',
      text:'Cadastre suas receitas e despesas. Itens recorrentes ajudam o Prumo a entender os próximos meses automaticamente.',
      icon:'wallet'
    },
    {
      eyebrow:'2 de 4 · Cartões',
      title:'A fatura sem perder os detalhes.',
      text:'Cadastre o cartão e suas compras. O Prumo mantém as compras detalhadas, mas leva a fatura consolidada para o seu fluxo de caixa.',
      icon:'card'
    },
    {
      eyebrow:'3 de 4 · Objetivos',
      title:'Transforme planos em metas visíveis.',
      text:'Crie objetivos individuais ou compartilhados, registre aportes e acompanhe quanto falta para chegar lá.',
      icon:'target'
    },
    {
      eyebrow:'4 de 4 · Projeções',
      title:'Veja o mês de amanhã antes de ele chegar.',
      text:'Use Projeções para antecipar saldos, compromissos e faturas. Assim você decide com mais contexto, não só olhando para hoje.',
      icon:'chart'
    }
  ];

  const icons={
    home:`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 22 24 9l16 13"/><path d="M12 20v19h24V20"/><path d="M20 39V28h8v11"/></svg>`,
    wallet:`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 14h27a4 4 0 0 1 4 4v19H11a4 4 0 0 1-4-4V15a5 5 0 0 1 5-5h23"/><path d="M32 23h8v9h-8a4.5 4.5 0 0 1 0-9Z"/><path d="M32 27.5h.01"/></svg>`,
    card:`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="11" width="36" height="26" rx="5"/><path d="M6 19h36"/><path d="M12 30h10"/></svg>`,
    target:`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="23" cy="25" r="15"/><circle cx="23" cy="25" r="8"/><path d="m23 25 15-15"/><path d="M32 10h6v6"/></svg>`,
    chart:`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 38V10"/><path d="M8 38h33"/><path d="m13 31 8-9 7 5 11-14"/><path d="M34 13h5v5"/></svg>`
  };

  function style(){
    if(document.getElementById('prumo-onboarding-style'))return;
    const s=document.createElement('style');
    s.id='prumo-onboarding-style';
    s.textContent=`
      body.prumo-onboarding-open{overflow:hidden!important}
      .prumo-onboarding{
        position:fixed;inset:0;z-index:20000;
        display:grid;place-items:center;
        padding:max(18px,env(safe-area-inset-top)) 18px max(18px,env(safe-area-inset-bottom));
        background:rgba(3,9,18,.72);
        -webkit-backdrop-filter:blur(18px) saturate(1.15);
        backdrop-filter:blur(18px) saturate(1.15);
        opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .28s ease,visibility 0s linear .28s;
      }
      .prumo-onboarding.open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .28s ease}
      .prumo-onboarding-card{
        width:min(520px,100%);
        min-height:min(650px,calc(100vh - 36px));
        max-height:calc(100vh - 36px);
        display:flex;flex-direction:column;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.16);
        border-radius:28px;
        background:rgba(13,25,41,.92);
        box-shadow:0 30px 90px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.07);
        color:#e7edf5;
      }
      .prumo-onboarding-top{
        min-height:64px;padding:15px 18px 8px;
        display:flex;align-items:center;justify-content:space-between;gap:16px;
      }
      .prumo-onboarding-brand{font-weight:820;letter-spacing:-.05em;font-size:20px;color:#ddeaac}
      .prumo-onboarding-skip{
        appearance:none;border:0;background:transparent;color:#9baabd;
        padding:9px 8px;border-radius:10px;font:700 12px/1 inherit;cursor:pointer;
      }
      .prumo-onboarding-skip:hover{background:rgba(255,255,255,.06);color:#fff}
      .prumo-onboarding-stage{
        flex:1;min-height:0;padding:18px 28px 16px;
        display:flex;flex-direction:column;justify-content:center;
      }
      .prumo-onboarding-visual{
        width:112px;height:112px;margin:0 0 30px;
        border-radius:32px;
        display:grid;place-items:center;
        color:#ddeaac;
        background:linear-gradient(145deg,rgba(221,234,172,.12),rgba(101,170,255,.06));
        border:1px solid rgba(221,234,172,.18);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
      }
      .prumo-onboarding-visual svg{
        width:56px;height:56px;fill:none;stroke:currentColor;stroke-width:2;
        stroke-linecap:round;stroke-linejoin:round;
      }
      .prumo-onboarding-eyebrow{
        color:#91a1b4;font-size:11px;font-weight:800;text-transform:uppercase;
        letter-spacing:.11em;margin-bottom:10px;
      }
      .prumo-onboarding-title{
        margin:0;color:#f6f8fb;font-size:clamp(30px,7vw,42px);line-height:1.02;
        letter-spacing:-.055em;font-weight:820;max-width:440px;
      }
      .prumo-onboarding-text{
        margin:18px 0 0;color:#aab7c8;font-size:15px;line-height:1.62;
        max-width:440px;
      }
      .prumo-onboarding-footer{padding:14px 18px 18px}
      .prumo-onboarding-progress{display:flex;gap:6px;margin:0 0 16px;padding:0 2px}
      .prumo-onboarding-dot{
        height:4px;flex:1;border-radius:999px;background:rgba(255,255,255,.10);
        overflow:hidden;transition:background .25s ease;
      }
      .prumo-onboarding-dot.done,.prumo-onboarding-dot.active{background:#ddeaac}
      .prumo-onboarding-actions{display:flex;align-items:center;gap:10px}
      .prumo-onboarding-btn{
        min-height:48px;border-radius:14px;padding:0 18px;
        border:1px solid #2a3c55;background:#101d2e;color:#dce6f2;
        font:800 13px/1 inherit;cursor:pointer;
        transition:transform .18s ease,background .18s ease,border-color .18s ease;
      }
      .prumo-onboarding-btn:hover{background:#15243a;border-color:#3a506d}
      .prumo-onboarding-btn:active{transform:scale(.98)}
      .prumo-onboarding-btn.primary{
        margin-left:auto;min-width:150px;background:#ddeaac;border-color:#ddeaac;color:#0b1a27;
      }
      .prumo-onboarding-btn.primary:hover{background:#e7f2bb;border-color:#e7f2bb}
      .prumo-onboarding-btn[hidden]{display:none!important}
      .prumo-onboarding-card.is-changing .prumo-onboarding-stage{animation:prumoOnboardingIn .32s cubic-bezier(.22,1,.36,1)}
      @keyframes prumoOnboardingIn{
        from{opacity:.15;transform:translateX(14px);filter:blur(3px)}
        to{opacity:1;transform:none;filter:none}
      }
      @media(max-width:600px){
        .prumo-onboarding{padding:0}
        .prumo-onboarding-card{
          width:100%;height:100%;min-height:100%;max-height:none;border-radius:0;border:0;
          background:linear-gradient(180deg,#0b1626 0%,#07101d 100%);
        }
        .prumo-onboarding-top{padding:calc(14px + env(safe-area-inset-top)) 20px 8px}
        .prumo-onboarding-stage{padding:14px 24px 16px}
        .prumo-onboarding-visual{width:96px;height:96px;border-radius:28px;margin-bottom:28px}
        .prumo-onboarding-visual svg{width:49px;height:49px}
        .prumo-onboarding-title{font-size:36px}
        .prumo-onboarding-text{font-size:14px}
        .prumo-onboarding-footer{padding:12px 20px calc(18px + env(safe-area-inset-bottom))}
      }
      @media(prefers-reduced-motion:reduce){
        .prumo-onboarding,.prumo-onboarding-card.is-changing .prumo-onboarding-stage,.prumo-onboarding-btn{transition:none!important;animation:none!important}
      }
    `;
    document.head.appendChild(s);
  }

  function storageKey(){return BASE_KEY+':'+userKey}

  async function resolveUser(){
    try{
      if(typeof sb!=='undefined'&&sb?.auth?.getUser){
        const {data}=await sb.auth.getUser();
        if(data?.user?.id)userKey=data.user.id;
      }
    }catch(_e){}
    return userKey;
  }

  function seen(){
    try{return localStorage.getItem(storageKey())==='1'}catch(_e){return false}
  }

  function markSeen(){
    try{localStorage.setItem(storageKey(),'1')}catch(_e){}
  }

  function build(){
    if(overlay)return overlay;
    style();
    overlay=document.createElement('div');
    overlay.className='prumo-onboarding';
    overlay.id='prumoOnboarding';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','prumoOnboardingTitle');
    overlay.innerHTML=`
      <div class="prumo-onboarding-card">
        <div class="prumo-onboarding-top">
          <div class="prumo-onboarding-brand">prumo</div>
          <button type="button" class="prumo-onboarding-skip" data-onboarding-skip>Pular</button>
        </div>
        <div class="prumo-onboarding-stage">
          <div class="prumo-onboarding-visual"></div>
          <div class="prumo-onboarding-eyebrow"></div>
          <h2 class="prumo-onboarding-title" id="prumoOnboardingTitle"></h2>
          <p class="prumo-onboarding-text"></p>
        </div>
        <div class="prumo-onboarding-footer">
          <div class="prumo-onboarding-progress" aria-label="Progresso do tutorial"></div>
          <div class="prumo-onboarding-actions">
            <button type="button" class="prumo-onboarding-btn" data-onboarding-back>Voltar</button>
            <button type="button" class="prumo-onboarding-btn primary" data-onboarding-next>Continuar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-onboarding-skip]').addEventListener('click',()=>close(true));
    overlay.querySelector('[data-onboarding-back]').addEventListener('click',()=>go(current-1));
    overlay.querySelector('[data-onboarding-next]').addEventListener('click',()=>{
      if(current>=slides.length-1)close(true);
      else go(current+1);
    });
    overlay.addEventListener('keydown',e=>{
      if(e.key==='Escape')close(true);
      if(e.key==='ArrowRight'&&current<slides.length-1)go(current+1);
      if(e.key==='ArrowLeft'&&current>0)go(current-1);
    });
    return overlay;
  }

  function render(){
    const el=build(),slide=slides[current],card=el.querySelector('.prumo-onboarding-card');
    card.classList.remove('is-changing');
    void card.offsetWidth;
    card.classList.add('is-changing');
    el.querySelector('.prumo-onboarding-visual').innerHTML=icons[slide.icon]||icons.home;
    el.querySelector('.prumo-onboarding-eyebrow').textContent=slide.eyebrow;
    el.querySelector('.prumo-onboarding-title').textContent=slide.title;
    el.querySelector('.prumo-onboarding-text').textContent=slide.text;
    const progress=el.querySelector('.prumo-onboarding-progress');
    progress.innerHTML=slides.map((_,i)=>`<span class="prumo-onboarding-dot ${i<current?'done':i===current?'active':''}" aria-hidden="true"></span>`).join('');
    const back=el.querySelector('[data-onboarding-back]');
    const next=el.querySelector('[data-onboarding-next]');
    const skip=el.querySelector('[data-onboarding-skip]');
    back.hidden=current===0;
    next.textContent=current===slides.length-1?'Começar a usar':'Continuar';
    skip.hidden=current===slides.length-1;
  }

  function go(index){
    current=Math.max(0,Math.min(slides.length-1,index));
    render();
  }

  async function open(options={}){
    await resolveUser();
    build();
    current=Number.isInteger(options.step)?Math.max(0,Math.min(slides.length-1,options.step)):0;
    render();
    overlay.classList.add('open');
    document.body.classList.add('prumo-onboarding-open');
    setTimeout(()=>overlay.querySelector('[data-onboarding-next]')?.focus(),50);
  }

  function close(remember=true){
    if(!overlay)return;
    if(remember)markSeen();
    overlay.classList.remove('open');
    document.body.classList.remove('prumo-onboarding-open');
  }

  async function maybeOpen(){
    if(shownThisSession)return;
    const app=document.getElementById('appRoot');
    const auth=document.getElementById('authScreen');
    const splashDone=document.body.classList.contains('caderno-splash-done');
    const loggedIn=app&&!app.classList.contains('auth-hidden')&&(!auth||auth.classList.contains('hidden'));
    if(!loggedIn||!splashDone)return;
    await resolveUser();
    if(seen())return;
    shownThisSession=true;
    setTimeout(()=>open(),320);
  }

  async function reset(){
    await resolveUser();
    try{localStorage.removeItem(storageKey())}catch(_e){}
    shownThisSession=false;
    close(false);
    return true;
  }

  window.prumoOnboarding={open,close,reset,version:VERSION};

  function init(){
    build();
    maybeOpen();
    let queued=false;
    const schedule=()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;maybeOpen()});
    };
    const app=document.getElementById('appRoot'),auth=document.getElementById('authScreen');
    const observer=new MutationObserver(schedule);
    if(app)observer.observe(app,{attributes:true,attributeFilter:['class']});
    if(auth)observer.observe(auth,{attributes:true,attributeFilter:['class']});
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('focus',schedule,{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
