# Alisson & Brenda

App web para organizar casamento, casa nova, presentes, compras, chá de casa nova, convidados, orçamento e fornecedores.

## Rodar localmente

Use um servidor estático na pasta do projeto:

```bash
python -m http.server 4173
```

Depois abra `http://localhost:4173`.

## Supabase

1. Crie um projeto no Supabase.
2. Em **SQL Editor**, rode o arquivo `supabase-schema.sql`.
3. Em **Authentication > Users**, crie as contas do casal ou use o botão **Criar conta** do app.
4. Adicione os usuários na tabela `wedding_members`, usando o exemplo no fim do SQL.
5. Copie a URL e a anon key do projeto para `supabase-config.js`.
6. Se o realtime não ativar pelo SQL, habilite `wedding_state` em **Database > Replication**.

Sem Supabase configurado, o app funciona em modo local usando o navegador.

## Publicar

O app é estático. Para GitHub Pages, suba estes arquivos na branch publicada:

- `index.html`
- `styles.css`
- `app.js`
- `logo.png`
- `supabase-config.js`
- `supabase-schema.sql`
