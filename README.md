# Controle Financeiro

Aplicação web estática para controle financeiro pessoal, com:

- login e sincronização via Supabase Auth;
- dados financeiros persistidos na nuvem via Supabase;
- lançamentos de caixa;
- cartões de crédito, faturas, parcelas e compras recorrentes;
- importação de compras de fatura analisadas dentro do ChatGPT;
- projeção financeira de 12 meses;
- backup JSON e exportação CSV.

## Integração com ChatGPT

A análise da fatura pode ser feita dentro do próprio ChatGPT. O Controle Financeiro expõe uma ação protegida no Supabase para receber os lançamentos estruturados e incluir somente compras novas na fatura indicada.

A integração não precisa de `OPENAI_API_KEY` no site. Em **Configurações → Integração com ChatGPT**, gere uma chave própria da integração e use-a na Ação do seu GPT.

Schema da Ação:

`https://eqolnqnsyomgybyrtrzt.supabase.co/functions/v1/chatgpt-finance/schema`

A importação:

- não edita nem exclui compras já cadastradas;
- evita duplicidades por cartão, mês, data, descrição e valor;
- sinaliza possíveis duplicidades antes de forçar uma inclusão;
- registra cada linha da fatura apenas no mês selecionado;
- não cria automaticamente parcelas futuras a partir de uma parcela encontrada no PDF.

Hospedagem do site em Vercel, com atualização automática a partir da branch `main` deste repositório.
