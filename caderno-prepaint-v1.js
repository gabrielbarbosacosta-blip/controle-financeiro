(function(){
  if(window.__cadernoPrepaintV1Loaded)return;
  window.__cadernoPrepaintV1Loaded=true;

  const links=[
    ['caderno-figma-theme','figma-caderno-theme-v1.css?v=20260916-4'],
    ['caderno-figma-dark-v2','figma-caderno-dark-v2.css?v=20260916-dark4'],
    ['caderno-stability-v3','figma-caderno-stability-v3.css?v=20260916-stability16']
  ];
  for(const [id,href] of links){
    if(document.getElementById(id))continue;
    const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  }
  document.documentElement.classList.add('caderno-theme','caderno-dark','caderno-stable');
  document.documentElement.style.background='#07101d';
  if(document.body){document.body.style.background='#07101d';document.body.style.color='#e7edf5'}

  const labels={dashboard:'Visão geral',history:'Lançamentos',cards:'Cartões',incomes:'Receitas',debts:'Despesas',projection:'Projeções',goals:'Objetivos',settings:'Configurações'};
  const brand=document.querySelector('.sidebar>.brand');
  const brandTitle=brand?.querySelector('h1');if(brandTitle)brandTitle.textContent='caderno';
  const brandLogo=brand?.querySelector('.logo');if(brandLogo)brandLogo.textContent='';
  document.querySelectorAll('.nav button[data-page]').forEach(btn=>{
    const label=labels[btn.dataset.page];if(label&&!btn.querySelector('.caderno-nav-label'))btn.textContent=label;
  });
})();
