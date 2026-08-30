# Running EcoBot on your own computer

This guide gets the whole app running on your laptop so you can click through
every page — dashboard, editor, Sprocket, modules, cart — for real.

No money required. You'll install a few free tools and run some commands.
Take it one step at a time; it's normal for this to take 30–45 minutes the
first time.

> Tip: When a step says "run", it means type the command into your terminal
> (Terminal on Mac, PowerShell on Windows) and press Enter.

---

## Step 1 — Install the tools you need

You need three things installed. Check if you already have them first:

- **Node.js 20+** — run `node --version`. If it prints a number ≥ 20, you're set.
  Otherwise install from https://nodejs.org (get the "LTS" version).
- **pnpm** — run `pnpm --version`. If missing, run: `npm install -g pnpm`
- **Postgres** (the database) — the easiest way is **Docker** (one command, below).
  Install Docker Desktop from https://www.docker.com/products/docker-desktop
  If you'd rather install Postgres directly, that works too.

---

## Step 2 — Start the database

If you have Docker, this one command starts a Postgres database named "ecobot":

```
docker run --name ecobot-db -e POSTGRES_USER=ecobot -e POSTGRES_PASSWORD=ecobot -e POSTGRES_DB=ecobot -p 5432:5432 -d postgres:16
```

That's it — the database is now running in the background. (To stop it later:
`docker stop ecobot-db`. To start it again: `docker start ecobot-db`.)

---

## Step 3 — Set up your environment file

1. In the project folder, copy the example file:
   - Mac/Linux: `cp .env.example .env`
   - Windows: `copy .env.example .env`
2. Open the new `.env` file in a text editor and fill in:
   - **GEMINI_API_KEY** — get a free one at https://aistudio.google.com/apikey
     (this powers Sprocket, the AI tutor)
   - **For login**, pick ONE:
     - **Easy way:** set `DEV_AUTH_BYPASS=1` to skip login entirely and land
       straight in the app as a test user. Leave the Clerk keys as-is.
     - **Real login:** sign up free at https://clerk.com, create an app, and
       paste your `pk_test_...` and `sk_test_...` keys into the three Clerk lines.

The `DATABASE_URL` line already matches the Docker command above — leave it.

---

## Step 4 — Install and set up the app

From the project folder, run these once:

```
pnpm install
pnpm --filter @workspace/db run push
```

The first line downloads everything the app needs. The second creates the
database tables. (If `run push` isn't found, run `pnpm --filter @workspace/db run` to see the exact script name.)

---

## Step 5 — Run it

You'll run two things at once, so open **two terminal windows** in the project folder.

**Terminal 1 — the backend server:**
```
pnpm --filter @workspace/api-server run dev
```
Wait until it says it's listening on port 3000.

**Terminal 2 — the frontend:**
```
pnpm --filter @workspace/ecobot run dev
```
It will print a local address, usually `http://localhost:5173`.

Open that address in your browser. If you set `DEV_AUTH_BYPASS=1`, you'll go
straight into the app. If you used Clerk keys, sign up with any email and
you're in.

---

## If something breaks

- **"DATABASE_URL must be set"** — your `.env` isn't being read, or the database
  isn't running. Check Step 2 and Step 3.
- **"Missing VITE_CLERK_PUBLISHABLE_KEY"** — the frontend needs a Clerk publishable
  key even in dev. Use the free Clerk dev key (Step 3, "Real login").
- **Sprocket doesn't respond** — check your `GEMINI_API_KEY` is filled in and valid.
- **Port already in use** — something else is on that port; change `PORT` in `.env`
  (backend) or stop the other program.
- **Can't reach the database** — make sure Docker is running and `ecobot-db`
  is started (`docker ps` shows running containers).

When you're ready to put this on the real internet so anyone can visit it,
that's the separate "deploy to Render" step — ask Claude for the deployment guide.
