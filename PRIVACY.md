# Privacy Policy

**Effective date:** April 18, 2026
**Contact:** imcclanan@gmail.com

---

## Overview

Whoop-To-Notion is a self-hosted integration that reads health data from your WHOOP account via the WHOOP API and writes it into your own Notion workspace. It does not operate as a service, does not have a backend of its own, and does not collect or store your data on any third-party server outside of WHOOP and Notion.

---

## Data Collected

This application accesses the following data from the WHOOP API, using only the scopes you explicitly authorize during OAuth setup:

- **Recovery** — recovery score, HRV, resting heart rate, SpO2
- **Sleep** — sleep stages, duration, performance, efficiency, respiratory rate
- **Cycles (Daily Strain)** — strain score, heart rate, calories burned
- **Workouts** — sport type, strain, duration, heart rate

No data is collected beyond what is required to populate your Notion databases.

---

## How Data Is Used

Data retrieved from WHOOP is used solely to create and update records in your personal Notion workspace. It is not used for analytics, advertising, profiling, or any purpose beyond the sync you configured.

---

## How Data Is Shared

Your WHOOP data is transmitted only to:

- **Notion** — to write records into your workspace via the Notion Workers API

Your data is never sold, rented, or disclosed to any other third party. It is not shared with the developer of this project or any other person.

---

## Data Storage

This application does not maintain its own database. The only persistent copies of your data are:

- **WHOOP's servers** — the original source, governed by [WHOOP's Privacy Policy](https://www.whoop.com/privacy/)
- **Your Notion workspace** — governed by [Notion's Privacy Policy](https://www.notion.so/privacy)
- **Your local `.env` file** — contains your WHOOP OAuth credentials (Client ID and Client Secret). This file is excluded from version control via `.gitignore` and should never be committed or shared.

---

## Security

The application uses OAuth 2.0 to authenticate with WHOOP. No WHOOP account passwords are accessed or stored. API credentials are stored locally in a `.env` file and, when deployed, in the Notion Workers encrypted environment. You are responsible for keeping your credentials secure on your own machine.

Any unauthorized access to your data must be reported promptly to affected users and to WHOOP in accordance with the [WHOOP API Terms of Use](https://developer.whoop.com/api-terms-of-use/).

---

## Your Rights

Because this is a self-hosted tool that writes only to your own Notion workspace, you have full control over your data. You can:

- Revoke this application's access to your WHOOP account at any time via [developer.whoop.com](https://developer.whoop.com)
- Delete synced data by removing records from your Notion databases
- Stop the sync entirely by undeploying the worker: `ntn workers deploy --delete`

---

## Changes to This Policy

If this policy changes materially, the effective date above will be updated and the change will be noted in the repository commit history.

---

## Contact

For questions about this privacy policy or data handling, contact: **imcclanan@gmail.com**
