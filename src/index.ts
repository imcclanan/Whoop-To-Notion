import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";

const worker = new Worker();
export default worker;

// ── OAuth ──────────────────────────────────────────────────────────────────
// User-managed OAuth: you own the Whoop app credentials.
// After deploying, run: ntn workers oauth start whoopAuth
// Then update your Whoop app's redirect URL to the one shown by:
//   ntn workers oauth show-redirect-url
const whoopAuth = worker.oauth("whoopAuth", {
	name: "whoop",
	authorizationEndpoint: "https://api.prod.whoop.com/oauth/oauth2/auth",
	tokenEndpoint: "https://api.prod.whoop.com/oauth/oauth2/token",
	scope:
		"offline read:recovery read:cycles read:sleep read:workout read:body_measurement",
	clientId: process.env.WHOOP_CLIENT_ID ?? "",
	clientSecret: process.env.WHOOP_CLIENT_SECRET ?? "",
	authorizationParams: {
		response_type: "code",
	},
	accessTokenExpireMs: 3_600_000, // WHOOP access tokens expire after 1 hour
});

// ── Rate limiter ───────────────────────────────────────────────────────────
// Whoop allows ~100 requests/minute. Using 60/min to stay well within limits.
const whoopApi = worker.pacer("whoopApi", {
	allowedRequests: 60,
	intervalMs: 60_000,
});

// ── Whoop API helper ───────────────────────────────────────────────────────
async function whoopFetch(path: string, token: string): Promise<any> {
	const res = await fetch(`https://api.prod.whoop.com/developer/v2${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		throw new Error(`Whoop API error ${res.status}: ${await res.text()}`);
	}
	return res.json();
}

// Safe number: returns 0 if value is null/undefined (unscored records)
function n(value: number | null | undefined): number {
	return value ?? 0;
}

// ms → minutes
function msToMin(ms: number | null | undefined): number {
	return ms != null ? Math.round(ms / 60_000) : 0;
}

// ── Databases ──────────────────────────────────────────────────────────────

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
			"Strain": Schema.number("number"),
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
			"Strain": Schema.number("number"),
			"Avg HR": Schema.number("number"),
			"Max HR": Schema.number("number"),
			"Calories (kJ)": Schema.number("number"),
			"% Day Recorded": Schema.number("percent"),
			Scored: Schema.checkbox(),
		},
	},
});

// ── Mappers ────────────────────────────────────────────────────────────────

function mapRecovery(r: any) {
	const date = (r.created_at ?? r.start ?? "").slice(0, 10);
	const s = r.score ?? {};
	const scored = r.score_state === "SCORED";
	return {
		type: "upsert" as const,
		key: String(r.cycle_id),
		properties: {
			Date: Builder.title(date),
			"Cycle ID": Builder.richText(String(r.cycle_id)),
			"Recovery Score": Builder.number(n(s.recovery_score) / 100),
			"HRV (ms)": Builder.number(n(s.hrv_rmssd_milli)),
			"Resting HR": Builder.number(n(s.resting_heart_rate)),
			"SpO2 %": Builder.number(n(s.spo2_percentage) / 100),
			"Skin Temp (°C)": Builder.number(n(s.skin_temp_celsius)),
			Scored: Builder.checkbox(scored),
		},
	};
}

function mapSleep(s: any) {
	const date = (s.start ?? "").slice(0, 10);
	const score = s.score ?? {};
	const stages = score.stage_summary ?? {};
	const scored = s.score_state === "SCORED";
	return {
		type: "upsert" as const,
		key: String(s.id),
		properties: {
			Date: Builder.title(date),
			"Sleep ID": Builder.richText(String(s.id)),
			"Is Nap": Builder.checkbox(Boolean(s.nap)),
			"Performance %": Builder.number(n(score.sleep_performance_percentage) / 100),
			"Efficiency %": Builder.number(n(score.sleep_efficiency_percentage) / 100),
			"Consistency %": Builder.number(n(score.sleep_consistency_percentage) / 100),
			"Total In Bed (min)": Builder.number(msToMin(stages.total_in_bed_time_milli)),
			"REM (min)": Builder.number(msToMin(stages.total_rem_sleep_time_milli)),
			"Deep (min)": Builder.number(msToMin(stages.total_slow_wave_sleep_time_milli)),
			"Light (min)": Builder.number(msToMin(stages.total_light_sleep_time_milli)),
			"Awake (min)": Builder.number(msToMin(stages.total_awake_time_milli)),
			"Respiratory Rate": Builder.number(n(score.respiratory_rate)),
			Scored: Builder.checkbox(scored),
		},
	};
}

// Whoop sport IDs: https://developer.whoop.com/docs/developing/user-data/activity/
const SPORTS: Record<number, string> = {
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
} as any;

function mapWorkout(w: any) {
	const date = (w.start ?? "").slice(0, 10);
	const score = w.score ?? {};
	const durationMin =
		w.start && w.end
			? Math.round(
					(new Date(w.end).getTime() - new Date(w.start).getTime()) / 60_000,
				)
			: 0;
	const scored = w.score_state === "SCORED";
	const sport = SPORTS[w.sport_id] ?? `Sport ${w.sport_id}`;
	return {
		type: "upsert" as const,
		key: String(w.id),
		properties: {
			Date: Builder.title(date),
			"Workout ID": Builder.richText(String(w.id)),
			Sport: Builder.richText(sport),
			Strain: Builder.number(n(score.strain)),
			"Avg HR": Builder.number(n(score.average_heart_rate)),
			"Max HR": Builder.number(n(score.max_heart_rate)),
			"Calories (kJ)": Builder.number(n(score.kilojoule)),
			"Duration (min)": Builder.number(durationMin),
			Scored: Builder.checkbox(scored),
		},
	};
}

function mapCycle(c: any) {
	const date = (c.start ?? "").slice(0, 10);
	const score = c.score ?? {};
	const scored = c.score_state === "SCORED";
	return {
		type: "upsert" as const,
		key: String(c.id),
		properties: {
			Date: Builder.title(date),
			"Cycle ID": Builder.richText(String(c.id)),
			Strain: Builder.number(n(score.strain)),
			"Avg HR": Builder.number(n(score.average_heart_rate)),
			"Max HR": Builder.number(n(score.max_heart_rate)),
			"Calories (kJ)": Builder.number(n(score.kilojoule)),
			"% Day Recorded": Builder.number(n(score.percent_recorded)),
			Scored: Builder.checkbox(scored),
		},
	};
}

// ── Recovery Syncs ─────────────────────────────────────────────────────────

// Backfill: run manually to pull full history
// ntn workers sync state reset recoveryBackfill && ntn workers sync trigger recoveryBackfill
worker.sync("recoveryBackfill", {
	database: recoveryDb,
	mode: "replace",
	schedule: "manual",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		await whoopApi.wait();
		const qs = state?.nextToken
			? `?limit=25&nextToken=${encodeURIComponent(state.nextToken)}`
			: "?limit=25";
		const data = await whoopFetch(`/recovery${qs}`, token);
		return {
			changes: (data.records ?? []).map(mapRecovery),
			hasMore: Boolean(data.next_token),
			nextState: data.next_token ? { nextToken: data.next_token } : undefined,
		};
	},
});

// Delta: keeps Notion current, runs every 30 minutes
worker.sync("recoveryDelta", {
	database: recoveryDb,
	mode: "incremental",
	schedule: "30m",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		const start =
			state?.start ??
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		await whoopApi.wait();
		const data = await whoopFetch(
			`/recovery?start=${encodeURIComponent(start)}&limit=25`,
			token,
		);
		return {
			changes: (data.records ?? []).map(mapRecovery),
			hasMore: false,
			nextState: { start: new Date().toISOString() },
		};
	},
});

// ── Sleep Syncs ────────────────────────────────────────────────────────────

worker.sync("sleepBackfill", {
	database: sleepDb,
	mode: "replace",
	schedule: "manual",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		await whoopApi.wait();
		const qs = state?.nextToken
			? `?limit=25&nextToken=${encodeURIComponent(state.nextToken)}`
			: "?limit=25";
		const data = await whoopFetch(`/activity/sleep${qs}`, token);
		return {
			changes: (data.records ?? []).map(mapSleep),
			hasMore: Boolean(data.next_token),
			nextState: data.next_token ? { nextToken: data.next_token } : undefined,
		};
	},
});

worker.sync("sleepDelta", {
	database: sleepDb,
	mode: "incremental",
	schedule: "30m",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		const start =
			state?.start ??
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		await whoopApi.wait();
		const data = await whoopFetch(
			`/activity/sleep?start=${encodeURIComponent(start)}&limit=25`,
			token,
		);
		return {
			changes: (data.records ?? []).map(mapSleep),
			hasMore: false,
			nextState: { start: new Date().toISOString() },
		};
	},
});

// ── Workout Syncs ──────────────────────────────────────────────────────────

worker.sync("workoutBackfill", {
	database: workoutDb,
	mode: "replace",
	schedule: "manual",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		await whoopApi.wait();
		const qs = state?.nextToken
			? `?limit=25&nextToken=${encodeURIComponent(state.nextToken)}`
			: "?limit=25";
		const data = await whoopFetch(`/activity/workout${qs}`, token);
		return {
			changes: (data.records ?? []).map(mapWorkout),
			hasMore: Boolean(data.next_token),
			nextState: data.next_token ? { nextToken: data.next_token } : undefined,
		};
	},
});

worker.sync("workoutDelta", {
	database: workoutDb,
	mode: "incremental",
	schedule: "30m",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		const start =
			state?.start ??
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		await whoopApi.wait();
		const data = await whoopFetch(
			`/activity/workout?start=${encodeURIComponent(start)}&limit=25`,
			token,
		);
		return {
			changes: (data.records ?? []).map(mapWorkout),
			hasMore: false,
			nextState: { start: new Date().toISOString() },
		};
	},
});

// ── Cycle Syncs ────────────────────────────────────────────────────────────

// Backfill: run manually to pull full history
// ntn workers sync state reset cycleBackfill && ntn workers sync trigger cycleBackfill
worker.sync("cycleBackfill", {
	database: cycleDb,
	mode: "replace",
	schedule: "manual",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		await whoopApi.wait();
		const qs = state?.nextToken
			? `?limit=25&nextToken=${encodeURIComponent(state.nextToken)}`
			: "?limit=25";
		const data = await whoopFetch(`/cycle${qs}`, token);
		return {
			changes: (data.records ?? []).map(mapCycle),
			hasMore: Boolean(data.next_token),
			nextState: data.next_token ? { nextToken: data.next_token } : undefined,
		};
	},
});

// Delta: keeps Notion current, runs every 30 minutes
worker.sync("cycleDelta", {
	database: cycleDb,
	mode: "incremental",
	schedule: "30m",
	execute: async (state: any) => {
		const token = await whoopAuth.accessToken();
		const start =
			state?.start ??
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		await whoopApi.wait();
		const data = await whoopFetch(
			`/cycle?start=${encodeURIComponent(start)}&limit=25`,
			token,
		);
		return {
			changes: (data.records ?? []).map(mapCycle),
			hasMore: false,
			nextState: { start: new Date().toISOString() },
		};
	},
});
