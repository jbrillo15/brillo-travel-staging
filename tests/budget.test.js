/* budget.js tests (HANDOFF §8.4): AC-B1, AC-B2 exact; EC-51, EC-54, EC-56, EC-57, EC-58. */
suite('budget', function () {
  var B = BT.budget;
  var S = { firstSpendDay: '2026-11-19', tripEnd: '2026-11-26', dailyBudget: 220000, shoppingBudget: 100000, startingCash: 50000, fxFallback: 158.3 };
  var R = { rate: 150, source: 'live', date: '2026-11-21' };
  var n = 0;
  function ex(o) { n++; return Object.assign({ id: 'ex_t' + n, amount: 1000, currency: 'JPY', envelope: 'Daily', category: 'Food', method: 'Card', tripDate: '2026-11-21', deleted: false }, o); }

  test('AC-B1: ¥220,000, ¥60,000 spent Nov 19–20, ¥5,000 today Nov 21 → allowance ¥26,667, left ¥21,667', function () {
    var list = [ex({ tripDate: '2026-11-19', amount: 35000 }), ex({ tripDate: '2026-11-20', amount: 25000 }), ex({ tripDate: '2026-11-21', amount: 5000 })];
    var d = B.daily(list, S, '2026-11-21', R);
    eq(d.spendDays, 8);
    eq(d.daysLeft, 6);
    eq(d.spentBefore, 60000);
    eq(d.allowance, 26667);
    eq(d.left, 21667);
    eq(d.remaining, 155000);
    eq(d.state, 'ok');
    eq(B.yen(d.allowance), '¥26,667');
  });

  test('AC-B2 / EC-51: an ATM withdrawal of ¥30,000 raises cash by ¥30,000 and leaves Daily spent unchanged', function () {
    var base = [ex({ amount: 4000, method: 'Cash' }), ex({ amount: 2000, method: 'Card' })];
    var before = { c: B.cash(base, S, R), d: B.daily(base, S, '2026-11-21', R) };
    var after = base.concat([ex({ amount: 30000, envelope: 'Cash movement', category: 'ATM withdrawal', method: 'Cash' })]);
    var c = B.cash(after, S, R), d = B.daily(after, S, '2026-11-21', R);
    eq(c.onHand - before.c.onHand, 30000);
    eq(c.onHand, 50000 + 30000 - 4000);
    eq(d.spentToday, before.d.spentToday, 'Daily spent today');
    eq(d.spentTotal, before.d.spentTotal, 'Daily spent total');
    eq(d.left, before.d.left);
  });

  test('cash on hand counts cash spending in every envelope; a cash tax refund puts yen back', function () {
    var list = [ex({ amount: 3000, method: 'Cash' }), ex({ amount: 8000, envelope: 'Shopping', category: 'Shopping', method: 'Cash' }),
      ex({ amount: 800, envelope: 'Shopping', category: 'Tax refund', method: 'Cash' }), ex({ amount: 5000, method: 'Suica' })];
    eq(B.cash(list, S, R).onHand, 50000 - 3000 - 8000 + 800);
    eq(B.cash(list, Object.assign({}, S, { startingCash: null }), R).startingSet, false);
  });

  test('EC-56: over budget gives a negative left today in the over state; later days recalculate', function () {
    var list = [ex({ amount: 40000 })];
    var d = B.daily(list, S, '2026-11-21', R);
    eq(d.allowance, Math.round(220000 / 6));
    eq(d.left, 36667 - 40000);
    eq(d.state, 'over');
    eq(B.yen(d.left), '−¥3,333');
    var next = B.daily(list, S, '2026-11-22', R);
    eq(next.allowance, Math.round(180000 / 5), 'tomorrow spreads what is left');
    ok(isFinite(next.left));
  });

  test('getting close below 25% of the allowance; a spent-out budget never shows NaN or ∞', function () {
    eq(B.daily([ex({ amount: 30000 })], S, '2026-11-21', R).state, 'close');
    var gone = B.daily([ex({ tripDate: '2026-11-19', amount: 230000 })], S, '2026-11-26', R);
    eq(gone.daysLeft, 1);
    eq(gone.allowance, -10000);
    ok(isFinite(gone.left) && isFinite(gone.fill), JSON.stringify(gone));
    eq(gone.state, 'over');
  });

  test('before Nov 19 the allowance is a preview (budget ÷ 8); after Nov 26 totals only', function () {
    var pre = B.daily([], S, '2026-11-10', R);
    eq(pre.phase, 'before'); eq(pre.allowance, 27500); eq(pre.left, 27500);
    var post = B.daily([ex({ tripDate: '2026-11-25', amount: 9000 })], S, '2026-11-27', R);
    eq(post.phase, 'after'); eq(post.allowance, null); eq(post.left, null); eq(post.spentTotal, 9000);
    eq(B.daily([], {}, '2026-11-21', R).allowance, null, 'no settings: no number, no crash');
  });

  test('EC-58: an expense dated on another trip day counts toward that day', function () {
    var list = [ex({ tripDate: '2026-11-20', amount: 12000 })];
    eq(B.daily(list, S, '2026-11-21', R).spentToday, 0);
    eq(B.daily(list, S, '2026-11-21', R).spentBefore, 12000);
    eq(B.daily(list, S, '2026-11-20', R).spentToday, 12000);
  });

  test('deleted rows and V-11 rows are left out of every total', function () {
    var list = [ex({ amount: 5000, deleted: true }), ex({ amount: 7000, excluded: true }), ex({ amount: 1.5 }), ex({ amount: 2000 })];
    eq(B.daily(list, S, '2026-11-21', R).spentToday, 2000);
    eq(B.counted(list).length, 1);
  });

  test('EC-54: pre-trip USD bookings land in Bookings at the current rate, never in Daily', function () {
    var list = [ex({ amount: 120, currency: 'USD', envelope: 'Bookings', category: 'Tickets', tripDate: '2026-10-20' })];
    eq(B.daily(list, S, '2026-11-21', R).spentTotal, 0);
    var b = B.bookings(list, [], '2026-11-21', R);
    eq(b.paid.length, 1); eq(b.paidJpy, 18000);
    eq(B.jpyOf({ amount: 99, currency: 'USD' }, { rate: 158.3 }), 15672, 'rounded to whole yen');
    eq(B.jpyOf({ amount: 99, currency: 'USD' }, { rate: null }), null);
  });

  test('Bookings due: Pay-at-hotel stays with a Total, until check-in has passed', function () {
    var hotels = [{ id: 'h1', nameEn: 'Fake Inn', checkIn: '2026-11-21', payment: 'Pay at hotel', total: 60000, currency: 'JPY', freeCancelBy: '2026-11-18' },
      { id: 'h2', nameEn: 'Fake Prepaid', checkIn: '2026-11-23', payment: 'Prepaid', total: 90000 },
      { id: 'h3', nameEn: 'Fake No Total', checkIn: '2026-11-24', payment: 'Pay at hotel', total: null },
      { id: 'h4', nameEn: 'Fake USD', checkIn: '2026-11-24', payment: 'pay at hotel ', total: 400, currency: 'USD' }];
    var b = B.bookings([], hotels, '2026-11-21', R);
    deepEq(b.due.map(function (d) { return d.id; }), ['h1', 'h4']);
    eq(b.dueJpy, 60000 + 60000);
    eq(b.due[0].freeCancelBy, '2026-11-18');
    eq(B.bookings([], hotels, '2026-11-22', R).due.length, 1, 'past check-in drops off');
  });

  test('Shopping: tax refund reduces spent; pending tax-free purchases are counted', function () {
    var list = [ex({ envelope: 'Shopping', category: 'Shopping', amount: 22000, taxFree: true, refundStatus: 'Pending' }),
      ex({ envelope: 'Shopping', category: 'Shopping', amount: 5000 }),
      ex({ envelope: 'Shopping', category: 'Tax refund', amount: 2000 })];
    var s = B.shopping(list, S, R);
    eq(s.spent, 25000); eq(s.refunds, 2000); eq(s.left, 75000); eq(s.pendingRefunds, 1); eq(s.pendingJpy, 22000);
    eq(B.shopping(list, Object.assign({}, S, { shoppingBudget: null }), R).left, null);
  });

  test('EC-53: tax-free purchase Pending → Received at Haneda; the refund entry reduces Shopping', function () {
    var buy = ex({ envelope: 'Shopping', category: 'Shopping', amount: 22000, taxFree: true, refundStatus: 'Pending' });
    var s = B.shopping([buy], S, R);
    eq(s.pendingRefunds, 1); eq(s.spent, 22000);
    var got = [Object.assign({}, buy, { refundStatus: 'Received' }), ex({ envelope: 'Shopping', category: 'Tax refund', amount: 2000, tripDate: '2026-11-26' })];
    s = B.shopping(got, S, R);
    eq(s.pendingRefunds, 0, 'Received is no longer pending');
    eq(s.spent, 20000); eq(s.refunds, 2000);
    eq(B.daily(got, S, '2026-11-26', R).spentTotal, 0, 'never touches Daily');
  });

  test('EC-52: a Suica top-up is Transit spending in Daily, and a cash top-up leaves the wallet', function () {
    eq(B.envelopeFor('Transit'), 'Daily');
    var list = [ex({ category: 'Transit', amount: 5000, method: 'Cash', note: 'Suica top-up' })];
    var d = B.daily(list, S, '2026-11-21', R);
    eq(d.spentToday, 5000);
    eq(B.cash(list, S, R).onHand, 50000 - 5000, 'a cash top-up leaves the wallet');
  });

  test('EC-57 / AC-B6: live rate, else the cached rate with its date, else the fallback, labelled', function () {
    var live = B.rate({ fxLive: 152.4, fxFallback: 158.3 }, null, '2026-11-21T03:00:00Z');
    eq(live.source, 'live'); eq(live.rate, 152.4); eq(live.date, '2026-11-21');
    var cached = B.rate({ fxLive: null, fxFallback: 158.3 }, { rate: 151, date: '2026-11-19' }, '2026-11-21T03:00:00Z');
    eq(cached.source, 'cached'); eq(cached.rate, 151);
    ok(/rate from Thu, Nov 19|rate from .*Nov 19/.test(B.rateLabel(cached)), B.rateLabel(cached));
    var fb = B.rate({ fxLive: undefined, fxFallback: 158.3 }, null, null);
    eq(fb.source, 'fallback'); ok(/fallback/.test(B.rateLabel(fb)));
    eq(B.rate({ fxLive: 1, fxFallback: 158.3 }, null, null).source, 'fallback', 'a broken live value is ignored');
    eq(B.rate({}, null, null).rate, null);
    eq(B.usdOf(30000, { rate: 158.3 }), 190, 'the ≈ $190 in the confirm prompt');
  });

  test('envelope follows the category', function () {
    eq(B.envelopeFor('Food'), 'Daily'); eq(B.envelopeFor('Transit'), 'Daily'); eq(B.envelopeFor('Tax refund'), 'Shopping');
    eq(B.envelopeFor('Lodging'), 'Bookings'); eq(B.envelopeFor('Tickets'), 'Bookings'); eq(B.envelopeFor('ATM withdrawal'), 'Cash movement');
  });

  test('keypad amounts: whole and positive only', function () {
    eq(B.parseAmount('1,200'), 1200); eq(B.parseAmount('¥30000'), 30000); eq(B.parseAmount(' 45 '), 45);
    eq(B.parseAmount('0'), null); eq(B.parseAmount('12.5'), null); eq(B.parseAmount('-5'), null); eq(B.parseAmount(''), null);
    eq(B.parseAmount('1e5'), null); eq(B.parseAmount('9999999999'), null);
  });

  test('calculator: what a price would leave for today', function () {
    var d = B.daily([ex({ amount: 5000 })], S, '2026-11-21', R);
    eq(B.leaveAfter(d, 3000), d.left - 3000);
    eq(B.leaveAfter(B.daily([], S, '2026-11-27', R), 3000), null);
  });

  test('AC-B7: CSV has every non-deleted expense with JPY and USD columns, escaped and formula-safe', function () {
    var list = [ex({ tripDate: '2026-11-20', amount: 3000, note: 'ramen, "big"', createdAt: '2026-11-20T03:00:00Z' }),
      ex({ amount: 120, currency: 'USD', envelope: 'Bookings', category: 'Tickets', tripDate: '2026-10-01', note: '=HYPERLINK("x")' }),
      ex({ amount: 999, deleted: true, note: 'gone' }),
      ex({ amount: 'abc', excluded: true, note: 'bad row' })];
    var text = B.csv(list, { rate: 150 });
    ok(text.charCodeAt(0) === 0xFEFF, 'BOM');
    var lines = text.slice(1).trim().split('\r\n');
    eq(lines.length, 4, 'header + 3 non-deleted');
    ok(/^Trip date,Category,Envelope,Amount,Currency,JPY,USD,/.test(lines[0]));
    ok(lines[1].indexOf('2026-10-01,Tickets,Bookings,120,USD,18000,120.00') === 0, lines[1]);
    ok(lines[1].indexOf('"\'=HYPERLINK(""x"")"') > 0, 'formula neutralised: ' + lines[1]);
    ok(lines[2].indexOf('2026-11-20,Food,Daily,3000,JPY,3000,20.00') === 0, lines[2]);
    ok(lines[2].indexOf('"ramen, ""big"""') > 0, lines[2]);
    ok(!/gone/.test(text));
    ok(/bad row/.test(lines[3]) && /,abc,JPY,,,/.test(lines[3]), 'bad amount: no JPY/USD: ' + lines[3]);
    var refund = B.csv([ex({ envelope: 'Shopping', category: 'Tax refund', amount: 1500 })], { rate: 150 }).slice(1).trim().split('\r\n')[1];
    ok(/,Tax refund,Shopping,1500,JPY,-1500,-10\.00,/.test(refund), 'refund is negative: ' + refund);
  });
});
