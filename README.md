# 📚 teravoidbin

**A private digital library for novels, manga and research papers. Sign up, then read in your browser or download.**

> ✅ **Official site: https://YOUR-SITE.vercel.app**
>
> The `github.io` page for this repo is not the website. This repository only holds the source code.

---

## Features

- **Library of novels, manga, books and academic papers** in PDF and EPUB, with category filters and search by title or author
- **Built-in reader:** EPUB reading in the browser, PDF viewer with full-screen mode
- **Members only:** reading and downloading require a free account
- **Secure files:** stored in a private bucket and served through short-lived signed links
- **Admin dashboard** (owner only): upload, delete, member count, recent signups, reads and downloads per file
- **Live visitor count** visible to the admin
- **Dark and light mode**, saved per device
- **Mobile-first design**, with a change-password page for members

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Auth, database, storage | Supabase (PostgreSQL with row-level security) |
| EPUB reader | epub.js |
| Hosting | Vercel |

## How access works

| Role | Browse | Read and download | Upload and delete | Analytics |
| --- | :---: | :---: | :---: | :---: |
| Visitor | ✅ | ❌ | ❌ | ❌ |
| Member | ✅ | ✅ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |

Permissions are enforced in the database with row-level security, not only in the interface.

## Run it yourself

1. Create a Supabase project and set up the tables (`profiles`, `items`, `events`) and a private storage bucket named `library`.
2. Add these environment variables locally in `.env.local` and in Vercel:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase publishable (anon) key |

3. Install and start:

`npm install` then `npm run dev`

4. Sign up on the site, then set your own account's `role` to `admin` in the `profiles` table.

## Content notice

Only content the owner created or has the right to share is hosted here. Rights holders who want something removed can reach out through the links below.

## Developer

**Helix**

- GitHub: [Prathamesh241024](https://github.com/Prathamesh241024)
- WhatsApp: [Chat with me](https://wa.me/qr/G7AQHSBORO5BA1?s=r)
- More contact details are on the site's **Developer info** page.

---

© 2026 Helix. All rights reserved.
