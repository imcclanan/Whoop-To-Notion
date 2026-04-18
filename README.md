# WHOOP to Notion Sync

Your WHOOP tracks everything — sleep, recovery, strain, workouts — but the insights stay locked inside the WHOOP app. This project pulls all of that data into your Notion workspace, where you can actually do something with it.

Once your health data lives in Notion, you can build on top of it in ways WHOOP alone doesn't support: custom dashboards that surface the metrics that matter to you, Notion AI agents that run a weekly review of your sleep trends, automations that flag when your recovery has been low for several days in a row, or whatever else fits your life. This is the infrastructure layer — get the data into Notion once, and everything else becomes possible.

Automatically syncs every 30 minutes. You'll get four databases in your Notion workspace:

- **Whoop Daily Strain** 🔥 — daily cycle data (strain, heart rate, calories)
- **Whoop Recovery** 💚 — recovery scores, HRV, resting HR, SpO2
- **Whoop Sleep** 😴 — sleep stages, performance, efficiency, respiratory rate
- **Whoop Workouts** 🏋️ — individual workouts with sport, strain, and duration

---

> **Prerequisites:** This guide requires basic terminal usage — you should be comfortable opening a terminal, navigating to a folder, and running commands by copying and pasting them. If you've never used a terminal before, spend 10 minutes with a beginner's guide first ([Mac](https://support.apple.com/guide/terminal/welcome/mac) / [Windows](https://learn.microsoft.com/en-us/windows/terminal/)).

## What you need before starting

- A [WHOOP](https://www.whoop.com) account with data
- A [Notion](https://notion.so) account (free tier works)
- [Node.js](https://nodejs.org) version 22 or later — download the LTS version if you're not sure
- Access to [Notion Custom Agents](https://www.notion.so/?target=ai) (currently in early access — you may need to request it from your workspace admin)
- [Claude Code](https://claude.ai/code) or your AI coding agent of choice — assumed to already be installed

---

## Step 0 — Install Node.js (skip if you already have it)

Check if Node.js is already installed by opening your terminal and running:

```shell
node --version
```

If you see a version number like `v22.x.x` or higher, you're good — skip to Step 1.

If you get an error or a version below 22, install it:

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version
2. Open the downloaded installer and follow the prompts
3. Once installed, close and reopen your terminal, then run `node --version` again to confirm it worked

---

## Step 1 — Create a WHOOP developer app

You need API credentials from WHOOP to let this sync read your data.

1. Go to [developer.whoop.com](https://developer.whoop.com) and sign in with your WHOOP account
2. Click **Create App**
3. Fill in a name — we recommend **Whoop-To-Notion** — and any description
4. For the redirect URL, enter exactly:
   ```
   https://www.notion.so/workers/oauth/callback
   ```
5. Under **Scopes**, check every box — enable all of them
6. Save the app and copy your **Client ID** and **Client Secret** — you'll need these shortly

---

## Step 2 — Install the Notion Workers CLI

Open your terminal and run:

```shell
npm install -g ntn
```

Then log into your Notion workspace:

```shell
ntn login
```

This will open a browser window asking you to authorize the CLI. Click **Allow**.

---

## Step 3 — Clone this repo and install dependencies

```shell
git clone https://github.com/imcclanan/Whoop-To-Notion.git
cd Whoop-To-Notion
npm install
```

---

## Step 4 — Add your WHOOP credentials

Run this to create your `.env` file from the included template:

```shell
cp .env.example .env
```

Then open it:

```shell
open .env
```

Replace `your_client_id_here` and `your_client_secret_here` with the credentials you copied in Step 1, then save the file.

> **Keep this file private.** Your `.env` file contains real API credentials — treat it like a password. A few rules to follow:
>
> - **Never commit it to git.** This repo's `.gitignore` already blocks it, so as long as you don't force-add it, you're protected. If you're using an AI coding tool (Cursor, Copilot, etc.), double-check it didn't stage the file.
> - **Never share it or paste it publicly** — not in a GitHub issue, Discord, screenshot, or anywhere else.
> - **Never push this repo to GitHub with `.env` inside it.** Run `git status` before pushing and make sure `.env` doesn't appear in the list of files to be committed. If it does, remove it with `git rm --cached .env` before proceeding.
> - If you accidentally commit or share your credentials, go to [developer.whoop.com](https://developer.whoop.com) immediately and regenerate your Client Secret. The old one should be considered compromised.

Then push those credentials to the Notion Workers environment so the sync can use them when running in the cloud:

```shell
ntn workers env push
```

Once you've run `ntn workers env push`, the credentials are stored securely in Notion's cloud and your local `.env` file is only needed if you're running the worker locally for testing.

---

## Step 5 — Deploy the worker

This uploads your sync to Notion's servers so it can run automatically:

```shell
ntn workers deploy
```

You should see a success message listing the capabilities that were deployed.

---

## Step 6 — Connect your WHOOP account

This is the OAuth step — it links your WHOOP account to the sync.

1. Go back to [developer.whoop.com](https://developer.whoop.com) and open your app
2. Confirm the **Redirect URL** is set to `https://www.notion.so/workers/oauth/callback` (you set this in Step 1)
3. Save the app if you made any changes

Now start the OAuth flow:

```shell
ntn workers oauth start whoopAuth
```

This will open a browser window asking you to authorize the sync to access your WHOOP data. Click **Allow**.

---

## Step 7 — Load your full history (one-time backfill)

The first time you run this, pull in all your historical data:

```shell
ntn workers sync state reset recoveryBackfill && ntn workers sync trigger recoveryBackfill
ntn workers sync state reset sleepBackfill    && ntn workers sync trigger sleepBackfill
ntn workers sync state reset workoutBackfill  && ntn workers sync trigger workoutBackfill
ntn workers sync state reset cycleBackfill    && ntn workers sync trigger cycleBackfill
```

Each of these may take a few minutes depending on how much history you have. You can watch progress with:

```shell
ntn workers sync status
```

---

## Step 8 — Find your databases in Notion

After the backfill finishes, your databases will appear in the **Private** section of your Notion sidebar — this is where Notion places newly created databases by default. Search for "Whoop" in Notion if you can't find them right away. From there you can move them anywhere in your workspace.

From here on, the sync runs automatically every 30 minutes. New workouts, sleep sessions, and recovery scores will appear in Notion within about 30 minutes of WHOOP scoring them (sleep scores typically show up within 30 minutes of waking up).


---

## Rotating your WHOOP credentials

If you ever regenerate your Client Secret in the WHOOP developer portal, update it here in three steps:

**1. Open your `.env` file:**
```shell
open .env
```

**2. Replace the `WHOOP_CLIENT_SECRET` value with your new secret and save the file.**

**3. Push the updated credentials to Notion:**
```shell
ntn workers env push
```

It will show you the variables it's about to upload and ask `Push changes? (y/n)` — type `y` and hit Enter. Your sync will use the new secret on its next run, no redeploy needed.

---

## Privacy policy

This repo includes a [PRIVACY.md](PRIVACY.md) that covers how this integration handles your WHOOP health data. If you fork this repo and share it publicly, you should update the policy for your own version.

**What to change in `PRIVACY.md`:**

1. **Contact email** — replace `imcclanan@gmail.com` with your own
2. **Effective date** — update to today's date

Everything else can stay as-is — the policy is written to describe the tool generically, not any specific person's deployment.

---

## Troubleshooting

**Data not showing up after setup?**
Run `ntn workers sync status` and check that all syncs show `HEALTHY`. If any show `ERROR`, run `ntn workers runs list` and check the logs for that sync.

**OAuth error when connecting WHOOP?**
Double-check that the redirect URL in your WHOOP app settings exactly matches the one from `ntn workers oauth show-redirect-url`.

**Missing old data?**
Re-run the backfill commands from Step 7 for the data type you're missing.

**Credentials not working?**
Make sure your `.env` file has the correct Client ID and Secret from your WHOOP app, and that you ran `ntn workers env push` after creating it.
