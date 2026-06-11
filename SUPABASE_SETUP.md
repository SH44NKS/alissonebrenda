# Como ativar o banco compartilhado

Este site ainda funciona sem banco, usando o armazenamento local do navegador. Para os dados ficarem iguais para voce, sua noiva e qualquer pessoa que abrir o link, configure o Supabase.

## 1. Criar o projeto

1. Acesse https://supabase.com.
2. Crie um projeto novo.
3. Em `Project Settings > API`, copie:
   - `Project URL`
   - `anon public key`

## 2. Criar a tabela

No Supabase, abra `SQL Editor` e rode:

```sql
create table if not exists public.wedding_data (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

alter table public.wedding_data enable row level security;

create policy "public read wedding data"
on public.wedding_data
for select
to anon
using (true);

create policy "public insert wedding data"
on public.wedding_data
for insert
to anon
with check (true);

create policy "public update wedding data"
on public.wedding_data
for update
to anon
using (true)
with check (true);
```

## 3. Colar as chaves no site

No `index.html`, procure:

```js
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
```

Cole os valores do seu projeto:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA-ANON-KEY';
```

Depois publique o site de novo no GitHub Pages.

## Observacao importante

Com essa configuracao simples, qualquer pessoa que tiver o link do app consegue alterar os dados. Para uso so entre voce e sua noiva, o ideal depois e adicionar login ou uma senha de acesso antes de liberar o link para muita gente.
