# Whoop to Notion

### Start here

Notion Workers is a new capability in Notion which allows you to sync external data sources into your Notion workspace. ([See Notion's repo on GitHub](https://github.com/makenotion/workers-template)) This matters because once your data flows into Notion, you can run customizations on top with Custom Agents to analyze your data however you'd like.

Today, we'll use this to pull in health data from WHOOP. After doing this, you'll be able to ask Notion AI about your health, create customized dashboards with the metrics you care about, and ultimately take action to improve your health. For me, this is the first step in what is a larger effort to pull in all my health data into Notion including Strava, bloodwork, and more.

**Note:** This guide requires basic terminal usage — you should be comfortable opening a terminal, navigating to a folder, and running commands by copying and pasting them.

**Early access:** Notion Workers is in extreme pre-release alpha. [Learn more here.](https://github.com/makenotion/workers-template) Things may go wrong!

### The Outcome

By the end of this setup, your WHOOP data will automatically sync into four Notion databases every 30 minutes:

- **Whoop Daily Strain** 🔥 — daily cycle data (strain, heart rate, calories)
- **Whoop Recovery** 💚 — recovery scores, HRV, resting HR, SpO2
- **Whoop Sleep** 😴 — sleep stages, performance, efficiency, respiratory rate
- **Whoop Workouts** 🏋️ — individual workouts with sport, strain, and duration

From there, you can build custom dashboards, run Custom Agents on top of your data, and surface insights tailored to your health.

---

### Prerequisites

- A [WHOOP](https://www.whoop.com) account with data
- A [Notion](https://notion.so) account
- [Node.js](https://nodejs.org) version 22 or later — download the LTS version if you're not sure
- An AI coding agent (Claude Code, Cursor, Copilot, etc.) — assumed to already be installed
- A Mac — this guide is written for macOS and hasn't been tested on other operating systems

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

The RECIPE.md contains all the project files embedded directly inside it — your agent reads them and writes them to disk locally. The files are based on the [Notion Workers template](https://github.com/makenotion/workers-template), customized for WHOOP.

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

**Before continuing:** All remaining commands need to be run from inside the `whoop-to-notion` folder. In your terminal, navigate there:

```shell
cd whoop-to-notion
```

Then run:

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
5. For the privacy policy URL, link to your own repo or a page you control (e.g. `https://github.com/your-username/your-repo/blob/main/PRIVACY.md`). If you haven't pushed your project to GitHub yet, you may need to do that first (a private repo is fine). If you don't have a GitHub account, you'll need to create one at [github.com](https://github.com). It's free. Note: the privacy policy requirement is really meant for public apps that other users will connect to. Since this is a personal project, it's just a formality — linking to your own repo is fine.
6. Under **Scopes**, check the boxes for the data types you want to sync. For this guide, we recommend enabling all of them
7. For webhook URLs, this integration doesn't use webhooks — leave those fields blank
8. Save the app — you do not need to request approval. That is only required for apps being distributed to other users

---

### Step 4 — Deploy the worker

This uploads your sync to Notion's servers so it can run automatically:

```shell
ntn workers deploy
```

You should see a success message listing the capabilities that were deployed.

---

### Step 5 — Add your WHOOP credentials (securely)

Unlike the rest of this setup, this step involves real credentials that must stay private — treat them like a password. Don't share your screen or paste these values anywhere while completing this step.

Run this to create your `.env` file from the included template:

```shell
cp .env.example .env
```

Then open it:

```shell
open .env
```

Go to [developer.whoop.com](https://developer.whoop.com), open your app, and copy the **Client ID** and **Client Secret**. Replace `your_client_id_here` and `your_client_secret_here` with those values, then save the file.

Then push those credentials to the Notion Workers environment so the sync can use them when running in the cloud:

```shell
ntn workers env push
```

Once pushed, Notion handles the credentials — your local `.env` file stays on your machine and isn't used by the live sync.

---

### Step 6 — Authenticate with WHOOP

Start the OAuth flow:

```shell
ntn workers oauth start whoopAuth
```

This will open a browser window asking you to authorize the sync to access your WHOOP data. Click **Allow**.

---

### Step 7 — Load your full history (one-time backfill)

Run these commands to load all your WHOOP history into Notion:

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

### That's it!

Your WHOOP data is now flowing into Notion automatically. From here, you can build custom dashboards or ask Notion AI questions about your health trends. The hard part is behind you — everything from here is just building on top of what you set up.

