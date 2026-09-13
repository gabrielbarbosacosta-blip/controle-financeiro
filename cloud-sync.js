(function(){
  const LOCAL_UPDATED_KEY='controleFinanceiroWebV2UpdatedAt';

  function validFinanceState(value){
    return !!(value&&value.settings&&Array.isArray(value.transactions)&&Array.isArray(value.cards));
  }

  function parseTime(value){
    const n=value?Date.parse(value):0;
    return Number.isFinite(n)?n:0;
  }

  window.financeCloud={
    async load(userId){
      const {data,error}=await sb.from('finance_states').select('state,updated_at').eq('user_id',userId).maybeSingle();
      if(error)throw error;
      return data||null;
    },
    async save(userId,financeState){
      const updatedAt=new Date().toISOString();
      const {error}=await sb.from('finance_states').upsert({user_id:userId,state:financeState,updated_at:updatedAt},{onConflict:'user_id'});
      if(error)throw error;
      localStorage.setItem(LOCAL_UPDATED_KEY,updatedAt);
      return updatedAt;
    }
  };

  const originalSave=save;
  save=function(){
    localStorage.setItem(LOCAL_UPDATED_KEY,new Date().toISOString());
    return originalSave();
  };

  pushStateToCloud=async function(){
    if(!currentUser||remoteWriteInFlight)return;
    remoteWriteInFlight=true;
    try{
      await window.financeCloud.save(currentUser.id,state);
      setSyncStatus('Sincronizado');
    }catch(e){
      console.error('Falha ao salvar estado financeiro no Supabase:',e);
      setSyncStatus('Falha ao sincronizar',true);
    }finally{
      remoteWriteInFlight=false;
    }
  };

  handleSession=async function(session){
    currentUser=session?.user||null;
    if(!currentUser){
      document.getElementById('authScreen').classList.remove('hidden');
      document.getElementById('appRoot').classList.add('auth-hidden');
      return;
    }

    setSyncStatus('Sincronizando…');
    try{
      const cloud=await window.financeCloud.load(currentUser.id);
      const cloudState=validFinanceState(cloud?.state)?cloud.state:null;
      const cloudTime=parseTime(cloud?.updated_at);
      const localTime=parseTime(localStorage.getItem(LOCAL_UPDATED_KEY));
      const hasLocal=!!localStorage.getItem(STORAGE_KEY)&&validFinanceState(state);

      if(cloudState&&cloudTime>=localTime){
        state=cloudState;
        localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
        localStorage.setItem(LOCAL_UPDATED_KEY,cloud?.updated_at||new Date().toISOString());
      }else if(hasLocal){
        await window.financeCloud.save(currentUser.id,state);
      }else{
        const legacy=currentUser.user_metadata?.finance_state;
        if(validFinanceState(legacy))state=legacy;
        await window.financeCloud.save(currentUser.id,state);
        localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      }

      selectedCardId=state.cards[0]?.id||null;
      selectedInvoiceYm=state.settings.selectedMonth;
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('appRoot').classList.remove('auth-hidden');
      renderAll();
      setSyncStatus('Sincronizado');
    }catch(e){
      console.error('Falha ao carregar/sincronizar estado financeiro:',e);
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('appRoot').classList.remove('auth-hidden');
      renderAll();
      setSyncStatus('Falha ao sincronizar',true);
    }
  };

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

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
