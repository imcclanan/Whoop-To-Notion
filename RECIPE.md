# WHOOP to Notion — Setup Recipe

You are helping the user set up the WHOOP to Notion sync project. This project uses Notion Workers to create an automated data sync — not a tool or automation — that pulls health data from the WHOOP API and writes it into Notion databases on a 30-minute schedule. This file contains everything you need to scaffold the project from scratch. Follow the steps below in order.

---

## Step 1 — Create the project folder

Create a folder called `whoop-to-notion` in a location the user is happy with (ask if unsure), then set it up:

```shell
mkdir whoop-to-notion
cd whoop-to-notion
```

---

## Step 2 — Write the project files

Create the following files exactly as specified.

### `package.json`

```json
{
	"name": "@notionhq/workers-template",
	"version": "0.0.0",
	"private": true,
	"scripts": {
		"build": "tsc",
		"check": "tsc --noEmit"
	},
	"engines": {
		"node": ">=22.0.0",
		"npm": ">=10.9.2"
	},
	"devDependencies": {
		"@types/node": "^22.9.0",
		"tsx": "^4.20.6",
		"typescript": "^5.8.0"
	},
	"dependencies": {
		"@notionhq/workers": ">=0.0.0"
	}
}
```

### `tsconfig.json`

```json
{
	"compilerOptions": {
		"target": "ES2020",
		"module": "nodenext",
		"outDir": "./dist",
		"rootDir": "./src",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true,
		"moduleResolution": "nodenext"
	},
	"include": ["src/**/*"],
	"exclude": ["node_modules", "dist"]
}
```

### `.gitignore`

```
.env
.env.*
!.env.example
dist/
node_modules/
workers.*.json
workers.json
```

### `.env.example`

```
WHOOP_CLIENT_ID=your_client_id_here
WHOOP_CLIENT_SECRET=your_client_secret_here
```

### `src/index.ts`

```typescript
import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";

const worker = new Worker();
export default worker;

const whoopAuth = worker.oauth("whoopAuth", {
	name: "whoop",
	authorizationEndpoint: "https://api.prod.whoop.com/oauth/oauth2/auth",
	tokenEndpoint: "https://api.prod.whoop.com/oauth/oauth2/token",
	scope: "offline read:recovery read:cycles read:sleep read:workout read:body_measurement",
	clientId: process.env.WHOOP_CLIENT_ID ?? "",
	clientSecret: process.env.WHOOP_CLIENT_SECRET ?? "",
	authorizationParams: { response_type: "code" },
	accessTokenExpireMs: 3_600_000,
});

const whoopApi = worker.pacer("whoopApi", { allowedRequests: 60, intervalMs: 60_000 });

async function whoopFetch(path: string): Promise<any> {
	const [token] = await Promise.all([whoopAuth.accessToken(), whoopApi.wait()]);
	const res = await fetch(`https://api.prod.whoop.com/developer/v2${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`Whoop API error ${res.status}: ${await res.text()}`);
	return res.json();
}

function msToMin(ms: number | null | undefined): number {
	return ms != null ? Math.round(ms / 60_000) : 0;
}

const recoveryDb = worker.database("recovery", {
	type: "managed",
	initialTitle: "Whoop Recovery",
	primaryKeyProperty: "Cycle ID",
	schema: {
		databaseIcon: Builder.emojiIcon("💚"),
		properties: {
			Date: Schema.title(),
			"Cycle ID": Schema.richText(),
			"Recovery Score": Schema.number("percent"),
			"HRV (ms)": Schema.number("number"),
			"Resting HR": Schema.number("number"),
			"SpO2 %": Schema.number("percent"),
			"Skin Temp (°C)": Schema.number("number"),
			Scored: Schema.checkbox(),
		},
	},
});

const sleepDb = worker.database("sleep", {
	type: "managed",
	initialTitle: "Whoop Sleep",
	primaryKeyProperty: "Sleep ID",
	schema: {
		databaseIcon: Builder.emojiIcon("😴"),
		properties: {
			Date: Schema.title(),
			"Sleep ID": Schema.richText(),
			"Is Nap": Schema.checkbox(),
			"Performance %": Schema.number("percent"),
			"Efficiency %": Schema.number("percent"),
			"Consistency %": Schema.number("percent"),
			"Total In Bed (min)": Schema.number("number"),
			"REM (min)": Schema.number("number"),
			"Deep (min)": Schema.number("number"),
			"Light (min)": Schema.number("number"),
			"Awake (min)": Schema.number("number"),
			"Respiratory Rate": Schema.number("number"),
			Scored: Schema.checkbox(),
		},
	},
});

const workoutDb = worker.database("workouts", {
	type: "managed",
	initialTitle: "Whoop Workouts",
	primaryKeyProperty: "Workout ID",
	schema: {
		databaseIcon: Builder.emojiIcon("🏋️"),
		properties: {
			Date: Schema.title(),
			"Workout ID": Schema.richText(),
			Sport: Schema.richText(),
			Strain: Schema.number("number"),
			"Avg HR": Schema.number("number"),
			"Max HR": Schema.number("number"),
			"Calories (kJ)": Schema.number("number"),
			"Duration (min)": Schema.number("number"),
			Scored: Schema.checkbox(),
		},
	},
});

const cycleDb = worker.database("cycles", {
	type: "managed",
	initialTitle: "Whoop Daily Strain",
	primaryKeyProperty: "Cycle ID",
	schema: {
		databaseIcon: Builder.emojiIcon("🔥"),
		properties: {
			Date: Schema.title(),
			"Cycle ID": Schema.richText(),
			Strain: Schema.number("number"),
			"Avg HR": Schema.number("number"),
			"Max HR": Schema.number("number"),
			"Calories (kJ)": Schema.number("number"),
			"% Day Recorded": Schema.number("percent"),
			Scored: Schema.checkbox(),
		},
	},
});

function mapRecovery(r: any) {
	const date = (r.created_at ?? r.start ?? "").slice(0, 10);
	const s = r.score ?? {};
	return {
		type: "upsert" as const,
		key: String(r.cycle_id),
		properties: {
			Date: Builder.title(date),
			"Cycle ID": Builder.richText(String(r.cycle_id)),
			"Recovery Score": Builder.number((s.recovery_score ?? 0) / 100),
			"HRV (ms)": Builder.number(s.hrv_rmssd_milli ?? 0),
			"Resting HR": Builder.number(s.resting_heart_rate ?? 0),
			"SpO2 %": Builder.number((s.spo2_percentage ?? 0) / 100),
			"Skin Temp (°C)": Builder.number(s.skin_temp_celsius ?? 0),
			Scored: Builder.checkbox(r.score_state === "SCORED"),
		},
	};
}

function mapSleep(s: any) {
	const date = (s.start ?? "").slice(0, 10);
	const score = s.score ?? {};
	const stages = score.stage_summary ?? {};
	return {
		type: "upsert" as const,
		key: String(s.id),
		properties: {
			Date: Builder.title(date),
			"Sleep ID": Builder.richText(String(s.id)),
			"Is Nap": Builder.checkbox(Boolean(s.nap)),
			"Performance %": Builder.number((score.sleep_performance_percentage ?? 0) / 100),
			"Efficiency %": Builder.number((score.sleep_efficiency_percentage ?? 0) / 100),
			"Consistency %": Builder.number((score.sleep_consistency_percentage ?? 0) / 100),
			"Total In Bed (min)": Builder.number(msToMin(stages.total_in_bed_time_milli)),
			"REM (min)": Builder.number(msToMin(stages.total_rem_sleep_time_milli)),
			"Deep (min)": Builder.number(msToMin(stages.total_slow_wave_sleep_time_milli)),
			"Light (min)": Builder.number(msToMin(stages.total_light_sleep_time_milli)),
			"Awake (min)": Builder.number(msToMin(stages.total_awake_time_milli)),
			"Respiratory Rate": Builder.number(score.respiratory_rate ?? 0),
			Scored: Builder.checkbox(s.score_state === "SCORED"),
		},
	};
}

// https://developer.whoop.com/docs/developing/user-data/activity/
const SPORTS: Record<string, string> = {
	"-1": "Activity",
	0: "Running",
	1: "Cycling",
	16: "Baseball",
	17: "Basketball",
	18: "Rowing",
	19: "Fencing",
	20: "Field Hockey",
	21: "Football",
	22: "Golf",
	24: "Ice Hockey",
	25: "Lacrosse",
	27: "Rugby",
	28: "Sailing",
	29: "Skiing",
	30: "Soccer",
	31: "Softball",
	32: "Squash",
	33: "Swimming",
	34: "Tennis",
	35: "Track & Field",
	36: "Volleyball",
	37: "Water Polo",
	38: "Wrestling",
	39: "Boxing",
	42: "Dance",
	43: "Pilates",
	44: "Yoga",
	45: "Weightlifting",
	47: "Cross Country Skiing",
	48: "Functional Fitness",
	49: "Duathlon",
	51: "Gymnastics",
	52: "Hiking/Rucking",
	53: "Horseback Riding",
	55: "Kayaking",
	56: "Martial Arts",
	57: "Mountain Biking",
	59: "Powerlifting",
	60: "Rock Climbing",
	61: "Paddleboarding",
	62: "Triathlon",
	63: "Walking",
	64: "Surfing",
	65: "Elliptical",
	66: "Stairmaster",
	70: "Meditation",
	71: "Other",
	73: "Diving",
	74: "Operations",
	75: "Healthcare",
	76: "Motorsports",
	77: "HIIT",
	82: "Spin",
	83: "Jiu Jitsu",
	84: "Manual Labor",
	85: "Cricket",
	86: "Pickleball",
	87: "Inline Skating",
	88: "Box Fitness",
	89: "Spikeball",
	90: "Wheelchair Pushing",
	91: "Paddle Tennis",
	92: "Barre",
	93: "Stage Performance",
	94: "High Stress Work",
	95: "Parkour",
	96: "Gaelic Football",
	97: "Hurling/Camogie",
	98: "Circus Arts",
	99: "Esports",
	100: "Lacrosse",
};

function mapWorkout(w: any) {
	const date = (w.start ?? "").slice(0, 10);
	const score = w.score ?? {};
	const durationMin = w.start && w.end
		? Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60_000)
		: 0;
	return {
		type: "upsert" as const,
		key: String(w.id),
		properties: {
			Date: Builder.title(date),
			"Workout ID": Builder.richText(String(w.id)),
			Sport: Builder.richText(SPORTS[w.sport_id] ?? `Sport ${w.sport_id}`),
			Strain: Builder.number(score.strain ?? 0),
			"Avg HR": Builder.number(score.average_heart_rate ?? 0),
			"Max HR": Builder.number(score.max_heart_rate ?? 0),
			"Calories (kJ)": Builder.number(score.kilojoule ?? 0),
			"Duration (min)": Builder.number(durationMin),
			Scored: Builder.checkbox(w.score_state === "SCORED"),
		},
	};
}

function mapCycle(c: any) {
	const date = (c.start ?? "").slice(0, 10);
	const score = c.score ?? {};
	return {
		type: "upsert" as const,
		key: String(c.id),
		properties: {
			Date: Builder.title(date),
			"Cycle ID": Builder.richText(String(c.id)),
			Strain: Builder.number(score.strain ?? 0),
			"Avg HR": Builder.number(score.average_heart_rate ?? 0),
			"Max HR": Builder.number(score.max_heart_rate ?? 0),
			"Calories (kJ)": Builder.number(score.kilojoule ?? 0),
			"% Day Recorded": Builder.number(score.percent_recorded ?? 0),
			Scored: Builder.checkbox(c.score_state === "SCORED"),
		},
	};
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CURSOR_BUFFER_MS = 15_000;

function registerBackfill(name: string, db: any, path: string, mapper: (r: any) => any) {
	worker.sync(name, {
		database: db,
		mode: "replace",
		schedule: "manual",
		execute: async (state: any) => {
			const qs = state?.nextToken
				? `?limit=25&nextToken=${encodeURIComponent(state.nextToken)}`
				: "?limit=25";
			const data = await whoopFetch(`${path}${qs}`);
			return {
				changes: (data.records ?? []).map(mapper),
				hasMore: Boolean(data.next_token),
				nextState: data.next_token ? { nextToken: data.next_token } : undefined,
			};
		},
	});
}

function registerDelta(name: string, db: any, path: string, mapper: (r: any) => any) {
	worker.sync(name, {
		database: db,
		mode: "incremental",
		schedule: "30m",
		execute: async (state: any) => {
			const start = state?.start ?? new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
			const qs = state?.nextToken
				? `?nextToken=${encodeURIComponent(state.nextToken)}&limit=25`
				: `?start=${encodeURIComponent(start)}&limit=25`;
			const data = await whoopFetch(`${path}${qs}`);
			return {
				changes: (data.records ?? []).map(mapper),
				hasMore: Boolean(data.next_token),
				nextState: data.next_token
					? { start, nextToken: data.next_token }
					: { start: new Date(Date.now() - CURSOR_BUFFER_MS).toISOString() },
			};
		},
	});
}

registerBackfill("recoveryBackfill", recoveryDb, "/recovery", mapRecovery);
registerBackfill("sleepBackfill", sleepDb, "/activity/sleep", mapSleep);
registerBackfill("workoutBackfill", workoutDb, "/activity/workout", mapWorkout);
registerBackfill("cycleBackfill", cycleDb, "/cycle", mapCycle);

registerDelta("recoveryDelta", recoveryDb, "/recovery", mapRecovery);
registerDelta("sleepDelta", sleepDb, "/activity/sleep", mapSleep);
registerDelta("workoutDelta", workoutDb, "/activity/workout", mapWorkout);
registerDelta("cycleDelta", cycleDb, "/cycle", mapCycle);
```

---

## Step 3 — Install dependencies

```shell
npm install
```

---

## Step 4 — Install the Notion Workers CLI

Check if `ntn` is already installed:

```shell
ntn --version
```

If not found, install it:

```shell
npm install -g ntn
```

---

## Step 5 — Confirm TypeScript check passes

```shell
npm run check
```

No errors means the code is valid and ready to deploy.

---

## Step 6 — Tell the user what to do next

Once all steps above are complete, tell the user:

> The project is set up. Here's what to do next — these steps require your personal accounts and can't be automated:
>
> 1. **Log into Notion** (Step 2 in the README): Run `ntn login` in your terminal
> 2. **Create your WHOOP developer app** (Step 3 in the README): Go to developer.whoop.com and create an app
> 3. **Deploy the worker** (Step 4 in the README): Run `ntn workers deploy`
> 4. **Add your WHOOP credentials** (Step 5 in the README): Copy your Client ID and Secret into the `.env` file, then run `ntn workers env push`
> 5. **Connect your WHOOP account** (Step 6 in the README): Run `ntn workers oauth start whoopAuth`
> 6. **Load your history** (Step 7 in the README): Run the backfill commands
>
> Refer to the full README at https://github.com/imcclanan/Whoop-To-Notion for details on each step.
