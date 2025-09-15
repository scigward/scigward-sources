#!/usr/bin/env node
// networkFetch.js
// Faithful Puppeteer replica of Sora's Swift NetworkFetch (JS injected exactly, window.webkit shim, header modification)
//
// Usage (CLI): node networkFetch.js <url> [--timeout N] [--returnHTML] [--cutoff KEY] [--click sel] [--wait sel] [--maxWait N] [--header "Key: Value"]
//
// Exports: { networkFetch }

const puppeteer = require('puppeteer');

const DEFAULTS = {
  timeoutSeconds: 10,
  headers: {},
  cutoff: null,
  returnHTML: false,
  clickSelectors: [],
  waitForSelectors: [],
  maxWaitTime: 5
};

function buildInterceptorScript() {
  // This JS mirrors the Swift-injected code verbatim (functionality-wise),
  // plus a shim so window.webkit.messageHandlers.networkLogger.postMessage(...) routes to __NETLOG__.
  return `
(function() {
  function postPayload(obj) {
    try { console.log('__NETLOG__' + JSON.stringify(obj)); } catch(e) {}
  }

  // shim for iOS-style messageHandlers so the same JS calls work
  try {
    if (!window.webkit) window.webkit = {};
    if (!window.webkit.messageHandlers) window.webkit.messageHandlers = {};
    if (!window.webkit.messageHandlers.networkLogger) {
      window.webkit.messageHandlers.networkLogger = {
        postMessage: function(msg) {
          try {
            // normalize the message into a small object
            const trimmed = {};
            if (msg && typeof msg === 'object') {
              if ('type' in msg) trimmed.type = msg.type;
              if ('url' in msg) trimmed.url = msg.url;
              if ('results' in msg) trimmed.results = msg.results;
              if ('path' in msg) trimmed.path = msg.path;
            } else {
              trimmed.type = 'unknown';
              trimmed.raw = String(msg);
            }
            postPayload(trimmed);
          } catch(e) {}
        }
      };
    }
  } catch(e) {}

  // helper used by many interceptors
  function __post(type, payload) {
    try {
      const obj = Object.assign({ type: type }, payload || {});
      // Ensure both console and window.webkit path are available.
      try {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.networkLogger && typeof window.webkit.messageHandlers.networkLogger.postMessage === 'function') {
          window.webkit.messageHandlers.networkLogger.postMessage(obj);
        } else {
          postPayload(obj);
        }
      } catch(e) {
        postPayload(obj);
      }
    } catch(e) {}
  }

  // Anti fingerprinting
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
    try { delete window.navigator.__proto__.webdriver; } catch(e) {}
    window.chrome = window.chrome || { runtime: {} };
    Object.defineProperty(navigator, 'permissions', { get: () => undefined });
  } catch(e) {}

  // Fetch interceptor
  (function() {
    const origFetch = window.fetch;
    window.fetch = function() {
      try {
        const url = arguments[0];
        const full = new URL(url, window.location.href).href;
        __post('fetch', { url: full });
      } catch(e) {
        try { __post('fetch', { url: String(arguments[0]) }); } catch(e){}
      }
      return origFetch.apply(this, arguments);
    };
  }());

  // XHR interception
  (function(){
    const XHROpen = XMLHttpRequest.prototype.open;
    const XHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      try {
        this._url = new URL(url, window.location.href).href;
      } catch(e) {
        this._url = url;
      }
      __post('xhr-open', { url: this._url, method: method });
      return XHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      try { if (this._url) __post('xhr-send', { url: this._url }); } catch(e){}
      const self = this;
      const origOnReady = this.onreadystatechange;
      this.onreadystatechange = function() {
        try {
          if (self.readyState === 4) {
            const respUrl = self.responseURL || self._url;
            __post('xhr-response', { url: respUrl });
            try {
              const text = self.responseText || '';
              const regex = /(https?:\\/\\/[^\\s"'<>]+\\.(m3u8|ts|mp4|webm|mkv))/ig;
              let m;
              while ((m = regex.exec(text)) !== null) {
                __post('response-content', { url: m[0] });
              }
            } catch(e){}
          }
        } catch(e){}
        if (origOnReady) try { origOnReady.apply(this, arguments); } catch(e){}
      };
      return XHRSend.apply(this, arguments);
    };
  }());

  // WebSocket hook
  (function() {
    try {
      const OrigWS = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        __post('websocket', { url: url && url.toString ? url.toString() : String(url) });
        if (arguments.length === 1) return new OrigWS(url);
        return new OrigWS(url, protocols);
      };
      Object.keys(OrigWS).forEach(k => window.WebSocket[k] = OrigWS[k]);
    } catch(e){}
  }());

  // Hook URL properties (src)
  (function() {
    function hook(obj, prop) {
      try {
        const desc = Object.getOwnPropertyDescriptor(obj.prototype, prop) || {};
        if (!desc || !desc.set) return;
        const origSetter = desc.set;
        Object.defineProperty(obj.prototype, prop, {
          set: function(val) {
            try {
              if (typeof val === 'string' && (val.includes('http') || val.includes('.m3u8') || val.includes('.ts'))) {
                __post('property-set', { prop: prop, url: val });
              }
            } catch(e){}
            return origSetter.call(this, val);
          },
          get: desc.get,
          configurable: true
        });
      } catch(e){}
    }
    ['src'].forEach(p => {
      [HTMLVideoElement, HTMLSourceElement, HTMLScriptElement, HTMLImageElement].forEach(C => {
        try { hook(C, p); } catch(e) {}
      });
    });
  }());

  // JWPlayer aggressive hook (20 attempts)
  (function(){
    let attempts = 0;
    function aggressiveJwHook() {
      attempts++;
      __post('jw-hook-attempt', { attempt: attempts });
      try {
        if (window.jwplayer) {
          __post('jwplayer-detected', {});
          const original = window.jwplayer;
          window.jwplayer = function() {
            const player = original.apply(this, arguments);
            try {
              if (player && player.setup) {
                const origSetup = player.setup;
                player.setup = function(config) {
                  function extractUrls(obj, path) {
                    if (!obj) return;
                    if (typeof obj === 'string') {
                      if (obj.includes('http') || obj.includes('.m3u8') || obj.includes('.ts')) {
                        __post('jwplayer-config', { url: obj, path: path });
                      }
                    } else if (typeof obj === 'object') {
                      Object.keys(obj).forEach(k => extractUrls(obj[k], path + '.' + k));
                    }
                  }
                  try { extractUrls(config, 'config'); } catch(e){}
                  return origSetup.call(this, config);
                };
              }
            } catch(e){}
            return player;
          };
          Object.keys(original).forEach(k => window.jwplayer[k] = original[k]);
        }
      } catch(e){}
      if (attempts < 20) setTimeout(aggressiveJwHook, 200);
    }
    aggressiveJwHook();
  }());

  // waitForElementAndClick (identical semantics to Swift)
  window.waitForElementAndClick = function(waitSelectors, clickSelectors, maxWaitTime) {
    return new Promise(function(resolve) {
      const results = { waitResults: {}, clickResults: [] };
      (waitSelectors || []).forEach(s => results.waitResults[s] = false);
      const start = Date.now();
      const checkInterval = 100;

      function checkAndClick() {
        const elapsed = (Date.now() - start) / 1000;
        try {
          (waitSelectors || []).forEach(function(selector) {
            try {
              const el = document.querySelector(selector);
              if (el && el.offsetParent !== null) {
                results.waitResults[selector] = true;
                try { console.log('Element found and visible:', selector); } catch(e){}
              }
            } catch(e){}
          });
        } catch(e){}

        const allFound = (waitSelectors || []).every(s => results.waitResults[s]) || (waitSelectors || []).length === 0;
        if (allFound || elapsed >= (maxWaitTime || 0)) {
          (clickSelectors || []).forEach(function(selector) {
            try {
              const elements = document.querySelectorAll(selector);
              let clicked = false;
              elements.forEach(function(element) {
                try {
                  if (element && element.offsetParent !== null) {
                    try {
                      element.click();
                      clicked = true;
                      try { console.log('Successfully clicked:', selector); } catch(e){}
                    } catch(e1) {
                      try {
                        const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                        element.dispatchEvent(event);
                        clicked = true;
                        try { console.log('Successfully dispatched click:', selector); } catch(e){}
                      } catch(e2) {
                        try { console.log('Failed to click element:', selector, e2); } catch(e){}
                      }
                    }
                  }
                } catch(e){}
              });
              results.clickResults.push({ selector: selector, success: clicked, elementsFound: elements.length });
            } catch(e) {
              try { console.log('Error clicking selector:', selector, e); } catch(e){}
              results.clickResults.push({ selector: selector, success: false, error: String(e) });
            }
          });

          // mirror Swift messaging
          try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.networkLogger && typeof window.webkit.messageHandlers.networkLogger.postMessage === 'function') {
              window.webkit.messageHandlers.networkLogger.postMessage({ type: 'click-results', results: results });
            } else {
              __post('click-results', { results: results });
            }
          } catch(e) { __post('click-results', { results: results }); }

          resolve(results);
          return;
        } else {
          setTimeout(checkAndClick, checkInterval);
        }
      }

      checkAndClick();
    });
  };

  // simulateUserInteraction (same as Swift)
  window.simulateUserInteraction = function() {
    try {
      setTimeout(function() {
        try {
          const playButtons = document.querySelectorAll('button, div, span, a');
          const filtered = Array.from(playButtons).filter(function(el) {
            try {
              const t = (el.textContent || el.innerText || '').toLowerCase();
              const c = (el.className || '').toLowerCase();
              const id = (el.id || '').toLowerCase();
              const aria = (el.getAttribute && (el.getAttribute('aria-label') || '') || '').toLowerCase();
              return t.includes('play') || c.includes('play') || id.includes('play') || aria.includes('play');
            } catch(e) { return false; }
          });
          filtered.forEach(function(btn, i) {
            setTimeout(function() {
              try { btn.click(); } catch(e) {}
            }, i * 200);
          });
        } catch(e) {}

        try { window.scrollTo(0, document.body.scrollHeight / 2); } catch(e){}
        setTimeout(function() { try { window.scrollTo(0, 0); } catch(e) {} }, 500);

        try {
          document.querySelectorAll('video').forEach(function(v) {
            try { if (v.play && typeof v.play === 'function') v.play().catch(function(){}); } catch(e) {}
          });
        } catch(e) {}

        try {
          if (window.jwplayer && typeof window.jwplayer === 'function') {
            try {
              const instances = (window.jwplayer().getInstances && window.jwplayer().getInstances()) || [];
              instances.forEach(function(p) { try { if (p.play) p.play(); } catch(e) {} });
            } catch(e) {}
          }
        } catch(e) {}

        try {
          if (window.videojs && window.videojs.getAllPlayers) {
            try {
              const p = window.videojs.getAllPlayers();
              Object.keys(p).forEach(function(k) { try { if (p[k] && p[k].play) p[k].play(); } catch(e) {} });
            } catch(e) {}
          }
        } catch(e) {}

      }, 1000);
    } catch(e){}
  };

  // nuclear scans
  (function() {
    function nuclearScan() {
      try {
        __post('nuclear-scan', {});
        Object.keys(window).forEach(function(key) {
          try {
            const value = window[key];
            if (typeof value === 'string' && (value.includes('.m3u8') || value.includes('.ts') || (value.includes('http') && value.includes('.')))) {
              __post('global-variable', { key: key, url: value });
            }
          } catch(e){}
        });
        document.querySelectorAll('script').forEach(function(script) {
          try {
            if (script.textContent) {
              const urlRegex = /(https?:\\/\\/[^\\s"'<>]+\\.(m3u8|ts|mp4))/gi;
              const matches = script.textContent.match(urlRegex);
              if (matches) {
                matches.forEach(function(m) { __post('script-content', { url: m }); });
              }
            }
          } catch(e){}
        });
      } catch(e){}
    }
    setTimeout(nuclearScan, 500);
    setTimeout(nuclearScan, 1500);
    setTimeout(nuclearScan, 3000);
  }());

  __post('interceptor-ready', {});
})();
`;
}

// parse __NETLOG__ messages from page console
function tryParseNetLog(text) {
  if (!text || typeof text !== 'string') return null;
  if (!text.startsWith('__NETLOG__')) return null;
  try { return JSON.parse(text.slice('__NETLOG__'.length)); } catch(e) { return null; }
}

async function networkFetch(url, options = {}) {
  options = Object.assign({}, DEFAULTS, options || {});

  // sanitize url
  if (typeof url === 'string') url = url.trim();

  // Launch browser
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Default headers match Swift URLRequest defaults (we'll merge with options.headers later per-request)
  const baseHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate'
  };

  // Set UA (use options.headers User-Agent if provided; otherwise use browser default)
  const uaFromOptions = (options.headers && (options.headers['User-Agent'] || options.headers['user-agent']));
  const ua = uaFromOptions || (await browser.userAgent()) || 'Mozilla/5.0';
  await page.setUserAgent(ua);

  // we won't set Host here via setExtraHTTPHeaders because Chromium often disallows Host there.
  // Instead we set other headers as defaults and apply full header merging inside request interception.
  const extraHeadersForPage = Object.assign({}, baseHeaders);
  if (!('Referer' in extraHeadersForPage) && !('referer' in extraHeadersForPage)) {
    const referers = ["https://www.google.com/", "https://www.youtube.com/", "https://twitter.com/", "https://www.reddit.com/", "https://www.facebook.com/"];
    extraHeadersForPage['Referer'] = referers[Math.floor(Math.random() * referers.length)];
  }
  await page.setExtraHTTPHeaders(extraHeadersForPage);

  // Data collectors
  const requests = new Set();
  const elementsClicked = [];
  const waitResults = {};
  let htmlCaptured = false;
  let html = null;
  let cutoffTriggered = false;
  let cutoffUrl = null;
  let finished = false;
  let timerHandle = null;

  function addRequest(urlStr) {
    if (!urlStr) return;
    if (!requests.has(urlStr)) {
      requests.add(urlStr);
      if (options.cutoff && typeof options.cutoff === 'string' && urlStr.toLowerCase().includes(options.cutoff.toLowerCase())) {
        cutoffTriggered = true;
        cutoffUrl = urlStr;
        // stop monitoring immediately (mimic Swift)
        finishAndClose('cutoff');
      }
    }
  }

  // console listener: parse __NETLOG__ messages
  page.on('console', msg => {
    try {
      const text = msg.text();
      const payload = tryParseNetLog(text);
      if (!payload) return;
      const t = payload.type;
      if (payload.url) addRequest(payload.url);
      if (t === 'click-results' && payload.results) {
        const cr = payload.results.clickResults || [];
        cr.forEach(r => { if (r.success) elementsClicked.push(r.selector); });
        if (payload.results.waitResults) Object.assign(waitResults, payload.results.waitResults);
      } else if (t === 'jwplayer-config' && payload.url) {
        // sometimes jwplayer-config URLs are posted - capture
        addRequest(payload.url);
      }
    } catch(e){}
  });

  // Request interception: merge headers (baseHeaders + options.headers) and set per request.
  await page.setRequestInterception(true);
  page.on('request', req => {
    try {
      // Merge headers: start with current req.headers, then baseHeaders, then options.headers override.
      const incoming = req.headers() || {};
      const merged = Object.assign({}, incoming);

      // Ensure base defaults exist (don't overwrite if already present in incoming)
      for (const k in baseHeaders) {
        if (!(k in merged) && !(k.toLowerCase() in merged)) merged[k] = baseHeaders[k];
      }

      // If user provided headers, apply them (case sensitive keys as provided)
      if (options.headers && typeof options.headers === 'object') {
        for (const k of Object.keys(options.headers)) {
          const val = options.headers[k];
          if (typeof val !== 'undefined') merged[k] = val;
        }
      }

      // If Referer still missing, set a default (mimic Swift)
      if (!('Referer' in merged) && !('referer' in merged)) {
        const referers = ["https://www.google.com/", "https://www.youtube.com/", "https://twitter.com/", "https://www.reddit.com/", "https://www.facebook.com/"];
        merged['Referer'] = referers[Math.floor(Math.random() * referers.length)];
      }

      // Continue the request with modified headers
      req.continue({ headers: merged });
    } catch(e) {
      try { req.continue(); } catch(_) {}
    }
  });

  // inject the interceptor at document start
  await page.evaluateOnNewDocument(buildInterceptorScript());

  // finish helper: gather html if requested and close browser
  let resolvePromise;
  const resultPromise = new Promise((resolve) => { resolvePromise = resolve; });

  async function finishAndClose(reason = 'completed') {
    if (finished) return;
    finished = true;
    try { if (timerHandle) clearTimeout(timerHandle); } catch(e){}
    try {
      if (options.returnHTML) {
        try { html = await page.content(); htmlCaptured = true; } catch(e) {}
      }
    } catch(e){}
    const result = {
      originalUrl: url,
      requests: Array.from(requests),
      html: html,
      success: true,
      error: null,
      totalRequests: requests.size,
      cutoffTriggered,
      cutoffUrl,
      htmlCaptured,
      elementsClicked,
      waitResults
    };
    try { await browser.close(); } catch(e){}
    resolvePromise(result);
  }

  // set global timeout to mirror Swift timer behavior
  timerHandle = setTimeout(() => {
    // On timeout, Swift either captures HTML (if returnHTML) or stops monitoring
    finishAndClose('timeout');
  }, options.timeoutSeconds * 1000);

  // navigate (permit some extra time in options to allow DOMContentLoaded)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeoutSeconds + 5) * 1000 });
  } catch (err) {
    // Navigation error mirrors Swift failure path
    if (!finished) {
      try { clearTimeout(timerHandle); } catch(e){}
      const result = {
        originalUrl: url,
        requests: Array.from(requests),
        html: null,
        success: false,
        error: String(err),
        totalRequests: requests.size,
        cutoffTriggered,
        cutoffUrl,
        htmlCaptured,
        elementsClicked,
        waitResults
      };
      try { await browser.close(); } catch(e){}
      resolvePromise(result);
      return resultPromise;
    }
  }

  // perform custom interactions (exact same logic and JS as Swift)
  if ((options.waitForSelectors && options.waitForSelectors.length) || (options.clickSelectors && options.clickSelectors.length)) {
    try {
      // call injected window.waitForElementAndClick
      await page.evaluate((w, c, maxWait) => {
        try {
          // note: the injected function posts click-results via window.webkit or __NETLOG__
          window.waitForElementAndClick(w, c, maxWait).then(function(res) {
            try { console.log('__NETLOG__' + JSON.stringify({ type: 'click-results-logged', results: res })); } catch(e){}
          });
        } catch(e) {
          try { console.log('__NETLOG__' + JSON.stringify({ type: 'click-error', error: String(e) })); } catch(e){}
        }
      }, options.waitForSelectors || [], options.clickSelectors || [], options.maxWaitTime);
    } catch(e) {
      // ignore errors; we'll still wait until timeout / cutoff
    }
  } else {
    // fallback simulate user interactions (same as Swift)
    try { await page.evaluate(() => { try { window.simulateUserInteraction(); } catch(e){} }); } catch(e){}
  }

  // return resultPromise; finishAndClose will resolve it either on cutoff or timeout or explicit finish.
  return resultPromise;
}

// CLI wrapper
async function cli() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.log('Usage: node networkFetch.js <url> [--timeout N] [--returnHTML] [--cutoff KEY] [--click sel] [--wait sel] [--maxWait N] [--header "Key: Value"]');
    process.exit(1);
  }
  const url = argv[0];
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--timeout') opts.timeoutSeconds = Number(argv[++i]) || DEFAULTS.timeoutSeconds;
    else if (a === '--returnHTML') opts.returnHTML = true;
    else if (a === '--cutoff') opts.cutoff = argv[++i];
    else if (a === '--click') { opts.clickSelectors = opts.clickSelectors || []; opts.clickSelectors.push(argv[++i]); }
    else if (a === '--wait') { opts.waitForSelectors = opts.waitForSelectors || []; opts.waitForSelectors.push(argv[++i]); }
    else if (a === '--maxWait') opts.maxWaitTime = Number(argv[++i]) || DEFAULTS.maxWaitTime;
    else if (a === '--header') {
      const h = argv[++i] || '';
      const idx = h.indexOf(':');
      if (idx > 0) {
        const key = h.slice(0, idx).trim();
        const val = h.slice(idx + 1).trim();
        opts.headers = opts.headers || {};
        opts.headers[key] = val;
      }
    }
  }

  const res = await networkFetch(url, opts);
  console.log('---- RESULT ----');
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

if (require.main === module) {
  cli();
} else {
  module.exports = { networkFetch };
}
