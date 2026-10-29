/* L3 scenarios against the real app (fake data, stubbed API). */
suite('e2e', function () {
  function has(w, re, msg) { ok(re.test(E2E.text(w)), (msg || 'expected ' + re) + '\n---\n' + E2E.text(w).slice(0, 400)); }

  test('first run: setup screen; a bad code is refused in plain words; nothing scrolls sideways', function () {
    return E2E.seed({ setup: false, snapshot: null }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Welcome to Brillo/);
      has(w, /not in Safari/, 'EC-30 hint');
      var ta = w.document.querySelector('textarea[data-action="paste-setup"]');
      ta.value = 'not a code';
      ta.dispatchEvent(new w.Event('input', { bubbles: true }));
      return new Promise(function (r) { setTimeout(r, 80); }).then(function () {
        has(w, /isn't a setup code/);
        eq(ta.value, '', 'the box clears itself');
        E2E.screenChecks(w);
      });
    });
  });

  test('a valid setup code saves, clears the box and drops the "setup needed" banner', function () {
    return E2E.seed({ setup: false, snapshot: null }).then(function () { return E2E.load(); }).then(function (w) {
      var code = btoa(JSON.stringify({ env: 'staging', apiUrl: 'https://script.google.com/macros/s/AKfakeE2E/exec', token: 'e'.repeat(40) }));
      var ta = w.document.querySelector('textarea[data-action="paste-setup"]');
      ta.value = code;
      ta.dispatchEvent(new w.Event('input', { bubbles: true }));
      return new Promise(function (r) { setTimeout(r, 400); }).then(function () {
        ok(!/Welcome to Brillo/.test(E2E.text(w)), 'left the setup screen');
        ok(!/Setup code needed/.test(E2E.text(w)), 'no stale banner');
        ok(!/eeeeeeeeee/.test(w.document.documentElement.outerHTML), 'token never in the page');
      });
    });
  });

  test('AC-T2 / AC-T4: in trip, offline, Nov 20 13:30 JST: Day 2, NOW = midday item, tonight\'s hotel', function () {
    return E2E.seed({ jst: '2026-11-20T13:30', owner: 'Lindsay' }).then(function () { return E2E.load(); }).then(function (w) {
      ok(E2E.renderMs < 1000, 'rendered from storage in ' + Math.round(E2E.renderMs) + ' ms');
      has(w, /Day 2 of 8 · Osaka/);
      has(w, /Good afternoon, Lindsay/);
      var nn = w.document.querySelector('.now-next').innerText;
      ok(/NOW\s+Fake lunch/.test(nn), nn);
      has(w, /Hotel Alpha/);
      has(w, /STAGING/);
      ok(/offline|Not synced|Couldn't sync|Syncing/i.test(w.document.querySelector('[data-sync]').textContent), 'sync pill shows an offline state');
      ok(w.document.querySelector('.app').classList.contains('city-osaka'), 'city color');
      ok(w.document.querySelector('.topbar > .greeting + .dayline'), 'day line sits under the greeting (0.1.4)');
      eq(w.document.querySelector('.topbar .day-badge b').textContent, 'O');
      E2E.screenChecks(w);
    });
  });

  test('AC-T1: phone in Pacific time, Nov 21 08:00 JST shows Nov 21 (Kyoto)', function () {
    return E2E.seed({ jst: '2026-11-21T08:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Day 3 of 8 · Kyoto/);
      has(w, /Fake temple/);
      has(w, /Check out of Hotel Alpha/);
    });
  });

  test('EC-04: reopening the next morning re-derives Today (no stale day); 00:00–02:00 stays on the old day (EC-05)', function () {
    return E2E.seed({ jst: '2026-11-20T23:50' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Day 2 of 8 · Osaka/);
      Object.defineProperty(w.document, 'visibilityState', { value: 'visible', configurable: true });
      function returnAt(time) {
        var at = w.BT.time.zonedToInstant('2026-11-21', time, 'Asia/Tokyo').getTime();
        w.BT.time.setNow(function () { return at; });     // the phone's clock (and maybe its zone) moved on
        w.document.dispatchEvent(new w.Event('visibilitychange'));
        return new Promise(function (r) { setTimeout(r, 80); });
      }
      return returnAt('00:10').then(function () {
        has(w, /Day 2 of 8 · Osaka/, 'just after midnight is still the old trip day');
        return returnAt('07:30');
      }).then(function () {
        has(w, /Day 3 of 8 · Kyoto/);
        ok(!/Day 2 of 8/.test(E2E.text(w)), 'the old day is gone');
      });
    });
  });

  test('after 6 PM: Route home appears with the last-train note', function () {
    return E2E.seed({ jst: '2026-11-21T19:15' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Route home/);
      has(w, /Last trains run around midnight/);
      var a = Array.prototype.filter.call(w.document.querySelectorAll('a.btn'), function (x) { return /Route home/.test(x.textContent); })[0];
      ok(/travelmode=transit/.test(a.href) && /destination=/.test(a.href));
    });
  });

  test('AC-T5: Nov 18 travel day shows both flights with zones and the layover', function () {
    return E2E.seed({ pt: '2026-11-18T06:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Travel day/);
      has(w, /Thu Nov 19, 4:55 PM/);
      has(w, /Japan time/);
      has(w, /Layover 2h 50m/);
      ok(w.document.querySelectorAll('.leg').length >= 2);
      E2E.screenChecks(w);
    });
  });

  test('AC-T6: Nov 26 shows the evening flight and the hotel check-out', function () {
    return E2E.seed({ jst: '2026-11-26T09:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Thu Nov 26, 7:15 PM/);
      has(w, /Check out of Hotel Gamma by 10:00 AM/);
    });
  });

  test('AC-T7: after the trip, a summary', function () {
    return E2E.seed({ jst: '2026-11-27T10:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Welcome home/);
      has(w, /Trip summary/);
    });
  });

  test('before the trip: countdown, next pre-trip items, to-book items', function () {
    return E2E.seed({ pt: '2026-10-15T09:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /34\s+days to go/);
      has(w, /Fake task/);
      has(w, /Still to book/);
      eq(w.document.querySelector('.topbar .day-badge').getAttribute('aria-label'), 'Trip starts ' + w.BT.time.fmtDay('2026-11-18'));
      E2E.screenChecks(w);
    });
  });

  test('AC-C1 / AC-C2: the Cards button opens the not-set-up allergy card in one tap, from every screen', function () {
    var screens = ['#/today', '#/trip', '#/day/2026-11-20', '#/item/it_a3', '#/info', '#/settings', '#/lists', '#/budget', '#/nearby'];
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load(); }).then(function (w) {
      var chain = Promise.resolve();
      screens.forEach(function (h) {
        chain = chain.then(function () { return E2E.go(w, h); }).then(function () {
          E2E.screenChecks(w);
          var t0 = performance.now();
          return E2E.click(w, '.cards-btn').then(function () {
            var sheet = w.document.getElementById('sheet');
            ok(!sheet.hidden, 'sheet open on ' + h);
            ok(sheet.querySelector('.staff-card.is-unset'), 'not-set-up allergy card on ' + h);
            ok(/not set up yet/.test(sheet.textContent), 'not-set-up label');
            ok(/allergen words from the sheet/.test(sheet.innerText), 'allergen words come from Settings');
            ok(performance.now() - t0 < 500, 'under 500 ms');
            return E2E.click(w, '[data-action="close-sheet"]');
          });
        });
      });
      return chain;
    });
  });

  test('allergen words missing from Settings: the card says so instead of showing nothing', function () {
    var snap = E2E.snapshot(function (raw) { raw.Settings.values.pop(); });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.cards-btn').then(function () {
        ok(/Label words aren't set/.test(w.document.getElementById('sheet').textContent));
      });
    });
  });

  test('F1: a bad time zone in the sheet still renders Today and the hotel', function () {
    var snap = E2E.snapshot(function (raw) { raw.Transportation.values[2][8] = 'JST'; });
    return E2E.seed({ jst: '2026-11-21T20:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Day 3 of 8 · Kyoto/);
      has(w, /Hotel Beta/);
      has(w, /Sheet problem/);
      ok(!/Storage problem/.test(E2E.text(w)), 'not mistaken for storage');
    });
  });

  test('allergy badge opens the allergy card', function () {
    return E2E.seed({ jst: '2026-11-20T09:00' }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.allergy-badge').then(function () {
        ok(w.document.querySelector('#sheet .staff-card.is-unset'));
      });
    });
  });

  test('AC-T3: hotel card shows Japanese name and address at 32 px or more on a light card', function () {
    return E2E.seed({ jst: '2026-11-21T20:00' }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.hotel [data-card="hotel"]').then(function () {
        var card = w.document.querySelector('#sheet .staff-card');
        ok(/ホテルベータ/.test(card.innerText));
        var addr = card.querySelector('.ja-addr');
        ok(/京都府テスト2-2/.test(addr.textContent));
        ok(parseFloat(w.getComputedStyle(addr).fontSize) >= 32, 'address size ' + w.getComputedStyle(addr).fontSize);
        eq(w.getComputedStyle(card).backgroundColor, 'rgb(251, 248, 241)', 'paper background');
        var tel = card.querySelector('a.tel');
        eq(tel.getAttribute('href'), 'tel:+81750000000', 'dials +81');
      });
    });
  });

  test('EC-61: a hotel with no Japanese address shows the English one with a hint; Data health lists V-12', function () {
    var snap = E2E.snapshot(function (raw) { raw.Hotels.values[2][5] = ''; });
    return E2E.seed({ jst: '2026-11-21T20:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.hotel [data-card="hotel"]').then(function () {
        var card = w.document.querySelector('#sheet .staff-card');
        ok(/2-2 Fake, Kyoto/.test(card.querySelector('.ja-addr').textContent), 'English address in its place');
        ok(/No Japanese address/.test(card.innerText), 'hint says why');
        return E2E.go(w, '#/health');
      }).then(function () {
        has(w, /Japanese address/i, 'V-12 listed in Data health');
        E2E.screenChecks(w);
      });
    });
  });

  test('EC-15: Japanese text and emoji from the sheet render intact on Today', function () {
    var snap = E2E.snapshot(function (raw) {
      raw.Itinerary.values.forEach(function (r) { if (r[5] === 'Fake lunch') r[5] = 'Fake lunch 道頓堀 🍜'; });
    });
    return E2E.seed({ jst: '2026-11-20T13:30', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Fake lunch 道頓堀 🍜/);
      ok(!/�/.test(E2E.text(w)), 'no replacement characters');
    });
  });

  test('EC-26: the sheet refuses the code (AUTH): "Setup code needed" banner, the saved plan stays', function () {
    E2E.fetchStub = function () {
      return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify({ ok: false, api: 1, code: 'AUTH', message: 'Unauthorized' })); } });
    };
    return E2E.seed({ jst: '2026-11-20T13:30' }).then(function () { return E2E.load('#/settings'); }).then(function (w) {
      return E2E.click(w, '[data-action="sync-now"]').then(function () {
        return new Promise(function (r) { setTimeout(r, 300); });
      }).then(function () {
        has(w, /Setup code needed/);
        return E2E.go(w, '#/today');
      }).then(function () {
        has(w, /Day 2 of 8 · Osaka/, 'saved plan still shows');
        has(w, /Setup code needed/, 'banner stays');
        E2E.screenChecks(w);
      });
    });
  });

  test('EC-36 / DQ-10: Large Text (23 px, and 33 px bold) never scrolls sideways or pushes a control off screen; normal size keeps headers on one row', function () {
    var routes = ['#/today', '#/trip', '#/lists', '#/budget', '#/nearby', '#/info', '#/settings', '#/expense/new', '#/calc', '#/health',
      '#/print', '#/day/2026-11-20', '#/item/it_a4', '#/list/Departure%20day'];
    var sizes = [[17, false], [23, false], [33, true]];
    var jobs = [];
    sizes.forEach(function (sz) { routes.forEach(function (h) { jobs.push([sz[0], sz[1], h]); }); });
    return jobs.reduce(function (p, j) {
      return p.then(function () {
        return E2E.seed({ jst: '2026-11-21T20:00', owner: 'Lindsay', snapshot: E2E.snapshot(E2E.withLists) }).then(function () { return E2E.load(j[2]); }).then(function (w) {
          var st = w.document.createElement('style');
          st.textContent = 'html{font-size:' + j[0] + 'px !important}' + (j[1] ? ' *{font-weight:700 !important}' : '');
          w.document.head.appendChild(st);
          return new Promise(function (r) { setTimeout(r, 120); }).then(function () {
            var tag = j[2] + ' at ' + j[0] + 'px' + (j[1] ? ' bold' : '');
            ok(w.document.documentElement.scrollWidth <= w.innerWidth, tag + ': page is ' + w.document.documentElement.scrollWidth + ' wide');
            var back = w.document.querySelector('.topbar > .back'), cards = w.document.querySelector('.topbar > .cards-btn');
            if (j[0] === 17 && back && cards) ok(Math.abs(back.getBoundingClientRect().top - cards.getBoundingClientRect().top) < 10, tag + ': back and Cards share one row at normal size');
            [].forEach.call(w.document.querySelectorAll('#main a[href], #main button, #main input, #main select, .topbar button, .tabbar a'), function (e) {
              var r = e.getBoundingClientRect();
              if (r.width && !e.closest('.jump, .chips, .filters')) ok(r.right <= w.innerWidth + 1, tag + ': ' + e.tagName + ' "' + (e.innerText || '').trim().slice(0, 20) + '" ends at ' + Math.round(r.right));
            });
          });
        });
      });
    }, Promise.resolve());
  });

  test('§15 print fallback: Trip links to a printable itinerary with every day, Japanese addresses and a hotels page; print hides the app chrome', function () {
    return E2E.seed({ jst: '2026-11-21T20:00' }).then(function () { return E2E.load('#/trip'); }).then(function (w) {
      return E2E.click(w, 'a[href="#/print"]').then(function () {
        var d = w.document, pr = d.querySelector('.printable');
        eq(d.querySelectorAll('.p-day:not(.p-hotels)').length, w.BT.model.tripDays(w.BT.app.state.vm).length, 'one section per trip day');
        ok(/大阪府テスト1-1/.test(pr.innerText) && /京都府テスト2-2/.test(pr.innerText), 'Japanese hotel addresses');
        ok(/テスト市場/.test(pr.innerText), 'Japanese place names');
        ok(d.querySelector('.p-hotels'), 'hotels page for drivers');
        ok(d.querySelector('[data-action="print"]'), 'print button');
        var printRules = [].concat.apply([], [].map.call(d.styleSheets, function (sh) {
          try { return [].filter.call(sh.cssRules, function (r) { return r.media && /print/.test(r.media.mediaText); }); } catch (e) { return []; }
        })).map(function (r) { return r.cssText; }).join('\n');
        ['.topbar', '.tabbar', '.banners', '.no-print'].forEach(function (sel) { ok(printRules.indexOf(sel) >= 0, 'print hides ' + sel); });
        ok(/#000\b|rgb\(0, 0, 0\)/.test(printRules) && /#fff\b|rgb\(255, 255, 255\)/.test(printRules), 'prints black on white');
        E2E.screenChecks(w);
      });
    });
  });

  test('booking ref card groups digits in fours', function () {
    return E2E.seed({ jst: '2026-11-21T20:00' }).then(function () { return E2E.load('#/info'); }).then(function (w) {
      return E2E.click(w, '[data-card="ref"][data-kind="hotel"]').then(function () {
        eq(w.document.querySelector('#sheet .ref').textContent, '1111 2222 3333 4444 5');
      });
    });
  });

  test('Trip: 9 days → day detail → item detail with transit Directions and a taxi card', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/trip'); }).then(function (w) {
      eq(w.document.querySelectorAll('.day-row').length, 9);
      ok(w.document.querySelector('.is-today'), 'today marked');
      return E2E.go(w, '#/day/2026-11-20').then(function () {
        has(w, /Fake market/);
        return E2E.go(w, '#/item/it_a3');
      }).then(function () {
        has(w, /テスト市場/);
        var dir = w.document.querySelector('.item-detail a.btn-primary');
        ok(/dir\/\?api=1&destination=%E3%83%86/.test(dir.href), 'directions to the Japanese name: ' + dir.href);
        return E2E.click(w, '[data-card="taxi"]');
      }).then(function () {
        ok(/ここまで/.test(w.document.querySelector('#sheet').innerText));
        ok(/テスト市場/.test(w.document.querySelector('#sheet').innerText));
      });
    });
  });

  test('sheet error: banner links to Data health, which lists it', function () {
    var snap = E2E.snapshot(function (raw) { raw.Itinerary.values[1][5] = ''; });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Sheet problem/);
      return E2E.click(w, '.banner a[href="#/health"]').then(function () {
        has(w, /Data health/);
        has(w, /Row 2 is missing Title/);
        E2E.screenChecks(w);
      });
    });
  });

  test('missing Lindsay data shows as plain text, never NaN or undefined', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/info'); }).then(function (w) {
      has(w, /Total and cancellation date not in the sheet yet/);
      ok(!/NaN|undefined|null/.test(E2E.text(w)), 'no NaN/undefined/null on Info');
      return E2E.go(w, '#/today').then(function () { ok(!/NaN|undefined|null/.test(E2E.text(w)), 'none on Today'); });
    });
  });

  test('§13: a newer script API shows "App and sheet don\'t match", keeps the plan, and Settings shows the script version', function () {
    var newer = E2E.snapshot();
    newer.ok = true; newer.api = 99;
    E2E.fetchStub = function () {
      return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(newer)); } });
    };
    return E2E.seed({ jst: '2026-11-20T13:30' }).then(function () { return E2E.load('#/settings'); }).then(function (w) {
      has(w, /script 0\.1\.0/, 'script version from the saved snapshot');
      return E2E.click(w, '[data-action="sync-now"]').then(function () {
        return new Promise(function (r) { setTimeout(r, 300); });
      }).then(function () {
        has(w, /App and sheet don't match/);
        has(w, /newer than this app/);
        eq(w.document.querySelector('[data-sync]').textContent, 'Version mismatch');
        E2E.screenChecks(w);
        return E2E.go(w, '#/today');
      }).then(function () {
        has(w, /Day 2 of 8 · Osaka/, 'saved plan still shows');
        has(w, /App and sheet don't match/, 'banner stays across screens');
        w.BT.api.fetch = function () { return Promise.reject(new TypeError('offline (stub)')); };
        return w.BT.app.state.sync.sync('manual').then(function () { return new Promise(function (r) { setTimeout(r, 80); }); });
      }).then(function () {
        has(w, /App and sheet don't match/, 'going offline doesn\'t clear the mismatch');
      });
    });
  });

  test('a reload keeps the screen (spike L10)', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/item/it_a3'); }).then(function (w) {
      has(w, /Fake market/);
    });
  });

  // ---------- Lists (v0.2, HANDOFF §8.3) ----------
  function listSnap() { return E2E.snapshot(E2E.withLists); }
  function rowFor(w, id) { return w.document.querySelector('.check[data-id="' + id + '"]'); }

  test('Lists overview: fixed order, progress, overdue count; deleted rows hidden', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load('#/lists'); }).then(function (w) {
      var names = Array.prototype.map.call(w.document.querySelectorAll('.list-name'), function (n) { return n.textContent; });
      deepEq(names, ['Pre-trip', 'Packing', 'Departure day']);
      has(w, /0 of 2 done · 1 overdue/);
      has(w, /1 of 3 done/, 'the deleted packing row is not counted');
      ok(w.document.querySelector('.tab[aria-current="page"][href="#/lists"]'), 'Lists tab is current');
      E2E.screenChecks(w);
    });
  });

  test('AC-L1 (phone half): ticking offline shows at once, survives a relaunch, and the sync line says it\'s saved', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', owner: 'Lindsay', snapshot: listSnap() }).then(function () { return E2E.load('#/list/Pre-trip'); }).then(function (w) {
      ok(!rowFor(w, 'ck_p1').classList.contains('is-done'));
      has(w, /Overdue · /, 'overdue item marked (AC-L3)');
      return E2E.click(w, '.check[data-id="ck_p1"] .label').then(function () {
        ok(rowFor(w, 'ck_p1').classList.contains('is-done'), 'ticked at once');
        eq(rowFor(w, 'ck_p1').querySelector('button.box').getAttribute('aria-pressed'), 'true');
        has(w, /Waiting to sync/);
        return E2E.wait(150);
      }).then(function () { return E2E.outbox(); }).then(function (ops) {
        eq(ops.length, 1);
        eq(ops[0].type, 'checklist.update');
        deepEq(ops[0].fields, { done: true, doneBy: 'Lindsay' });
        return E2E.load('#/list/Pre-trip');                       // relaunch, still offline
      }).then(function (w2) {
        ok(rowFor(w2, 'ck_p1').classList.contains('is-done'), 'still ticked after relaunch');
        return E2E.wait(400).then(function () {
          ok(/1 change saved on this phone|1 change waiting|Syncing/.test(w2.document.querySelector('[data-sync]').textContent), w2.document.querySelector('[data-sync]').textContent);
          E2E.screenChecks(w2);
        });
      });
    });
  });

  test('AC-L1 (sync half): back online, the change is pushed, then the fresh snapshot shows it with no pending mark', function () {
    var script = E2E.fakeScript();
    var queued = { opId: 'op_e2e000001', seq: 1, type: 'checklist.update', id: 'ck_p1', fields: { done: true, doneBy: 'Jordan' }, clientUpdatedAt: new Date().toISOString(), status: 'pending' };
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap(), outbox: [queued] }).then(function () {
      E2E.fetchStub = script;
      return E2E.load('#/list/Pre-trip');
    }).then(function (w) {
      return E2E.wait(600).then(function () {
        // The saved snapshot came from script 0.1.0, so the app checks the script first.
        deepEq(script.actions().slice(0, 3), ['snapshot', 'mutate', 'snapshot'], 'check, push, then pull');
        ok(rowFor(w, 'ck_p1').classList.contains('is-done'));
        ok(!/Waiting to sync/.test(E2E.text(w)), 'pending mark gone');
        has(w, /Done by Jordan/);
        ok(/Synced/.test(w.document.querySelector('[data-sync]').textContent));
        return E2E.outbox();
      }).then(function (ops) { eq(ops.length, 0, 'outbox empty'); });
    });
  });

  test('AC-L4: Packing groups by bag with counts; All items view is remembered', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load('#/list/Packing'); }).then(function (w) {
      var heads = Array.prototype.map.call(w.document.querySelectorAll('.bag-head'), function (h) { return h.innerText.replace(/\s+/g, ' '); });
      deepEq(heads, ['Suitcase 0 of 1 packed', 'Jordan backpack 1 of 1 packed', 'Lindsay backpack 0 of 1 packed']);
      E2E.screenChecks(w);
      return E2E.click(w, '[data-action="pack-view"][data-view="all"]').then(function () {
        eq(w.document.querySelectorAll('.bag-head').length, 0);
        eq(w.document.querySelectorAll('.check').length, 3);
        return E2E.wait(100).then(function () { return E2E.load('#/list/Packing'); });
      }).then(function (w2) {
        eq(w2.document.querySelectorAll('.bag-head').length, 0, 'still All items after relaunch');
      });
    });
  });

  test('add, edit and delete an item: each shows at once and is queued for the sheet', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load('#/list/Departure%20day'); }).then(function (w) {
      var form = w.document.querySelector('form[data-action="add-check"]');
      form.elements.namedItem('item').value = 'Fake new item';   // the real input; .item is the collection's method
      form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      var id;
      return E2E.wait(150).then(function () {
        has(w, /Fake new item/);
        var row = Array.prototype.filter.call(w.document.querySelectorAll('.check'), function (r) { return /Fake new item/.test(r.innerText); })[0];
        id = row.getAttribute('data-id');
        ok(/^ck_[a-z2-9]{8}$/.test(id), id);
        eq(w.document.querySelector('form[data-action="add-check"] input[name="item"]').value, '', 'field cleared');
        return E2E.go(w, '#/check/' + id);
      }).then(function () {
        var f = w.document.querySelector('form[data-action="save-check"]');
        f.elements.owner.value = 'Lindsay';
        f.elements.notes.value = 'bring the 日本語 note';
        f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
        return E2E.wait(150);
      }).then(function () {
        ok(/#\/list\/Departure/.test(w.location.hash), 'back on the list');
        has(w, /Lindsay/);
        has(w, /bring the 日本語 note/);
        return E2E.go(w, '#/check/' + id);
      }).then(function () {
        w.confirm = function () { return true; };
        return E2E.click(w, '[data-action="delete-check"]');
      }).then(function () { return E2E.wait(100); }).then(function () {
        ok(!/Fake new item/.test(E2E.text(w)), 'gone from the list');
        return E2E.outbox();
      }).then(function (ops) {
        deepEq(ops.sort(function (a, b) { return a.seq - b.seq; }).map(function (o) { return o.type; }), ['checklist.add', 'checklist.update', 'checklist.delete']);
        deepEq(ops[1].fields, { owner: 'Lindsay', notes: 'bring the 日本語 note' }, 'only changed fields are sent');
        eq(ops[0].fields.list, 'Departure day');
        eq(ops[0].fields.sort, 70);
      });
    });
  });

  test('Sync issues: a refused change is listed with its reason; Retry resends; Discard removes', function () {
    var refuse = true;
    var script = E2E.fakeScript({ status: function () { return refuse ? 'rejected' : 'applied'; } });
    var queued = { opId: 'op_e2e000002', seq: 1, type: 'checklist.update', id: 'ck_p2', fields: { done: true }, clientUpdatedAt: new Date().toISOString(), status: 'pending' };
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap(), outbox: [queued] }).then(function () {
      E2E.fetchStub = script;
      return E2E.load('#/lists');
    }).then(function (w) {
      return E2E.wait(600).then(function () {
        has(w, /1 change the sheet didn't accept/);
        eq(w.document.querySelector('[data-sync]').textContent, '1 sync issue');
        return E2E.click(w, '.issue-row');
      }).then(function () {
        has(w, /Tick “Fake insurance”/);
        has(w, /Not found in the sheet \(fake\)/);
        E2E.screenChecks(w);
        refuse = false;
        return E2E.click(w, '[data-action="retry-op"]');
      }).then(function () { return E2E.wait(500); }).then(function () {
        has(w, /No sync issues/);
        return E2E.outbox();
      }).then(function (ops) {
        eq(ops.length, 0);
        refuse = true;                                   // a second refused change, this time discarded
        return w.BT.app.state.sync.enqueue('checklist.update', 'ck_p1', { done: true });
      }).then(function () { return w.BT.app.state.sync.sync('manual'); }).then(function () { return E2E.wait(150); }).then(function () {
        has(w, /Tick “Fake booking”/);
        w.confirm = function () { return true; };
        return E2E.click(w, '[data-action="discard-op"]');
      }).then(function () { return E2E.wait(150); }).then(function () {
        has(w, /No sync issues/);
        return E2E.outbox();
      }).then(function (ops) { eq(ops.length, 0, 'discarded'); });
    });
  });

  test('held: an old script (0.1.0) gets no push; a banner says changes wait for the update', function () {
    var script = E2E.fakeScript({ serverVersion: '0.1.0' });
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () {
      E2E.fetchStub = script;
      return E2E.load('#/list/Pre-trip');
    }).then(function (w) {
      return E2E.wait(400).then(function () { return E2E.click(w, '.check[data-id="ck_p1"] .label'); })
        .then(function () { return w.BT.app.state.sync.sync('manual'); }).then(function () { return E2E.wait(150); })
        .then(function () {
          ok(script.actions().indexOf('mutate') < 0, 'never pushed: ' + script.actions().join());
          has(w, /Changes waiting/);
          has(w, /updated to 0\.2\.0/);
          ok(/script update needed/.test(w.document.querySelector('[data-sync]').textContent));
          ok(rowFor(w, 'ck_p1').classList.contains('is-done'), 'still shown on the phone');
        });
    });
  });

  test('Today before the trip: overdue Pre-trip items first, tickable there (AC-L3)', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      var first = w.document.querySelector('.checks .check');
      ok(/Fake booking/.test(first.innerText) && /Overdue/.test(first.innerText), first.innerText);
      return E2E.click(w, '.check[data-id="ck_p1"] .label').then(function () {
        ok(!/Fake booking/.test(E2E.text(w)), 'a ticked item leaves the to-do list');
        E2E.screenChecks(w);
      });
    });
  });

  test('update prompt: shows the new version, waits for the tap, then asks the worker to take over; queued changes stay', function () {
    var queued = { opId: 'op_e2e000003', seq: 1, type: 'checklist.update', id: 'ck_p1', fields: { done: true }, clientUpdatedAt: new Date().toISOString(), status: 'pending' };
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap(), outbox: [queued] }).then(function () { return E2E.load('#/today'); }).then(function (w) {
      var sent = [];
      var worker = { postMessage: function (m) { sent.push(m); } };
      w.BT.app.state.update = { worker: worker, version: '9.9.9' };
      w.BT.app.render();
      has(w, /Update available/);
      has(w, /Version 9\.9\.9/);
      eq(sent.length, 0, 'never applied on its own');
      return E2E.click(w, '[data-action="apply-update"]').then(function () {
        deepEq(sent, [{ type: 'skipWaiting' }]);
        eq(w.BT.app.state.updating, true, 'reloads when the new worker takes control');
        return E2E.outbox();
      }).then(function (ops) { eq(ops.length, 1, 'the queued change is still on the phone'); });
    });
  });

  // ---------- ship-check 2026-10-21 regressions ----------
  function reply(obj) { return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(obj)); } }); }
  function lastOp(ops) { return ops.sort(function (a, b) { return a.seq - b.seq; })[ops.length - 1]; }

  test('add and edit work through the real form fields (form.elements.item is a method, not the input)', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load('#/list/Pre-trip'); }).then(function (w) {
      eq(typeof w.document.querySelector('form[data-action="add-check"]').elements.item, 'function', 'the trap this guards');
      var input = w.document.querySelector('form[data-action="add-check"] input[name="item"]');
      input.value = '  Rail pass  ';
      return E2E.click(w, 'form[data-action="add-check"] button[type="submit"]').then(function () { return E2E.wait(150); }).then(function () {
        has(w, /Rail pass/);
        return E2E.go(w, '#/check/ck_p1');
      }).then(function () {
        w.document.querySelector('form[data-action="save-check"] input[name="item"]').value = 'Fake task, renamed';
        return E2E.click(w, 'form[data-action="save-check"] button[type="submit"]');
      }).then(function () { return E2E.wait(150); }).then(function () {
        ok(/#\/list\/Pre-trip/.test(w.location.hash), 'Save went back to the list');
        return E2E.outbox();
      }).then(function (ops) {
        var add = ops.filter(function (o) { return o.type === 'checklist.add'; })[0];
        ok(add, 'add queued'); eq(add.fields.item, 'Rail pass', 'trimmed');
        deepEq(lastOp(ops).fields, { item: 'Fake task, renamed' }, 'only the name changed');
      });
    });
  });

  test('a setup code for the other site is refused in plain words, and the app stays put', function () {
    return E2E.seed({ setup: false, snapshot: null }).then(function () { return E2E.load(); }).then(function (w) {
      var code = btoa(JSON.stringify({ env: 'prod', apiUrl: 'https://script.google.com/macros/s/AKfakePROD/exec', token: 'p'.repeat(43) }));
      var ta = w.document.querySelector('textarea[data-action="paste-setup"]');
      ta.value = code;
      ta.dispatchEvent(new w.Event('input', { bubbles: true }));
      return E2E.wait(300).then(function () {
        has(w, /This is the test app \(STAGING\)/);
        has(w, /Welcome to Brillo/, 'still on setup');
        ok(w.document.querySelector('.staging-ribbon'), 'ribbon still shows');
        ok(!Object.keys(w.localStorage).some(function (k) { return k.indexOf('brillo.env') === 0 && w.localStorage.getItem(k) === 'prod'; }), 'no prod pointer saved');
        ok(!/pppppppppp/.test(w.document.documentElement.outerHTML), 'token never in the page');
      });
    });
  });

  test('a saved pointer to the other env (from before codes were tied to their site) is ignored', function () {
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () {
      localStorage.setItem('brillo.env:/app/', 'prod');
      return E2E.load('#/lists');
    }).then(function (w) {
      ok(w.document.querySelector('.staging-ribbon'), 'still the staging app');
      has(w, /Pre-trip/, 'its own saved data');
    }).finally(function () { localStorage.removeItem('brillo.env:/app/'); });
  });

  test('Save sends only what the person changed, even when the sheet holds values the form cannot show', function () {
    var snap = E2E.snapshot(function (raw) {
      E2E.withLists(raw);
      var H = raw.Checklists.values[0];
      var row = raw.Checklists.values.filter(function (r) { return r[0] === 'ck_p1'; })[0];
      row[H.indexOf('Owner')] = 'Grandma';             // not one of the dropdown choices
      row[H.indexOf('Bag')] = 'Carry-on tote';
    });
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: snap }).then(function () { return E2E.load('#/check/ck_p1'); }).then(function (w) {
      w.document.querySelector('form[data-action="save-check"] textarea[name="notes"]').value = 'just a note';
      return E2E.click(w, 'form[data-action="save-check"] button[type="submit"]').then(function () { return E2E.wait(150); })
        .then(function () { return E2E.outbox(); })
        .then(function (ops) { deepEq(lastOp(ops).fields, { notes: 'just a note' }, 'owner, bag and due untouched'); });
    });
  });

  test('newer data arriving while the edit form is open: unsaved text stays, and Save does not undo the other phone', function () {
    var renamed = E2E.snapshot(function (raw) {
      E2E.withLists(raw);
      var H = raw.Checklists.values[0];
      raw.Checklists.values.filter(function (r) { return r[0] === 'ck_p1'; })[0][H.indexOf('Item')] = 'Fake task + visa copy';
    });
    renamed.ok = true; renamed.api = 1; renamed.serverVersion = '0.2.1'; renamed.rev = 'renamed';
    var w;
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load('#/check/ck_p1'); }).then(function (win) {
      w = win;
      var notes = w.document.querySelector('form[data-action="save-check"] textarea[name="notes"]');
      notes.value = 'typed, not saved yet';
      notes.blur();
      w.BT.api.fetch = function () { return reply(renamed); };
      w.dispatchEvent(new w.Event('online'));                  // a background sync
      return E2E.wait(500);
    }).then(function () {
      eq(w.document.querySelector('form[data-action="save-check"] textarea[name="notes"]').value, 'typed, not saved yet', 'unsaved text kept');
      w.document.dispatchEvent(new w.Event('visibilitychange'));   // coming back from another app
      return E2E.wait(300);
    }).then(function () {
      eq(w.document.querySelector('form[data-action="save-check"] textarea[name="notes"]').value, 'typed, not saved yet', 'kept after returning to the app');
      return E2E.click(w, 'form[data-action="save-check"] button[type="submit"]');
    }).then(function () { return E2E.wait(150); }).then(function () { return E2E.outbox(); }).then(function (ops) {
      deepEq(lastOp(ops).fields, { notes: 'typed, not saved yet' }, 'the old name is not sent back');
    });
  });

  test('Save on an item deleted meanwhile says so instead of doing nothing', function () {
    var gone = E2E.snapshot(function (raw) {
      E2E.withLists(raw);
      var H = raw.Checklists.values[0];
      raw.Checklists.values.filter(function (r) { return r[0] === 'ck_p1'; })[0][H.indexOf('Deleted')] = true;
    });
    gone.ok = true; gone.api = 1; gone.serverVersion = '0.2.1'; gone.rev = 'gone';
    var w;
    return E2E.seed({ pt: '2026-10-20T09:00', snapshot: listSnap() }).then(function () { return E2E.load('#/check/ck_p1'); }).then(function (win) {
      w = win;
      w.BT.api.fetch = function () { return reply(gone); };
      w.dispatchEvent(new w.Event('online'));
      return E2E.wait(500);
    }).then(function () {
      w.document.querySelector('form[data-action="save-check"] textarea[name="notes"]').value = 'too late';
      return E2E.click(w, 'form[data-action="save-check"] button[type="submit"]');
    }).then(function () { return E2E.wait(200); }).then(function () {
      has(w, /was deleted from the list/);
      ok(/#\/lists/.test(w.location.hash), 'back on Lists');
    });
  });

  // ---------- Budget (v0.3, HANDOFF §8.4) ----------
  function budgetSnap(mutate) { return E2E.snapshot(function (raw) { E2E.withLists(raw); E2E.withExpenses(raw); if (mutate) mutate(raw); }); }
  function typeInto(w, sel, text) {
    var el = w.document.querySelector(sel);
    if (!el) throw new Error('no input ' + sel);
    el.focus(); el.value = text;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
    el.blur();
  }
  function pick(w, name, value) {
    var input = w.document.querySelector('form[data-action="save-expense"] input[name="' + name + '"][value="' + value + '"]');
    if (!input) throw new Error('no choice ' + name + '=' + value);
    input.closest('label').click();                              // a tap on the chip
  }
  function submitExpense(w) { return E2E.click(w, 'form[data-action="save-expense"] button[type="submit"]').then(function () { return E2E.wait(150); }); }
  function leftToday(w) { return w.document.querySelector('[data-left]').firstChild.textContent.trim(); }
  function cashOnHand(w) {
    var env = Array.prototype.filter.call(w.document.querySelectorAll('.envelope'), function (e) { return /Cash on hand/i.test(e.innerText); })[0];
    return env.querySelector('.env-main').textContent.trim();
  }

  test('AC-B1 / AC-B2 on screen: left today ¥21,667 of ¥26,667; cash counts the ATM withdrawal; deleted rows hidden', function () {
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/budget'); }).then(function (w) {
      eq(leftToday(w), '¥21,667');
      has(w, /Spent ¥5,000 of ¥26,667/);
      has(w, /Trip left ¥155,000 · 6 days/);
      eq(w.document.querySelector('.budget').getAttribute('data-state'), 'ok');
      eq(cashOnHand(w), '¥50,000', '50,000 start + 30,000 ATM − 30,000 cash spending');
      has(w, /¥78,000 left of ¥100,000/);
      has(w, /1 tax-free purchase waiting for a refund/);
      has(w, /Fake park tickets/);
      ok(!/Fake deleted/.test(E2E.text(w)), 'deleted expense hidden');
      ok(w.document.querySelector('.tab[aria-current="page"][href="#/budget"]'), 'Budget tab is current');
      E2E.screenChecks(w);
    });
  });

  test('AC-B3 (phone half): an expense typed offline shows at once, updates the totals, and survives a relaunch', function () {
    var w;
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Lindsay', snapshot: budgetSnap() }).then(function () { return E2E.load('#/budget'); }).then(function (win) {
      w = win;
      return E2E.click(w, 'a[href="#/expense/new"]');
    }).then(function () {
      E2E.screenChecks(w);
      eq(w.document.querySelector('form[data-action="save-expense"] input[name="tripDate"]').value, '2026-11-21', 'date defaults to today in Japan');
      ok(w.document.querySelector('input[name="paidBy"][value="Lindsay"]').checked, 'paid by defaults to this phone\'s owner');
      typeInto(w, 'form[data-action="save-expense"] input[name="amount"]', '1,200');
      pick(w, 'category', 'Transit');
      pick(w, 'method', 'Cash');
      typeInto(w, 'form[data-action="save-expense"] input[name="note"]', 'Fake 切符');
      return submitExpense(w);
    }).then(function () {
      ok(/#\/budget/.test(w.location.hash), 'back on Budget');
      has(w, /Fake 切符/);
      has(w, /Waiting to sync/);
      eq(leftToday(w), '¥20,467');
      eq(cashOnHand(w), '¥48,800');
      return E2E.outbox();
    }).then(function (ops) {
      eq(ops.length, 1);
      eq(ops[0].type, 'expense.upsert');
      ok(/^ex_[a-z2-9]{8}$/.test(ops[0].id), ops[0].id);
      var f = Object.assign({}, ops[0].fields); delete f.createdAt;
      deepEq(f, { amount: 1200, currency: 'JPY', category: 'Transit', envelope: 'Daily', method: 'Cash', paidBy: 'Lindsay',
        tripDate: '2026-11-21', note: 'Fake 切符', taxFree: false, refundStatus: 'n/a' });
      ok(ops[0].fields.createdAt, 'createdAt set');
      return E2E.load('#/budget');
    }).then(function (w2) {
      has(w2, /Fake 切符/);
      eq(leftToday(w2), '¥20,467', 'still counted after relaunch');
    });
  });

  test('AC-B3 (sync half): back online, the expense reaches the sheet exactly once and the pending mark clears', function () {
    var script = E2E.fakeScript({ expenses: true });
    var queued = { opId: 'op_e2eexp001', seq: 1, type: 'expense.upsert', id: 'ex_e2equeue', clientUpdatedAt: new Date().toISOString(), status: 'pending',
      fields: { amount: 800, currency: 'JPY', category: 'Food', envelope: 'Daily', method: 'Card', paidBy: 'Jordan', tripDate: '2026-11-21', note: 'Fake onigiri', taxFree: false, refundStatus: 'n/a', createdAt: new Date().toISOString() } };
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap(), outbox: [queued] }).then(function () {
      E2E.fetchStub = script;
      return E2E.load('#/budget');
    }).then(function (w) {
      return E2E.wait(700).then(function () {
        var mutates = script.calls.filter(function (c) { return c.action === 'mutate'; });
        eq(mutates.length, 1, 'pushed once');
        eq(mutates[0].ops.length, 1);
        eq(w.document.querySelectorAll('.exp-row[data-id="ex_e2equeue"]').length, 1, 'shown once');
        ok(!/Waiting to sync/.test(E2E.text(w)), 'pending mark gone');
        eq(leftToday(w), '¥20,867');
        return E2E.outbox();
      }).then(function (ops) { eq(ops.length, 0, 'outbox empty'); });
    });
  });

  test('edit sends only the changed field; category picks the envelope; a large amount asks first (EC-50)', function () {
    var w, asked = [];
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/expense/ex_e3'); }).then(function (win) {
      w = win;
      E2E.screenChecks(w);
      eq(w.document.querySelector('input[name="amount"]').value, '5000');
      typeInto(w, 'form[data-action="save-expense"] input[name="amount"]', '6000');
      return submitExpense(w);
    }).then(function () {
      has(w, /Fake lunch/);
      eq(leftToday(w), '¥20,667');
      return E2E.outbox();
    }).then(function (ops) {
      eq(ops.length, 1);
      deepEq(ops[0].fields, { amount: 6000 }, 'only the amount');
      return E2E.go(w, '#/expense/new');
    }).then(function () {
      pick(w, 'category', 'Lodging');
      eq(w.document.querySelector('select[name="envelope"]').value, 'Bookings', 'Lodging → Bookings');
      pick(w, 'category', 'ATM withdrawal');
      eq(w.document.querySelector('select[name="envelope"]').value, 'Cash movement');
      pick(w, 'category', 'Food');
      typeInto(w, 'form[data-action="save-expense"] input[name="amount"]', '30000');
      w.confirm = function (msg) { asked.push(msg); return false; };
      return submitExpense(w);
    }).then(function () {
      deepEq(asked, ['Confirm ¥30,000 (≈ $190)?']);
      ok(/#\/expense\/new/.test(w.location.hash), 'still on the form after Cancel');
      return E2E.outbox();
    }).then(function (ops) {
      eq(ops.length, 1, 'nothing queued after Cancel');
      typeInto(w, 'form[data-action="save-expense"] input[name="amount"]', '12.5');
      return submitExpense(w);
    }).then(function () {
      has(w, /whole number above zero/);
      eq(asked.length, 1, 'a bad amount never reaches the confirm');
    });
  });

  test('AC-B5 (phone half): delete marks the expense deleted and drops it from the totals', function () {
    var w;
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/expense/ex_e3'); }).then(function (win) {
      w = win;
      w.confirm = function () { return true; };
      return E2E.click(w, '[data-action="delete-expense"]');
    }).then(function () { return E2E.wait(150); }).then(function () {
      ok(/#\/budget/.test(w.location.hash));
      ok(!/Fake lunch/.test(E2E.text(w)), 'gone from the list');
      eq(leftToday(w), '¥26,667');
      eq(cashOnHand(w), '¥55,000');
      return E2E.outbox();
    }).then(function (ops) {
      eq(ops.length, 1); eq(ops[0].type, 'expense.delete'); eq(ops[0].id, 'ex_e3'); deepEq(ops[0].fields, {});
    });
  });

  test('AC-B4 / AC-B5 (sync half): the other phone\'s edit and delete show after a sync', function () {
    var changed = budgetSnap(function (raw) {
      var X = raw.Expenses.values[0];
      raw.Expenses.values.filter(function (r) { return r[0] === 'ex_e3'; })[0][X.indexOf('Amount')] = 7000;
      raw.Expenses.values.filter(function (r) { return r[0] === 'ex_e2'; })[0][X.indexOf('Deleted')] = true;
    });
    changed.ok = true; changed.api = 1; changed.serverVersion = '0.2.1'; changed.rev = 'other-phone';
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () {
      E2E.fetchStub = function () { return reply(changed); };
      return E2E.load('#/budget');
    }).then(function (w) {
      return E2E.wait(500).then(function () {
        ok(!/Fake museum/.test(E2E.text(w)), 'deleted on the other phone');
        has(w, /¥7,000/);
        eq(leftToday(w), '¥23,833', '(220,000 − 35,000) ÷ 6 − 7,000');
      });
    });
  });

  test('Shopping shows the tax-free toggle (saved as refund Pending); Suica shows the top-up tip', function () {
    var w;
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/expense/new'); }).then(function (win) {
      w = win;
      var tf = w.document.querySelector('[data-taxfree]'), tip = w.document.querySelector('[data-suica-tip]');
      ok(tf.hidden && tip.hidden, 'hidden for Food / Card');
      pick(w, 'method', 'Suica');
      ok(!tip.hidden, 'Suica tip');
      pick(w, 'category', 'Shopping');
      ok(!tf.hidden, 'tax-free toggle for Shopping');
      w.document.querySelector('input[name="taxFree"]').closest('label').click();
      pick(w, 'method', 'Card');
      typeInto(w, 'form[data-action="save-expense"] input[name="amount"]', '15000');
      return submitExpense(w);
    }).then(function () { return E2E.outbox(); }).then(function (ops) {
      eq(ops[0].fields.envelope, 'Shopping');
      eq(ops[0].fields.taxFree, true);
      eq(ops[0].fields.refundStatus, 'Pending');
      has(w, /2 tax-free purchases waiting for a refund/);
    });
  });

  test('AC-B6: no live rate → the cached rate with its date, used in the ≈ dollars', function () {
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap(), prefs: { fx: { rate: 150, date: '2026-11-19' } } }).then(function () { return E2E.load('#/budget'); }).then(function (w) {
      ok(/¥150 = \$1 · rate from Thu Nov 19/.test(w.document.querySelector('[data-rate]').textContent), w.document.querySelector('[data-rate]').textContent);
      has(w, /≈ \$144/, '21,667 ÷ 150');
      return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/budget'); });
    }).then(function (w2) {
      ok(/fallback rate from the sheet/.test(w2.document.querySelector('[data-rate]').textContent), 'no cache: the sheet fallback');
      has(w2, /≈ \$137/, '21,667 ÷ 158.3');
    });
  });

  test('calculator: a yen price shows dollars and what it leaves for today; Log it opens the form with the amount', function () {
    var w;
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/calc'); }).then(function (win) {
      w = win;
      E2E.screenChecks(w);
      typeInto(w, '[data-action="calc-input"]', '3000');
      var out = w.document.querySelector('[data-calc-out]').innerText;
      ok(/≈ \$19/.test(out), out);
      ok(/This would leave ¥18,667 for today/.test(out), out);
      return E2E.click(w, '[data-action="calc-log"]');
    }).then(function () {
      ok(/#\/expense\/new/.test(w.location.hash));
      eq(w.document.querySelector('form[data-action="save-expense"] input[name="amount"]').value, '3000');
    });
  });

  test('AC-B7: Export CSV hands the share sheet a file with every non-deleted expense and JPY / USD columns', function () {
    var shared = null;
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/budget'); }).then(function (w) {
      w.navigator.canShare = function (d) { return !!(d && d.files); };
      w.navigator.share = function (d) { shared = d; return Promise.resolve(); };
      return E2E.click(w, '[data-action="export-csv"]');
    }).then(function () {
      ok(shared && shared.files && shared.files.length === 1, 'one file shared');
      ok(/^brillo-expenses-2026-11-21\.csv$/.test(shared.files[0].name), shared.files[0].name);
      return shared.files[0].text();
    }).then(function (text) {
      var lines = text.replace(/^﻿/, '').trim().split('\r\n');
      eq(lines.length, 7, 'header + 6 non-deleted');
      ok(/,JPY,USD,/.test(lines[0]));
      ok(lines.some(function (l) { return l.indexOf('2026-10-01,Tickets,Bookings,120,USD,18996,120.00') === 0; }), 'USD row converted');
      ok(!/Fake deleted/.test(text));
    });
  });

  test('an open expense form is never redrawn by a sync; Save on one deleted meanwhile says so', function () {
    var gone = budgetSnap(function (raw) {
      var X = raw.Expenses.values[0];
      raw.Expenses.values.filter(function (r) { return r[0] === 'ex_e3'; })[0][X.indexOf('Deleted')] = true;
    });
    gone.ok = true; gone.api = 1; gone.serverVersion = '0.2.1'; gone.rev = 'gone-exp';
    var w;
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: budgetSnap() }).then(function () { return E2E.load('#/expense/ex_e3'); }).then(function (win) {
      w = win;
      typeInto(w, 'form[data-action="save-expense"] input[name="note"]', 'typed, not saved');
      w.BT.api.fetch = function () { return reply(gone); };
      w.dispatchEvent(new w.Event('online'));
      return E2E.wait(500);
    }).then(function () {
      eq(w.document.querySelector('form[data-action="save-expense"] input[name="note"]').value, 'typed, not saved', 'unsaved text kept');
      return submitExpense(w);
    }).then(function () {
      has(w, /This expense was deleted/);
      ok(/#\/budget/.test(w.location.hash));
    });
  });
});
