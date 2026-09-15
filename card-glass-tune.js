(function(){
  if(document.getElementById('card-glass-tune-style'))return;
  const style=document.createElement('style');
  style.id='card-glass-tune-style';
  style.textContent=`
    .credit-card.bank-liquid-card::before{
      background:
        radial-gradient(circle at 105% 125%,
          rgba(var(--bank-accent-rgb),.28) 0%,
          rgba(var(--bank-accent-rgb),.10) 36%,
          rgba(var(--bank-accent-rgb),0) 68%)!important;
    }
  `;
  document.head.appendChild(style);
})();
