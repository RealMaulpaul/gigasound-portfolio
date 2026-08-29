/* Visit counter. Uses Abacus (abacus.jasoncameron.dev), a free, no-signup
   counting service. The first page view in a browsing session increments the
   count; later views only read it.

   The last number seen is kept in localStorage and shown straight away, before
   any request goes out. Reloading cancels a request that has not come back
   yet, and without the stored number that left the line blank for anyone
   reloading quickly. Now the stored number stands whenever a request is
   cancelled or fails, and the line is hidden only for someone who has never
   successfully loaded a count. A fresh read is skipped if one succeeded within
   the last minute, which keeps a held-down reload key off the service. */
(function () {
  var NS = 'gigasoundproject.com';
  var KEY = 'visits';
  var BASE = 'https://abacus.jasoncameron.dev/';
  var MIN_GAP_MS = 60000;

  var line = document.getElementById('visits');
  var out = document.getElementById('visit-count');
  if (!line || !out) return;

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function show(n) {
    out.textContent = Number(n).toLocaleString();
    line.hidden = false;
  }

  var cached = load('gs-visits');
  if (cached !== null && cached !== '') show(cached);

  var counted = false;
  try { counted = sessionStorage.getItem('gs-counted') === '1'; } catch (e) {}

  // Nothing to gain from asking again this soon.
  var last = parseInt(load('gs-visits-at') || '0', 10);
  if (counted && cached !== null && Date.now() - last < MIN_GAP_MS) return;

  fetch(BASE + (counted ? 'get/' : 'hit/') + NS + '/' + KEY)
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (data) {
      if (typeof data.value !== 'number') return;
      try { sessionStorage.setItem('gs-counted', '1'); } catch (e) {}
      store('gs-visits', String(data.value));
      store('gs-visits-at', String(Date.now()));
      show(data.value);
    })
    .catch(function () { /* the stored number, if any, stays on screen */ });
})();
