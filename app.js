const SUPABASE_URL='https://eqolnqnsyomgybyrtrzt.supabase.co';
const SUPABASE_KEY='sb_publishable_koTIgLL07Qe1Wf-ZY81LCA_0UO310ks';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{experimental:{passkey:true}}});
let currentUser=null;let syncTimer=null;let remoteWriteInFlight=false;let hadAuthenticatedSession=false;
const STORAGE_KEY='controleFinanceiroWebV2';
const V1_KEY='controleFinanceiroWebV1';
const categories=['Moradia','Educação','Alimentação','Transporte','Saúde','Lazer','Assinaturas','Eletrônicos','Compras','Serviços','Investimentos','Dívidas','Salário','Extra','Reembolso','Ajuste','Outros'];
const fmtMoney=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const fmtMonth=ym=>{if(!ym)return'—';const[y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit'}).format(new Date(y,m-1,1)).replace('.','')};
const fmtDate=d=>d?new Intl.DateTimeFormat('pt-BR').format(new Date(d+'T12:00:00')):'—';
const monthKey=d=>String(d||'').slice(0,7);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const round2=v=>Math.round((Number(v)||0)*100)/100;
const settled=s=>s!=='Pendente';
const ymAdd=(ym,n)=>{const[y,m]=ym.split('-').map(Number);const d=new Date(y,m-1+n,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
const monthDiff=(a,b)=>{const[ya,ma]=a.split('-').map(Number),[yb,mb]=b.split('-').map(Number);return(yb-ya)*12+(mb-ma)};
function safeDay(y,m,day){return Math.min(Math.max(Number(day)||1,1),new Date(y,m,0).getDate())}
function invoiceDueDate(card,ym){const[y,m]=ym.split('-').map(Number);return`${y}-${String(m).padStart(2,'0')}-${String(safeDay(y,m,card.dueDay||10)).padStart(2,'0')}`}
function cashEffect(t){if(!settled(t.status))return 0;if(t.type==='Receita')return Number(t.amount)||0;if(t.type==='Despesa')return-(Number(t.amount)||0);return 0}

function seedData(){
 const tx=(date,type,category,description,account,nature,amount,status,extra={})=>({id:uid(),date,type,category,description,account,nature,amount,status,notes:'',projection:true,recurring:false,...extra});
 const cards=[
  {id:'card-bb-gabriel',name:'BB Gabriel',account:'Banco do Brasil',limit:0,closingDay:28,dueDay:5,estimatedMonthlySpend:2220.39,active:true},
  {id:'card-bb-ronaldo',name:'BB Ronaldo',account:'Banco do Brasil',limit:0,closingDay:28,dueDay:5,estimatedMonthlySpend:1055.38,active:true},
  {id:'card-nubank',name:'Nubank',account:'Nubank',limit:0,closingDay:25,dueDay:2,estimatedMonthlySpend:195,active:true}
 ];
 return{
  settings:{baseBalance:8635.68,baseDate:'2026-09-01',selectedMonth:'2026-09'},
  transactions:[
   tx('2026-09-01','Benefício','Alimentação','VR','Benefício','Fixa',586.63,'Recebido',{recurring:true}),
   tx('2026-09-01','Benefício','Alimentação','VA','Benefício','Fixa',1511.10,'Recebido',{recurring:true}),
   tx('2026-09-01','Receita','Salário','Salário líquido','BB','Fixa',5858.94,'Recebido',{recurring:true}),
   tx('2026-09-01','Receita','Extra','Devolução bolsa','BB','Extra',1934.40,'Recebido',{projection:false}),
   tx('2026-09-01','Despesa','Moradia','Aluguel','BB','Fixa',1020,'Pago',{recurring:true}),
   tx('2026-09-01','Despesa','Educação','Faculdade fixo','BB','Fixa',1042.38,'Pago',{recurring:true}),
   tx('2026-09-01','Despesa','Educação','Faculdade mês','BB','Extra',2149.40,'Pago',{projection:false,notes:'Na imagem constava 2 parcelas'}),
   tx('2026-09-01','Despesa','Dívidas','CDC PREVI','BB','Parcelamento',150,'Pago',{recurring:true}),
   tx('2026-09-01','Despesa','Dívidas','CDC TRAB 2','BB','Parcelamento',312.39,'Pago',{installmentCurrent:1,installmentTotal:60}),
   tx('2026-09-01','Despesa','Dívidas','CDC TRAB 1','BB','Parcelamento',198.02,'Pago',{installmentCurrent:7,installmentTotal:108}),
   tx('2026-09-01','Despesa','Dívidas','CDC FUNCI','BB','Parcelamento',945.48,'Pago',{installmentCurrent:32,installmentTotal:120}),
   tx('2026-09-01','Despesa','Investimentos','Investimento casal','BB','Fixa',180,'Pago',{recurring:true}),
   tx('2026-09-01','Despesa','Serviços','Energia + Internet','BB','Fixa',290,'Pago',{recurring:true}),
   tx('2026-09-01','Despesa','Extra','Ajuste de conciliação','BB','Extra',270,'Pago',{projection:false,notes:'Diferença entre itens visíveis e total original; conferir'})
  ],
  cards,
  purchases:[],
  invoices:[
   {id:uid(),cardId:'card-bb-gabriel',ym:'2026-09',status:'Paga',adjustment:2220.39,notes:'Fatura histórica importada sem detalhamento das compras.'},
   {id:uid(),cardId:'card-bb-ronaldo',ym:'2026-09',status:'Paga',adjustment:1055.38,notes:'Fatura histórica importada sem detalhamento das compras.'},
   {id:uid(),cardId:'card-nubank',ym:'2026-09',status:'Paga',adjustment:195,notes:'Fatura histórica importada sem detalhamento das compras.'}
  ]
 }
}
function migrateV1(v1){
 const base=seedData();base.settings={...base.settings,...(v1.settings||{})};base.transactions=[];base.cards=[];base.purchases=[];base.invoices=[];
 const cardMap=new Map();
 function getCard(name,account,estimate){const key=name.toLowerCase();if(cardMap.has(key))return cardMap.get(key);const c={id:uid(),name,account:account||'',limit:0,closingDay:28,dueDay:5,estimatedMonthlySpend:Number(estimate)||0,active:true};base.cards.push(c);cardMap.set(key,c);return c}
 (v1.transactions||[]).forEach(t=>{
  const isCard=t.nature==='Cartão'||/^fatura\s/i.test(t.description||'')||(t.description||'').toLowerCase()==='nubank';
  if(isCard){let name=(t.description||'Cartão').replace(/^Fatura\s+/i,'');const c=getCard(name,t.account,t.amount);base.invoices.push({id:uid(),cardId:c.id,ym:monthKey(t.date),status:t.status==='Pago'?'Paga':'Aberta',adjustment:Number(t.amount)||0,notes:'Importado automaticamente da versão 1.'});}
  else base.transactions.push({...t,id:t.id||uid()});
 });
 if(!base.cards.length)return seedData();return base
}
function load(){
 try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return JSON.parse(raw);const old=localStorage.getItem(V1_KEY);if(old){const migrated=migrateV1(JSON.parse(old));localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated}}catch(e){}
 return seedData()
}
let state=load();let selectedCardId=state.cards[0]?.id||null;let selectedInvoiceYm=state.settings.selectedMonth;
function save(){
 localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
 scheduleCloudSave();
}
function setSyncStatus(text,bad=false){const el=document.getElementById('syncStatus');if(!el)return;el.textContent=text;el.style.color=bad?'#fecaca':'#bfdbfe'}
function scheduleCloudSave(){if(!currentUser)return;clearTimeout(syncTimer);setSyncStatus('Salvando…');syncTimer=setTimeout(pushStateToCloud,700)}
async function pushStateToCloud(){if(!currentUser||remoteWriteInFlight)return;remoteWriteInFlight=true;try{const {data,error}=await sb.auth.updateUser({data:{finance_state:state,finance_updated_at:new Date().toISOString()}});if(error)throw error;currentUser=data.user||currentUser;setSyncStatus('Sincronizado')}catch(e){console.error(e);setSyncStatus('Falha ao sincronizar',true)}finally{remoteWriteInFlight=false}}
function runPrumoLoginIntro(auth){
  if(!auth||auth.dataset.prumoIntroRunning==='1'||auth.dataset.prumoIntroPlayed==='1')return;
  auth.dataset.prumoIntroRunning='1';
  const words=[
    auth.querySelector('.prumo-login-word-1'),
    auth.querySelector('.prumo-login-word-2'),
    auth.querySelector('.prumo-login-word-3')
  ];
  const box=auth.querySelector('.auth-box');
  const reduced=(()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})();

  words.forEach(el=>{
    if(!el)return;
    el.getAnimations?.().forEach(anim=>anim.cancel());
    el.style.opacity='0';
    el.style.transform='translateY(7px)';
    el.style.filter='blur(5px)';
  });
  if(box){
    box.getAnimations?.().forEach(anim=>anim.cancel());
    box.style.opacity='0';
    box.style.transform='translateY(12px)';
    box.style.filter='blur(8px)';
    box.style.pointerEvents='none';
  }

  auth.classList.remove('prumo-login-prep');
  auth.classList.add('prumo-login-intro');
  void auth.offsetWidth;

  if(reduced){
    words.forEach(el=>{
      if(!el)return;
      el.style.opacity='1';
      el.style.transform='translateY(0)';
      el.style.filter='blur(0)';
    });
    if(box){
      box.style.opacity='1';
      box.style.transform='translateY(0)';
      box.style.filter='blur(0)';
      box.style.pointerEvents='auto';
    }
    auth.dataset.prumoIntroRunning='0';
    auth.dataset.prumoIntroPlayed='1';
    return;
  }

  const easing='cubic-bezier(.22,1,.36,1)';
  const wordFrames=[
    {opacity:0,transform:'translateY(7px)',filter:'blur(5px)',offset:0},
    {opacity:.66,transform:'translateY(3px)',filter:'blur(1.8px)',offset:.42},
    {opacity:1,transform:'translateY(0)',filter:'blur(0)',offset:1}
  ];
  [100,950,1800].forEach((delay,i)=>{
    const el=words[i];
    if(!el)return;
    el.animate(wordFrames,{duration:720,delay,easing,fill:'forwards'});
  });

  if(box){
    const cardAnim=box.animate([
      {opacity:0,transform:'translateY(12px)',filter:'blur(8px)',offset:0},
      {opacity:.66,transform:'translateY(5px)',filter:'blur(2px)',offset:.42},
      {opacity:1,transform:'translateY(0)',filter:'blur(0)',offset:1}
    ],{duration:720,delay:2680,easing,fill:'forwards'});
    cardAnim.finished.then(()=>{
      box.style.opacity='1';
      box.style.transform='translateY(0)';
      box.style.filter='blur(0)';
      box.style.pointerEvents='auto';
      auth.dataset.prumoIntroRunning='0';
      auth.dataset.prumoIntroPlayed='1';
    }).catch(()=>{});
  }else{
    setTimeout(()=>{
      auth.dataset.prumoIntroRunning='0';
      auth.dataset.prumoIntroPlayed='1';
    },3400);
  }
}

window.__prumoSplashManagedByApp=true;
let authenticatedSplashStartedAt=0;
let authenticatedSplashReleaseTimer=null;
let authenticatedSplashExitTimer=null;
let authenticatedUiRevealBound=false;

function finalizeAuthenticatedApp(auth=document.getElementById('authScreen'),app=document.getElementById('appRoot')){
  const body=document.body,root=document.documentElement;
  clearTimeout(authenticatedSplashReleaseTimer);
  clearTimeout(authenticatedSplashExitTimer);
  body?.classList.remove('prumo-login-mode','prumo-app-splash','caderno-splash-exit','prumo-ui-loading');
  body?.classList.add('caderno-splash-done');
  root?.classList.add('prumo-current-ui-ready');
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
    app.style.removeProperty('visibility');
    app.style.removeProperty('opacity');
  }
  try{window.dispatchEvent(new CustomEvent('caderno:splash-done'))}catch(_e){}
}

function scheduleAuthenticatedSplashRelease(auth=document.getElementById('authScreen'),app=document.getElementById('appRoot')){
  if(window.__prumoInitialModulesReady!==true)return;
  const month=document.getElementById('monthSelect');
  const opening=String(document.getElementById('kpiOpening')?.textContent||'').trim();
  if(!(month?.options?.length>0)||!opening||opening==='—'){
    clearTimeout(authenticatedSplashReleaseTimer);
    authenticatedSplashReleaseTimer=setTimeout(()=>scheduleAuthenticatedSplashRelease(auth,app),60);
    return;
  }
  const reduce=(()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_e){return false}})();
  const minVisible=reduce?0:3450;
  const elapsed=Math.max(0,performance.now()-authenticatedSplashStartedAt);
  const wait=Math.max(0,minVisible-elapsed);
  clearTimeout(authenticatedSplashReleaseTimer);
  clearTimeout(authenticatedSplashExitTimer);
  authenticatedSplashReleaseTimer=setTimeout(()=>{
    const body=document.body;
    body?.classList.add('caderno-splash-exit');
    const exitMs=reduce?0:650;
    authenticatedSplashExitTimer=setTimeout(()=>finalizeAuthenticatedApp(auth,app),exitMs);
  },wait);
}

function authenticatedUiAlreadyOpen(userId=currentUser?.id){
  const auth=document.getElementById('authScreen');
  const app=document.getElementById('appRoot');
  const body=document.body;
  return !!(
    userId&&currentUser?.id===userId&&
    app&&!app.hidden&&!app.classList.contains('auth-hidden')&&
    auth&&(auth.hidden||auth.classList.contains('hidden'))&&
    body?.classList.contains('caderno-splash-done')&&
    !body.classList.contains('prumo-login-mode')&&
    !body.classList.contains('prumo-app-splash')&&
    !body.classList.contains('caderno-splash-exit')
  );
}

function showAuthenticatedApp(auth=document.getElementById('authScreen'),app=document.getElementById('appRoot')){
  const body=document.body,root=document.documentElement;

  // Returning to the tab or receiving a repeated SIGNED_IN must never replay
  // the splash when this same authenticated UI is already active.
  if(authenticatedUiAlreadyOpen()){
    clearTimeout(authenticatedSplashReleaseTimer);
    clearTimeout(authenticatedSplashExitTimer);
    root?.classList.add('prumo-current-ui-ready');
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
    return;
  }
  if(auth){
    auth.classList.add('hidden');
    auth.hidden=true;
    auth.setAttribute('aria-hidden','true');
    auth.style.pointerEvents='none';
  }

  if(!body?.classList.contains('prumo-app-splash')||body.classList.contains('caderno-splash-done')){
    authenticatedSplashStartedAt=performance.now();
  }

  body?.classList.remove('prumo-login-mode','caderno-splash-done','caderno-splash-exit','prumo-ui-loading');
  body?.classList.add('prumo-app-splash');
  root?.classList.remove('prumo-current-ui-ready');

  // O app pode montar por baixo da splash, mas não fica visível enquanto
  // a interface atual não estiver pronta e a animação não terminar.
  if(app){
    app.classList.remove('auth-hidden');
    app.hidden=false;
    app.removeAttribute('aria-hidden');
  }

  if(window.__prumoInitialModulesReady===true){
    root?.classList.add('prumo-current-ui-ready');
    scheduleAuthenticatedSplashRelease(auth,app);
    return;
  }

  if(!authenticatedUiRevealBound){
    authenticatedUiRevealBound=true;
    window.addEventListener('prumo:initial-modules-ready',()=>{
      authenticatedUiRevealBound=false;
      document.documentElement?.classList.add('prumo-current-ui-ready');
      scheduleAuthenticatedSplashRelease(
        document.getElementById('authScreen'),
        document.getElementById('appRoot')
      );
    },{once:true});
  }
}

function showLoginScreen(auth=document.getElementById('authScreen'),app=document.getElementById('appRoot'),{reveal=true}={}){
  clearTimeout(authenticatedSplashReleaseTimer);
  clearTimeout(authenticatedSplashExitTimer);
  document.documentElement?.classList.remove('prumo-current-ui-ready');
  document.body?.classList.remove('prumo-ui-loading','prumo-app-splash','caderno-splash-exit');
  if(app){
    app.classList.add('auth-hidden');
    app.hidden=true;
    app.setAttribute('aria-hidden','true');
  }
  if(auth&&reveal){
    auth.hidden=false;
    auth.classList.remove('hidden');
    auth.removeAttribute('aria-hidden');
    auth.style.removeProperty('pointer-events');
  }
}

function revealPreparedLogin(auth){
  if(!auth)return;
  auth.hidden=false;
  auth.classList.remove('hidden');
  auth.removeAttribute('aria-hidden');
  auth.style.removeProperty('pointer-events');
}

function showLoginImmediately(auth){
  if(!auth)return;
  auth.querySelectorAll('.prumo-login-word,.auth-box').forEach(el=>{
    try{el.getAnimations?.().forEach(animation=>animation.cancel())}catch(_e){}
  });

  auth.querySelectorAll('.prumo-login-word').forEach(el=>{
    el.style.opacity='1';
    el.style.transform='translateY(0)';
    el.style.filter='blur(0)';
  });

  const box=auth.querySelector('.auth-box');
  if(box){
    box.style.opacity='1';
    box.style.transform='translateY(0)';
    box.style.filter='blur(0)';
    box.style.pointerEvents='auto';
  }

  auth.dataset.prumoIntroRunning='0';
  auth.dataset.prumoIntroPlayed='1';
  auth.classList.remove('prumo-login-prep');
  auth.classList.add('prumo-login-intro');
}

function waitForFinanceCloud(timeoutMs=2500){
  if(window.financeCloud?.activateSession)return Promise.resolve(true);
  return new Promise(resolve=>{
    let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('finance:cloud-ready',onReady);resolve(value)};
    const onReady=()=>finish(!!window.financeCloud?.activateSession);
    const timer=setTimeout(()=>finish(!!window.financeCloud?.activateSession),timeoutMs);
    window.addEventListener('finance:cloud-ready',onReady,{once:true});
  });
}

async function handleSession(session){
  const nextUser=session?.user||null;
  const auth=document.getElementById('authScreen');
  const app=document.getElementById('appRoot');

  if(!nextUser){
    const alreadyVisibleSignedOut=
      !currentUser&&
      auth&&!auth.hidden&&!auth.classList.contains('hidden')&&
      app?.classList.contains('auth-hidden');

    if(alreadyVisibleSignedOut)return;

    const returningFromApp=hadAuthenticatedSession;
    currentUser=null;
    hadAuthenticatedSession=false;
    try{window.financeCloud?.deactivateSession?.()}catch(_e){}
    document.body?.classList.remove('prumo-app-splash','caderno-splash-exit');
    document.body?.classList.add('caderno-splash-done','prumo-login-mode');

    // Prepare the complete login layout while it is still hidden.
    // This prevents a visible flex -> grid relayout after logout.
    if(auth){
      auth.hidden=true;
      auth.classList.add('hidden');
      auth.setAttribute('aria-hidden','true');
      auth.style.pointerEvents='none';
    }
    showLoginScreen(auth,app,{reveal:false});

    if(auth){
      if(returningFromApp){
        showLoginImmediately(auth);
        revealPreparedLogin(auth);
        return;
      }

      if(auth.dataset.prumoIntroRunning==='1'){
        revealPreparedLogin(auth);
        return;
      }

      if(auth.dataset.prumoIntroPlayed!=='1'){
        auth.classList.add('prumo-login-prep');
        revealPreparedLogin(auth);
        requestAnimationFrame(()=>runPrumoLoginIntro(auth));
      }else{
        showLoginImmediately(auth);
        revealPreparedLogin(auth);
      }
    }
    return;
  }

  currentUser=nextUser;
  hadAuthenticatedSession=true;
  if(auth){
    auth.dataset.prumoIntroRunning='0';
    delete auth.dataset.prumoIntroPlayed;
    auth.classList.remove('prumo-login-intro','prumo-login-prep');
  }

  // app.js is the only owner of auth visibility from this point forward.
  showAuthenticatedApp(auth,app);
  setSyncStatus('Carregando banco relacional…');

  try{
    await waitForFinanceCloud();
    if(window.financeCloud?.activateSession){
      await window.financeCloud.activateSession(currentUser.id);
    }else{
      throw new Error('finance_cloud_unavailable');
    }

    selectedCardId=state.cards[0]?.id||null;
    selectedInvoiceYm=state.settings.selectedMonth;
    renderAll();
    showAuthenticatedApp(auth,app);
    setSyncStatus('Sincronizado com banco relacional');
  }catch(error){
    console.error('Falha ao preparar sessão autenticada:',error);

    // Data-loading errors never invalidate a valid Supabase session.
    try{renderAll()}catch(_e){}
    showAuthenticatedApp(auth,app);
    setSyncStatus('Falha ao carregar dados do servidor',true);
  }
}
let authTransitionTimer=null;
let interactiveAuthInProgress=false;
let authSessionWork=null;
let authSessionWorkKey=null;

function processAuthSession(session){
  const key=session?.user?.id||'signed-out';
  if(authSessionWork&&authSessionWorkKey===key)return authSessionWork;
  const run=Promise.resolve().then(()=>handleSession(session));
  authSessionWorkKey=key;
  authSessionWork=run.finally(()=>{
    if(authSessionWork===run||authSessionWorkKey===key){
      authSessionWork=null;
      authSessionWorkKey=null;
    }
  });
  return authSessionWork;
}

function scheduleAuthSessionHandling(session){
  clearTimeout(authTransitionTimer);
  authTransitionTimer=setTimeout(()=>{
    processAuthSession(session).catch(error=>{
      console.error('Falha ao processar mudança de sessão',error);
      const msg=document.getElementById('authMsg');
      if(msg)msg.textContent=session?'Não foi possível carregar seus dados.':'Não foi possível atualizar a sessão.';
    });
  },0);
}

function cancelPendingSignedOut(){
  clearTimeout(authTransitionTimer);
  authTransitionTimer=null;
}

function verifyAndHandleSignedOut(){
  clearTimeout(authTransitionTimer);
  authTransitionTimer=setTimeout(async()=>{
    try{
      const {data,error}=await sb.auth.getSession();
      if(error)throw error;
      if(data?.session?.user){
        // O SIGNED_OUT era obsoleto/racing; a sessão válida sempre prevalece.
        await processAuthSession(data.session);
        return;
      }
      await processAuthSession(null);
    }catch(error){
      console.error('Falha ao confirmar encerramento da sessão',error);
    }
  },80);
}

async function initApp(){
  const {data,error}=await sb.auth.getSession();
  if(error)throw error;
  await processAuthSession(data.session);
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN'){
      cancelPendingSignedOut();
      if(session?.user&&authenticatedUiAlreadyOpen(session.user.id)){
        currentUser=session.user;
        return;
      }
      if(interactiveAuthInProgress)return;
      scheduleAuthSessionHandling(session);
      return;
    }
    if(event==='SIGNED_OUT'){
      verifyAndHandleSignedOut();
      return;
    }
    if(event==='TOKEN_REFRESHED'&&session?.user){
      cancelPendingSignedOut();
      currentUser=session.user;
      return;
    }
    if(event==='USER_UPDATED'&&session?.user&&currentUser?.id===session.user.id){
      currentUser=session.user;
    }
  });
}

function getCard(id){return state.cards.find(c=>c.id===id)}
function getInvoice(cardId,ym){return state.invoices.find(i=>i.cardId===cardId&&i.ym===ym)}
function ensureInvoice(cardId,ym){let i=getInvoice(cardId,ym);if(!i){i={id:uid(),cardId,ym,status:'Aberta',adjustment:0,notes:''};state.invoices.push(i)}return i}
function installmentAmount(p,index){const n=Math.max(1,Number(p.installments)||1),cents=Math.round((Number(p.totalAmount)||0)*100),base=Math.floor(cents/n),rem=cents-base*n;return(base+(index<rem?1:0))/100}
function purchaseAllocation(p,ym){
 if(p.mode==='recorrente'){if(ym<p.firstInvoiceYm)return null;if(p.recurringEnd&&ym>p.recurringEnd)return null;return{amount:Number(p.totalAmount)||0,number:null,total:null}}
 const diff=monthDiff(p.firstInvoiceYm,ym),n=Math.max(1,Number(p.installments)||1);if(diff<0||diff>=n)return null;return{amount:installmentAmount(p,diff),number:diff+1,total:n}
}
function invoiceItems(cardId,ym){return state.purchases.filter(p=>p.cardId===cardId).map(p=>({purchase:p,alloc:purchaseAllocation(p,ym)})).filter(x=>x.alloc)}
function invoiceKnownTotal(cardId,ym){const items=invoiceItems(cardId,ym),inv=getInvoice(cardId,ym);return round2(items.reduce((s,x)=>s+x.alloc.amount,0)+(Number(inv?.adjustment)||0))}
function cardForecast(card,ym){
 const known=invoiceKnownTotal(card.id,ym),inv=getInvoice(card.id,ym);let estimate=0;
 if(card.active!==false && (!inv||inv.status==='Aberta') && ym>state.settings.selectedMonth)estimate=Number(card.estimatedMonthlySpend)||0;
 return{known,estimate,total:round2(known+estimate),status:inv?.status||'Aberta'}
}
function paidInvoiceTotalForMonth(ym){return state.invoices.filter(i=>i.ym===ym&&i.status==='Paga').reduce((s,i)=>s+invoiceKnownTotal(i.cardId,ym),0)}
function balanceBeforeMonth(ym){let bal=Number(state.settings.baseBalance)||0;for(const tx of state.transactions){if(monthKey(tx.date)<ym)bal+=cashEffect(tx)}for(const inv of state.invoices){if(inv.ym<ym&&inv.status==='Paga')bal-=invoiceKnownTotal(inv.cardId,inv.ym)}return round2(bal)}
function actualForMonth(ym){
 const rows=state.transactions.filter(t=>monthKey(t.date)===ym&&settled(t.status));const income=rows.filter(t=>t.type==='Receita').reduce((s,t)=>s+(Number(t.amount)||0),0);const otherExpense=rows.filter(t=>t.type==='Despesa').reduce((s,t)=>s+(Number(t.amount)||0),0);const benefits=rows.filter(t=>t.type==='Benefício').reduce((s,t)=>s+(Number(t.amount)||0),0);const invoices=paidInvoiceTotalForMonth(ym);const expense=otherExpense+invoices;const opening=balanceBeforeMonth(ym);return{rows,income,otherExpense,invoices,expense,benefits,opening,result:income-expense,closing:round2(opening+income-expense)}
}
function isProjectedTxInMonth(tx,ym){
 if(tx.projection===false)return false;const base=monthKey(tx.date);if(ym<base)return false;if(tx.recurringEnd&&ym>tx.recurringEnd)return false;
 if(tx.nature==='Parcelamento'&&tx.installmentCurrent&&tx.installmentTotal){const elapsed=monthDiff(base,ym);return Number(tx.installmentCurrent)+elapsed<=Number(tx.installmentTotal)}
 if(tx.recurring)return true;return ym===base&&tx.status==='Pendente'
}
function projectionFrom(selectedYm,months=12){
 const actual=actualForMonth(selectedYm);let opening=actual.closing;const rows=[];
 for(let i=1;i<=months;i++){const ym=ymAdd(selectedYm,i);let income=0,otherExpense=0,benefits=0;for(const tx of state.transactions){if(!isProjectedTxInMonth(tx,ym))continue;if(tx.type==='Receita')income+=Number(tx.amount)||0;else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;else if(tx.type==='Benefício')benefits+=Number(tx.amount)||0}const invoices=state.cards.filter(c=>c.active!==false).reduce((s,c)=>s+cardForecast(c,ym).total,0);const expense=otherExpense+invoices,result=income-expense,closing=round2(opening+result);rows.push({ym,opening,income,otherExpense,invoices,expense,benefits,result,closing});opening=closing}return rows
}
function monthlySpendingCategories(ym){
 const cats={};state.transactions.filter(t=>monthKey(t.date)===ym&&t.type==='Despesa'&&settled(t.status)).forEach(t=>cats[t.category]=(cats[t.category]||0)+(Number(t.amount)||0));
 state.cards.forEach(c=>invoiceItems(c.id,ym).forEach(x=>{cats[x.purchase.category]=(cats[x.purchase.category]||0)+x.alloc.amount}));return cats
}
function allMonthOptions(){const set=new Set([state.settings.selectedMonth,monthKey(state.settings.baseDate)]);state.transactions.forEach(t=>set.add(monthKey(t.date)));state.invoices.forEach(i=>set.add(i.ym));state.purchases.forEach(p=>{set.add(p.firstInvoiceYm);for(let i=1;i<Math.min(Number(p.installments)||1,24);i++)set.add(ymAdd(p.firstInvoiceYm,i))});for(let i=-6;i<=18;i++)set.add(ymAdd(state.settings.selectedMonth,i));return[...set].sort()}

function populateGlobalSelects(){
 const catHtml=categories.map(c=>`<option>${c}</option>`).join('');document.getElementById('txCategory').innerHTML=catHtml;document.getElementById('purchaseCategory').innerHTML=catHtml;document.getElementById('categoryFilter').innerHTML='<option value="">Todas</option>'+catHtml;
 const months=allMonthOptions(),sel=document.getElementById('monthSelect');sel.innerHTML=months.map(m=>`<option value="${m}">${fmtMonth(m)}</option>`).join('');sel.value=state.settings.selectedMonth;
 document.getElementById('purchaseCard').innerHTML=state.cards.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')
}
function renderDashboard(){
 const ym=state.settings.selectedMonth,a=actualForMonth(ym);document.getElementById('kpiOpening').textContent=fmtMoney(a.opening);document.getElementById('kpiIncome').textContent=fmtMoney(a.income);document.getElementById('kpiExpense').textContent=fmtMoney(a.expense);document.getElementById('kpiInvoices').textContent=fmtMoney(a.invoices);document.getElementById('kpiClosing').textContent=fmtMoney(a.closing);document.getElementById('kpiClosing').className='value '+(a.closing<0?'negative':'');document.getElementById('kpiResultHint').textContent=`Resultado: ${fmtMoney(a.result)}`;
 const cats=monthlySpendingCategories(ym),entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=entries[0]?.[1]||1;document.getElementById('categoryList').innerHTML=entries.length?entries.map(([c,v])=>`<div class="cat-row"><div><div>${c}</div><div class="bar"><span style="width:${Math.min(100,v/max*100)}%"></span></div></div><strong>${fmtMoney(v)}</strong></div>`).join(''):'<div class="empty">Sem gastos classificados neste mês.</div>';
 drawLineChart('projectionChart',projectionFrom(ym).map(r=>({label:fmtMonth(r.ym),value:r.closing})))
}
function historyRowsForMonth(ym){
 const txs=state.transactions.filter(t=>monthKey(t.date)===ym).map(t=>({kind:'tx',id:t.id,date:t.date,type:t.type,description:t.description,category:t.category,account:t.account,status:t.status,amount:t.amount,notes:t.notes||''}));
 const invs=state.invoices.filter(i=>i.ym===ym).map(i=>{const c=getCard(i.cardId);return{kind:'invoice',id:i.id,date:invoiceDueDate(c,ym),type:'Fatura',description:`Fatura ${c?.name||'Cartão'} — ${fmtMonth(ym)}`,category:'Cartões',account:c?.account||'',status:i.status,amount:invoiceKnownTotal(i.cardId,ym),notes:i.notes||''}});return[...txs,...invs]
}
function historyDeadlineKind(r){
 const today=new Date(),todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,date=String(r?.date||'');
 const pendingTx=r?.kind==='tx'&&r?.type==='Despesa'&&String(r?.status||'')==='Pendente';
 const unpaidInvoice=r?.kind==='invoice'&&String(r?.status||'')!=='Paga';
 if(!pendingTx&&!unpaidInvoice)return '';
 return date<todayKey?'overdue':'due';
}
function renderHistory(){
 const q=document.getElementById('searchFilter').value.toLowerCase().trim(),type=document.getElementById('typeFilter').value,cat=document.getElementById('categoryFilter').value,status=document.getElementById('statusFilter').value,deadline=document.getElementById('deadlineFilter')?.value||'';
 const rows=historyRowsForMonth(state.settings.selectedMonth).filter(r=>!type||r.type===type).filter(r=>!cat||r.category===cat).filter(r=>!status||r.status===status).filter(r=>!deadline||historyDeadlineKind(r)===deadline).filter(r=>!q||`${r.description} ${r.account} ${r.notes}`.toLowerCase().includes(q)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 document.getElementById('historyCount').textContent=`${rows.length} item(ns) em ${fmtMonth(state.settings.selectedMonth)}`;document.getElementById('historyBody').innerHTML=rows.length?rows.map(r=>{const deadlineKind=historyDeadlineKind(r),deadlineBadge=deadlineKind?` <span class="badge ${deadlineKind==='overdue'?'despesa':'pendente'}">${deadlineKind==='overdue'?'Vencido':'A vencer'}</span>`:'';return `<tr><td>${fmtDate(r.date)}</td><td><span class="badge ${r.type.toLowerCase().replace('í','i')}">${r.type}</span></td><td>${r.description}</td><td>${r.category||'—'}</td><td>${r.account||'—'}</td><td><span class="badge ${String(r.status).toLowerCase()}">${r.status}</span>${deadlineBadge}</td><td class="num ${r.type==='Receita'?'positive':r.type==='Benefício'?'':'negative'}">${fmtMoney(r.amount)}</td><td>${r.kind==='invoice'?`<button class="btn small" onclick="openInvoiceFromHistory('${r.id}')">Abrir</button>`:`<button class="btn small" onclick="editTx('${r.id}')">Editar</button>`}</td></tr>`}).join(''):'<tr><td colspan="8" class="empty">Nenhum item encontrado.</td></tr>'
}
function renderCards(){
 if(!selectedCardId||!getCard(selectedCardId))selectedCardId=state.cards[0]?.id||null;
 const ym=selectedInvoiceYm||state.settings.selectedMonth;
 document.getElementById('cardsGrid').innerHTML=state.cards.length?state.cards.map(c=>{const f=cardForecast(c,ym),limit=Number(c.limit)||0,pct=limit?Math.min(999,f.total/limit*100):null;return`<div class="credit-card ${c.id===selectedCardId?'active':''}" onclick="selectCard('${c.id}')"><div class="name">${c.name}</div><div class="account">${c.account||'Cartão de crédito'}</div><div class="amount">${fmtMoney(f.total)}</div><div class="meta"><span>${fmtMonth(ym)} • ${f.status}</span><span>${pct===null?'Limite não informado':pct.toFixed(1)+'% do limite'}</span></div></div>`}).join(''):'<div class="empty">Nenhum cartão cadastrado.</div>';
 renderCardDetail()
}
function renderCardDetail(){
 const host=document.getElementById('cardDetail'),card=getCard(selectedCardId);if(!card){host.innerHTML='<div class="card empty">Cadastre um cartão para começar.</div>';return}
 const months=allMonthOptions(),ym=selectedInvoiceYm||state.settings.selectedMonth,inv=getInvoice(card.id,ym),items=invoiceItems(card.id,ym),known=invoiceKnownTotal(card.id,ym),adjust=Number(inv?.adjustment)||0,purchasesTotal=round2(items.reduce((s,x)=>s+x.alloc.amount,0)),limit=Number(card.limit)||0,pct=limit?known/limit*100:0;
 const itemHtml=items.length?items.map(x=>`<div class="detail-line"><div><div class="purchase-desc">${x.purchase.description}</div><div class="sub">${x.purchase.category} • ${fmtDate(x.purchase.date)} ${x.alloc.number?`• ${x.alloc.number}/${x.alloc.total}`:'• recorrente'}</div></div><div style="text-align:right"><strong>${fmtMoney(x.alloc.amount)}</strong><div style="margin-top:5px"><button class="btn small" onclick="editPurchase('${x.purchase.id}')">Editar</button></div></div></div>`).join(''):'<div class="empty">Nenhuma compra atribuída a esta fatura.</div>';
 const proj=[];for(let i=0;i<12;i++){const m=ymAdd(state.settings.selectedMonth,i),f=cardForecast(card,m);proj.push({ym:m,...f})}
 host.innerHTML=`<div class="invoice-layout"><div class="card"><div class="section-head"><div><h3>Fatura ${card.name}</h3><div class="muted">Compras internas geram um único valor no caixa</div></div><div class="invoice-tools"><select id="invoiceMonthLocal">${months.map(m=>`<option value="${m}" ${m===ym?'selected':''}>${fmtMonth(m)}</option>`).join('')}</select><button class="btn" onclick="openInvoiceModal('${card.id}','${ym}')">Configurar fatura</button><button class="btn primary" onclick="openPurchaseModal('${card.id}','${ym}')">+ Adicionar compra</button></div></div><div class="invoice-total">${fmtMoney(known)}</div><div><span class="badge ${(inv?.status||'Aberta').toLowerCase()}">${inv?.status||'Aberta'}</span> <span class="muted">Vencimento: dia ${card.dueDay||'—'}</span></div><div class="split-kpis"><div class="mini"><div class="t">Compras/parcelas</div><div class="v">${fmtMoney(purchasesTotal)}</div></div><div class="mini"><div class="t">Ajustes</div><div class="v">${fmtMoney(adjust)}</div></div><div class="mini"><div class="t">Limite usado</div><div class="v">${limit?pct.toFixed(1)+'%':'—'}</div></div></div>${limit?`<div class="progress"><span style="width:${Math.min(100,pct)}%"></span></div>`:''}<div class="divider"></div><div class="section-head"><h3>Itens da fatura</h3><span class="muted">${items.length} item(ns)</span></div>${itemHtml}${inv?.notes?`<div class="notice" style="margin-top:14px">${inv.notes}</div>`:''}</div>
 <div class="card"><div class="section-head"><div><h3>Projeção do cartão</h3><div class="muted">Parcelas conhecidas + estimativa de novas compras</div></div><button class="btn" onclick="editCard('${card.id}')">Editar cartão</button></div><div class="chart-wrap small"><canvas id="cardProjectionChart"></canvas></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Mês</th><th class="num">Compromissos</th><th class="num">Estimativa nova</th><th class="num">Fatura projetada</th></tr></thead><tbody>${proj.map(r=>`<tr><td>${fmtMonth(r.ym)}</td><td class="num">${fmtMoney(r.known)}</td><td class="num">${fmtMoney(r.estimate)}</td><td class="num"><strong>${fmtMoney(r.total)}</strong></td></tr>`).join('')}</tbody></table></div></div></div>`;
 document.getElementById('invoiceMonthLocal').onchange=e=>{selectedInvoiceYm=e.target.value;renderCards()};requestAnimationFrame(()=>drawLineChart('cardProjectionChart',proj.map(r=>({label:fmtMonth(r.ym),value:r.total}))))
}
function renderProjection(){
 const rows=projectionFrom(state.settings.selectedMonth),opening=rows[0]?.opening??actualForMonth(state.settings.selectedMonth).closing,lowest=Math.min(...rows.map(r=>r.closing)),cardsTotal=rows.reduce((s,r)=>s+r.invoices,0),ending=rows.at(-1)?.closing||0;
 const openingEl=document.getElementById('projOpening'),lowestEl=document.getElementById('projLowest'),cardsEl=document.getElementById('projCardsTotal'),endEl=document.getElementById('projEnd');
 openingEl.textContent=fmtMoney(opening);openingEl.className='v '+(opening<0?'negative':'positive');
 lowestEl.textContent=fmtMoney(lowest);lowestEl.className='v '+(lowest<0?'negative':'positive');
 cardsEl.textContent=fmtMoney(cardsTotal);cardsEl.className='v negative';
 endEl.textContent=fmtMoney(ending);endEl.className='v '+(ending<0?'negative':'positive');
 document.getElementById('projectionBody').innerHTML=rows.map(r=>`<tr><td>${fmtMonth(r.ym)}</td><td class="num ${r.opening<0?'negative':'positive'}">${fmtMoney(r.opening)}</td><td class="num positive">${fmtMoney(r.income)}</td><td class="num negative">${fmtMoney(r.otherExpense)}</td><td class="num negative">${fmtMoney(r.invoices)}</td><td class="num ${r.result<0?'negative':'positive'}">${fmtMoney(r.result)}</td><td class="num ${r.closing<0?'negative':'positive'}"><strong>${fmtMoney(r.closing)}</strong></td></tr>`).join('');
 drawLineChart('projectionChartLarge',rows.map(r=>({label:fmtMonth(r.ym),value:r.closing})))
}
function renderSettings(){document.getElementById('setBaseBalance').value=state.settings.baseBalance;document.getElementById('setBaseDate').value=state.settings.baseDate}
function renderAll(){populateGlobalSelects();renderDashboard();renderHistory();renderCards();renderProjection();renderSettings();save()}

function drawLineChart(id,data){
 const canvas=document.getElementById(id);if(!canvas)return;const rect=canvas.getBoundingClientRect();const dpr=window.devicePixelRatio||1,cssW=Math.max(300,rect.width||700),cssH=Math.max(220,rect.height||300);canvas.width=cssW*dpr;canvas.height=cssH*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const W=cssW,H=cssH,p={l:62,r:18,t:20,b:42},vals=data.map(d=>Number(d.value)||0);let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min){max+=1;min-=1}const pad=(max-min)*.1;max+=pad;min-=pad;const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));ctx.clearRect(0,0,W,H);ctx.strokeStyle='#273449';ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.lineWidth=1;for(let i=0;i<=4;i++){const val=min+(max-min)*i/4,yy=y(val);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),5,yy+4)}if(min<0&&max>0){ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}ctx.strokeStyle='#60a5fa';ctx.lineWidth=3;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);ctx.fillStyle=d.value<0?'#ef4444':'#3b82f6';ctx.beginPath();ctx.arc(xx,yy,4,0,Math.PI*2);ctx.fill();if(data.length<=12||i%2===0){ctx.save();ctx.translate(xx,H-13);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore()}})
}

function openModal(id){document.getElementById(id).classList.add('open')}function closeModal(id){document.getElementById(id).classList.remove('open')}
function openTxModal(id=null){
 const t=id?state.transactions.find(x=>x.id===id):null;document.getElementById('txModalTitle').textContent=t?'Editar lançamento':'Novo lançamento';document.getElementById('txId').value=t?.id||'';document.getElementById('txDate').value=t?.date||`${state.settings.selectedMonth}-01`;document.getElementById('txType').value=t?.type||'Despesa';document.getElementById('txCategory').value=t?.category||'Outros';document.getElementById('txDescription').value=t?.description||'';document.getElementById('txAccount').value=t?.account||'';document.getElementById('txNature').value=t?.nature||'Variável';document.getElementById('txAmount').value=t?.amount??'';document.getElementById('txStatus').value=t?.status||(t?.type==='Receita'?'Recebido':'Pago');document.getElementById('txInstallmentCurrent').value=t?.installmentCurrent||'';document.getElementById('txInstallmentTotal').value=t?.installmentTotal||'';document.getElementById('txRecurring').checked=!!t?.recurring;document.getElementById('txRecurringEnd').value=t?.recurringEnd||'';document.getElementById('txProjection').checked=t?.projection!==false;document.getElementById('txNotes').value=t?.notes||'';openModal('txModal')
}
window.editTx=openTxModal;
function editCard(id){const c=getCard(id);document.getElementById('cardModalTitle').textContent='Editar cartão';document.getElementById('cardId').value=c.id;document.getElementById('cardName').value=c.name;document.getElementById('cardAccount').value=c.account||'';document.getElementById('cardLimit').value=c.limit||'';document.getElementById('cardEstimate').value=c.estimatedMonthlySpend||0;document.getElementById('cardClosingDay').value=c.closingDay||'';document.getElementById('cardDueDay').value=c.dueDay||'';document.getElementById('cardActive').checked=c.active!==false;openModal('cardModal')}window.editCard=editCard;
function openCardModal(){document.getElementById('cardModalTitle').textContent='Novo cartão';document.getElementById('cardForm').reset();document.getElementById('cardId').value='';document.getElementById('cardActive').checked=true;openModal('cardModal')}
function openPurchaseModal(cardId=selectedCardId,ym=selectedInvoiceYm){document.getElementById('purchaseModalTitle').textContent='Adicionar compra';document.getElementById('purchaseForm').reset();document.getElementById('purchaseId').value='';document.getElementById('purchaseCard').value=cardId||state.cards[0]?.id||'';document.getElementById('purchaseDate').value=`${state.settings.selectedMonth}-01`;document.getElementById('purchaseMode').value='parcelada';document.getElementById('purchaseInstallments').value=1;document.getElementById('purchaseFirstInvoice').value=ym||state.settings.selectedMonth;document.getElementById('purchaseCategory').value='Compras';togglePurchaseMode();openModal('purchaseModal')}window.openPurchaseModal=openPurchaseModal;
function editPurchase(id){const p=state.purchases.find(x=>x.id===id);if(!p)return;document.getElementById('purchaseModalTitle').textContent='Editar compra';document.getElementById('purchaseId').value=p.id;document.getElementById('purchaseCard').value=p.cardId;document.getElementById('purchaseDate').value=p.date;document.getElementById('purchaseDescription').value=p.description;document.getElementById('purchaseCategory').value=p.category;document.getElementById('purchaseMode').value=p.mode||'parcelada';document.getElementById('purchaseAmount').value=p.totalAmount;document.getElementById('purchaseInstallments').value=p.installments||1;document.getElementById('purchaseFirstInvoice').value=p.firstInvoiceYm;document.getElementById('purchaseRecurringEnd').value=p.recurringEnd||'';document.getElementById('purchaseNotes').value=p.notes||'';togglePurchaseMode();openModal('purchaseModal')}window.editPurchase=editPurchase;
function openInvoiceModal(cardId,ym){const inv=getInvoice(cardId,ym);document.getElementById('invoiceCardId').value=cardId;document.getElementById('invoiceYm').value=ym;document.getElementById('invoiceStatus').value=inv?.status||'Aberta';document.getElementById('invoiceAdjustment').value=inv?.adjustment||0;document.getElementById('invoiceNotes').value=inv?.notes||'';openModal('invoiceModal')}window.openInvoiceModal=openInvoiceModal;
function openInvoiceFromHistory(invoiceId){const inv=state.invoices.find(i=>i.id===invoiceId);if(!inv)return;selectedCardId=inv.cardId;selectedInvoiceYm=inv.ym;showPage('cards');renderCards()}window.openInvoiceFromHistory=openInvoiceFromHistory;
function selectCard(id){selectedCardId=id;renderCards()}window.selectCard=selectCard;
function togglePurchaseMode(){const rec=document.getElementById('purchaseMode').value==='recorrente';document.getElementById('installmentsField').style.display=rec?'none':'grid';document.getElementById('recurringEndField').style.display=rec?'grid':'none';document.getElementById('purchaseAmountLabel').textContent=rec?'Valor mensal (R$)':'Valor total da compra (R$)'}

function prumoPasskeySupported(){
  return !!window.PublicKeyCredential
    &&typeof sb?.auth?.signInWithPasskey==='function'
    &&typeof sb?.auth?.registerPasskey==='function'
    &&!!sb?.auth?.passkey;
}
function prumoPasskeyError(error){
  const code=String(error?.code||'');
  const name=String(error?.name||'');
  if(code==='passkey_disabled')return 'Face ID / Passkey ainda não está ativado no servidor.';
  if(code==='email_not_confirmed')return 'Confirme seu e-mail antes de cadastrar ou usar uma passkey.';
  if(code==='too_many_passkeys')return 'Esta conta atingiu o limite de passkeys cadastradas.';
  if(code==='webauthn_credential_exists')return 'Esta passkey já está cadastrada nesta conta.';
  if(code==='webauthn_credential_not_found')return 'Esta passkey não está cadastrada no Prumo.';
  if(code==='webauthn_challenge_expired')return 'A solicitação expirou. Tente novamente.';
  if(code==='webauthn_verification_failed')return 'Não foi possível validar a passkey. Tente novamente.';
  if(name==='NotAllowedError'||/notallowed/i.test(String(error?.message||'')))return 'Autenticação cancelada ou não autorizada no dispositivo.';
  return String(error?.message||'Não foi possível concluir a autenticação por passkey.');
}
function prumoPasskeyRows(data){
  if(Array.isArray(data))return data;
  if(Array.isArray(data?.passkeys))return data.passkeys;
  return [];
}
async function refreshPrumoPasskeys(){
  const list=document.getElementById('passkeyList');
  const msg=document.getElementById('passkeySettingsMsg');
  const registerBtn=document.getElementById('registerPasskeyBtn');
  if(!list||!msg||!registerBtn)return;
  list.replaceChildren();
  msg.textContent='';
  if(!currentUser){
    registerBtn.disabled=true;
    msg.textContent='Entre na conta para gerenciar suas passkeys.';
    return;
  }
  if(!prumoPasskeySupported()){
    registerBtn.disabled=true;
    msg.textContent='Este navegador não oferece suporte ao recurso de passkeys do Prumo.';
    return;
  }
  registerBtn.disabled=false;
  try{
    const {data,error}=await sb.auth.passkey.list();
    if(error)throw error;
    const rows=prumoPasskeyRows(data);
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='passkey-empty';
      empty.textContent='Nenhuma passkey cadastrada.';
      list.appendChild(empty);
      return;
    }
    rows.forEach(item=>{
      const row=document.createElement('div');
      row.className='passkey-item';

      const copy=document.createElement('div');
      copy.className='passkey-item-copy';

      const title=document.createElement('strong');
      title.textContent=item?.friendly_name||'Passkey';

      const meta=document.createElement('small');
      const created=item?.created_at?new Date(item.created_at):null;
      meta.textContent=created&&!Number.isNaN(created.getTime())
        ?`Cadastrada em ${created.toLocaleDateString('pt-BR')}`
        :'Passkey cadastrada';

      copy.append(title,meta);

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='btn small';
      remove.textContent='Remover';
      remove.onclick=async()=>{
        if(!confirm('Remover esta passkey da sua conta?'))return;
        remove.disabled=true;
        msg.textContent='Removendo passkey…';
        try{
          const {error}=await sb.auth.passkey.delete({passkeyId:item.id});
          if(error)throw error;
          msg.textContent='Passkey removida.';
          await refreshPrumoPasskeys();
        }catch(error){
          console.error('Falha ao remover passkey',error);
          msg.textContent=prumoPasskeyError(error);
        }finally{
          remove.disabled=false;
        }
      };

      row.append(copy,remove);
      list.appendChild(row);
    });
  }catch(error){
    console.error('Falha ao listar passkeys',error);
    msg.textContent=prumoPasskeyError(error);
  }
}
window.refreshPrumoPasskeys=refreshPrumoPasskeys;

function showPage(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const titles={dashboard:['Dashboard','Caixa, gastos e projeções'],history:['Lançamentos','Fluxo de caixa consolidado'],cards:['Cartões','Faturas, compras e projeção por cartão'],projection:['Projeção geral','Saldo futuro com faturas projetadas'],settings:['Configurações','Base financeira, backup e exportação']};document.getElementById('pageTitle').textContent=titles[page][0];document.getElementById('pageSubtitle').textContent=titles[page][1];if(page==='dashboard')requestAnimationFrame(renderDashboard);if(page==='cards')requestAnimationFrame(renderCards);if(page==='projection')requestAnimationFrame(renderProjection);if(page==='settings')requestAnimationFrame(refreshPrumoPasskeys)}

// Events
[...document.querySelectorAll('.nav button')].forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.getElementById('monthSelect').onchange=e=>{state.settings.selectedMonth=e.target.value;selectedInvoiceYm=e.target.value;renderAll()};document.getElementById('quickAdd').onclick=()=>openTxModal();document.getElementById('addFromHistory').onclick=()=>openTxModal();document.getElementById('addCardBtn').onclick=openCardModal;document.querySelectorAll('.modal-close').forEach(b=>b.onclick=()=>closeModal(b.dataset.modal));document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));['searchFilter','typeFilter','categoryFilter','statusFilter','deadlineFilter'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderHistory));document.getElementById('purchaseMode').onchange=togglePurchaseMode;

document.getElementById('txForm').onsubmit=e=>{e.preventDefault();const id=document.getElementById('txId').value;const obj={id:id||uid(),date:document.getElementById('txDate').value,type:document.getElementById('txType').value,category:document.getElementById('txCategory').value,description:document.getElementById('txDescription').value.trim(),account:document.getElementById('txAccount').value.trim(),nature:document.getElementById('txNature').value,amount:Number(document.getElementById('txAmount').value)||0,status:document.getElementById('txStatus').value,installmentCurrent:Number(document.getElementById('txInstallmentCurrent').value)||null,installmentTotal:Number(document.getElementById('txInstallmentTotal').value)||null,recurring:document.getElementById('txRecurring').checked,recurringEnd:document.getElementById('txRecurringEnd').value||null,projection:document.getElementById('txProjection').checked,notes:document.getElementById('txNotes').value.trim()};if(id){const idx=state.transactions.findIndex(t=>t.id===id);state.transactions[idx]=obj}else state.transactions.push(obj);closeModal('txModal');renderAll()};
document.getElementById('cardForm').onsubmit=e=>{e.preventDefault();const id=document.getElementById('cardId').value;const obj={id:id||uid(),name:document.getElementById('cardName').value.trim(),account:document.getElementById('cardAccount').value.trim(),limit:Number(document.getElementById('cardLimit').value)||0,estimatedMonthlySpend:Number(document.getElementById('cardEstimate').value)||0,closingDay:Number(document.getElementById('cardClosingDay').value)||null,dueDay:Number(document.getElementById('cardDueDay').value)||null,active:document.getElementById('cardActive').checked};if(id){const idx=state.cards.findIndex(c=>c.id===id);state.cards[idx]=obj}else{state.cards.push(obj);selectedCardId=obj.id}closeModal('cardModal');renderAll()};
document.getElementById('purchaseForm').onsubmit=e=>{e.preventDefault();const id=document.getElementById('purchaseId').value,mode=document.getElementById('purchaseMode').value;const obj={id:id||uid(),cardId:document.getElementById('purchaseCard').value,date:document.getElementById('purchaseDate').value,description:document.getElementById('purchaseDescription').value.trim(),category:document.getElementById('purchaseCategory').value,mode,totalAmount:Number(document.getElementById('purchaseAmount').value)||0,installments:mode==='recorrente'?null:(Number(document.getElementById('purchaseInstallments').value)||1),firstInvoiceYm:document.getElementById('purchaseFirstInvoice').value,recurringEnd:mode==='recorrente'?(document.getElementById('purchaseRecurringEnd').value||null):null,notes:document.getElementById('purchaseNotes').value.trim()};if(id){const idx=state.purchases.findIndex(p=>p.id===id);state.purchases[idx]=obj}else state.purchases.push(obj);selectedCardId=obj.cardId;selectedInvoiceYm=obj.firstInvoiceYm;closeModal('purchaseModal');renderAll()};
document.getElementById('invoiceForm').onsubmit=e=>{e.preventDefault();const cardId=document.getElementById('invoiceCardId').value,ym=document.getElementById('invoiceYm').value,inv=ensureInvoice(cardId,ym);inv.status=document.getElementById('invoiceStatus').value;inv.adjustment=Number(document.getElementById('invoiceAdjustment').value)||0;inv.notes=document.getElementById('invoiceNotes').value.trim();closeModal('invoiceModal');renderAll()};
document.getElementById('saveSettings').onclick=()=>{state.settings.baseBalance=Number(document.getElementById('setBaseBalance').value)||0;state.settings.baseDate=document.getElementById('setBaseDate').value||state.settings.baseDate;renderAll()};
document.getElementById('backupBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`controle-financeiro-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
document.getElementById('restoreFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!data.settings||!Array.isArray(data.transactions)||!Array.isArray(data.cards))throw new Error();state=data;selectedCardId=state.cards[0]?.id||null;selectedInvoiceYm=state.settings.selectedMonth;renderAll();alert('Backup restaurado.')}catch(err){alert('Arquivo de backup inválido.')}};r.readAsText(f)};
document.getElementById('csvBtn').onclick=()=>{const rows=[['Competência','Data','Tipo','Descrição','Categoria','Conta','Status','Valor']];for(const ym of allMonthOptions()){historyRowsForMonth(ym).forEach(r=>rows.push([ym,r.date,r.type,r.description,r.category,r.account,r.status,r.amount]))}const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv='\ufeff'+rows.map(r=>r.map(esc).join(';')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='controle-financeiro.csv';a.click();URL.revokeObjectURL(a.href)};
document.getElementById('registerPasskeyBtn').onclick=async()=>{
  const btn=document.getElementById('registerPasskeyBtn');
  const msg=document.getElementById('passkeySettingsMsg');
  if(!currentUser){msg.textContent='Entre na conta para cadastrar uma passkey.';return}
  if(!prumoPasskeySupported()){msg.textContent='Este navegador não oferece suporte ao recurso de passkeys do Prumo.';return}
  btn.disabled=true;
  msg.textContent='Confirme a autenticação no seu dispositivo…';
  try{
    const {data,error}=await sb.auth.registerPasskey();
    if(error)throw error;
    msg.textContent=`${data?.friendly_name||'Passkey'} cadastrada com sucesso.`;
    await refreshPrumoPasskeys();
  }catch(error){
    console.error('Falha ao cadastrar passkey',error);
    msg.textContent=prumoPasskeyError(error);
  }finally{
    btn.disabled=false;
  }
};
document.getElementById('resetBtn').onclick=()=>{if(confirm('Apagar os dados desta versão e recriar a base inicial?')){state=seedData();selectedCardId=state.cards[0]?.id||null;selectedInvoiceYm=state.settings.selectedMonth;renderAll()}};
window.addEventListener('resize',()=>{if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();if(document.getElementById('page-projection').classList.contains('active'))renderProjection();if(document.getElementById('page-cards').classList.contains('active'))renderCards()});
document.getElementById('authPasskey').onclick=async()=>{
  const btn=document.getElementById('authPasskey');
  const msg=document.getElementById('authMsg');
  if(!prumoPasskeySupported()){
    msg.textContent='Este navegador não oferece suporte a Face ID / Passkey.';
    return;
  }
  btn.disabled=true;
  interactiveAuthInProgress=true;
  msg.textContent='Confirme a autenticação no seu dispositivo…';
  try{
    const {data,error}=await sb.auth.signInWithPasskey();
    if(error)throw error;
    if(!data?.session)throw new Error('A autenticação não retornou uma sessão.');
    cancelPendingSignedOut();
    msg.textContent='Carregando seus dados…';
    await processAuthSession(data.session);
    if(!document.getElementById('appRoot')?.classList.contains('auth-hidden'))msg.textContent='';
  }catch(error){
    console.error('Falha no login por passkey',error);
    msg.textContent=prumoPasskeyError(error);
  }finally{
    interactiveAuthInProgress=false;
    btn.disabled=false;
  }
};
document.getElementById('authLogin').onclick=async()=>{
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const msg=document.getElementById('authMsg');
  const btn=document.getElementById('authLogin');
  msg.textContent='Entrando…';
  if(btn)btn.disabled=true;
  interactiveAuthInProgress=true;
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error){msg.textContent=error.message;return}
    if(!data?.session){msg.textContent='A autenticação não retornou uma sessão.';return}
    cancelPendingSignedOut();
    msg.textContent='Carregando seus dados…';
    await processAuthSession(data.session);
    if(!document.getElementById('appRoot')?.classList.contains('auth-hidden'))msg.textContent='';
  }catch(error){
    console.error('Falha no login',error);
    msg.textContent='Não foi possível conectar ao serviço de autenticação.';
  }finally{
    interactiveAuthInProgress=false;
    if(btn)btn.disabled=false;
  }
};
document.getElementById('authSignup').onclick=async()=>{
  const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value,msg=document.getElementById('authMsg');
  if(password.length<6){msg.textContent='Use uma senha com pelo menos 6 caracteres.';return}
  msg.textContent='Criando conta…';
  interactiveAuthInProgress=true;
  try{
    const {data,error}=await sb.auth.signUp({email,password});
    if(error){msg.textContent=error.message;return}
    if(data.session){
      msg.textContent='Carregando seus dados…';
      await processAuthSession(data.session);
      if(!document.getElementById('appRoot')?.classList.contains('auth-hidden'))msg.textContent='';
    }else{
      msg.textContent='Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre.';
    }
  }catch(error){
    console.error('Falha ao criar conta',error);
    msg.textContent='Não foi possível criar a conta.';
  }finally{
    interactiveAuthInProgress=false;
  }
};
document.getElementById('logoutBtn').onclick=async()=>{
  const {error}=await sb.auth.signOut();
  if(error){
    console.error('Falha ao sair da conta',error);
  }
};
initApp();