/* App-wide constants. The version must match sw.js's cache name and the top
   CHANGELOG entry (a unit test checks this; HANDOFF §13). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};

  BT.config = {
    version: '0.4.6',
    api: 1,
    minServerForWrites: '0.2.0',  // older scripts have no mutate; changes wait on the phone
    maxOpsPerPush: 50,
    pushDebounceMs: 2000,         // sync 2 s after a local change (HANDOFF §7)
    requestTimeoutMs: 20000,
    autoSyncMs: 5 * 60 * 1000,
    geoGiveUpMs: 10000,           // Nearby stops waiting for a location answer (iOS can stay silent)
    tripTz: 'Asia/Tokyo',        // D10: all trip logic runs in Japan time
    homeTz: 'America/Los_Angeles',
    envs: ['staging', 'prod'],
    // Fallback trip facts if Settings is missing or unreadable. Real values come from the sheet.
    defaults: {
      tripName: 'Trip',
      cities: ['Osaka', 'Kyoto', 'Tokyo', 'Travel']
    }
  };
})();
