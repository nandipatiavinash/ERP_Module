# Polymer Fabric ERP

Production-ready starter ERP for a polymer fabric manufacturing company.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI components
- Supabase Auth
- Supabase PostgreSQL

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor or with Supabase CLI.
3. Copy `.env.example` to `.env.local` and fill Supabase values.
4. Install dependencies and run the app:

```bash
npm install
npm run dev
```

## First Admin

Create the first Supabase Auth user from this project after `.env.local` is filled and the migration has been run:

```bash
npm run create-user -- --email admin@example.com --password StrongPass123 --name "Admin User" --role admin
```

After the first admin can log in, use the in-app Users page to create more Supabase Auth users and link them to ERP roles.

## Supabase CLI

The Supabase CLI is installed as a dev dependency.

```bash
npm run supabase -- --version
npm run supabase -- login
npm run supabase -- link --project-ref your-project-ref
npm run supabase -- db push
```
