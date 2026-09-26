// Run with jsdom installed: node --test tests/first-steps-modal.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(process.env.FIRST_STEPS_SOURCE || 'prumo-first-steps.js', 'utf8');

for (const kind of ['income', 'debt']) test(`guide opens and closes ${kind} without an observer loop`, async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <nav class="sidebar"><div class="nav"><button data-page="settings">Settings</button><button data-page="incomes">Incomes</button><button data-page="debts">Debts</button></div></nav>
    <section id="page-dashboard"><div class="grid-kpi"></div></section>
    <section id="page-settings"><div class="settings-grid"></div><input id="setBaseBalance"></section>
    <button id="addIncomeBtn">Add income</button><button id="addDebtBtn">Add debt</button>
    <div class="modal-backdrop" id="incomeModal"></div><div class="modal-backdrop" id="debtModal"></div>
    </body>`, { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  let callbacks = 0, runaway = false;
  const NativeObserver = w.MutationObserver;
  // Bound a broken version's microtask loop so the regression fails instead of hanging CI.
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super((records, observer) => {
        if (++callbacks > 100) { runaway = true; observer.disconnect(); return; }
        callback(records, observer);
      });
    }
  };
  w.HTMLElement.prototype.getBoundingClientRect = () => ({left:10,top:10,width:100,height:30});
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    for (const name of ['Income', 'Debt']) w.document.getElementById(`add${name}Btn`).onclick = () => w.document.getElementById(`${name.toLowerCase()}Modal`).classList.add('open');
    w.eval(source);
    await wait(30);
    w.prumoFirstSteps.open();
    w.document.querySelector('[data-pfs-skip-step]').click();
    if (kind === 'debt') w.document.querySelector('[data-pfs-skip-step]').click();
    w.document.querySelector('[data-pfs-action]').click();
    await wait(2400);
    assert.equal(runaway, false, `observer loop detected (${callbacks} callbacks)`);
    const modal = w.document.getElementById(`${kind}Modal`);
    const panel = w.document.getElementById('prumoFirstStepsPanel');
    assert.ok(modal.classList.contains('open'));
    assert.equal(panel.style.display, 'none');
    assert.equal(w.document.querySelector('.pfs-focus-ring').classList.contains('visible'), false);
    modal.classList.remove('open');
    await wait(30);
    assert.equal(panel.style.display, '');
    const settled = callbacks;
    await wait(30);
    assert.equal(callbacks, settled, 'observer should settle after closing');
    w.document.querySelector('[data-pfs-action]').click();
    await wait(2400);
    assert.equal(runaway, false);
    assert.ok(modal.classList.contains('open'), 'the guide can reopen the modal');
  } finally { w.close(); }
});
