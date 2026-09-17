(function(){
  if(window.__removeDuplicateSidebarProfileLoaded)return;
  window.__removeDuplicateSidebarProfileLoaded=true;
  const style=document.createElement('style');
  style.id='remove-duplicate-sidebar-profile-style';
  style.textContent='.caderno-profile{display:none!important}';
  document.head.appendChild(style);
})();
