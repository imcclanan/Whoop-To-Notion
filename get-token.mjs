/**
 * One-time script to get a Whoop refresh token.
 *
 * Before running:
 *   1. In your Whoop developer app, set the redirect URI to: whoop://callback
 *   2. Run: node --env-file=.env get-token.mjs
 */

import { createInterface } from "readline";
import { exec } from "child_process";

const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
const REDIRECT_URI = "whoop://callback";
const SCOPE =
	"read:recovery read:cycles read:sleep read:workout read:body_measurement offline";
const STATE = Math.random().toString(36).slice(2, 12); // 10 char random state

if (!CLIENT_ID || !CLIENT_SECRET) {
	console.error("Missing WHOOP_CLIENT_ID or WHOOP_CLIENT_SECRET in .env file");
	process.exit(1);
}

const authUrl =
	`https://api.prod.whoop.com/oauth/oauth2/auth` +
	`?response_type=code` +
	`&client_id=${encodeURIComponent(CLIENT_ID)}` +
	`&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
	`&scope=${encodeURIComponent(SCOPE)}` +
	`&state=${STATE}`;

console.log("\n=== Whoop OAuth Token Setup ===\n");
console.log("Opening Whoop authorization page in your browser...");
exec(`open "${authUrl}"`);

console.log("\nAfter you approve access, Whoop will redirect to:");
console.log("  whoop://callback?code=...&state=...");
console.log("\nYour browser will show an error (can't open the link) —");
console.log("that's expected. Copy the full URL from the browser's address bar.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question("Paste the full redirect URL here: ", async (input) => {
	rl.close();
	const url = input.trim();

	let parsed;
	try {
		// Handle whoop:// scheme by replacing with https:// for URL parsing
		parsed = new URL(url.replace(/^whoop:\/\//, "https://whoop.com/"));
	} catch {
		console.error("Couldn't parse that URL. Make sure you copied the full address.");
		process.exit(1);
	}

	const code = parsed.searchParams.get("code");
	const returnedState = parsed.searchParams.get("state");

	if (!code) {
		console.error("No 'code' found in the URL. Did you copy the right address?");
		process.exit(1);
	}

	if (returnedState !== STATE) {
		console.error(`State mismatch (got "${returnedState}", expected "${STATE}"). Try again.`);
		process.exit(1);
	}

	console.log("\nExchanging code for tokens...");

	const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: REDIRECT_URI,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
		}),
	});

	const tokens = await tokenRes.json();

	if (!tokenRes.ok) {
		console.error("Token exchange failed:", JSON.stringify(tokens, null, 2));
		process.exit(1);
	}

	console.log("\n✅ Success! Run this command to save your refresh token:\n");
	console.log(
		`cd ~/Documents/Cursor/whoop-notion-sync && ~/.npm-global/bin/ntn workers env set WHOOP_REFRESH_TOKEN=${tokens.refresh_token}`
	);
	console.log(`\nAccess token (good for ${tokens.expires_in}s — for testing):`);
	console.log(tokens.access_token);
});
