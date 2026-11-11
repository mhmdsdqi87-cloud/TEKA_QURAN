# Contributing to حافظ (Hafez)

Thank you for wanting to improve the AI Quran memorization studio — this guide
covers everything needed to run a local copy and land a clean PR.
حافظ استودیوی تلاوت با هوش مصنوعی است — ممنون که می‌خواهید بهترش کنید.

## Tech stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui ·
Prisma ORM · Bun. Installable PWA, deployed on Vercel.

## Local setup

```bash
bun install
bun run db:push     # create/update the local database schema
bun run dev         # http://localhost:3000
```

## Before you open a pull request

1. `bun run lint` passes with no errors.
2. `bun run build` succeeds (it runs Prisma generate as part of the build).
3. UI changes are checked at mobile width — the studio is mobile-first, and
   RTL matters everywhere (the interface is Persian-first).
4. Include screenshots or a short clip for visual changes.
5. One logical change per PR — small, focused PRs get merged fastest.

## Ground rules

- Recitation accuracy is sacred: detection and suggestions may surface a
  mistake, but nothing ever silently rewrites a mushaf reading.
- The word-by-word tracking and mistake alerts are real measurements — do not
  add anything that fabricates progress or scores.
- New dependencies need a stated reason in the PR description.

## Where things live

- `src/` — application code · `prisma/` — database schema
- `docs/` — notes and app screens · `worklog.md` — the running build journal
  (add a line there if your change is significant)

## Reporting bugs

See [SUPPORT.md](SUPPORT.md). Security issues go through private disclosure —
never a public issue.
