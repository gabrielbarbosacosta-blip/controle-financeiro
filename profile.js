(function(){
  if(window.__financeProfileLoaded)return;
  window.__financeProfileLoaded=true;

  const STYLE_ID='finance-profile-style';
  const BUCKET='profile-photos';
  let profile=null;
  let signedAvatarUrl='';
  let initialized=false;
  let saving=false;
  let loadedProfileUserId=null;
  const avatarUrlCache=new Map();

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits=value=>String(value||'').replace(/\D/g,'').slice(0,11);

  function cpfValid(value){
    const cpf=digits(value);
    if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
    const calc=len=>{
      let sum=0;
      for(let i=0;i<len;i++)sum+=Number(cpf[i])*(len+1-i);
      const mod=(sum*10)%11;
      return mod===10?0:mod;
    };
    return calc(9)===Number(cpf[9])&&calc(10)===Number(cpf[10]);
  }

  function cpfMask(value){
    const v=digits(value);
    return v.replace(/^(\d{3})(\d)/,'$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3')
      .replace(/\.(\d{3})(\d)/,'.$1-$2');
  }

  function initials(){
    const text=(profile?.nickname||profile?.full_name||currentUser?.email||'U').trim();
    const parts=text.split(/\s+/).filter(Boolean);
    return (parts.length>1?parts[0][0]+parts[1][0]:parts[0]?.slice(0,2)||'U').toUpperCase();
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .profile-sidebar-card{margin-top:18px;padding:10px;border:1px solid var(--line);border-radius:14px;background:rgba(23,32,51,.58);display:flex;align-items:center;gap:10px;cursor:pointer}
      .profile-sidebar-card:hover{background:rgba(30,41,59,.82)}
      .profile-sidebar-avatar,.profile-avatar{overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#1e3a5f,#172033);border:1px solid rgba(255,255,255,.12);color:#dbeafe;font-weight:800}
      .profile-sidebar-avatar{width:38px;height:38px;border-radius:12px;flex:0 0 38px;font-size:12px}
      .profile-sidebar-avatar img,.profile-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .profile-sidebar-copy{min-width:0;flex:1}
      .profile-sidebar-name{font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .profile-sidebar-label{font-size:10px;color:var(--muted);margin-top:2px}
      .profile-layout{display:grid;grid-template-columns:minmax(240px,.7fr) minmax(0,1.3fr);gap:14px}
      .profile-photo-card{text-align:center}
      .profile-avatar{width:132px;height:132px;border-radius:38px;margin:4px auto 14px;font-size:34px;box-shadow:0 18px 40px rgba(0,0,0,.22)}
      .profile-photo-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
      .profile-file-input{display:none}
      .profile-identity-note{margin-top:14px;padding:12px;border-radius:12px;background:#0f172a;border:1px solid var(--line);font-size:12px;color:var(--muted);line-height:1.5}
      .profile-status{min-height:20px;margin-top:12px;font-size:12px;color:var(--muted)}
      .profile-cpf-ok{color:#86efac!important}.profile-cpf-bad{color:#fca5a5!important}
      @media(max-width:800px){.profile-layout{grid-template-columns:1fr}.profile-sidebar-card{margin-bottom:8px}.profile-avatar{width:116px;height:116px;border-radius:32px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePage(){
    if(document.getElementById('page-profile'))return;
    const settings=document.getElementById('page-settings');
    if(!settings)return;
    const section=document.createElement('section');
    section.className='page';
    section.id='page-profile';
    section.innerHTML=`
      <div class="profile-layout">
        <div class="card profile-photo-card">
          <h3>Foto de perfil</h3>
          <div class="profile-avatar" id="profileAvatarLarge"><span>U</span></div>
          <div class="profile-photo-actions">
            <label class="btn" for="profilePhotoInput">Escolher foto</label>
            <input class="profile-file-input" id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp">
            <button class="btn ghost" type="button" id="profilePhotoRemove">Remover</button>
          </div>
          <div class="profile-identity-note">A foto é privada no armazenamento. O sistema gera uma URL temporária apenas para exibição quando você está autenticado.</div>
        </div>
        <div class="card">
          <div class="section-head"><div><h3>Seu perfil</h3><div class="muted">Identidade usada no compartilhamento de despesas</div></div></div>
          <form id="profileForm">
            <div class="form-grid">
              <div class="field full"><label>Nome completo</label><input id="profileFullName" autocomplete="name" maxlength="120" placeholder="Seu nome completo" required></div>
              <div class="field"><label>Apelido</label><input id="profileNickname" maxlength="60" placeholder="Como você quer aparecer"></div>
              <div class="field"><label>CPF</label><input id="profileCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required><small id="profileCpfHint" class="muted">O CPF será usado para outras pessoas encontrarem você ao compartilhar uma despesa.</small></div>
            </div>
            <div style="margin-top:16px"><button class="btn primary" id="profileSaveBtn" type="submit">Salvar perfil</button></div>
            <div class="profile-status" id="profileStatus"></div>
          </form>
        </div>
      </div>`;
    settings.parentNode.insertBefore(section,settings);
  }

  function ensureNav(){
    const nav=document.querySelector('.nav');
    if(!nav||nav.querySelector('[data-page="profile"]'))return;
    const settings=nav.querySelector('[data-page="settings"]');
    const button=document.createElement('button');
    button.type='button';button.dataset.page='profile';button.textContent='Perfil';
    button.onclick=()=>openProfilePage();
    nav.insertBefore(button,settings||null);
  }

  function ensureSidebarCard(){
    const sidebar=document.querySelector('.sidebar');
    const nav=sidebar?.querySelector('.nav');
    if(!sidebar||!nav||document.getElementById('profileSidebarCard'))return;
    const card=document.createElement('div');
    card.id='profileSidebarCard';card.className='profile-sidebar-card';card.tabIndex=0;card.setAttribute('role','button');
    card.innerHTML='<div class="profile-sidebar-avatar" id="profileSidebarAvatar"><span>U</span></div><div class="profile-sidebar-copy"><div class="profile-sidebar-name" id="profileSidebarName">Meu perfil</div><div class="profile-sidebar-label">Perfil</div></div>';
    card.onclick=()=>openProfilePage();
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfilePage()}};
    nav.insertAdjacentElement('afterend',card);
  }

  function openProfilePage(){
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-profile'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='profile'));
    const title=document.getElementById('pageTitle'),subtitle=document.getElementById('pageSubtitle');
    if(title)title.textContent='Perfil';
    if(subtitle)subtitle.textContent='Identidade, foto e compartilhamento';
    renderProfile();
  }
  window.openFinanceProfile=openProfilePage;

  async function avatarSignedUrl(path,{force=false}={}){
    if(!path)return'';
    const cached=avatarUrlCache.get(path);
    if(!force&&cached?.url&&cached.expiresAt>Date.now())return cached.url;
    try{
      const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(path,3600);
      if(error)throw error;
      const url=data?.signedUrl||'';
      if(url)avatarUrlCache.set(path,{url,expiresAt:Date.now()+50*60*1000});
      return url;
    }catch(e){console.warn('Não foi possível carregar a foto de perfil.',e);return cached?.url||''}
  }

  function patchAvatar(el,url){
    if(!el)return;
    if(url){
      const img=el.querySelector(':scope > img');
      if(img){
        const current=img.getAttribute('src')||'';
        if(current!==url)img.setAttribute('src',url);
        return;
      }
      el.replaceChildren(Object.assign(document.createElement('img'),{src:url,alt:'Foto de perfil'}));
      return;
    }
    const value=initials();
    const span=el.querySelector(':scope > span');
    if(span){
      if(span.textContent!==value)span.textContent=value;
      return;
    }
    const next=document.createElement('span');
    next.textContent=value;
    el.replaceChildren(next);
  }

  function updateVisuals(){
    const label=profile?.nickname||profile?.full_name||currentUser?.email||'Meu perfil';
    const sideName=document.getElementById('profileSidebarName');if(sideName&&sideName.textContent!==label)sideName.textContent=label;
    patchAvatar(document.getElementById('profileSidebarAvatar'),signedAvatarUrl);
    patchAvatar(document.getElementById('profileAvatarLarge'),signedAvatarUrl);
  }

  function renderProfile(){
    const full=document.getElementById('profileFullName'),nick=document.getElementById('profileNickname'),cpf=document.getElementById('profileCpf');
    if(full)full.value=profile?.full_name||'';
    if(nick)nick.value=profile?.nickname||'';
    if(cpf)cpf.value=cpfMask(profile?.cpf||'');
    updateCpfHint();updateVisuals();
  }

  function updateCpfHint(){
    const input=document.getElementById('profileCpf'),hint=document.getElementById('profileCpfHint');
    if(!input||!hint)return;
    const value=digits(input.value);
    hint.classList.remove('profile-cpf-ok','profile-cpf-bad');
    if(!value){hint.textContent='O CPF será usado para outras pessoas encontrarem você ao compartilhar uma despesa.';return}
    if(value.length===11&&cpfValid(value)){hint.textContent='CPF válido • identificador de compartilhamento';hint.classList.add('profile-cpf-ok')}
    else if(value.length===11){hint.textContent='CPF inválido. Confira os números.';hint.classList.add('profile-cpf-bad')}
    else hint.textContent=`${value.length}/11 dígitos`;
  }

  async function loadProfile({forceAvatar=false}={}){
    if(!currentUser?.id)return null;
    const userId=currentUser.id;
    const previousPath=profile?.user_id===userId?profile?.avatar_path||null:null;
    const previousUrl=profile?.user_id===userId?signedAvatarUrl:'';
    try{
      const {data,error}=await sb.from('finance_profiles').select('user_id,full_name,nickname,cpf,avatar_path,share_code').eq('user_id',userId).maybeSingle();
      if(error)throw error;
      const nextProfile=data||{user_id:userId,full_name:'',nickname:'',cpf:null,avatar_path:null,share_code:null};
      const nextPath=nextProfile.avatar_path||null;
      profile=nextProfile;
      loadedProfileUserId=userId;

      if(nextPath&&previousPath===nextPath&&previousUrl&&!forceAvatar){
        signedAvatarUrl=previousUrl;
      }else{
        signedAvatarUrl=await avatarSignedUrl(nextPath,{force:forceAvatar});
      }

      renderProfile();
      return profile;
    }catch(e){console.error('Falha ao carregar perfil.',e);return null}
  }

  async function uploadAvatar(file){
    if(!currentUser?.id||!file)return null;
    if(file.size>5*1024*1024)throw new Error('photo_too_large');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('photo_type');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=`${currentUser.id}/avatar-${Date.now()}.${ext}`;
    const {error}=await sb.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error)throw error;
    return path;
  }

  async function saveProfile(event){
    event?.preventDefault();
    if(saving||!currentUser?.id)return;
    const full=document.getElementById('profileFullName')?.value.trim()||'';
    const nickname=document.getElementById('profileNickname')?.value.trim()||'';
    const cpf=digits(document.getElementById('profileCpf')?.value||'');
    const status=document.getElementById('profileStatus'),button=document.getElementById('profileSaveBtn');
    if(!full){if(status)status.textContent='Informe seu nome completo.';return}
    if(!cpfValid(cpf)){if(status)status.textContent='Informe um CPF válido.';updateCpfHint();return}
    saving=true;if(button)button.disabled=true;if(status)status.textContent='Salvando perfil…';
    try{
      const payload={user_id:currentUser.id,full_name:full,nickname,cpf,avatar_path:profile?.avatar_path||null,updated_at:new Date().toISOString()};
      const {data,error}=await sb.from('finance_profiles').upsert(payload,{onConflict:'user_id'}).select('user_id,full_name,nickname,cpf,avatar_path,share_code').single();
      if(error)throw error;
      profile=data;
      if(status)status.textContent='Perfil salvo.';
      updateVisuals();updateCpfHint();
    }catch(e){
      console.error('Falha ao salvar perfil.',e);
      if(status)status.textContent=e?.code==='23505'?'Este CPF já está associado a outro perfil.':'Não foi possível salvar o perfil.';
    }finally{saving=false;if(button)button.disabled=false}
  }

  async function onPhotoChange(event){
    const file=event.target.files?.[0];if(!file||!currentUser?.id)return;
    const status=document.getElementById('profileStatus');
    const oldPath=profile?.avatar_path||null;
    const preview=URL.createObjectURL(file);signedAvatarUrl=preview;updateVisuals();
    if(status)status.textContent='Enviando foto…';
    try{
      const newPath=await uploadAvatar(file);
      const base={user_id:currentUser.id,full_name:profile?.full_name||'',nickname:profile?.nickname||'',cpf:profile?.cpf||null,avatar_path:newPath,updated_at:new Date().toISOString()};
      const {data,error}=await sb.from('finance_profiles').upsert(base,{onConflict:'user_id'}).select('user_id,full_name,nickname,cpf,avatar_path,share_code').single();
      if(error)throw error;
      profile=data;signedAvatarUrl=await avatarSignedUrl(newPath);updateVisuals();
      if(oldPath&&oldPath!==newPath)sb.storage.from(BUCKET).remove([oldPath]).catch(()=>{});
      if(status)status.textContent='Foto atualizada.';
    }catch(e){
      console.error('Falha ao atualizar foto.',e);
      signedAvatarUrl=await avatarSignedUrl(oldPath);updateVisuals();
      if(status)status.textContent=e?.message==='photo_too_large'?'A foto deve ter no máximo 5 MB.':e?.message==='photo_type'?'Use JPG, PNG ou WebP.':'Não foi possível atualizar a foto.';
    }finally{URL.revokeObjectURL(preview);event.target.value=''}
  }

  async function removePhoto(){
    if(!profile?.avatar_path||!currentUser?.id)return;
    const status=document.getElementById('profileStatus'),oldPath=profile.avatar_path;
    if(status)status.textContent='Removendo foto…';
    try{
      const {data,error}=await sb.from('finance_profiles').update({avatar_path:null,updated_at:new Date().toISOString()}).eq('user_id',currentUser.id).select('user_id,full_name,nickname,cpf,avatar_path,share_code').single();
      if(error)throw error;
      profile=data;signedAvatarUrl='';updateVisuals();
      await sb.storage.from(BUCKET).remove([oldPath]);
      if(status)status.textContent='Foto removida.';
    }catch(e){console.error(e);if(status)status.textContent='Não foi possível remover a foto.'}
  }

  async function findByCpf(cpf){
    const value=digits(cpf);
    if(!cpfValid(value))return{ok:false,error:'invalid_cpf'};
    const {data,error}=await sb.rpc('finance_find_profile_by_cpf',{p_cpf:value});
    if(error)throw error;
    if(data?.avatarPath){data.avatarUrl=await avatarSignedUrl(data.avatarPath)}
    return data;
  }
  window.financeFindProfileByCpf=findByCpf;

  function bind(){
    const form=document.getElementById('profileForm');if(form)form.onsubmit=saveProfile;
    const cpf=document.getElementById('profileCpf');if(cpf){cpf.addEventListener('input',()=>{const start=cpf.selectionStart;cpf.value=cpfMask(cpf.value);updateCpfHint()})}
    const photo=document.getElementById('profilePhotoInput');if(photo)photo.onchange=onPhotoChange;
    const remove=document.getElementById('profilePhotoRemove');if(remove)remove.onclick=removePhoto;
  }

  async function init(){
    if(initialized)return;initialized=true;
    injectStyles();ensurePage();ensureNav();ensureSidebarCard();bind();
    try{
      const {data}=await sb.auth.getSession();
      if(data?.session?.user&&!currentUser)currentUser=data.session.user;
    }catch(e){}
    if(currentUser?.id)await loadProfile();
    sb.auth.onAuthStateChange((event,session)=>{
      if(session?.user){
        const sameUser=loadedProfileUserId===session.user.id&&profile?.user_id===session.user.id;
        if(sameUser&&['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event))return;
        setTimeout(()=>loadProfile(),0);
        return;
      }
      if(event==='SIGNED_OUT'){
        // Do not mutate the visible profile card during logout.
        // The app shell is about to be hidden; changing avatar/name here causes
        // a visible flash from the photo to the email/initials.
        loadedProfileUserId=null;
      }
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
