# Banco de dados relacional

O Controle Financeiro usa Supabase/PostgreSQL como fonte de verdade. O frontend mantém um objeto `state` apenas em memória para compatibilidade com a interface; ele é montado a partir das tabelas relacionais e nunca é persistido como um único JSON financeiro.

## Tabelas

### Núcleo
- `finance_sync_meta`: versão global do conjunto financeiro para controle de concorrência.
- `finance_settings`: saldo-base, data-base, mês selecionado, horizonte e fontes da projeção.
- `finance_transactions`: lançamentos de caixa.
- `finance_cards`: cartões.
- `finance_purchases`: compras de cartão.
- `finance_invoices`: faturas.
- `finance_income_plans`: regras de receitas.
- `finance_debts`: regras de despesas/dívidas.

### Históricos e metadados
- `finance_income_amount_versions`: histórico de valores de receitas.
- `finance_income_month_overrides`: exceções mensais de receitas.
- `finance_debt_amount_versions`: histórico de valores de despesas.
- `finance_debt_month_overrides`: exceções mensais de despesas.
- `finance_purchase_imports`: metadados das compras importadas pelo ChatGPT.

### Configuração e autenticação
- `user_profiles`: perfil/controle administrativo.
- `chatgpt_action_tokens`: hashes das chaves da integração com ChatGPT.

## Relações principais

```text
finance_cards
  ├── finance_purchases
  │      └── finance_purchase_imports
  └── finance_invoices

finance_income_plans
  ├── finance_income_amount_versions
  ├── finance_income_month_overrides
  └── finance_transactions (income_plan_id)

finance_debts
  ├── finance_debt_amount_versions
  ├── finance_debt_month_overrides
  └── finance_transactions (debt_id)
```

Todas as entidades financeiras usam `user_id` e chaves estrangeiras compostas para impedir relações entre usuários diferentes. As tabelas possuem RLS e as políticas restringem o acesso ao `auth.uid()` autenticado.

## Sincronização do navegador

`cloud-sync.js` usa somente as RPCs:

- `finance_get_state()`
- `finance_put_state(p_state, p_expected_updated_at)`

As RPCs fazem a conversão entre as linhas relacionais e o formato em memória esperado pela interface. A gravação é atômica e utiliza `finance_sync_meta.updated_at` para detectar concorrência entre sessões.

## Integração com ChatGPT

A Edge Function `chatgpt-finance` continua usando os contratos:

- `chatgpt_get_finance_state(p_token)`
- `chatgpt_put_finance_state(p_token, p_state, p_expected_updated_at)`

Essas RPCs agora leem e escrevem as tabelas relacionais; a Edge Function não acessa um snapshot JSON persistido.

## Legado

`finance_states_legacy` contém o último snapshot do modelo anterior e está sem acesso para `anon`/`authenticated`. Ele existe somente como rollback da migração e não é fonte ativa do aplicativo.

Snapshots financeiros antigos em `auth.users.raw_user_meta_data` foram removidos. O `localStorage` financeiro legado também é limpo após o primeiro carregamento relacional.