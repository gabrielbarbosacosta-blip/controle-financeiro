# Versao local do Controle Financeiro

## 1. Instale as ferramentas

No Windows, instale:
- Git: https://git-scm.com/download/win
- Node.js LTS: https://nodejs.org/
- VS Code: https://code.visualstudio.com/

## 2. Baixe o projeto

Abra o PowerShell e execute:

```powershell
git clone https://github.com/gabrielbarbosacosta-blip/controle-financeiro.git
cd controle-financeiro
```

Se a pasta ja existir, entre nela e atualize:

```powershell
git pull
```

## 3. Inicie a versao local

Dê dois cliques em `INICIAR-LOCAL.bat` ou, no terminal da pasta, execute:

```powershell
npx --yes vercel@latest dev
```

Na primeira execucao, a Vercel pode pedir login e perguntar qual projeto deve ser vinculado. Selecione o projeto `controle-financeiro` da sua conta.

Depois abra o endereco mostrado no terminal, normalmente `http://localhost:3000`.

## 4. Edite a interface

Abra a pasta `controle-financeiro` no VS Code. Os principais arquivos visuais sao:

- `index.html`: estrutura da interface
- `app.css`: cores, espacamentos, tamanhos e estilos
- `app.js`: comportamento principal
- arquivos `.js` adicionais: recursos especificos

Salve o arquivo alterado e atualize o navegador para visualizar.

## 5. Importante sobre seus dados

A versao local continua conectada ao mesmo Supabase do site publicado. Portanto, se voce entrar com sua conta e alterar faturas, compras ou outros dados, essas alteracoes afetam os dados reais da sua conta.

Alteracoes feitas apenas em HTML/CSS/JS no computador ficam somente locais ate voce executar `git add`, `git commit` e `git push`.

## 6. Parar o servidor

No terminal em que o servidor estiver rodando, pressione `Ctrl + C`.
