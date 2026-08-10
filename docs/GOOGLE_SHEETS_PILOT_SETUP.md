# Google Sheets + Apps Script Pilot Setup

## Goal
Use one private Google Sheet as the Florence pilot datastore while GitHub Pages remains the public UI.

## 1. Create the workbook
Create a private Google Sheet named `Dinner Dice Dragons Pilot Database`.

Do **not** publish the Sheet to the web and do not grant Players/GMs direct Sheet access.

## 2. Add Apps Script
From the Sheet, open **Extensions → Apps Script**.

Create these script files and copy the matching repository content from `/apps-script/`:
- `Schema.gs`
- `Storage.gs`
- `Security.gs`
- `Profiles.gs`
- `Games.gs`
- `Code.gs`

## 3. Initialize tabs
Run `setupDatabase()` once from the Apps Script editor and authorize it.

It creates the pilot tabs defined in `Schema.gs` without overwriting existing rows.

## 4. Keep writes disabled while testing
Shared writes are disabled by default.

Run `disablePilotWrites()` whenever you want the backend read-only.

Only after the deployment is tested should you run:

`enablePilotWrites()`

This is a safety switch, **not user authentication**.

## 5. Deploy the web app
Use **Deploy → New deployment → Web app**.

The project requires `doGet(e)` and `doPost(e)`, which Apps Script web apps invoke for GET and POST requests.

Choose deployment permissions appropriate to the pilot. Do not enable a public write deployment until privacy/abuse controls have been reviewed.

Copy the deployment URL ending in `/exec`.

## 6. Connect GitHub Pages
Edit `/api-config.js` and set:

```js
window.DDD_API_CONFIG = Object.freeze({
  baseUrl: "YOUR_APPS_SCRIPT_EXEC_URL"
});
```

Until this value is present, the public site remains in local prototype mode and forms retain localStorage fallback behavior.

## 7. Smoke test
Open the Apps Script URL with:

`?action=health`

Expected JSON:

```json
{"ok":true,"service":"Dinner Dice & Dragons Pilot API"}
```

Then test:
1. Player profile save
2. GM profile save
3. Game save
4. `?action=games.list`
5. Game registration
6. Confirm rows appear only in the intended Sheets tabs
7. Disable writes and verify POSTs are rejected

## Current API actions

### GET
- `health`
- `games.list`

### POST
- `player.save`
- `gm.save`
- `game.save`
- `game.join`

## Security boundary
This pilot backend currently provides validation, private Sheet storage, a write kill-switch, and serialized writes with Apps Script LockService. It does **not yet provide production-grade user authentication**.

Before inviting an unrestricted public audience, add a real identity/authentication layer and server-side authorization rules for Player/GM/Venue roles.

## Migration rule
Every sheet uses stable IDs so the same logical records can later migrate into PostgreSQL without changing the product model.
