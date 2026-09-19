(function(){
  if(window.__financeCloudSyncLoaded)return;
  window.__financeCloudSyncLoaded=true;
  let applyingRemote=false;
  let writeQueued=false;
  let localWritePending=false;
  let lastRefreshAt=0;
  let lastRemoteUpdatedAt=null;
  let relationalReady=false;

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
    if(authenticated){
      if(typeof showAuthenticatedApp==='function'){
        showAuthenticatedApp(auth,app);
        return;
      }
      if(auth){
        auth.classList.add('hidden');
        auth.hidden=true;
        auth.setAttribute('aria-hidden','true');
      }
      if(app){
        app.classList.remove('auth-hidden');
        app.hidden=false;
        app.removeAttribute('aria-hidden');
      }
      return;
    }

    if(typeof showLoginScreen==='function'){
      showLoginScreen(auth,app);
      return;
    }
    if(auth){
      auth.classList.remove('hidden');
      auth.hidden=false;
      auth.removeAttribute('aria-hidden');
    }
    if(app){
      app.classList.add('auth-hidden');
      app.hidden=true;
      app.setAttribute('aria-hidden','true');
    }
  }

  async function clearLegacyCopies(){
    try{
      localStorage.removeItem('controleFinanceiroWebV2');
      localStorage.removeItem('controleFinanceiroWebV1');
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i);
        if(String(key||'').startsWith('controleFinanceiroWebV2UpdatedAt:user:'))localStorage.removeItem(key);
      }
    }catch(e){}
    try{
      if(currentUser?.user_metadata?.finance_state||currentUser?.user_metadata?.finance_updated_at){
        const {data,error}=await sb.auth.updateUser({data:{finance_state:null,finance_updated_at:null}});
        if(!error&&data?.user)currentUser=data.user;
      }
    }catch(e){console.warn('Não foi possível limpar metadados financeiros legados:',e)}
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
    storage:'relational',
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
      if(!relationalReady)throw new Error('relational_not_ready');
      const {data,error}=await sb.rpc('finance_put_state',{
        p_state:cloneState(financeState),
        p_expected_updated_at:lastRemoteUpdatedAt
      });
      if(error)throw error;
      if(!data?.ok)throw rpcFailure(data,'finance_save_failed');
      lastRemoteUpdatedAt=data.updatedAt||null;
      return lastRemoteUpdatedAt;
    },
    async deleteCard(cardId){
      if(!currentUser?.id)throw new Error('user_required');
      if(!cardId)throw new Error('card_required');
      while(remoteWriteInFlight){
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      remoteWriteInFlight=true;
      localWritePending=true;
      try{
        const {data,error}=await sb.rpc('finance_delete_card',{p_card_id:String(cardId)});
        if(error)throw error;
        if(!data?.ok)throw rpcFailure(data,'finance_delete_card_failed');
        lastRemoteUpdatedAt=data.updatedAt||lastRemoteUpdatedAt;
        setSyncStatus('Sincronizado com banco relacional');
        return data;
      }finally{
        remoteWriteInFlight=false;
        if(writeQueued){
          writeQueued=false;
          scheduleCloudSave();
        }else{
          localWritePending=false;
        }
      }
    },
    async refresh(){
      if(!currentUser?.id||!relationalReady||remoteWriteInFlight||localWritePending)return null;
      const cloud=await this.load(currentUser.id);
      if(validFinanceState(cloud?.state)){
        await applyServerState(cloud.state,{render:true});
        setSyncStatus('Sincronizado com banco relacional');
      }
      return cloud;
    },
    async activateSession(userId){
      if(!userId)throw new Error('user_required');
      relationalReady=false;
      localWritePending=false;
      writeQueued=false;

      const cloud=await this.load(userId);
      let serverState=validFinanceState(cloud?.state)?cloud.state:null;

      if(!serverState){
        serverState=blankFinanceState();
        relationalReady=true;
        await this.save(userId,serverState);
        relationalReady=false;
      }

      await applyServerState(serverState,{render:false});
      selectedCardId=state.cards[0]?.id||null;
      selectedInvoiceYm=state.settings.selectedMonth;
      relationalReady=true;
      await clearLegacyCopies();
      return serverState;
    },
    deactivateSession(){
      relationalReady=false;
      localWritePending=false;
      writeQueued=false;
      lastRemoteUpdatedAt=null;
    },
    get version(){return lastRemoteUpdatedAt},
    get hasPendingLocalWrite(){return localWritePending||remoteWriteInFlight},
    get ready(){return relationalReady}
  };

  save=function(){
    if(!relationalReady||applyingRemote)return;
    localWritePending=true;
    scheduleCloudSave();
  };

  pushStateToCloud=async function(){
    if(!currentUser||!relationalReady||applyingRemote)return;
    if(remoteWriteInFlight){writeQueued=true;localWritePending=true;return}
    remoteWriteInFlight=true;
    localWritePending=true;
    const userId=currentUser.id,snapshot=cloneState(state);
    try{
      await window.financeCloud.save(userId,snapshot);
      setSyncStatus('Sincronizado com banco relacional');
    }catch(e){
      console.error('Falha ao salvar dados financeiros relacionais:',e);
      if(e?.code==='conflict')setSyncStatus('Dados alterados em outra sessão — atualize a página',true);
      else if(e?.code==='destructive_state_replacement_blocked')setSyncStatus('Proteção de dados acionada — atualização bloqueada',true);
      else setSyncStatus('Falha ao salvar no servidor',true);
    }finally{
      remoteWriteInFlight=false;
      if(writeQueued){
        writeQueued=false;
        scheduleCloudSave();
      }else{
        localWritePending=false;
      }
    }
  };

  async function refreshFromServer(){
    if(!currentUser?.id||!relationalReady||remoteWriteInFlight||localWritePending||Date.now()-lastRefreshAt<2000)return;
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

  window.__financeCloudModuleReady=true;
  try{window.dispatchEvent(new CustomEvent('finance:cloud-ready'))}catch(_e){}
  window.addEventListener('focus',refreshFromServer);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFromServer()});
})();
