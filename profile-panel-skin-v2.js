(function(){
  if(window.__profilePanelSkinV2Loaded)return;
  window.__profilePanelSkinV2Loaded=true;
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
