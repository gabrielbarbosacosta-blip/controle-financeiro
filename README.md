# Controle Financeiro

Aplicação web estática para controle financeiro pessoal, com:

- login e sincronização via Supabase Auth;
- dados financeiros persistidos na nuvem via Supabase;
- lançamentos de caixa;
- cartões de crédito, faturas, parcelas e compras recorrentes;
- análise de faturas com IA para incluir apenas compras novas na fatura selecionada;
- projeção financeira de 12 meses;
- backup JSON e exportação CSV.

## IA para faturas

A função `api/analyze-invoice.js` usa a OpenAI Responses API. Configure `OPENAI_API_KEY` nas variáveis de ambiente da Vercel. Opcionalmente, defina `OPENAI_INVOICE_MODEL`; o padrão é `gpt-5.6-luna`.

A importação não edita nem exclui compras existentes. Cada lançamento vindo da fatura é registrado como item único do mês selecionado, sem gerar parcelas futuras automaticamente.

Hospedagem planejada em Vercel, com atualização automática a partir da branch `main` deste repositório.

<!-- deploy-trigger: 2026-09-13 -->
