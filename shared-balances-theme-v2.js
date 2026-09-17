(function(){
  if(window.__sharedBalancesThemeV2Loaded)return;
  window.__sharedBalancesThemeV2Loaded=true;
  const id='shared-balances-theme-v2-style';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
    html.caderno-stable #page-sharing .card:has(#sharedBalances){
      background:#0d1929!important;
      border-color:#23334a!important;
      box-shadow:none!important;
    }
    html.caderno-stable #sharedBalances.shared-balances-detailed{gap:10px!important}
    html.caderno-stable .shared-month-context{
      margin-bottom:10px!important;
      padding:10px 12px!important;
      background:#101d2e!important;
      border:1px solid #23334a!important;
      border-radius:12px!important;
      color:#8fa0b5!important;
      box-shadow:none!important;
    }
    html.caderno-stable .shared-month-context strong{color:#e7edf5!important}
    html.caderno-stable .shared-person-card{
      background:#0d1929!important;
      border:1px solid #23334a!important;
      border-radius:14px!important;
      box-shadow:none!important;
      overflow:hidden!important;
    }
    html.caderno-stable .shared-person-card-head{
      padding:14px!important;
      background:#0d1929!important;
      border-bottom:1px solid #22344b!important;
    }
    html.caderno-stable .shared-person-avatar{
      width:46px!important;
      height:46px!important;
      flex-basis:46px!important;
      border-radius:50%!important;
      background:#101d2e!important;
      border:1px solid #30445e!important;
      color:#ddeaac!important;
      box-shadow:none!important;
    }
    html.caderno-stable .shared-person-card-name{
      color:#f1f5f9!important;
      font-size:13px!important;
      font-weight:800!important;
    }
    html.caderno-stable .shared-person-card-sub,
    html.caderno-stable .shared-entry-meta,
    html.caderno-stable .shared-person-total-label{
      color:#8fa0b5!important;
    }
    html.caderno-stable .shared-entry-line{
      padding:11px 14px!important;
      background:transparent!important;
      border-bottom:1px solid #1f3047!important;
    }
    html.caderno-stable .shared-entry-line:hover{background:#101f32!important}
    html.caderno-stable .shared-entry-title{color:#dce6f2!important}
    html.caderno-stable .shared-entry-kind{
      background:#111f31!important;
      border-color:#30445e!important;
      color:#cbd6e3!important;
    }
    html.caderno-stable .shared-entry-kind.receive{
      background:#102a20!important;
      border-color:#28513e!important;
      color:#a5e2c8!important;
    }
    html.caderno-stable .shared-entry-kind.pay{
      background:#2a2213!important;
      border-color:#5a4824!important;
      color:#ead38f!important;
    }
    html.caderno-stable .shared-entry-status{
      background:#2a2213!important;
      border-color:#5a4824!important;
      color:#ead38f!important;
    }
    html.caderno-stable .shared-entry-status.paid{
      background:#102a20!important;
      border-color:#28513e!important;
      color:#a5e2c8!important;
    }
    html.caderno-stable .shared-entry-status.waiting{
      background:#10243a!important;
      border-color:#275073!important;
      color:#abd5f3!important;
    }
    html.caderno-stable .shared-entry-value{color:#eef3f8!important}
    html.caderno-stable .shared-person-card-foot{
      padding:12px 14px!important;
      background:#0a1524!important;
      border-top:1px solid #22344b!important;
    }
    html.caderno-stable .shared-person-total{color:#eef3f8!important}
    html.caderno-stable .shared-person-total.positive{color:#91d6b9!important}
    html.caderno-stable .shared-person-total.negative{color:#ef8a81!important}
    html.caderno-stable .shared-person-total.settled{color:#aab7c8!important}
    html.caderno-stable #sharedBalances .empty{
      color:#8fa0b5!important;
      background:#101d2e!important;
      border:1px dashed #30445e!important;
      border-radius:12px!important;
    }
  `;
  document.head.appendChild(style);
})();
