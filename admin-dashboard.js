(function(){
  let users=[];
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function mount(){
    if(document.getElementById('page-admin'))return;
    const main=document.querySelector('main.main'),nav=document.querySelector('.nav');
    if(!main||!nav)return;
    const page=document.createElement('section');
    page.className='page';page.id='page-admin';
    page.innerHTML='<div class="card"><div class="section-head"><div><h3>Gestão de usuários</h3><div class="muted" id="admStatus">Carregando permissões administrativas…</div></div><button class="btn" id="admRefresh">Atualizar</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Cadastro</th><th>Último acesso</th><th class="num">Lançamentos</th><th class="num">Cartões</th><th>Ações</th></tr></thead><tbody id="admBody"></tbody></table></div></div>';
    main.appendChild(page);
    const btn=document.createElement('button');btn.dataset.page='admin';btn.textContent='Gestão de usuários';
    btn.onclick=()=>{document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-admin'));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===btn));document.getElementById('pageTitle').textContent='Gestão de usuários';document.getElementById('pageSubtitle').textContent='Contas cadastradas no sistema';load();};
    nav.appendChild(btn);document.getElementById('admRefresh').onclick=load;
  }
  function render(){
    const body=document.getElementById('admBody');if(!body)return;
    body.innerHTML=users.map(u=>{const self=u.user_id===currentUser?.id;const action=self?'<span class="muted">Conta atual</span>':`<button class="btn danger adm-remove" data-id="${esc(u.user_id)}" data-email="${esc(u.email||'usuário')}">Excluir</button>`;return `<tr><td>${esc(u.email||'Sem e-mail')}</td><td>${u.role==='admin'?'Gestor':'Usuário'}</td><td>${u.active?'Ativo':'Bloqueado'}</td><td>${u.created_at?new Date(u.created_at).toLocaleString('pt-BR'):'—'}</td><td>${u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString('pt-BR'):'—'}</td><td class="num">${Number(u.transactions_count)||0}</td><td class="num">${Number(u.cards_count)||0}</td><td>${action}</td></tr>`;}).join('')||'<tr><td colspan="8" class="empty">Nenhum usuário encontrado.</td></tr>';
    body.querySelectorAll('.adm-remove').forEach(b=>b.onclick=()=>removeUser(b.dataset.id,b.dataset.email));
  }
  async function removeUser(id,email){
    if(!confirm(`Excluir permanentemente ${email}? A conta e os dados financeiros serão removidos.`))return;
    const status=document.getElementById('admStatus');if(status)status.textContent='Excluindo usuário…';
    const r=await sb.rpc('admin_delete_user',{target_user_id:id});
    if(r.error){if(status)status.textContent='Falha ao excluir usuário: '+(r.error.message||'erro desconhecido');return;}
    await load();
  }
  async function load(){
    const status=document.getElementById('admStatus');if(status)status.textContent='Carregando usuários…';
    const r=await sb.rpc('admin_list_users');
    if(r.error){console.error('Falha ao carregar usuários:',r.error);if(status)status.textContent='Acesso administrativo indisponível: '+(r.error.message||'erro desconhecido');users=[];render();return;}
    users=Array.isArray(r.data)?r.data:[];if(status)status.textContent=`${users.length} usuário(s) cadastrado(s).`;render();
  }
  function init(){mount();load();}
  let i=0;const timer=setInterval(()=>{i++;if(currentUser?.id){clearInterval(timer);init();}else if(i>120)clearInterval(timer);},250);
})();