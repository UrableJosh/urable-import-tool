// The migration harness carries its OWN copy of the account-copy functions so it
// can run under node with no browser. That copy can drift from index.html, and a
// drifted harness passes while testing code nobody ships.
//
// This checks the two are still the same. Run it alongside the harness:
//   node harness-sync.test.js && node migration-harness.test.js

const fs = require('fs');

const FUNCTIONS = ['migRun', 'migFetch', 'migPageAll', 'migResolveCategory', 'migPick',
  'migIndustryFor', 'migIndustryChoice', 'UrableSource', 'migTryPage', 'migShape',
  'migLoadCatFile', 'migProgress', 'migLog', 'migBase'];

const test = fs.readFileSync(__dirname + '/migration-harness.test.js', 'utf8');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const shipped = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const grab = (src, name) => {
  const m = src.match(new RegExp('(?:async )?function ' + name + '\\([\\s\\S]*?\\n\\}', 'm'));
  return m ? m[0] : null;
};
const norm = s => s.replace(/\s+/g, ' ').trim();

let drifted = 0, missing = 0;
for (const fn of FUNCTIONS) {
  const a = grab(test, fn), b = grab(shipped, fn);
  if (!a || !b) { missing++; console.log('MISSING  ' + fn + ' — absent from ' + (!a ? 'the harness' : 'index.html')); continue; }
  if (norm(a) !== norm(b)) { drifted++; console.log('DRIFTED  ' + fn + ' — harness ' + a.length + 'b vs index.html ' + b.length + 'b'); }
}

if (drifted || missing) {
  console.log('\n' + drifted + ' drifted, ' + missing + ' missing. The harness is testing code that is not what ships.');
  console.log('Re-sync the harness from index.html before trusting its results.');
  process.exit(1);
}
console.log('harness in sync with index.html — ' + FUNCTIONS.length + ' functions identical');
