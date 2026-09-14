(function(){
  let applyingRemote=false;
  let writeQueued=false;
  let lastRefreshAt=0;
  let lastRemoteUpdatedAt=null;

  function validFinanceState(value){
    return !!(
      value&&value.settings&&Array.isArray(value.transactions)&&Array.isArray(value.cards)&&
      Array.isArray(value.purchases)&&Array.isArray(value.invoices)
    );
  }

  function blankFinanceState(){
    const now=new Date();
    const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return {
      settings:{baseBalance:0,baseDate:`${ym}-01`,selectedMonth:ym,projectionMonths:12,
        dashboardProjectionSources:{transactions:true,incomes:true,cards:true,debts:true}},
      transactions:[],cards:[],purchases:[],invoices:[],incomePlans:[],debts:[]
    };
  }

  function cloneState(value){
    return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  }

  function setVisible(authenticated){
    const auth=document.getElementById('authScreen'),app=document.getElementById('appRoot');
    if(auth)auth.classList.toggle('hidden',authenticated);
    if(app)app.classList.toggle('auth-hidden',!authenticated);
  }

  async function applyServerState(financeState,{render=true}={}){
    if(!validFinanceState(financeState))return false;
    applyingRemote=true;
    try{
      state=cloneState(financeState);
      if(!Array.isArray(state.incomePlans))state.incomePlans=[];
      if(!Array.isArray(state.debts))state.debts=[];
      if(selectedCardId&&!state.cards.some(card=>card.id===selectedCardId))selectedCardId=state.cards[0]?.id||null;
      if(!selectedCardId)selectedCardId=state.cards[0]?.id||null;
      if(!selectedInvoiceYm)selectedInvoiceYm=state.settings.selectedMonth;
      if(render&&typeof renderAll==='function')renderAll();
      return true;
    }finally{applyingRemote=false}
  }

  function rpcFailure(data,fallback){
    const error=new Error(data?.error||fallback);
    error.code=data?.error||'rpc_failed';
    error.remoteUpdatedAt=data?.updatedAt||null;
    return error;
  }

  window.financeCloud={
    async load(userId){
      if(!userId)return null;
      const {data,error}=await sb.rpc('finance_get_state');
      if(error)throw error;
      if(!data?.ok){
        if(data?.error==='finance_state_not_found'){lastRemoteUpdatedAt=null;return null}
        throw rpcFailure(data,'finance_load_failed');
      }
      lastRemoteUpdatedAt=data.updatedAt||null;
      return{state:data.state,updated_at:data.updatedAt||null};
    },
    async save(userId,financeState){
      if(!userId)throw new Error('user_required');
      const {data,error}=await sb.rpc('finance_put_state',{
        p_state:cloneState(financeState),
        p_expected_updated_at:lastRemoteUpdatedAt
      });
      if(error)throw error;
      if(!data?.ok)throw rpcFailure(data,'finance_save_failed');
      lastRemoteUpdatedAt=data.updatedAt||null;
      return lastRemoteUpdatedAt;
    },
    async refresh(){
      if(!currentUser?.id)return null;
      const cloud=await this.load(currentUser.id);
      if(validFinanceState(cloud?.state)){
        await applyServerState(cloud.state,{render:true});
        setSyncStatus('Sincronizado com banco relacional');
      }
      return cloud;
    },
    get version(){return lastRemoteUpdatedAt}
  };

  save=function(){if(!applyingRemote)scheduleCloudSave()};

  pushStateToCloud=async function(){
    if(!currentUser||applyingRemote)return;
    if(remoteWriteInFlight){writeQueued=true;return}
    remoteWriteInFlight=true;
    const userId=currentUser.id,snapshot=cloneState(state);
    try{
      await window.financeCloud.save(userId,snapshot);
      setSyncStatus('Sincronizado com banco relacional');
    }catch(e){
      console.error('Falha ao salvar dados financeiros relacionais:',e);
      if(e?.code==='conflict')setSyncStatus('Dados alterados em outra sessão — atualize a página',true);
      else setSyncStatus('Falha ao salvar no servidor',true);
    }finally{
      remoteWriteInFlight=false;
      if(writeQueued){writeQueued=false;scheduleCloudSave()}
    }
  };

  handleSession=async function(session){
    currentUser=session?.user||null;
    if(!currentUser){setVisible(false);return}
    setSyncStatus('Carregando banco relacional…');
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
      try{if(typeof renderAll==='function')renderAll()}finally{applyingRemote=false}
      setSyncStatus('Sincronizado com banco relacional');
    }catch(e){
      console.error('Falha ao carregar dados financeiros relacionais:',e);
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
        setSyncStatus('Sincronizado com banco relacional');
      }
    }catch(e){
      console.error('Falha ao atualizar dados financeiros relacionais:',e);
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();