/* Phase 2 write path on the phone (HANDOFF §7, §12 L1 sync.js): outbox, push then
   pull, never dropping ops, Sync issues, the incompatible-state guard, the
   held state for an old script, and the optimistic model. */
suite('outbox', function () {
  var SETUP = { env: 'staging', apiUrl: 'https://script.google.com/macros/s/AKfakeFAKE/exec', token: 'x'.repeat(40), device: 'test' };

  function memStore() {
    var d = { snapshot: {}, outbox: {}, prefs: {}, meta: {} };
    function copy(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
    return {
      d: d,
      get: function (s, k) { return Promise.resolve(copy(d[s][k])); },
      put: function (s, k, v) { d[s][k] = copy(v); return Promise.resolve(); },
      del: function (s, k) { delete d[s][k]; return Promise.resolve(); },
      all: function (s) { return Promise.resolve(Object.keys(d[s]).map(function (k) { return copy(d[s][k]); })); }
    };
  }
  function snapshotReply(over) {
    var p = BT.parse.snapshot(FIXTURES.sheet());
    return Object.assign({ ok: true, api: 1, serverVersion: '0.2.0', env: 'staging', rev: 'r1', generatedAt: '2026-10-20T00:00:00Z', data: p.data, issues: p.issues }, over || {});
  }
  // A fake script: answers snapshot and mutate, records every call.
  function fakeScript(opts) {
    opts = opts || {};
    var calls = [];
    var fn = function (url, o) {
      var body = JSON.parse(o.body);
      calls.push(body);
      var res;
      if (opts.offline && opts.offline(body, calls)) return Promise.reject(new TypeError('offline'));
      if (body.action === 'snapshot') res = (opts.snapshot || snapshotReply)(calls);
      else if (body.action === 'mutate') {
        res = opts.mutate ? opts.mutate(body, calls) : { ok: true, api: 1, results: body.ops.map(function (op) { return { opId: op.opId, status: 'applied' }; }) };
      } else res = { ok: false, api: 1, code: 'BAD_REQUEST' };
      return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(res)); } });
    };
    fn.calls = calls;
    fn.actions = function () { return calls.map(function (c) { return c.action; }); };
    return fn;
  }
  function withFetch(fn, body) {
    var saved = BT.api.fetch;
    BT.api.fetch = fn;
    return Promise.resolve().then(body).then(function (v) { BT.api.fetch = saved; return v; }, function (e) { BT.api.fetch = saved; throw e; });
  }
  var clock = Date.parse('2026-10-20T10:00:00Z');
  function makeSync(store, opts) {
    var scheduled = [];
    var s = BT.sync.create(Object.assign({
      store: store, getSetup: function () { return SETUP; },
      now: function () { return new Date(clock); },
      schedule: function (fn, ms) { scheduled.push(ms); return scheduled.length; }, cancel: function () {}
    }, opts || {}));
    s.scheduled = scheduled;
    return s;
  }
  function ready(store, opts) { var s = makeSync(store, opts); return s.load().then(function () { return s; }); }
  function tick(s, id, done) { return s.enqueue('checklist.update', id || 'ck_1', { done: done !== false }); }

  test('enqueue saves the op on the phone before anything is sent', function () {
    var store = memStore();
    return ready(store).then(function (s) {
      return tick(s).then(function (op) {
        ok(/^op_[a-z0-9]+$/.test(op.opId), op.opId);
        eq(op.status, 'pending');
        eq(op.clientUpdatedAt, new Date(clock).toISOString());
        eq(store.d.outbox[op.opId].type, 'checklist.update');
        eq(s.status().pending, 1);
        eq(BT.sync.describe(s.status()).text, '1 change waiting');
        deepEq(s.scheduled, [BT.config.pushDebounceMs], 'a sync is scheduled 2 s after the change');
      });
    });
  });

  test('two changes in the same millisecond still get increasing clientUpdatedAt', function () {
    return ready(memStore()).then(function (s) {
      return tick(s).then(function (a) { return tick(s, 'ck_1', false).then(function (b) {
        ok(Date.parse(b.clientUpdatedAt) > Date.parse(a.clientUpdatedAt));
        ok(b.seq > a.seq);
      }); });
    });
  });

  test('push, then pull: applied ops leave the outbox and the snapshot is stored', function () {
    var store = memStore(), script = fakeScript();
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { return s.sync(); }).then(function () {
          deepEq(script.actions(), ['mutate', 'snapshot']);
          eq(script.calls[0].ops.length, 1);
          deepEq(Object.keys(script.calls[0].ops[0]).sort(), ['clientUpdatedAt', 'fields', 'id', 'opId', 'type']);
          deepEq(Object.keys(store.d.outbox), []);
          eq(s.status().state, 'synced');
          eq(store.d.snapshot.current.rev, 'r1');
        });
      });
    });
  });

  test('duplicate and stale also settle an op; rejected moves it to Sync issues, never dropped', function () {
    var store = memStore();
    var answers = ['duplicate', 'stale', 'rejected'];
    var script = fakeScript({ mutate: function (body) {
      return { ok: true, api: 1, results: body.ops.map(function (op, i) { return { opId: op.opId, status: answers[i], reason: i === 2 ? 'Not found in the sheet' : '' }; }) };
    } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s, 'ck_1').then(function () { return tick(s, 'ck_2'); }).then(function () { return tick(s, 'ck_3'); })
          .then(function () { return s.sync(); }).then(function () {
            var left = Object.keys(store.d.outbox).map(function (k) { return store.d.outbox[k]; });
            eq(left.length, 1);
            eq(left[0].id, 'ck_3');
            eq(left[0].status, 'rejected');
            eq(left[0].reason, 'Not found in the sheet');
            eq(s.status().rejected, 1);
            eq(s.status().pending, 0);
            eq(BT.sync.describe(s.status()).text, '1 sync issue');
            return s.sync();
          }).then(function () {
            deepEq(script.actions(), ['mutate', 'snapshot', 'snapshot'], 'a rejected op is not resent on its own');
          });
      });
    });
  });

  test('Sync issues: retry sends the same op again; discard removes it', function () {
    var store = memStore(), first = true;
    var script = fakeScript({ mutate: function (body) {
      var st = first ? 'rejected' : 'applied'; first = false;
      return { ok: true, api: 1, results: body.ops.map(function (op) { return { opId: op.opId, status: st, reason: 'x' }; }) };
    } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        var opId;
        return tick(s).then(function (op) { opId = op.opId; return s.sync(); }).then(function () {
          eq(s.status().rejected, 1);
          return s.retry(opId);
        }).then(function () {
          eq(script.calls.filter(function (c) { return c.action === 'mutate'; })[1].ops[0].opId, opId, 'same opId on retry');
          deepEq(Object.keys(store.d.outbox), []);
          return tick(s, 'ck_9');
        }).then(function (op) {
          first = true;
          return s.sync().then(function () { return s.discard(op.opId); });
        }).then(function () {
          deepEq(Object.keys(store.d.outbox), []);
          eq(s.status().rejected, 0);
        });
      });
    });
  });

  test('a change discarded while its push is in flight is not brought back by a rejection', function () {
    var store = memStore(), s, release;
    var script = fakeScript({ mutate: function (body) {
      return { ok: true, api: 1, results: body.ops.map(function (op) { return { opId: op.opId, status: 'rejected', reason: 'x' }; }) };
    } });
    var slow = function (u, o) { var b = JSON.parse(o.body); if (b.action !== 'mutate') return script(u, o); return new Promise(function (r) { release = function () { r(script(u, o)); }; }); };
    return withFetch(slow, function () {
      return ready(store).then(function (x) { s = x; return tick(s); }).then(function (op) {
        var p = s.sync();
        function started() { return release ? Promise.resolve() : new Promise(function (r) { setTimeout(r, 5); }).then(started); }
        return started().then(function () { return s.discard(op.opId); }).then(function () { release(); return p; });
      }).then(function () {
        deepEq(Object.keys(store.d.outbox), [], 'stays discarded');
        eq(s.status().rejected, 0);
      });
    });
  });

  test('an op the script didn\'t answer (or answered oddly) stays queued; no endless loop', function () {
    var store = memStore();
    var script = fakeScript({ mutate: function (body) {
      return { ok: true, api: 1, results: [{ opId: body.ops[0].opId, status: 'weird' }] };
    } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s, 'ck_1').then(function () { return tick(s, 'ck_2'); }).then(function () { return s.sync(); }).then(function () {
          eq(Object.keys(store.d.outbox).length, 2);
          eq(script.actions().filter(function (a) { return a === 'mutate'; }).length, 1);
        });
      });
    });
  });

  test('EC-20/24 offline or captive portal during push: ops kept, offline line, backoff', function () {
    var store = memStore();
    var script = fakeScript({ offline: function (body) { return body.action === 'mutate'; } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { s.scheduled.length = 0; return s.sync(); }).then(function () {
          eq(Object.keys(store.d.outbox).length, 1);
          eq(s.status().state, 'offline');
          deepEq(s.scheduled, [2000]);
          eq(BT.sync.describe(s.status()).text, 'Offline · 1 change saved on this phone');
        });
      });
    });
  });

  test('EC-25: quota or internal script error during push: ops kept, "Couldn\'t sync · will retry", retry scheduled', function () {
    var store = memStore();
    var script = fakeScript({ mutate: function () { return { ok: false, api: 1, code: 'INTERNAL', message: 'Service invoked too many times' }; } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { s.scheduled.length = 0; return s.sync(); }).then(function () {
          eq(Object.keys(store.d.outbox).length, 1);
          eq(s.status().state, 'problem');
          eq(BT.sync.describe(s.status()).text, 'Couldn\'t sync · will retry');
          deepEq(s.scheduled, [2000], 'retry on the normal backoff');
        });
      });
    });
  });

  test('an old script without mutate (BAD_REQUEST) keeps the ops and says it couldn\'t sync', function () {
    var store = memStore();
    var script = fakeScript({ snapshot: function () { return snapshotReply(); }, mutate: function () { return { ok: false, api: 1, code: 'BAD_REQUEST', message: 'Unknown action' }; } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { return s.sync(); }).then(function () {
          eq(Object.keys(store.d.outbox).length, 1);
          eq(s.status().state, 'problem');
        });
      });
    });
  });

  test('reviewer F1: with an old script and no saved snapshot, a failed push still pulls and learns it is held', function () {
    var store = memStore();
    var script = fakeScript({ snapshot: function () { return snapshotReply({ serverVersion: '0.1.4' }); },
      mutate: function () { return { ok: false, api: 1, code: 'BAD_REQUEST', message: 'Unknown action' }; } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { return s.sync(); }).then(function () {
          deepEq(script.actions(), ['mutate', 'snapshot'], 'pulled after the failed push');
          eq(store.d.snapshot.current.serverVersion, '0.1.4', 'fresh plan stored');
          ok(s.status().held, 'held');
          eq(s.status().state, 'synced');
          eq(Object.keys(store.d.outbox).length, 1, 'op kept');
          return s.sync();
        }).then(function () {
          deepEq(script.actions().slice(2), ['snapshot'], 'no more mutate attempts while held');
        });
      });
    });
  });

  test('a saved snapshot from an old script starts the app held: the first sync asks before pushing', function () {
    var store = memStore();
    store.d.snapshot.current = { rev: 'old', serverVersion: '0.1.0', data: {} };
    var script = fakeScript();
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        ok(s.status().held, 'held from the saved snapshot');
        return tick(s).then(function () { return s.sync(); }).then(function () {
          deepEq(script.actions(), ['snapshot', 'mutate', 'snapshot'], 'the script is 0.2.0 now: check, push, pull');
        });
      });
    });
  });

  test('reviewer F2: an applied change stays drawn until the next snapshot, even when that pull fails', function () {
    var store = memStore();
    var script = fakeScript({ offline: function (body) { return body.action === 'snapshot'; } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s, 'ck_1').then(function () { return s.sync(); }).then(function () {
          deepEq(Object.keys(store.d.outbox), [], 'sent');
          eq(s.status().state, 'offline', 'the pull failed');
          var vm = BT.model.build({ data: { checklists: [{ id: 'ck_1', list: 'Pre-trip', item: 'x', done: false }] } }, s.overlay());
          eq(vm.checklists[0].done, true, 'still ticked');
          ok(!vm.checklists[0].pending, 'no longer marked waiting');
          return ready(store);                                     // relaunch before any pull succeeds
        }).then(function (s2) {
          eq(s2.overlay().length, 1, 'kept across a relaunch');
          BT.api.fetch = fakeScript();
          return s2.sync().then(function () { eq(s2.overlay().length, 0, 'cleared once a snapshot lands'); });
        });
      });
    });
  });

  test('reviewer F3: Retry stamps the op with a fresh time (a fixed clock can retry)', function () {
    var store = memStore();
    return ready(store).then(function (s) {
      return tick(s).then(function (op) {
        var o = store.d.outbox[op.opId];
        o.status = 'rejected'; o.reason = 'clock'; o.clientUpdatedAt = '2026-10-25T00:00:00.000Z';
        return ready(store).then(function (s2) {
          clock += 60000;
          return s2.retry(op.opId).then(function () {
            eq(store.d.outbox[op.opId].clientUpdatedAt, new Date(clock).toISOString());
            eq(store.d.outbox[op.opId].status, 'pending');
          });
        });
      });
    });
  });

  test('held: a script older than 0.2.0 gets no push; the snapshot still applies; pushes once updated', function () {
    var store = memStore(), version = '0.1.0';
    var script = fakeScript({ snapshot: function () { return snapshotReply({ serverVersion: version }); } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return s.sync().then(function () {
          ok(s.status().held, 'held message set');
          eq(store.d.meta.compat.state, 'held', 'saved');
          return tick(s);
        }).then(function () { return s.sync(); }).then(function () {
          deepEq(script.actions(), ['snapshot', 'snapshot'], 'no mutate while held');
          eq(Object.keys(store.d.outbox).length, 1);
          ok(/script update needed/.test(BT.sync.describe(s.status()).text));
          version = '0.2.0';
          return s.sync();
        }).then(function () {
          deepEq(script.actions().slice(2), ['snapshot', 'mutate', 'snapshot'], 'checks the script first, then pushes');
          deepEq(Object.keys(store.d.outbox), []);
          eq(store.d.meta.compat, null);
          eq(s.status().held, null);
        });
      });
    });
  });

  test('incompatible guard: no push while the APIs differ, and the state survives a relaunch', function () {
    var store = memStore(), api = 2;
    var script = fakeScript({ snapshot: function () { return snapshotReply({ api: api }); } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { return s.sync(); }).then(function () {
          deepEq(script.actions(), ['mutate', 'snapshot'], 'first contact: the snapshot reveals the mismatch');
          eq(store.d.meta.compat.state, 'incompatible', 'saved');
        });
      }).then(function () {
        // A phone that already saw the mismatch, relaunched with a change queued.
        script.calls.length = 0;
        store.d.meta.compat = { state: 'incompatible', message: 'The sheet\'s script is newer than this app.', serverVersion: '0.9.0' };
        store.d.outbox.op_kept = { opId: 'op_kept', seq: 99, type: 'checklist.update', id: 'ck_1', fields: { done: true }, clientUpdatedAt: '2026-10-20T10:05:00Z', status: 'pending' };
        return ready(store);                                         // relaunch
      }).then(function (s) {
        eq(s.status().state, 'incompatible', 'restored before any network call');
        ok(/newer/.test(s.status().error.message));
        return s.sync().then(function () {
          deepEq(script.actions(), ['snapshot'], 'asked the script, pushed nothing');
          eq(s.status().state, 'incompatible');
          ok(store.d.outbox.op_kept, 'op kept');
          api = 1;
          return s.sync();
        }).then(function () {
          deepEq(script.actions().slice(1), ['snapshot', 'mutate', 'snapshot'], 'matching again: check, push, pull');
          eq(store.d.outbox.op_kept, undefined);
          eq(store.d.meta.compat, null);
          eq(s.status().state, 'synced');
        });
      });
    });
  });

  test('a mutate reply with a different API number trips the guard and keeps the ops', function () {
    var store = memStore();
    var script = fakeScript({ mutate: function () { return { ok: true, api: 2, results: [] }; } });
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        return tick(s).then(function () { return s.sync(); }).then(function () {
          eq(s.status().state, 'incompatible');
          eq(store.d.meta.compat.state, 'incompatible');
          eq(Object.keys(store.d.outbox).length, 1);
        });
      });
    });
  });

  test('batches of 50: 120 queued ops go in three calls, oldest first', function () {
    var store = memStore(), script = fakeScript();
    return withFetch(script, function () {
      return ready(store).then(function (s) {
        var chain = Promise.resolve();
        for (var i = 0; i < 120; i++) (function (i) { chain = chain.then(function () { return tick(s, 'ck_' + i); }); })(i);
        return chain.then(function () { return s.sync(); }).then(function () {
          var m = script.calls.filter(function (c) { return c.action === 'mutate'; });
          deepEq(m.map(function (c) { return c.ops.length; }), [50, 50, 20]);
          eq(m[0].ops[0].id, 'ck_0');
          eq(m[2].ops[19].id, 'ck_119');
          deepEq(Object.keys(store.d.outbox), []);
        });
      });
    });
  });

  test('a change made during a sync gets its own push right after', function () {
    var store = memStore(), s, added = false;
    var script = fakeScript({ mutate: function (body) {
      if (!added) { added = true; s.enqueue('checklist.update', 'ck_late', { done: true }); }
      return { ok: true, api: 1, results: body.ops.map(function (op) { return { opId: op.opId, status: 'applied' }; }) };
    } });
    return withFetch(script, function () {
      return ready(store).then(function (x) { s = x; return tick(s); }).then(function () { return s.sync(); })
        .then(function () { return new Promise(function (r) { setTimeout(r, 20); }); })
        .then(function () { return s.sync(); })
        .then(function () { deepEq(Object.keys(store.d.outbox), [], 'the late change was pushed too'); });
    });
  });

  test('EC-31: queued ops are still there after the app restarts', function () {
    var store = memStore();
    return ready(store).then(function (s) { return tick(s); }).then(function () { return ready(store); }).then(function (s2) {
      eq(s2.queue().length, 1);
      eq(s2.status().pending, 1);
    });
  });

  test('EC-31 (real IndexedDB): the outbox store returns its ops', function () {
    var opts = { name: 'brillo-test-' + Math.random().toString(36).slice(2) };
    return BT.store.open('test', opts).then(function (db) {
      return db.put('outbox', 'op_a', { opId: 'op_a', seq: 1 }).then(function () { return db.all('outbox'); }).then(function (all) {
        eq(all.length, 1); eq(all[0].opId, 'op_a'); db.close();
      });
    }).then(function () { return BT.store.deleteDb('test', opts); });
  });

  // ---------- optimistic model ----------
  function data() {
    return { checklists: [
      { id: 'ck_1', list: 'Pre-trip', item: 'Book', done: false, due: '2026-10-09', sort: 10 },
      { id: 'ck_2', list: 'Packing', item: 'Passport', bag: 'Jordan backpack', done: true, sort: 20 },
      { id: 'ck_3', list: 'Packing', item: 'Shoes', bag: 'Suitcase', done: false, sort: 30 },
      { id: 'ck_4', list: 'Custom', item: 'x', done: false }
    ], itinerary: [{ id: 'it_1', done: false }] };
  }

  test('model: queued changes show at once, marked pending; rejected ones don\'t', function () {
    var ops = [
      { type: 'checklist.update', id: 'ck_1', fields: { done: true, doneBy: 'Jordan' }, clientUpdatedAt: 't1', status: 'pending' },
      { type: 'checklist.add', id: 'ck_new', fields: { list: 'Packing', item: 'Hat', bag: '—', sort: 40 }, status: 'pending' },
      { type: 'checklist.delete', id: 'ck_4', fields: {}, status: 'pending' },
      { type: 'checklist.update', id: 'ck_3', fields: { done: true }, status: 'rejected' },
      { type: 'itinerary.setDone', id: 'it_1', fields: { done: true }, status: 'pending' }
    ];
    var src = data();
    var vm = BT.model.build({ data: src }, ops);
    var c1 = vm.checklists.filter(function (c) { return c.id === 'ck_1'; })[0];
    eq(c1.done, true); eq(c1.pending, true); eq(c1.doneBy, 'Jordan'); eq(c1.doneAt, 't1');
    ok(vm.checklists.some(function (c) { return c.id === 'ck_new' && c.pending && !c.done; }));
    ok(!vm.checklists.some(function (c) { return c.id === 'ck_4'; }), 'deleted hidden');
    eq(vm.checklists.filter(function (c) { return c.id === 'ck_3'; })[0].done, false, 'rejected not shown');
    eq(vm.itinerary[0].done, true);
    eq(src.checklists[0].done, false, 'the snapshot itself is untouched');
  });

  test('model: lists in a fixed order, progress, overdue (AC-L3), packing by bag (AC-L4)', function () {
    var vm = BT.model.build({ data: data() });
    var ls = BT.model.lists(vm, '2026-10-20');
    deepEq(ls.map(function (l) { return l.name; }), ['Pre-trip', 'Packing', 'Custom']);
    eq(ls[0].overdue, 1);
    eq(ls[1].done, 1);
    var bags = BT.model.byBag(ls[1].items);
    deepEq(bags.map(function (b) { return b.bag + ' ' + b.done + '/' + b.items.length; }), ['Suitcase 0/1', 'Jordan backpack 1/1']);
    eq(BT.model.overduePreTrip(vm, '2026-10-20').length, 1);
    eq(BT.model.overduePreTrip(vm, '2026-10-08').length, 0);
    eq(BT.model.nextSort(ls[1].items), 40);
  });

  test('sync line wording with queued changes', function () {
    eq(BT.sync.describe({ state: 'synced', pending: 3, lastSyncAt: '2026-10-20T00:00:00Z' }).text, '3 changes waiting');
    eq(BT.sync.describe({ state: 'offline', pending: 2 }).text, 'Offline · 2 changes saved on this phone');
    eq(BT.sync.describe({ state: 'synced', rejected: 2 }).text, '2 sync issues');
    eq(BT.sync.describe({ state: 'incompatible', pending: 2 }).text, 'Version mismatch');
  });

  test('new entity IDs: tab prefix + 8 lowercase characters', function () {
    var id = BT.sync.newId('ck_');
    ok(/^ck_[a-z2-9]{8}$/.test(id), id);
    ok(BT.sync.newId('ck_') !== id);
  });
});
