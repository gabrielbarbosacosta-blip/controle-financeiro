(function(){
  if(document.getElementById('bank-branding-rounded-style'))return;
  const style=document.createElement('style');
  style.id='bank-branding-rounded-style';
  style.textContent=`
    .bank-logo-shell{
      border-radius:10px!important;
      overflow:hidden!important;
    }
    .bank-logo-shell img,
    .bank-logo-shell .bank-logo-fallback{
      border-radius:inherit!important;
    }
    .bank-card-account .bank-logo-shell{
      border-radius:9px!important;
    }
    .invoice-bank-brand .bank-logo-shell{
      border-radius:10px!important;
    }
    .invoice-title-bank-logo{
      border-radius:10px!important;
      overflow:hidden!important;
    }
  `;
  document.head.appendChild(style);
})();
