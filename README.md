# Controle Financeiro

Aplicação web para controle financeiro pessoal, com:

- login via Supabase Auth;
- banco financeiro relacional em Supabase/PostgreSQL;
- lançamentos de caixa;
- cartões de crédito, faturas, parcelas e compras recorrentes;
- receitas e despesas gerenciadas com histórico de valores;
- importação de compras de fatura analisadas dentro do ChatGPT;
- projeção financeira configurável;
- backup JSON e exportação CSV.

## Banco de dados

A fonte de verdade é relacional. Lançamentos, cartões, compras, faturas, receitas, despesas e históricos ficam em tabelas próprias, relacionadas por chaves estrangeiras e protegidas por RLS.

O objeto `state` usado pela interface existe somente em memória. `cloud-sync.js` carrega e grava os dados através das RPCs `finance_get_state()` e `finance_put_state()`, que montam/decompõem esse formato sobre as tabelas relacionais de forma atômica.

A arquitetura completa está em `DATABASE.md`.

## Integração com ChatGPT

A análise da fatura pode ser feita dentro do próprio ChatGPT. O Controle Financeiro expõe uma ação protegida no Supabase para receber os lançamentos estruturados e incluir somente compras novas na fatura indicada.

A integração não precisa de `OPENAI_API_KEY` no site. Em **Configurações → Integração com ChatGPT**, gere uma chave própria da integração e use-a na Ação do seu GPT.

Schema da Ação:

`https://eqolnqnsyomgybyrtrzt.supabase.co/functions/v1/chatgpt-finance/schema`

A importação:

- evita duplicidades por cartão, mês, data, descrição, valor e metadados de parcela;
- sinaliza possíveis duplicidades antes de forçar uma inclusão;
- preserva a numeração de parcelamentos encontrados na fatura;
- projeta somente as parcelas restantes;
- concilia automaticamente o total final da fatura com o valor informado do PDF.

A Edge Function usa as mesmas RPCs de estado lógico, mas elas agora leem e gravam o modelo relacional; não existe mais dependência ativa do snapshot financeiro monolítico.

Hospedagem do site em Vercel, com atualização a partir da branch `main` deste repositório.