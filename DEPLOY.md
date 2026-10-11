# Deploying MELA

MELA ships as a Docker image (`Dockerfile`). It keeps all its state (the SQLite DB and uploaded photos) in **`/data`**,
so the one hard requirement is a **persistent volume mounted at `/data`** and **a single instance**.
Without a volume, every redeploy wipes all accounts.

## Environment variables

| Variable | Value | Notes |
|---|---|---|
| `SESSION_SECRET` | a long random string (32+ chars) | **Required.** Generate one with `openssl rand -hex 32` |
| `MELA_DATA_DIR` | `/data` | Already set in the image; must match the volume mount path |
| `MELA_SHOW_OTP` | `1` | **Demo deploys only.** Shows the login code on screen, so anyone can sign in as any number. Remove it once real SMS works |
| `SMS_PROVIDER` | `console` (demo) or `twilio` | With `twilio`, also set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` |
| `MELA_DEMO_MODE` / `MELA_SKIP_SEED` | `off` / `1` | Set these for a real launch to remove the demo members, their likes and their auto-replies |
| `WHATSAPP_*`, `BILLING_PROVIDER` | see `.env.example` | Optional |

`PORT` is provided by the platform and the app reads it automatically. The health check is `GET /api/health`.

## Railway (recommended: volumes on the Hobby plan, ~$5/month)

1. Go to <https://railway.com/new>, choose **Deploy from GitHub repo**, and pick `mela-app`.
   If the code isn't on your default branch, set **Settings → Source → Branch** to `claude/mela-dating-app-upp63r`.
   Railway reads `railway.json` and builds with the Dockerfile.
2. Right-click the service (or press ⌘K) and choose **Add Volume** → mount path **`/data`**.
3. **Variables** tab: add `SESSION_SECRET` (a random value) and `MELA_SHOW_OTP=1`.
4. **Settings → Networking → Generate Domain**. This gives you a public `https://<name>.up.railway.app` URL.
5. Wait for the deploy to turn green, then open the URL on your phone.

CLI alternative: `npm i -g @railway/cli && railway login && railway init && railway up`, then add the volume and domain in the dashboard.

## Render

The repo includes a Blueprint (`render.yaml`).

1. Open <https://dashboard.render.com/blueprints>, choose **New Blueprint Instance**, and pick `mela-app`.
   It creates the web service with a 1 GB disk at `/data`, a generated `SESSION_SECRET`, and `MELA_SHOW_OTP=1`.
2. Your URL is `https://mela-xxxx.onrender.com` (shown on the service page).

Persistent disks need a paid instance (`starter`, ~$7/month). For a quick free look you can set `plan: free` and remove
the `disk:` block, but then all data is wiped on every deploy and whenever the instance sleeps (after 15 idle minutes).

## After it's live

- Check `https://<your-url>/api/health`. It should return `{"ok":true}`.
- Phone screens: add the site to the home screen. It runs full-screen with the dark status bar.
- Don't scale past 1 replica: SQLite and the real-time chat bus are single-instance (see "Scale-out" in the README).
- Back up the volume (Railway: Volume → Backups; Render: disk snapshots are automatic).
