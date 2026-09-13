(function(){
  let applyingRemote=false;
  let writeQueued=false;
  let lastRefreshAt=0;

  function validFinanceState(value){
    return !!(
      value&&
      value.settings&&
      Array.isArray(value.transactions)&&
      Array.isArray(value.cards)&&
      Array.isArray(value.purchases)&&
      Array.isArray(value.invoices)
    );
  }

  function blankFinanceState(){
    const now=new Date();
    const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const date=`${ym}-01`;
    return {
      settings:{baseBalance:0,baseDate:date,selectedMonth:ym},
      transactions:[],
      cards:[],
      purchases:[],
      invoices:[]
    };
  }

  function cloneState(value){
    return typeof structuredClone==='function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function setVisible(authenticated){
    const auth=document.getElementById('authScreen');
    const app=document.getElementById('appRoot');
    if(auth)auth.classList.toggle('hidden',authenticated);
    if(app)app.classList.toggle('auth-hidden',!authenticated);
  }

  async function applyServerState(financeState,{render=true}={}){
    if(!validFinanceState(financeState))return false;
    applyingRemote=true;
    try{
      state=cloneState(financeState);
      if(selectedCardId&&!state.cards.some(card=>card.id===selectedCardId))selectedCardId=state.cards[0]?.id||null;
      if(!selectedCardId)selectedCardId=state.cards[0]?.id||null;
      if(!selectedInvoiceYm)selectedInvoiceYm=state.settings.selectedMonth;
      if(render&&typeof renderAll==='function')renderAll();
      return true;
    }finally{
      applyingRemote=false;
    }
  }

  window.financeCloud={
    async load(userId){
      const {data,error}=await sb.from('finance_states').select('state,updated_at').eq('user_id',userId).maybeSingle();
      if(error)throw error;
      return data||null;
    },
    async save(userId,financeState){
      const updatedAt=new Date().toISOString();
      const {error}=await sb.from('finance_states').upsert({user_id:userId,state:cloneState(financeState),updated_at:updatedAt},{onConflict:'user_id'});
      if(error)throw error;
      return updatedAt;
    },
    async refresh(){
      if(!currentUser?.id)return null;
      const cloud=await this.load(currentUser.id);
      if(validFinanceState(cloud?.state)){
        await applyServerState(cloud.state,{render:true});
        setSyncStatus('Sincronizado com servidor');
      }
      return cloud;
    }
  };

  save=function(){
    if(applyingRemote)return;
    scheduleCloudSave();
  };

  pushStateToCloud=async function(){
    if(!currentUser||applyingRemote)return;
    if(remoteWriteInFlight){
      writeQueued=true;
      return;
    }
    remoteWriteInFlight=true;
    const userId=currentUser.id;
    const snapshot=cloneState(state);
    try{
      await window.financeCloud.save(userId,snapshot);
      setSyncStatus('Sincronizado com servidor');
    }catch(e){
      console.error('Falha ao salvar estado financeiro no Supabase:',e);
      setSyncStatus('Falha ao salvar no servidor',true);
    }finally{
      remoteWriteInFlight=false;
      if(writeQueued){
        writeQueued=false;
        scheduleCloudSave();
      }
    }
  };

  handleSession=async function(session){
    currentUser=session?.user||null;
    if(!currentUser){
      setVisible(false);
      return;
    }
    setSyncStatus('Carregando do servidor…');
    try{
      const cloud=await window.financeCloud.load(currentUser.id);
      let serverState=validFinanceState(cloud?.state)?cloud.state:null;
      if(!serverState){
        serverState=blankFinanceState();
        await window.financeCloud.save(currentUser.id,serverState);
      }
      await applyServerState(serverState,{render:false});
      selectedCardId=state.cards[0]?.id||null;
      selectedInvoiceYm=state.settings.selectedMonth;
      setVisible(true);
      applyingRemote=true;
      try{
        if(typeof renderAll==='function')renderAll();
      }finally{
        applyingRemote=false;
      }
      setSyncStatus('Sincronizado com servidor');
    }catch(e){
      console.error('Falha ao carregar estado financeiro do Supabase:',e);
      setVisible(false);
      const msg=document.getElementById('authMsg');
      if(msg)msg.textContent='Não foi possível carregar seus dados do servidor. Tente novamente.';
      setSyncStatus('Falha ao carregar servidor',true);
    }
  };

  async function refreshFromServer(){
    if(!currentUser?.id||remoteWriteInFlight||Date.now()-lastRefreshAt<2000)return;
    lastRefreshAt=Date.now();
    try{
      const cloud=await window.financeCloud.load(currentUser.id);
      if(validFinanceState(cloud?.state)){
        await applyServerState(cloud.state,{render:true});
        setSyncStatus('Sincronizado com servidor');
      }
    }catch(e){
      console.error('Falha ao atualizar estado financeiro do servidor:',e);
      setSyncStatus('Falha ao atualizar servidor',true);
    }
  }

  async function bootstrap(){
    try{
      const {data,error}=await sb.auth.getSession();
      if(error)throw error;
      if(data?.session)await handleSession(data.session);
    }catch(e){
      console.error('Falha ao inicializar sincronização:',e);
      setSyncStatus('Falha ao sincronizar',true);
    }
  }

  window.addEventListener('focus',refreshFromServer);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFromServer()});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
