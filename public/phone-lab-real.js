// Reloads the whole analysis page, as a visitor does, and checks that the
// engines come back. Loaded by _document.tsx while this test is running.
;(function () {
  var KEY = 'phone-lab-real'
  var S = JSON.parse(localStorage.getItem(KEY))
  S.loads++
  localStorage.setItem(KEY, JSON.stringify(S))
  var nativeFetch = window.fetch.bind(window)
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input)
    if (url.indexOf('/analysis/store_engine_analysis/') >= 0) return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    if (url.indexOf('/ingest/') >= 0) return Promise.resolve(new Response(null, { status: 204 }))
    if (url.indexOf('/analysis/get_engine_analysis/') >= 0) return Promise.resolve(new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }))
    return nativeFetch(input, init)
  }
  var errors = []
  var nativeError = console.error.bind(console)
  console.error = function () {
    var t = Array.prototype.map.call(arguments, String).join(' ')
    if (/memory|Failed to|abort|RangeError/i.test(t) && errors.length < 3) errors.push(t.slice(0, 120))
    nativeError.apply(null, arguments)
  }
  var sf = null, maia = null, clicked = false, finished = false
  var finish = function () {
    finished = true
    S.rows.push({ sf: sf, maia: maia, errors: errors })
    localStorage.setItem(KEY, JSON.stringify(S))
    setTimeout(function () {
      if (S.rows.length < S.total) return location.reload()
      localStorage.removeItem(KEY)
      var sec = function (x) { return x == null ? '-' : (x / 1000).toFixed(2) }
      var ok = S.rows.filter(function (r) { return r.sf != null && r.maia != null }).length
      var seen = {}
      S.rows.forEach(function (r) { r.errors.forEach(function (e) { seen[e] = 1 }) })
      var text = 'real reloads of the whole page: both engines back ' + ok + '/' + S.total + ', page restarts it did not ask for: ' + (S.loads - S.total) +
        '\n  SF first ' + S.rows.map(function (r) { return sec(r.sf) }).join(' ') +
        '\n  Maia ' + S.rows.map(function (r) { return sec(r.maia) }).join(' ') +
        '\n  ' + Object.keys(seen).slice(0, 3).join(' ; ') +
        '\n  (took ' + Math.round((Date.now() - S.started) / 1000) + ' s)'
      var store = JSON.parse(localStorage.getItem('phone-lab-v1') || '{}')
      store.results = store.results || {}
      store.results.real = text
      store.order = store.order || []
      if (store.order.indexOf('real') < 0) store.order.push('real')
      store.running = null
      store.resume = true
      localStorage.setItem('phone-lab-v1', JSON.stringify(store))
      location.href = '/phone-lab.html'
    }, 1000)
  }
  var timer = setInterval(function () {
    if (finished) return clearInterval(timer)
    var now = performance.now()
    if (!document.body) return
    if (!clicked) {
      var b = Array.prototype.find.call(document.querySelectorAll('button, [role="button"]'), function (x) { return /Download Maia/.test(x.textContent) })
      if (b) { b.click(); clicked = true }
    }
    var hl = document.querySelector('#analysis-highlight')
    if (hl) {
      if (sf == null) Array.prototype.forEach.call(hl.querySelectorAll('span'), function (s) { if (/^d\d+$/.test(s.textContent.trim())) sf = now })
      if (maia == null && hl.querySelector('button.text-human-1')) maia = now
    }
    if ((sf != null && maia != null) || now > 45000) finish()
  }, 100)
})()
