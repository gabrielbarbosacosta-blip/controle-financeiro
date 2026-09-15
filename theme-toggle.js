(function(){
  if(window.__financeThemeToggleLoaded)return;
  window.__financeThemeToggleLoaded=true;
  const KEY='finance-theme';
  const DARK='#0b1220',LIGHT='#f3f6fb';

  function injectStyles(){
    if(document.getElementById('finance-theme-styles'))return;
    const s=document.createElement('style');s.id='finance-theme-styles';s.textContent=`
      html[data-theme="light"]{color-scheme:light}
      html[data-theme="light"] body{background:linear-gradient(180deg,#f8fafc,#eef3f9 34%,#f3f6fb);color:#172033}
      html[data-theme="light"]{--bg:#f3f6fb;--panel:#ffffff;--panel2:#f4f7fb;--line:#d8e0ea;--text:#172033;--muted:#64748b;--chip:#edf2f7;--input:#ffffff;--shadow:0 14px 36px rgba(15,23,42,.09)}
      html[data-theme="light"] .sidebar{background:rgba(255,255,255,.96);border-color:var(--line)}
      html[data-theme="light"] .nav button{color:#475569}
      html[data-theme="light"] .nav button.active,html[data-theme="light"] .nav button:hover{background:#eaf0f7;color:#172033}
      html[data-theme="light"] .card{background:linear-gradient(180deg,#ffffff,#f8fafc);border-color:var(--line)}
      html[data-theme="light"] .mini{background:#f8fafc}
      html[data-theme="light"] .split-kpis .mini{background:#f4f7fb}
      html[data-theme="light"] .btn{color:#172033;background:#ffffff;border-color:#cbd5e1}
      html[data-theme="light"] .btn.primary{color:#fff;background:var(--accent);border-color:var(--accent)}
      html[data-theme="light"] .btn.danger{color:#991b1b;background:#fff1f2;border-color:#fecaca}
      html[data-theme="light"] .field label{color:#475569}
      html[data-theme="light"] .field input,html[data-theme="light"] .field select,html[data-theme="light"] .field textarea,
      html[data-theme="light"] .invoice-tools select,html[data-theme="light"] .toolbar select{background:#fff;color:#172033;border-color:#cbd5e1}
      html[data-theme="light"] .data-table th{color:#475569}
      html[data-theme="light"] .notice{background:#eff6ff;border-color:#bfdbfe;color:#1e3a5f}
      html[data-theme="light"] .warning{background:#fffbeb;border-color:#fde68a;color:#92400e}
      html[data-theme="light"] .bar,html[data-theme="light"] .progress{background:#e2e8f0}
      html[data-theme="light"] .modal{background:#fff;border-color:#d8e0ea;box-shadow:0 28px 90px rgba(15,23,42,.18)}
      html[data-theme="light"] .modal-head,html[data-theme="light"] .modal-foot{background:#fff}
      html[data-theme="light"] .modal-backdrop{background:rgba(15,23,42,.38)}
      html[data-theme="light"] .auth-screen{background:linear-gradient(180deg,#f8fafc,#eef3f9)}
      html[data-theme="light"] .auth-box{background:#fff}
      html[data-theme="light"] .auth-msg{color:#475569}
      html[data-theme="light"] .toggle{color:#475569}
      html[data-theme="light"] .sync-pill{color:#1d4ed8;background:#eff6ff;border-color:#bfdbfe}
      html[data-theme="light"] .badge{background:#edf2f7;color:#475569;border-color:#d8e0ea}
      html[data-theme="light"] .credit-card{box-shadow:0 12px 28px rgba(15,23,42,.12)}
      html[data-theme="light"] .danger-zone{background:#fff7f7;border-color:#fecaca}
      html[data-theme="light"] .shared-item{background:#fff!important}
      html[data-theme="light"] .shared-dashboard .shared-item{background:#f8fafc!important}
      html[data-theme="light"] .shared-expense-box,html[data-theme="light"] #sharedDebtBox{background:#f8fafc!important}
      html[data-theme="light"] .shared-expense-box summary,html[data-theme="light"] #sharedDebtBox summary{color:#1e3a5f!important}
      html[data-theme="light"] .shared-person-row,html[data-theme="light"] .shared-debt-row{background:#fff!important}
      html[data-theme="light"] .shared-hint,html[data-theme="light"] .shared-debt-hint{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1e3a5f!important}
      .theme-selector{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:10px;padding:4px 7px;background:var(--panel)}
      .theme-selector span{font-size:12px;color:var(--muted)}
      .theme-selector select{border:0;outline:none;background:transparent;color:var(--text);font:inherit;font-size:12px;padding:5px 3px;cursor:pointer}
      html[data-theme="light"] .theme-selector{background:#fff}
      html[data-theme="light"] .theme-selector select{color:#172033}
    `;document.head.appendChild(s);
  }

  function apply(theme){
    const value=theme==='light'?'light':'dark';
    document.documentElement.dataset.theme=value;
    try{localStorage.setItem(KEY,value)}catch(e){}
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',value==='light'?LIGHT:DARK);
    const select=document.getElementById('themeModeSelect');if(select)select.value=value;
  }

  function mount(){
    injectStyles();
    const actions=document.querySelector('.topbar .actions');if(!actions||document.getElementById('themeModeSelect'))return;
    const wrap=document.createElement('label');wrap.className='theme-selector';wrap.title='Tema da interface';
    wrap.innerHTML='<span>Tema</span><select id="themeModeSelect" aria-label="Selecionar tema"><option value="dark">Noturno</option><option value="light">Claro</option></select>';
    const logout=document.getElementById('logoutBtn');actions.insertBefore(wrap,logout||actions.firstChild);
    const select=wrap.querySelector('select');
    select.value=document.documentElement.dataset.theme||'dark';
    select.addEventListener('change',()=>apply(select.value));
  }

  let saved='dark';try{saved=localStorage.getItem(KEY)||'dark'}catch(e){}
  injectStyles();apply(saved);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();