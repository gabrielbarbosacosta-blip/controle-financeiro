/* PRUMO — perfil canônico atual. Consolidado de skin v1 + v2. */
(function(){
  if(window.__profilePanelCurrentBaseLoaded)return;
  window.__profilePanelCurrentBaseLoaded=true;

  const STYLE_ID='profile-panel-skin-v1-style';

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #profilePanelSkin.profile-dropdown.profile-skin-v1,
      #page-profile.profile-skin-v1{
        --profile-shell:#07101d;
        --profile-card:#0d1b2d;
        --profile-card-2:#10223a;
        --profile-line:#15304d;
        --profile-soft:#9db1c9;
        --profile-text:#eef6ff;
        --profile-input:#091726;
        --profile-accent:#1fb6ff;
        --profile-accent-2:#29c3ff;
        --profile-success:#1dd1a1;
      }

      #profilePanelSkin.profile-dropdown.profile-skin-v1{
        width:min(360px,calc(100vw - 32px));
        padding:16px;
        background:var(--profile-shell)!important;
        border:1px solid rgba(58,92,128,.42)!important;
        border-radius:18px!important;
        box-shadow:0 28px 80px rgba(0,0,0,.54)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-dropdown-title{
        display:block!important;
        margin:0 0 12px!important;
        color:#8ea5c1!important;
        font:700 13px/1.2 Manrope,Arial,sans-serif!important;
        letter-spacing:-.01em!important;
        text-transform:lowercase;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-layout,
      #page-profile.profile-skin-v1 .profile-layout{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:14px!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-layout>.card,
      #page-profile.profile-skin-v1 .profile-layout>.card{
        background:linear-gradient(180deg,var(--profile-card),var(--profile-card-2))!important;
        border:1px solid var(--profile-line)!important;
        border-radius:18px!important;
        padding:16px!important;
        box-shadow:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-card,
      #page-profile.profile-skin-v1 .profile-photo-card{
        text-align:center!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-card h3,
      #page-profile.profile-skin-v1 .profile-photo-card h3{
        display:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-avatar,
      #page-profile.profile-skin-v1 .profile-avatar{
        width:92px!important;
        height:92px!important;
        border-radius:50%!important;
        margin:0 auto 14px!important;
        border:0!important;
        background:linear-gradient(135deg,#17375a,#0f1d31)!important;
        box-shadow:0 12px 30px rgba(0,0,0,.28)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions,
      #page-profile.profile-skin-v1 .profile-photo-actions{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:14px!important;
        flex-wrap:wrap!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions .btn,
      #page-profile.profile-skin-v1 .profile-photo-actions .btn{
        min-width:102px!important;
        padding:8px 12px!important;
        border-radius:999px!important;
        font-size:11px!important;
        font-weight:700!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions label.btn,
      #page-profile.profile-skin-v1 .profile-photo-actions label.btn{
        background:rgba(31,182,255,.12)!important;
        border:1px solid rgba(31,182,255,.78)!important;
        color:var(--profile-accent)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions .btn.ghost,
      #page-profile.profile-skin-v1 .profile-photo-actions .btn.ghost{
        background:transparent!important;
        border:0!important;
        color:#96a8bd!important;
        min-width:auto!important;
        padding-inline:6px!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-identity-note,
      #page-profile.profile-skin-v1 .profile-identity-note{
        display:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .section-head,
      #page-profile.profile-skin-v1 .section-head{
        margin-bottom:12px!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .section-head h3,
      #page-profile.profile-skin-v1 .section-head h3{
        color:var(--profile-text)!important;
        font-size:14px!important;
        font-weight:700!important;
        letter-spacing:-.02em!important;
        margin:0!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .section-head .muted,
      #page-profile.profile-skin-v1 .section-head .muted{
        display:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .form-grid,
      #page-profile.profile-skin-v1 .form-grid{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:12px!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field,
      #page-profile.profile-skin-v1 .field{
        gap:6px!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field label,
      #page-profile.profile-skin-v1 .field label{
        color:#a5b7ca!important;
        font-size:11px!important;
        font-weight:700!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field input,
      #page-profile.profile-skin-v1 .field input{
        background:var(--profile-input)!important;
        color:var(--profile-text)!important;
        border:1px solid #102942!important;
        border-radius:12px!important;
        min-height:42px!important;
        padding:10px 13px!important;
        box-shadow:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field input:focus,
      #page-profile.profile-skin-v1 .field input:focus{
        border-color:rgba(31,182,255,.88)!important;
        box-shadow:0 0 0 3px rgba(31,182,255,.13)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileCpfHint,
      #page-profile.profile-skin-v1 #profileCpfHint{
        color:var(--profile-success)!important;
        font-size:10px!important;
        line-height:1.45!important;
        margin-top:2px!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileCpfHint.profile-cpf-bad,
      #page-profile.profile-skin-v1 #profileCpfHint.profile-cpf-bad{
        color:#fda4af!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileSaveBtn,
      #page-profile.profile-skin-v1 #profileSaveBtn{
        width:100%!important;
        min-height:46px!important;
        border-radius:14px!important;
        border:1px solid rgba(41,195,255,.9)!important;
        background:linear-gradient(180deg,var(--profile-accent-2),#11a8eb)!important;
        color:#04213a!important;
        font-size:13px!important;
        font-weight:800!important;
        box-shadow:0 12px 28px rgba(17,168,235,.22)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileSaveBtn:hover,
      #page-profile.profile-skin-v1 #profileSaveBtn:hover{
        filter:brightness(1.03)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-status,
      #page-profile.profile-skin-v1 .profile-status{
        margin-top:10px!important;
        min-height:16px!important;
        color:#8fb5d8!important;
        font-size:11px!important;
      }
      @media(max-width:900px){
        #profilePanelSkin.profile-dropdown.profile-skin-v1{
          width:auto!important;
          left:14px!important;
          right:14px!important;
          top:88px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applySkin(){
    document.querySelectorAll('.profile-dropdown').forEach(el=>{
      el.id='profilePanelSkin';
      el.classList.add('profile-skin-v1');
    });
    const page=document.getElementById('page-profile');
    if(page)page.classList.add('profile-skin-v1');
  }

  function boot(){
    injectStyles();
    applySkin();
    const observer=new MutationObserver(()=>applySkin());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

(function(){
  if(window.__profilePanelCurrentPaletteLoaded)return;
  window.__profilePanelCurrentPaletteLoaded=true;
  const STYLE_ID='profile-panel-skin-v2-style';

  function inject(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #profilePanelSkin.profile-dropdown.profile-skin-v1,
      #page-profile.profile-skin-v1{
        --profile-shell:#0d1929;
        --profile-card:#101d2e;
        --profile-line:#23334a;
        --profile-text:#e7edf5;
        --profile-muted:#8fa0b5;
        --profile-input:#0a1524;
        --profile-blue:#65aaff;
        --profile-lime:#ddeaac;
        --profile-success:#91d6b9;
      }

      #profilePanelSkin.profile-dropdown.profile-skin-v1{
        background:var(--profile-shell)!important;
        border:1px solid #2a3c55!important;
        box-shadow:0 28px 80px rgba(0,0,0,.48)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-dropdown-title{
        color:#8fa0b5!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-layout>.card,
      #page-profile.profile-skin-v1 .profile-layout>.card{
        background:var(--profile-card)!important;
        border-color:var(--profile-line)!important;
        box-shadow:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-avatar,
      #page-profile.profile-skin-v1 .profile-avatar{
        border-color:var(--profile-blue)!important;
        background:#101d2e!important;
        box-shadow:0 10px 26px rgba(0,0,0,.26)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions label.btn,
      #page-profile.profile-skin-v1 .profile-photo-actions label.btn{
        background:#101d2e!important;
        border-color:#3a506d!important;
        color:#dce6f2!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions label.btn:hover,
      #page-profile.profile-skin-v1 .profile-photo-actions label.btn:hover{
        background:#15243a!important;
        border-color:var(--profile-blue)!important;
        color:#fff!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-photo-actions .btn.ghost,
      #page-profile.profile-skin-v1 .profile-photo-actions .btn.ghost{
        color:#8fa0b5!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field label,
      #page-profile.profile-skin-v1 .field label{
        color:#9aa9bb!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field input,
      #page-profile.profile-skin-v1 .field input{
        background:var(--profile-input)!important;
        color:var(--profile-text)!important;
        border-color:#2a3c55!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .field input:focus,
      #page-profile.profile-skin-v1 .field input:focus{
        border-color:var(--profile-blue)!important;
        box-shadow:0 0 0 3px rgba(101,170,255,.10)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileCpfHint,
      #page-profile.profile-skin-v1 #profileCpfHint{
        color:var(--profile-success)!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileSaveBtn,
      #page-profile.profile-skin-v1 #profileSaveBtn{
        background:var(--profile-lime)!important;
        border-color:var(--profile-lime)!important;
        color:#0b1a27!important;
        box-shadow:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 #profileSaveBtn:hover,
      #page-profile.profile-skin-v1 #profileSaveBtn:hover{
        background:#e7f2bb!important;
        border-color:#e7f2bb!important;
        filter:none!important;
      }
      #profilePanelSkin.profile-dropdown.profile-skin-v1 .profile-status,
      #page-profile.profile-skin-v1 .profile-status{
        color:#8fa0b5!important;
      }
    `;
    document.head.appendChild(style);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
