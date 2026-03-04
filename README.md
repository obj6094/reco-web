# Reco (Next.js + Supabase) — MVP

Reco is a small MVP built with **Next.js App Router** and **Supabase**.

## Local development

1) Install deps

```bash
npm install
```

2) Create `.env.local`

Copy `.env.example` to `.env.local` and fill in values (do not commit secrets):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

3) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup (high level)

- Supabase is used for auth + data.
- Tables are already created in Supabase:
  - `weekly_challenges`
  - `challenge_submissions`
  - `challenge_votes`
  - `qna_requests`
  - `qna_claims`
  - `qna_answers`
  - `qna_ratings`

### RLS notes

- `weekly_challenges` should be **publicly readable** (home page shows the latest + past challenges without login).
- Other tables are expected to be protected by RLS and accessed only by authenticated users.

## Routes

- Public:
  - `/` (home/landing + dashboard when logged in)
  - `/login`
- Protected (redirects to `/login` if logged out):
  - `/challenge`
  - `/requests`
  - `/requests/[id]`
  - `/profile`

## Deploy to Vercel

1) Push the repo to GitHub (make sure `.env.local` is NOT committed).
2) Import into Vercel.
3) In **Project Settings → Environment Variables**, add the variables from `.env.example`.
4) Deploy.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
