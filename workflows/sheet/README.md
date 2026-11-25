# Google Sheet tracking

Every application you submit gets a row:
`Company | Date | Role | Location | Link | Referral? | Result`.
Result is a dropdown: Applied / Interview / Rejected / Accepted.

Settings live in `my-data/preferences/settings.yml` under `tracking_sheet:`.

## No sheet yet

Leave `tracking_sheet.url` empty. The first time `/apply-jobs` runs it asks for a
**Google Drive folder link**, creates "Applications Tracking" in that folder,
fills in your past applications and saves the sheet's link to your settings.
That uses the Google Drive connector in Claude.

## How rows get written

`write_method: chrome` (default): after each submit, Claude types the row
into the sheet in your Chrome. Nothing to set up. It can trip over sheet
layout changes, and it checks each row after typing it.

`write_method: apps-script` (recommended, 5 minutes):

1. Open the sheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with [Code.gs](Code.gs), then save.
3. Select `setup` in the toolbar and click **Run**. Allow access when asked.
   **View → Logs** shows a secret.
4. **Deploy → New deployment** → type **Web app**. Execute as **Me**, and set
   Who has access to **Anyone**. The secret is what protects it. Copy the web app URL.
5. In `settings.yml`, set:
   ```yaml
   write_method: apps-script
   apps_script_url: "<web app URL>"
   apps_script_secret: "<secret from step 3>"
   ```
6. `./jobs sheet push` sends every application. Run it any time. It only
   adds missing rows and updates Result when a status changes (Interview,
   Rejected, …). Your own edits, such as Referral?, are kept.

`./jobs sheet` (no push) prints the rows the sheet should have, without
sending anything.
