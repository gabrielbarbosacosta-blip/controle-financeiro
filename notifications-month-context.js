(function(){
  if(window.__financeNotificationsMonthContextLoaded)return;
  window.__financeNotificationsMonthContextLoaded=true;

  // Month context is now applied natively inside notifications.js before the
  // panel is shown. Keep only compatibility hooks for older callers.
  window.financeNotificationsMonthContextRefresh=function(){
    try{return window.financeNotificationsRefresh?.()}catch(e){return undefined}
  };
})();