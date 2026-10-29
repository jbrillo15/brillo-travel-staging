/* App controller: boot, routing, events, sync triggers, update prompt.
   Renders from the stored snapshot first, then syncs (offline-first, D6). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var D = BT.dom, html = D.html, T = BT.time;

  var S = {
    env: null, db: null, setup: null, owner: null, snapshot: null, vm: BT.model.build(null),
    status: { state: 'idle' }, sheet: null, update: null, updateNote: null, setupError: null,
    simulate: null, storageError: null, sync: null, incompatible: null, packView: 'bag', saveError: null,
    fxCache: null, prefill: null
  };
  BT.app = { state: S };

  // ---------- routing (hash keeps the screen across reloads; spike L10) ----------
  var TABS = [['today', 'Today', 'i-today'], ['trip', 'Trip', 'i-trip'], ['lists', 'Lists', 'i-lists'],
    ['budget', 'Budget', 'i-budget'], ['nearby', 'Nearby', 'i-nearby']];
  function route() {
    var parts = (location.hash || '#/today').replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'today';
    var arg = null;
    try { arg = parts[1] ? decodeURIComponent(parts[1]) : null; } catch (e) { arg = parts[1]; }
    var tab = { today: 'today', info: 'today', settings: 'today', health: 'today', trip: 'trip', day: 'trip', item: 'trip', print: 'trip',
      lists: 'lists', list: 'lists', check: 'lists', 'sync-issues': 'lists', budget: 'budget', expense: 'budget', calc: 'budget', nearby: 'nearby' }[name] || 'today';
    return { name: name, arg: arg, tab: tab };
  }
  function screenFor(r) {
    if (!S.setup && r.name !== 'settings' && r.name !== 'health') return BT.ui.settings.setup(S);
    switch (r.name) {
      case 'trip': return BT.ui.trip.list(S);
      case 'day': return BT.ui.trip.day(S, r.arg);
      case 'item': return BT.ui.trip.item(S, r.arg);
      case 'print': return BT.ui.trip.printable(S);
      case 'info': return BT.ui.info.render(S);
      case 'settings': return BT.ui.settings.render(S);
      case 'health': return BT.ui.settings.health(S);
      case 'lists': return BT.ui.lists.overview(S);
      case 'list': return BT.ui.lists.list(S, r.arg);
      case 'check': return BT.ui.lists.edit(S, r.arg);
      case 'sync-issues': return BT.ui.lists.issues(S);
      case 'budget': return BT.ui.budget.overview(S);
      case 'expense': return BT.ui.budget.form(S, r.arg || 'new');
      case 'calc': return BT.ui.budget.calc(S);
      case 'nearby': return BT.ui.nearby.render(S);
      default: return BT.ui.today.render(S);
    }
  }

  // ---------- banners ----------
  function banners() {
    var out = [];
    if (S.dataError) out.push(html`<div class="banner"><div class="msg"><strong>Couldn't read the latest plan</strong><span>Showing what this phone had before. Check Data health or the sheet.</span></div></div>`);
    if (S.saveError) out.push(html`<div class="banner"><div class="msg"><strong>Couldn't save that change</strong><span>${S.saveError}</span></div><button class="btn" type="button" data-action="dismiss-save-error">OK</button></div>`);
    if (S.status.held && S.status.pending) out.push(html`<div class="banner"><div class="msg"><strong>Changes waiting</strong><span>${S.status.held}</span></div></div>`);
    if (S.storageError) out.push(html`<div class="banner"><div class="msg"><strong>Storage problem</strong><span>This phone couldn't open the app's storage. Free some space, then close and reopen the app.</span></div></div>`);
    var errs = (S.vm.issues || []).filter(function (i) { return i.severity === 'error'; }).length;
    if (errs) out.push(html`<div class="banner"><div class="msg"><strong>Sheet problem</strong><span>${errs} ${errs === 1 ? 'issue' : 'issues'}${S.vm.staleTabs.length ? '. Showing the last good copy.' : ''}</span></div><a class="btn" href="#/health">Details</a></div>`);
    if (S.update) out.push(html`<div class="banner"><div class="msg"><strong>Update available</strong><span>${S.update.version ? 'Version ' + S.update.version : 'A new version is ready'}</span></div><button class="btn btn-primary" type="button" data-action="apply-update">Update</button></div>`);
    if (S.vm.settings.minAppVersion && BT.model.semverLess(BT.config.version, S.vm.settings.minAppVersion)) {
      out.push(html`<div class="banner"><div class="msg"><strong>This app is out of date</strong><span>The sheet expects version ${S.vm.settings.minAppVersion}. Everything still shows; update when you can.</span></div></div>`);
    }
    if (S.incompatible) out.push(html`<div class="banner"><div class="msg"><strong>App and sheet don't match</strong><span>${S.incompatible}</span></div><a class="btn" href="#/settings">Settings</a></div>`);
    if (S.status.state === 'setup' && S.setup) out.push(html`<div class="banner"><div class="msg"><strong>Setup code needed</strong><span>The sheet didn't accept this phone's code. Your saved plans are still here.</span></div><a class="btn" href="#/settings">Settings</a></div>`);
    return out;
  }

  function syncPill() {
    var st = BT.sync.describe(S.status, T.now());
    return html`<span class="sync" data-state="${st.state}" data-sync>${st.text}</span>`;
  }

  // ---------- render ----------
  var root;
  function render() {
    var r = route();
    var scr;
    try { scr = screenFor(r); } catch (e) {
      scr = { city: null, header: D.plainHeader('Something went wrong'), body: html`<p class="error">${String(e && e.message || e)}</p>` };
    }
    var cityCls = scr.city ? BT.model.cityClass(scr.city) : '';
    var bs = banners();
    root.className = 'app ' + cityCls;
    root.innerHTML = D.str(html`
      ${S.env === 'staging' ? html`<div class="staging-ribbon" aria-label="Staging">STAGING${S.simulate ? ' · SIMULATED TIME' : ''}</div>` : ''}
      ${scr.header}
      <div class="sync-row">${syncPill()}</div>
      ${bs.length ? html`<div class="banners">${bs}</div>` : ''}
      <main class="content" id="main">${scr.body}</main>
      <nav class="tabbar" aria-label="Main">${TABS.map(function (t) {
        return html`<a class="tab" href="#/${t[0]}"${r.tab === t[0] ? D.raw(' aria-current="page"') : ''}>${D.icon(t[2])}${t[1]}</a>`;
      })}</nav>`);
    // Remember what the edit form showed, so Save sends only what the person changed
    // (not the gap between the form and newer data, or a cell the form can't show).
    var ef = root.querySelector('form[data-action="save-check"]');
    if (ef) Array.prototype.forEach.call(ef.elements, function (el) { if (el.name) el.setAttribute('data-orig', el.value); });
    renderSheet();
  }
  BT.app.render = function () { render(); };
  // New data arrived while someone was typing: draw it when they leave the field. The
  // edit form is left alone (its Save diffs against the latest data, not the screen).
  var deferred = false;
  function deferRender() { deferred = true; renderSyncOnly(); }
  function flushDeferred() {
    if (!deferred || typing()) return;
    deferred = false;
    if (!document.querySelector('[data-hold]')) render();
  }   // E2E: redraw after setting state directly
  // An open edit form is never redrawn by a sync: unsaved text would vanish (ship-check
  // 2026-10-21). It redraws when the person saves or leaves. Any screen holding typed
  // state marks itself data-hold (list item edit, expense form, calculator).
  function holdRender() { return typing() || !!document.querySelector('[data-hold]'); }
  function typing() { return !!(document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)); }
  function renderSyncOnly() {
    var st = BT.sync.describe(S.status, T.now());
    Array.prototype.forEach.call(document.querySelectorAll('[data-sync]'), function (el) {
      el.setAttribute('data-state', st.state); el.textContent = st.text;
    });
  }

  // ---------- cards sheet ----------
  var overlay, wakeLock = null;
  function renderSheet() {
    if (!S.sheet) { overlay.hidden = true; overlay.innerHTML = ''; releaseWake(); return; }
    overlay.innerHTML = D.str(BT.ui.cards.render(S, S.sheet));
    overlay.hidden = false;
    if (wakeLock) Array.prototype.forEach.call(overlay.querySelectorAll('[data-wake-hint]'), function (el) { el.hidden = true; });
    requestWake();
  }
  function requestWake() {
    if (wakeLock || !('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l;
      l.addEventListener('release', function () { wakeLock = null; });
      Array.prototype.forEach.call(overlay.querySelectorAll('[data-wake-hint]'), function (el) { el.hidden = true; });
    }).catch(function () { /* the brightness hint stays visible (EC-37) */ });
  }
  function releaseWake() { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } }

  // ---------- data ----------
  // Bad data must never look like a storage problem or blank the app (F1).
  function applySnapshot(snap) {
    try {
      S.vm = BT.model.build(snap, S.sync ? S.sync.overlay() : []);
      S.snapshot = snap;
      S.dataError = null;
      rememberRate(snap);
    } catch (e) {
      S.dataError = String(e && e.message || e);
    }
  }
  // The phone keeps the last good live rate, for when GOOGLEFINANCE says #N/A (EC-57).
  function rememberRate(snap) {
    var live = snap && snap.data && snap.data.settings && snap.data.settings.fxLive;
    var at = snap && snap.generatedAt ? new Date(snap.generatedAt) : null;
    if (!BT.budget.goodRate(live) || !at || isNaN(at.getTime())) return;
    var date = T.tripDate(at);
    if (S.fxCache && S.fxCache.rate === live && S.fxCache.date === date) return;
    S.fxCache = { rate: live, date: date };
    if (S.db) S.db.put('prefs', 'fx', S.fxCache).catch(function () { /* the sheet's fallback still works */ });
  }
  function applySimulation(sim) {
    S.simulate = S.env === 'staging' && sim ? sim : null;
    T.setNow(S.simulate ? function () { return Date.now() + S.simulate.offsetMs; } : null);
  }
  function deviceName() { return S.owner ? S.owner.toLowerCase() + '-iphone' : 'unknown-iphone'; }

  function openDb(env) {
    S.env = env;
    return BT.store.open(env).then(function (db) {
      S.db = db;
      return Promise.all([db.get('prefs', 'setup'), db.get('prefs', 'owner'), db.get('prefs', 'simulate')]);
    }).then(function (v) {
      S.setup = v[0] || null;
      S.owner = v[1] || null;
      applySimulation(v[2] || null);
      if (S.sync) S.sync.stopRetry();
      var sync = S.sync = BT.sync.create({
        store: S.db,
        getSetup: function () { return S.setup ? Object.assign({ device: deviceName() }, S.setup) : null; },
        isVisible: function () { return document.visibilityState === 'visible'; }
      });
      var queueSig = '';
      sync.onChange(function (st) {
        if (sync !== S.sync) return;            // a sync left over from before an env switch
        var prevRev = S.snapshot && S.snapshot.rev;
        // Queued changes are drawn on top of the snapshot; redraw when the outbox changes.
        var sig = sync.queue().map(function (o) { return o.opId + o.status; }).join();
        var queueChanged = sig !== queueSig;
        queueSig = sig;
        var wasIncompatible = S.incompatible;
        S.status = st;
        // The mismatch banner stays up until the script answers again (synced, or setup
        // needed); offline or a failed sync says nothing about whether it now matches.
        if (st.state === 'incompatible') S.incompatible = st.error && st.error.message || 'The app and the sheet\'s script don\'t match.';
        else if (st.state === 'synced' || st.state === 'setup') S.incompatible = null;
        var bannerChanged = wasIncompatible !== S.incompatible && !holdRender();   // shows on the next render instead
        if (st.state === 'synced') {
          S.db.get('snapshot', 'current').then(function (snap) {
            if (snap && (snap.rev !== prevRev || queueChanged)) { applySnapshot(snap); holdRender() ? deferRender() : render(); }
            else if (bannerChanged) render(); else renderSyncOnly();
          });
        } else if (queueChanged) { applySnapshot(S.snapshot); holdRender() ? deferRender() : render(); }
        else if ((st.state === 'setup' && !holdRender()) || bannerChanged) render();
        else renderSyncOnly();
      });
      return Promise.all([S.sync.load(), S.db.get('prefs', 'packView'), S.db.get('prefs', 'fx')]);
    }).then(function (v) {
      var snap = v[0];
      if (v[1]) S.packView = v[1];
      S.fxCache = v[2] && BT.budget.goodRate(v[2].rate) ? v[2] : null;
      if (snap) applySnapshot(snap);
      S.status = S.sync.status();
      // A mismatch saved before the app closed keeps its banner until the script answers.
      if (S.status.state === 'incompatible') S.incompatible = S.status.error && S.status.error.message;
      if (!S.setup) S.status.state = 'setup';
    });
  }

  // ---------- actions ----------
  function savePasted(text) {
    var setup;
    try { setup = BT.api.decodeSetup(text); } catch (e) { S.setupError = e.message; render(); return; }
    // A code only works on its own site: the test app never connects to the real sheet,
    // and the real-trip app never to the test sheet (ship-check 2026-10-21).
    var site = BT.store.envFromPath(location.pathname);
    if (setup.env !== site) {
      S.setupError = site === 'staging'
        ? 'This is the test app (STAGING). That code is for the real trip app. Open the other Brillo icon and paste it there.'
        : 'This is the real trip app. That code is for the test app (STAGING). Ask Jordan for the real trip code.';
      render(); return;
    }
    S.setupError = null;
    var switching = setup.env !== S.env;
    BT.store.setActiveEnv(setup.env);
    var ready = switching ? (S.db.close(), openDb(setup.env)) : Promise.resolve();
    ready.then(function () { return S.db.put('prefs', 'setup', setup); }).then(function () {
      S.setup = setup;
      S.status = { state: 'idle', lastSyncAt: null, issues: { errors: 0, warnings: 0 } };   // drop the stale "setup needed" banner
      BT.store.requestPersistence();
      if (/^#?\/?(today)?$/.test(location.hash)) render(); else location.hash = '#/today';   // hashchange renders
      S.sync.sync('setup');
    }).catch(function (e) { S.setupError = 'Couldn\'t save the code on this phone: ' + (e && e.message || e); render(); });
  }

  // ---------- checklist changes (through the outbox) ----------
  function change(type, id, fields) {
    if (!S.sync) return Promise.resolve(null);
    return S.sync.enqueue(type, id, fields).catch(function (e) {
      S.saveError = 'This phone couldn\'t store it (' + (e && e.message || e) + '). Free some space and try again.';
      render();
      return null;
    });
  }
  function findCheck(id) { return S.vm.checklists.filter(function (c) { return c.id === id; })[0]; }
  function toggleCheck(id, rowEl) {
    var c = findCheck(id);
    if (!c) return;
    var fields = { done: !c.done };
    if (!c.done) fields.doneBy = S.owner || '';
    // Ticking: the ticker's face pops up from the box; the last open item of a list gets the big one.
    var l = c.done ? null : BT.model.listByName(S.vm, c.list, BT.ui.lists.today(S.vm));
    var finishing = l && l.items.length > 1 && l.done === l.items.length - 1;
    change('checklist.update', id, fields).then(function (op) {
      if (!op || c.done) return;
      if (finishing) { BT.ui.cheer.listDone(l.name); return; }
      // Measured after the redraw: a new banner can push the row down.
      var box = document.querySelector('.check[data-id="' + CSS.escape(id) + '"] .box') || (rowEl && rowEl.querySelector('.box'));
      if (box && box.isConnected) BT.ui.cheer.pop(S.owner, box.getBoundingClientRect());
    });
  }
  function addCheck(form) {
    var name = form.getAttribute('data-list');
    // namedItem: on a form's elements list, .item is the built-in item() method, not the field (ship-check 2026-10-21).
    var item = (form.elements.namedItem('item').value || '').trim();
    if (!item) return;
    var l = BT.model.listByName(S.vm, name, BT.ui.lists.today(S.vm));
    var fields = { list: name, item: item, owner: 'Both', sort: BT.model.nextSort(l ? l.items : []) };
    fields.bag = form.elements.bag ? form.elements.bag.value || '—' : '—';
    change('checklist.add', BT.sync.newId('ck_'), fields).then(function (op) {
      if (!op) return;
      render();                                // the outbox redraw skips while the field has focus
      var input = document.querySelector('form[data-action="add-check"] input[name="item"]');
      if (input) input.focus();                // keep adding without reaching for the field again
    });
  }
  function saveCheck(form) {
    var id = form.getAttribute('data-id');
    var c = findCheck(id);
    if (!c) {
      // Deleted on the other phone while this form was open (the form isn't redrawn by a sync).
      S.saveError = 'This item was deleted from the list (on the other phone or in the sheet), so the change wasn\'t saved.';
      location.hash = '#/lists';
      return;
    }
    var fields = {};
    ['item', 'owner', 'bag', 'due', 'notes'].forEach(function (k) {
      var el = form.elements.namedItem(k);
      if (!el) return;
      var v = el.value;
      var orig = el.getAttribute('data-orig');
      if (orig === null) orig = c[k] || '';
      if (k === 'item') { v = v.trim(); orig = orig.trim(); }
      if (k === 'bag') { v = v || '—'; orig = orig || '—'; }
      if (k === 'item' && !v) return;
      if (v !== orig) fields[k] = v;
    });
    var back = '#/list/' + encodeURIComponent(c.list);
    if (!Object.keys(fields).length) { location.hash = back; return; }
    change('checklist.update', id, fields).then(function (op) { if (op) location.hash = back; });
  }

  // ---------- expenses (HANDOFF §8.4; through the outbox) ----------
  function findExpense(id) { return S.vm.expenses.filter(function (e) { return e.id === id; })[0]; }
  function expenseValues(form) {
    // namedItem: a radio group comes back as a RadioNodeList whose .value is the checked one.
    function val(k) { var el = form.elements.namedItem(k); return el ? String(el.value || '') : ''; }
    var tf = form.elements.namedItem('taxFree');
    return { amount: val('amount'), currency: val('currency'), category: val('category'), envelope: val('envelope'),
      method: val('method'), paidBy: val('paidBy'), tripDate: val('tripDate'), note: val('note').trim(),
      taxFree: tf && tf.checked ? 'TRUE' : 'FALSE', refundStatus: val('refundStatus') || 'n/a' };
  }
  function formError(form, msg, field) {
    var p = form.querySelector('[data-error]');
    if (p) { p.textContent = msg; p.hidden = false; }
    var el = field && form.elements.namedItem(field);
    if (el && el.focus) el.focus();
  }
  // Category picks the envelope; Shopping shows the tax-free toggle; Suica shows the tip.
  function syncExpenseForm(form, changed) {
    var env = form.elements.namedItem('envelope');
    if (changed === 'category') env.value = BT.budget.envelopeFor(form.elements.namedItem('category').value);
    var shop = env.value === 'Shopping' && form.elements.namedItem('category').value !== 'Tax refund';
    var tf = form.querySelector('[data-taxfree]'); if (tf) tf.hidden = !shop;
    var tip = form.querySelector('[data-suica-tip]'); if (tip) tip.hidden = form.elements.namedItem('method').value !== 'Suica';
    var refund = form.querySelector('[data-refund]'), box = form.elements.namedItem('taxFree');
    if (refund && form.getAttribute('data-id')) refund.hidden = !(box && box.checked);
    var cur = form.querySelector('[data-cur]'); if (cur) cur.textContent = form.elements.namedItem('currency').value === 'USD' ? '$' : '¥';
  }
  function typedExpense(v) {
    var shop = v.envelope === 'Shopping' && v.category !== 'Tax refund', tf = shop && v.taxFree === 'TRUE';
    return { amount: BT.budget.parseAmount(v.amount), currency: v.currency, category: v.category, envelope: v.envelope,
      method: v.method, paidBy: v.paidBy, tripDate: v.tripDate, note: String(v.note || '').trim(), taxFree: tf,
      refundStatus: tf ? (v.refundStatus === 'n/a' ? 'Pending' : v.refundStatus) : 'n/a' };
  }
  function saveExpense(form) {
    var id = form.getAttribute('data-id');
    var e = id ? findExpense(id) : null;
    if (id && !e) {
      S.saveError = 'This expense was deleted (on the other phone or in the sheet), so the change wasn\'t saved.';
      location.hash = '#/budget';
      return;
    }
    var v = expenseValues(form), f = typedExpense(v);
    if (f.amount === null) { formError(form, 'Type the amount as a whole number above zero.', 'amount'); return; }
    if (BT.budget.CATEGORIES.indexOf(f.category) < 0) { formError(form, 'Pick a category.'); return; }
    // Method may stay blank on a row typed into the sheet; the script doesn't require it.
    if (BT.budget.ENVELOPES.indexOf(f.envelope) < 0 || (f.method && BT.budget.METHODS.indexOf(f.method) < 0) || BT.budget.CURRENCIES.indexOf(f.currency) < 0) {
      formError(form, 'Pick an envelope, a currency and how it was paid.'); return;
    }
    if (!T.isIsoDate(f.tripDate)) { formError(form, 'Pick the date it was spent.', 'tripDate'); return; }
    var fields = {};
    if (e) {
      var o = typedExpense(JSON.parse(form.getAttribute('data-orig') || '{}'));
      Object.keys(f).forEach(function (k) { if (f[k] !== o[k]) fields[k] = f[k]; });
      if (fields.paidBy === '') delete fields.paidBy;    // a name the form can't show (sheet typo) is left alone
      if (!Object.keys(fields).length) { location.hash = '#/budget'; return; }
    } else {
      fields = f;
      fields.createdAt = T.now().toISOString();
    }
    // EC-50: a large amount asks first (when it's new or the amount changed).
    if ('amount' in fields || 'currency' in fields) {
      var r = BT.ui.budget.rateFor(S), jpy = BT.budget.jpyOf(f, r);
      if (jpy !== null && jpy >= S.vm.settings.largeAmountConfirm) {
        var other = f.currency === 'USD' ? '≈ ' + BT.budget.yen(jpy) : BT.budget.usdOf(jpy, r) === null ? '' : '≈ ' + BT.budget.usd(BT.budget.usdOf(jpy, r));
        if (!confirm('Confirm ' + BT.budget.money(f) + (other ? ' (' + other + ')' : '') + '?')) return;
      }
    }
    S.prefill = null;
    change('expense.upsert', id || BT.sync.newId('ex_'), fields).then(function (op) { if (op) location.hash = '#/budget'; });
  }
  function exportCsv() {
    var r = BT.ui.budget.rateFor(S);
    var name = 'brillo-expenses-' + BT.ui.budget.today() + '.csv';
    var text = BT.budget.csv(S.vm.expenses, r);
    var file = null;
    try { file = new File([text], name, { type: 'text/csv' }); } catch (e) { /* older browsers: download below */ }
    // AC-B7: the iOS share sheet (Save to Files, Mail, AirDrop).
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Brillo expenses' }).catch(function () { /* cancelled */ });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  // ---------- Nearby: location and ideas (HANDOFF §8.5; through the outbox) ----------
  // Location is asked only on Nearby (EC-35): opening the screen, "Use my location",
  // or "I'm here". A denial isn't asked again until the person taps the button.
  function locate(force, done) {
    var st = BT.ui.nearby.state(S);
    var settled = false, guard = null;
    function redraw() { if (route().name === 'nearby') { typing() ? deferRender() : nearbyRender(); } }
    function finish(pos) {
      if (settled) return;
      settled = true; clearTimeout(guard);
      if (done) done(pos);
      redraw();
    }
    if (!('geolocation' in navigator)) { st.geo = 'unavailable'; finish(null); return; }
    if (!force && st.pos && Date.now() - st.posAt < 60000) { if (done) done(st.pos); return; }
    if (!force && !done && (st.geo === 'denied' || st.geo === 'asking')) return;
    st.geo = 'asking';
    // iOS may never answer while its permission prompt is ignored or the app is in the
    // background: give up after 10 s so the screen and "I'm here" never hang.
    guard = setTimeout(function () { if (st.geo === 'asking') st.geo = 'timeout'; finish(null); }, BT.config.geoGiveUpMs);
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        st.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        st.posAt = Date.now(); st.geo = 'ok';
        if (settled) redraw(); else finish(st.pos);   // a late fix still updates the list
      }, function (e) {
        if (settled) return;
        st.geo = e && e.code === 1 ? 'denied' : e && e.code === 3 ? 'timeout' : 'unavailable';
        finish(null);
      }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    } catch (e) { st.geo = 'unavailable'; finish(null); }
  }
  // Nearby redraws keep whatever is typed in "Add an idea" (a filter tap, Done on another
  // card or a location answer must never empty the form).
  function ideaDraft() {
    var f = document.querySelector('form[data-action="add-idea"]');
    if (!f) return null;
    var d = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
      else if (el.type === 'checkbox') d[el.name] = el.checked;
      else d[el.name] = el.value;
    });
    return d;
  }
  function restoreIdeaDraft(d) {
    var f = d && document.querySelector('form[data-action="add-idea"]');
    if (!f) return;
    Object.keys(d).forEach(function (k) {
      var el = f.elements.namedItem(k);
      if (!el) return;
      if (!el.tagName) Array.prototype.forEach.call(el, function (r) { r.checked = r.value === d[k]; });   // a radio group
      else if (el.type === 'checkbox') el.checked = d[k];
      else el.value = d[k];
    });
  }
  function nearbyRender() { var d = ideaDraft(); render(); restoreIdeaDraft(d); }
  function findIdea(id) { return S.vm.ideas.filter(function (i) { return i.id === id; })[0]; }
  function setIdeaStatus(id, status) {
    var i = findIdea(id);
    if (!i || i.status === status) return;
    var fields = { status: status };
    if (status === 'Idea' && i.plannedDate) fields.plannedDate = '';   // "Put back" forgets the day
    change('idea.update', id, fields).then(function (op) { if (op) nearbyRender(); });
  }
  function planIdea(form) {
    var id = form.getAttribute('data-id'), i = findIdea(id);
    var st = BT.ui.nearby.state(S);
    if (!i) { st.plan = null; render(); return; }
    var el = form.elements.namedItem('day');
    var day = el ? el.value : '';
    if (!T.isIsoDate(day)) return;
    // Save sends only what changed against what the form showed (data-orig).
    var orig = el.getAttribute('data-orig');
    if (orig === null) orig = i.plannedDate || '';
    var fields = {};
    if (i.status !== 'Planned') fields.status = 'Planned';
    if (day !== orig) fields.plannedDate = day;
    st.plan = null;
    if (!Object.keys(fields).length) { nearbyRender(); return; }
    change('idea.update', id, fields).then(function () { nearbyRender(); });
  }
  function addIdea(form) {
    if (form.hasAttribute('data-busy')) return;          // a second tap while it saves or locates
    function val(k) { var el = form.elements.namedItem(k); return el ? String(el.value || '').trim() : ''; }
    var name = val('nameEn');
    if (!name) { formError(form, 'Type a name for the idea.', 'nameEn'); return; }
    var fields = { nameEn: name, category: val('category') || 'Other', status: 'Idea' };
    if (val('city')) fields.city = val('city');
    if (val('why')) fields.why = val('why');
    if (S.owner === 'Jordan' || S.owner === 'Lindsay') { fields.source = S.owner; fields.addedBy = S.owner; }
    var here = form.elements.namedItem('here'), wantHere = !!(here && here.checked);
    var btn = form.querySelector('button[type="submit"]');
    form.setAttribute('data-busy', '');
    if (btn) { btn.disabled = true; btn.textContent = wantHere ? 'Finding where you are…' : 'Saving…'; }
    function save(pos) {
      if (pos) { fields.lat = Math.round(pos.lat * 1e6) / 1e6; fields.lng = Math.round(pos.lng * 1e6) / 1e6; }
      change('idea.add', BT.sync.newId('id_'), fields).then(function (op) {
        var st = BT.ui.nearby.state(S);
        if (!op) { form.removeAttribute('data-busy'); if (btn) { btn.disabled = false; btn.textContent = 'Save idea'; } return; }
        st.adding = false;
        st.notice = wantHere && !pos ? 'Saved. The phone didn\'t share where you are, so this idea has no map point yet.' : null;
        nearbyRender();
      });
    }
    if (wantHere) locate(false, save); else save(null);
  }

  function onSubmit(ev) {
    var form = ev.target;
    var a = form.getAttribute && form.getAttribute('data-action');
    if (a === 'add-check') { ev.preventDefault(); addCheck(form); }
    else if (a === 'save-check') { ev.preventDefault(); saveCheck(form); }
    else if (a === 'save-expense') { ev.preventDefault(); saveExpense(form); }
    else if (a === 'plan-idea') { ev.preventDefault(); planIdea(form); }
    else if (a === 'add-idea') { ev.preventDefault(); addIdea(form); }
  }

  function onClick(ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
    var a = el.getAttribute('data-action');
    if (a === 'nav') return;                      // a plain link inside a tappable row
    if (a === 'toggle-check') {
      ev.preventDefault();
      toggleCheck(el.getAttribute('data-id'), el.closest('.check'));
    } else if (a === 'pack-view') {
      S.packView = el.getAttribute('data-view') === 'all' ? 'all' : 'bag';
      S.db.put('prefs', 'packView', S.packView).catch(function () {});
      render();
    } else if (a === 'delete-check') {
      if (!confirm('Delete this item from the list on both phones? It stays in the sheet, marked Deleted.')) return;
      var list = el.getAttribute('data-list');
      change('checklist.delete', el.getAttribute('data-id'), {}).then(function (op) { if (op) location.hash = '#/list/' + encodeURIComponent(list); });
    } else if (a === 'delete-expense') {
      if (!confirm('Delete this expense on both phones? It stays in the sheet, marked Deleted.')) return;
      change('expense.delete', el.getAttribute('data-id'), {}).then(function (op) { if (op) location.hash = '#/budget'; });
    } else if (a === 'print') {
      window.print();
    } else if (a === 'export-csv') {
      exportCsv();
    } else if (a === 'calc-log') {
      var price = document.querySelector('[data-action="calc-input"]');
      S.prefill = { amount: price ? BT.budget.parseAmount(price.value) || '' : '' };
      location.hash = '#/expense/new';
    } else if (a === 'retry-op') {
      S.sync.retry(el.getAttribute('data-op'));
    } else if (a === 'discard-op') {
      if (!confirm('Discard this change? It never reaches the sheet.')) return;
      S.sync.discard(el.getAttribute('data-op'));
    } else if (a === 'dismiss-save-error') {
      S.saveError = null; render();
    } else if (/^(nearby-|idea-|quick-)/.test(a)) {
      nearbyAction(a, el);
    } else if (a === 'phrase-jump') {
      var group = overlay.querySelector('[data-phrase-group="' + CSS.escape(el.getAttribute('data-cat') || '') + '"]');
      var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (group) group.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
    } else if (a === 'say') {
      BT.ui.cards.say(S, el.getAttribute('data-id'));
    } else if (a === 'cards') {
      ev.preventDefault();
      S.sheet = { card: el.getAttribute('data-card') || 'allergy', id: el.getAttribute('data-id'), kind: el.getAttribute('data-kind') };
      renderSheet();
      overlay.scrollTop = 0;
    } else if (a === 'close-sheet') {
      S.sheet = null; renderSheet();
    } else if (a === 'sync-now') {
      S.sync.sync('button');
    } else if (a === 'apply-update') {
      if (S.update && S.update.worker) { S.updating = true; S.update.worker.postMessage({ type: 'skipWaiting' }); }
    } else if (a === 'check-update') {
      checkForUpdate();
    } else if (a === 'simulate-clear') {
      S.db.del('prefs', 'simulate').then(function () { applySimulation(null); render(); }, render);
    } else if (a === 'tap-debug') {
      try { localStorage.setItem('brillo.tapdebug', S.tapDebug ? '' : '1'); } catch (e) { /* ignore */ }
      location.reload();
    } else if (a === 'reset-local') {
      if (!confirm('Erase everything this app saved on this phone, including the setup code? The sheet is not touched.')) return;
      S.db.close();
      BT.store.deleteDb(S.env).then(function () {
        BT.store.clearActiveEnv();
        location.hash = '#/today'; location.reload();
      });
    }
  }

  function nearbyAction(a, el) {
    var st = BT.ui.nearby.state(S), id = el.getAttribute('data-id');
    if (a === 'nearby-locate') { locate(true); nearbyRender(); return; }
    if (a === 'nearby-cat') st.cat = el.getAttribute('data-cat') || 'All';
    else if (a === 'nearby-all') st.all = !st.all;
    else if (a === 'nearby-hidden') st.hidden = !st.hidden;
    else if (a === 'quick-sushi') st.sushi = !st.sushi;
    else if (a === 'idea-plan') st.plan = id;
    else if (a === 'idea-plan-cancel') st.plan = null;
    else if (a === 'idea-add') st.adding = true;
    else if (a === 'idea-add-cancel') st.adding = false;
    else if (a === 'idea-status') { setIdeaStatus(id, el.getAttribute('data-status')); return; }
    if (a !== 'idea-add-cancel') st.notice = null;
    nearbyRender();
    if (a === 'idea-add') { var n = document.querySelector('form[data-action="add-idea"] input[name="nameEn"]'); if (n) n.focus(); }
  }

  function onInput(ev) {
    var el = ev.target;
    var a = el.getAttribute && el.getAttribute('data-action');
    if (a === 'paste-setup') {
      var v = el.value; el.value = '';           // the code never stays on screen
      if (v.trim()) savePasted(v);
    } else if (a === 'calc-input') {
      var out = document.querySelector('[data-calc-out]');
      if (out) out.innerHTML = D.str(BT.ui.budget.calcResult(S, el.value));
    }
  }

  function onChange(ev) {
    var el = ev.target;
    var a = el.getAttribute && el.getAttribute('data-action');
    var ef = el.form && el.form.getAttribute('data-action') === 'save-expense' ? el.form : null;
    if (ef) { syncExpenseForm(ef, el.name); return; }
    if (a === 'set-owner') {
      S.owner = el.value || null;
      S.db.put('prefs', 'owner', S.owner).then(render, render);
    } else if (a === 'simulate-set' && el.value) {
      var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(el.value);
      if (!m) return;
      var at = T.zonedToInstant(m[1], m[2], BT.config.tripTz);
      var sim = { offsetMs: at.getTime() - Date.now(), inputValue: m[1] + 'T' + m[2], label: T.fmtDay(m[1]) + ' ' + T.fmtClock(m[2]) };
      S.db.put('prefs', 'simulate', sim).then(function () { applySimulation(sim); render(); });
    }
  }

  // ---------- service worker and updates (never auto-applied; HANDOFF §7) ----------
  var reg = null;
  function watchWorker(w) {
    if (!w) return;
    function ready() {
      if (w.state !== 'installed' || !navigator.serviceWorker.controller) return;
      var ch = new MessageChannel();
      ch.port1.onmessage = function (e) { S.update = { worker: w, version: e.data && e.data.version }; render(); };
      w.postMessage({ type: 'version' }, [ch.port2]);
      S.update = S.update || { worker: w, version: null };
      render();
    }
    if (w.state === 'installed') ready(); else w.addEventListener('statechange', ready);
  }
  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (r) {
      reg = r;
      if (r.waiting) watchWorker(r.waiting);
      r.addEventListener('updatefound', function () { watchWorker(r.installing); });
    }).catch(function () { /* the app still works online; offline open needs the worker */ });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (S.updating) location.reload(); });
  }
  function checkForUpdate() {
    if (!reg) { S.updateNote = 'Updates aren\'t available here.'; render(); return; }
    S.updateNote = 'Checking…'; render();
    reg.update().then(function () {
      S.updateNote = reg.waiting || reg.installing ? 'A new version is downloading. An Update button appears when it\'s ready.' : 'You have the latest version.';
      if (reg.waiting) watchWorker(reg.waiting);
      render();
    }).catch(function () { S.updateNote = 'Couldn\'t check. Are you offline?'; render(); });
  }

  // ---------- sync triggers (HANDOFF §7) ----------
  var timer = null;
  function startTriggers() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (!holdRender()) render(); S.sync.sync('foreground');   // EC-04: re-derive "today" (an open edit form keeps its text)
        if (route().name === 'nearby' && S.setup) locate(false);   // back from Maps a few blocks on: re-measure (a fix under 60 s is kept)
      }
      else S.sync.stopRetry();
    });
    window.addEventListener('online', function () { S.sync.sync('online'); });
    timer = setInterval(function () {
      if (document.visibilityState === 'visible') { S.sync.sync('timer'); }
    }, BT.config.autoSyncMs);
    // Keep Now/Next current; never while someone is typing on the setup screen.
    setInterval(function () {
      if (document.visibilityState === 'visible' && !S.sheet && S.setup && route().name === 'today' &&
          !typing()) render();
    }, 60000);
  }

  // ---------- tap debug (staging only; Developer settings) ----------
  // Shows on screen what each tap hits and what gets focus, to diagnose phone-only input bugs.
  var dbgLog = [], dbgPanel = null;
  function dbgDesc(el) {
    if (!el || !el.tagName) return String(el);
    var cs = getComputedStyle(el);
    return el.tagName.toLowerCase() + (el.name ? '[' + el.name + ']' : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : '') +
      (cs.pointerEvents !== 'auto' ? ' pe:' + cs.pointerEvents : '') + (el.disabled ? ' disabled' : '') + (el.readOnly ? ' ro' : '');
  }
  function dbg(msg) {
    if (!S.tapDebug) return;
    dbgLog.push(new Date().toISOString().slice(17, 22) + ' ' + msg);
    dbgLog = dbgLog.slice(-12);
    if (!dbgPanel) { dbgPanel = document.createElement('pre'); dbgPanel.className = 'tap-debug'; document.body.appendChild(dbgPanel); }
    dbgPanel.textContent = dbgLog.join('\n');
  }
  function startTapDebug() {
    ['touchstart', 'touchend', 'mousedown', 'click', 'focusin', 'focusout'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        var extra = '';
        var t = e.changedTouches && e.changedTouches[0];
        if (t) extra = ' @' + Math.round(t.clientX) + ',' + Math.round(t.clientY) + ' top=' + dbgDesc(document.elementFromPoint(t.clientX, t.clientY));
        dbg(type + ' ' + dbgDesc(e.target) + extra + (e.defaultPrevented ? ' PREVENTED' : ''));
        if (type === 'touchend') setTimeout(function () { dbg('active=' + dbgDesc(document.activeElement)); }, 350);
      }, true);
    });
  }

  // ---------- boot ----------
  function boot() {
    root = document.getElementById('app');
    overlay = document.getElementById('sheet');
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('focusout', function () { setTimeout(flushDeferred, 0); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { S.sheet = null; renderSheet(); } });
    // Voices load after the page on iOS: redraw an open phrase card so Play appears (AC-C3).
    try {
      if ('speechSynthesis' in window && window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener('voiceschanged', function () { if (S.sheet) renderSheet(); });
      }
    } catch (e) { /* no speech: Play stays hidden */ }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) { S.sheet = null; renderSheet(); } });
    var enterTimer = null;
    window.addEventListener('hashchange', function () {
      S.sheet = null;
      if (route().name !== 'expense') S.prefill = null;
      if (S.nearby) { S.nearby.plan = null; S.nearby.adding = false; S.nearby.sushi = false; S.nearby.notice = null; }
      root.setAttribute('data-enter', '');      // screen entrance plays on route changes only (DESIGN §8)
      render(); window.scrollTo(0, 0);
      if (route().name === 'nearby' && S.setup) locate(false);
      clearTimeout(enterTimer);
      enterTimer = setTimeout(function () { root.removeAttribute('data-enter'); }, 400);
    });

    try { S.tapDebug = BT.store.envFromPath(location.pathname) === 'staging' && localStorage.getItem('brillo.tapdebug') === '1'; } catch (e) { S.tapDebug = false; }
    if (S.tapDebug) startTapDebug();
    openDb(BT.store.activeEnv()).catch(function (e) {
      S.storageError = e; S.env = BT.store.activeEnv();
    }).then(function () {
      render();
      if (route().name === 'nearby' && S.setup) locate(false);
      registerWorker();
      if (S.sync) { S.sync.sync('open'); startTriggers(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
