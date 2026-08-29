/* Visit counter. Uses Abacus (abacus.jasoncameron.dev), a free, no-signup
   counting service. The first page view in a browsing session increments the
   count; later views in the same session only read it. If the service is
   unreachable, the line stays hidden rather than showing a broken number. */
(function () {
  var NS = 'gigasoundproject.com';
  var KEY = 'visits';
  var base = 'https://abacus.jasoncameron.dev/';

  var line = document.getElementById('visits');
  var out = document.getElementById('visit-count');
  if (!line || !out) return;

  var counted = false;
  try { counted = sessionStorage.getItem('gs-counted') === '1'; } catch (e) {}

  fetch(base + (counted ? 'get/' : 'hit/') + NS + '/' + KEY)
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (data) {
      if (typeof data.value !== 'number') return;
      try { sessionStorage.setItem('gs-counted', '1'); } catch (e) {}
      out.textContent = data.value.toLocaleString();
      line.hidden = false;
    })
    .catch(function () { /* leave the line hidden */ });
})();
