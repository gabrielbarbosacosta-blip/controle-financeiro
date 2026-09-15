(function(){
  if(window.__purchaseGroupingFlatLoaded)return;
  window.__purchaseGroupingFlatLoaded=true;

  const id='purchase-grouping-flat-style';
  if(document.getElementById(id))return;

  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
    /* Agrupamentos por nome: linha discreta, mas com o mesmo peso/tamanho dos itens normais. */
    .invoice-purchase-group .purchase-name-group{
      margin:0 12px!important;
      border:0!important;
      border-radius:0!important;
      overflow:visible!important;
      background:transparent!important;
    }

    .invoice-purchase-group .purchase-name-toggle{
      width:100%;
      min-height:58px;
      margin:0!important;
      padding:10px 12px!important;
      border:0!important;
      border-bottom:1px solid rgba(148,163,184,.16)!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }

    .invoice-purchase-group .purchase-name-toggle:hover{
      background:rgba(148,163,184,.045)!important;
    }

    .invoice-purchase-group .purchase-name-title{
      font-size:16px!important;
      line-height:1.25!important;
      font-weight:650!important;
      color:#f8fafc!important;
    }

    .invoice-purchase-group .purchase-name-count{
      min-width:auto!important;
      height:auto!important;
      padding:0!important;
      border-radius:0!important;
      background:transparent!important;
      color:#94a3b8!important;
      font-size:12px!important;
      line-height:1.25!important;
      font-weight:600!important;
    }

    .purchase-name-count::before{content:'· ';}
    .purchase-name-count::after{content:' itens';}

    .invoice-purchase-group .purchase-name-total{
      color:#f8fafc!important;
      font-size:16px!important;
      line-height:1.25!important;
      font-weight:700!important;
    }

    .invoice-purchase-group .purchase-name-chevron{
      color:#718096!important;
      font-size:15px!important;
    }

    .invoice-purchase-group .purchase-name-group .detail-line{
      margin:0!important;
      padding-left:28px!important;
      padding-right:12px!important;
      background:transparent!important;
      border-radius:0!important;
    }

    .invoice-purchase-group .purchase-name-group .detail-line:last-child{
      margin-bottom:0!important;
    }

    /* Gerenciador de compras: mantém a escala da tabela, não a da lista principal. */
    #purchaseManagerBody .purchase-name-group-row td{
      padding:0!important;
      background:transparent!important;
      border-bottom:0!important;
    }

    #purchaseManagerBody .purchase-name-group-row .purchase-name-toggle{
      width:100%;
      min-height:44px;
      margin:0!important;
      padding:10px 18px 10px 26px!important;
      border:0!important;
      border-bottom:1px solid rgba(148,163,184,.16)!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }

    #purchaseManagerBody .purchase-name-group-row .purchase-name-toggle:hover{
      background:rgba(148,163,184,.045)!important;
    }

    #purchaseManagerBody .purchase-name-title,
    #purchaseManagerBody .purchase-name-total{
      font-size:13px!important;
      line-height:1.25!important;
      font-weight:650!important;
      color:#f8fafc!important;
    }

    #purchaseManagerBody .purchase-name-count{
      min-width:auto!important;
      height:auto!important;
      padding:0!important;
      border-radius:0!important;
      background:transparent!important;
      color:#94a3b8!important;
      font-size:11px!important;
      font-weight:600!important;
    }

    #purchaseManagerBody tr.purchase-name-item td:first-child{
      padding-left:42px!important;
    }

    @media(max-width:700px){
      .invoice-purchase-group .purchase-name-group{margin:0 8px!important;}
      .invoice-purchase-group .purchase-name-toggle{min-height:54px;padding:10px 8px!important;}
      .invoice-purchase-group .purchase-name-title,.invoice-purchase-group .purchase-name-total{font-size:15px!important;}
      .invoice-purchase-group .purchase-name-group .detail-line{padding-left:22px!important;padding-right:8px!important;}
      #purchaseManagerBody .purchase-name-group-row .purchase-name-toggle{padding-left:18px!important;padding-right:12px!important;}
      #purchaseManagerBody tr.purchase-name-item td:first-child{padding-left:30px!important;}
    }
  `;
  document.head.appendChild(style);
})();
