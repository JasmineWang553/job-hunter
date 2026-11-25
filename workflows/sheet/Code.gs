/**
 * Application tracking sheet: receives rows from `./jobs sheet push`.
 * Paste into the sheet: Extensions -> Apps Script, replace Code.gs, save.
 * Then run setup() once and deploy as a web app (see README.md next to this file).
 */
const COLUMNS = ['Company', 'Date', 'Role', 'Location', 'Link', 'Referral?', 'Result'];
const RESULTS = ['Applied', 'Interview', 'Rejected', 'Accepted'];

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

/** Run once: header row, Result dropdown, frozen header. Also sets the secret. */
function setup() {
  const sh = sheet_();
  sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(RESULTS, true).build();
  sh.getRange(2, COLUMNS.indexOf('Result') + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid());
  Logger.log('Secret (copy into preferences/settings.yml -> apps_script_secret): ' + props.getProperty('SECRET'));
}

/** Upsert rows by Link (or Company + Role). Existing rows: only Result changes. New rows: appended. */
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || body.secret !== secret) return out_('unauthorized');

  const sh = sheet_();
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const col = (name) => header.indexOf(name);
  const last = sh.getLastRow();
  const data = last > 1 ? sh.getRange(2, 1, last - 1, header.length).getValues() : [];
  // match on Link, or on Company + Role (links typed by hand can differ slightly)
  const key = (company, role) => (String(company) + '|' + String(role)).toLowerCase().trim();
  const byLink = {}, byName = {};
  data.forEach((r, i) => {
    if (r[col('Link')]) byLink[String(r[col('Link')])] = i + 2;
    byName[key(r[col('Company')], r[col('Role')])] = i + 2;
  });

  let added = 0, updated = 0;
  (body.rows || []).forEach((row) => {
    const at = (row.Link && byLink[row.Link]) || byName[key(row.Company, row.Role)];
    if (at) {
      const cell = sh.getRange(at, col('Result') + 1);
      if (cell.getValue() !== row.Result) { cell.setValue(row.Result); updated++; }
      return;
    }
    sh.appendRow(header.map((h) => (row[h] !== undefined ? row[h] : '')));
    added++;
  });
  return out_(`added ${added}, updated ${updated}`);
}

function out_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
