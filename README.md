# Whoop to Notion

### Start here

Notion Workers is a new capability in Notion which allows you to sync external data sources into your Notion workspace. (See the project on GitHub [here](https://github.com/makenotion/workers-template).) This matters because once your data flows into Notion, you can run customizations on top with Custom Agents to display and analyze your data with great flexibility.

Today, we'll use this to pull in health data from WHOOP. After doing this, you'll be able to ask Notion AI about your health, create customized dashboards with the metrics you care about, and ultimately take action to improve your health. For me, this is the first step in what is a larger effort to pull in all my health data into Notion including Strava, bloodwork, and more.

**Note:** This guide requires basic terminal usage — you should be comfortable opening a terminal, navigating to a folder, and running commands by copying and pasting them.

### The Outcome

By the end of this guide, your WHOOP data will automatically sync into four Notion databases every 30 minutes:

- **Whoop Daily Strain** 🔥 — daily cycle data (strain, heart rate, calories)
- **Whoop Recovery** 💚 — recovery scores, HRV, resting HR, SpO2
- **Whoop Sleep** 😴 — sleep stages, performance, efficiency, respiratory rate
- **Whoop Workouts** 🏋️ — individual workouts with sport, strain, and duration

From there, you can build custom dashboards, run Notion AI agents against your data, and surface insights tailored to your health.

---

### Prerequisites

- A [WHOOP](https://www.whoop.com) account with data
- A [Notion](https://notion.so) account (free tier works)
- [Node.js](https://nodejs.org) version 22 or later — download the LTS version if you're not sure
- An AI coding agent (Claude Code, Cursor, Copilot, etc.) — assumed to already be installed

---

### Step 0 — Install Node.js (skip if you already have it)

Node.js is one of the most widely used programming runtimes in the world — it's safe, open source, and installed on hundreds of millions of machines. You're not installing anything obscure here.

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

### Step 1 — Scaffold the project and install the Notion Workers SDK

Open [RECIPE.md](RECIPE.md) from this repo, copy the entire contents, and paste it into your AI coding agent session. Tell it:

> "Follow the instructions in this file exactly. Create the project folder, write all the files as specified, run npm install, install the ntn CLI, and confirm the TypeScript check passes. Tell me when each step is complete."

Your agent will work through the following steps automatically. Use these as checkpoints to verify things are on track:

**1a — Create the project folder and files**

The RECIPE.md contains all the project files embedded directly inside it — your agent reads them and writes them to disk locally. Nothing is cloned from GitHub. The files are based on the [Notion Workers template](https://github.com/makenotion/workers-template), customized for WHOOP.

Your agent should create a folder called `whoop-to-notion` containing:
- `src/index.ts` — the sync logic that pulls from WHOOP and writes to Notion
- `package.json` and `tsconfig.json` — project configuration
- `.env.example` — a template for your WHOOP credentials (you'll fill this in later)
- `.gitignore` — ensures your credentials never accidentally get committed to git

**1b — Install the Notion Workers SDK**

The agent should run:
```shell
npm install
```
This installs:
- **`@notionhq/workers`** — the Notion Workers SDK, which is the package that lets your sync code talk to Notion
- **`typescript`, `tsx`, `@types/node`** — TypeScript tooling used to type-check and compile the code before deploying

You'll see a `node_modules/` folder appear in the project directory when this completes.

**1c — Install the Notion Workers CLI**

The agent should run:
```shell
npm install -g ntn
```
Verify it worked by running:
```shell
ntn --version
```
You should see a version number printed.

**1d — Confirm the TypeScript check passes**

The agent should run:
```shell
npm run check
```
No errors means the code is valid and ready to deploy. If you see errors, share them with your agent to fix.

---

### Step 2 — Log into Notion

```shell
ntn login
```

This will open a browser window asking you to authorize the CLI. Click **Allow**.

---

### Step 3 — Create a WHOOP developer app

You need API credentials from WHOOP to let this sync read your data.

1. Go to [developer.whoop.com](https://developer.whoop.com) and sign in with your WHOOP account
2. Click **Create App**
3. Fill in a name (e.g. **Whoop-To-Notion**) and any description
4. For the redirect URL, it should look exactly like this:
   ```
   https://www.notion.so/workers/oauth/callback
   ```
5. For the privacy policy URL, link to your own repo or a page you control (e.g. `https://github.com/your-username/your-repo/blob/main/PRIVACY.md`). If you haven't pushed your project to GitHub yet, you may need to do that first — a private repo is fine
6. For webhook URLs, this integration doesn't use webhooks — leave those fields blank
7. Under **Scopes**, check the boxes for the data types you want to sync. For this guide, we recommend enabling all of them
8. Save the app — you do not need to request approval. That is only required for apps being distributed to other users

---

### Step 4 — Add your WHOOP credentials

Unlike the rest of this setup, this step involves real credentials that must stay private — treat them like a password. Don't share your screen or paste these values anywhere while completing this step.

Run this to create your `.env` file from the included template:

```shell
cp .env.example .env
```

Then open it:

```shell
open .env
```

Replace `your_client_id_here` and `your_client_secret_here` with the credentials you copied in Step 3, then save the file.

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

### Step 5 — Deploy the worker

This uploads your sync to Notion's servers so it can run automatically:

```shell
ntn workers deploy
```

You should see a success message listing the capabilities that were deployed.

---

### Step 6 — Connect your WHOOP account

This is the OAuth step — it links your WHOOP account to the sync.

1. Go back to [developer.whoop.com](https://developer.whoop.com) and open your app
2. Confirm the **Redirect URL** is set to `https://www.notion.so/workers/oauth/callback` (you set this in Step 3)
3. Save the app if you made any changes

Now start the OAuth flow:

```shell
ntn workers oauth start whoopAuth
```

This will open a browser window asking you to authorize the sync to access your WHOOP data. Click **Allow**.

---

### Step 7 — Load your full history (one-time backfill)

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

### Step 8 — Find your databases in Notion

After the backfill finishes, your databases will appear in the **Private** section of your Notion sidebar — this is where Notion places newly created databases by default. Search for "Whoop" in Notion if you can't find them right away. From there you can move them anywhere in your workspace.

From here on, the sync runs automatically every 30 minutes. New workouts, sleep sessions, and recovery scores will appear in Notion within about 30 minutes of WHOOP scoring them (sleep scores typically show up within 30 minutes of waking up).

---

### You're done

Your WHOOP data is now flowing into Notion automatically. From here, you can build custom dashboards, ask Notion AI questions about your health trends, or connect this data to other tools in your workspace. The hard part is behind you — everything from here is just building on top of what you set up.

---

### Privacy policy

This repo includes a [PRIVACY.md](PRIVACY.md) that covers how this integration handles your WHOOP health data. If you fork this repo and share it publicly, you should update the policy for your own version.

**What to change in `PRIVACY.md`:**

1. **Contact** — update the contact section to point to your own GitHub repo or preferred contact method
2. **Effective date** — update to today's date

Everything else can stay as-is — the policy is written to describe the tool generically, not any specific person's deployment.

