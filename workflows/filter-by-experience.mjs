// After a scan, removes new jobs whose stated minimum years of experience is
// above find.max_required_years in preferences/settings.yml.
// It reads the "yrs:" label the scanner adds. Jobs that state no figure, or only
// a skill-specific one ("skill 3+"), are kept.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { P, settings } from './lib/paths.mjs';

const max = (await settings()).find?.max_required_years;
if (max == null) { console.log('filter-by-experience: no find.max_required_years set, nothing removed'); process.exit(0); }
if (!existsSync(P.inbox)) process.exit(0);

const removed = [];
const kept = readFileSync(P.inbox, 'utf8').split('\n').filter((line) => {
  if (!line.startsWith('- [ ] ')) return true;
  const label = (line.match(/\|\s*yrs:\s*([^|]*)/) || [])[1] || '';
  if (!label || /^(skill|none|unread)/.test(label.trim())) return true;
  // the lowest stated bar decides ("1/3+" -> 1, "pref 8+" -> 8)
  const nums = (label.match(/\d+/g) || []).map(Number);
  if (nums.length && Math.min(...nums) > max) {
    removed.push(line.slice(6).split(' | ').slice(1, 3).join(' — ') + ` (${label.trim()})`);
    return false;
  }
  return true;
});
writeFileSync(P.inbox, kept.join('\n'));
console.log(`filter-by-experience: removed ${removed.length} (over ${max} years)`);
for (const r of removed) console.log(`  - ${r}`);
