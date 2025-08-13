const BASE_URL = "https://ok.okanime.xyz";
const SEARCH_URL = `${BASE_URL}/search/?s=`;
const MEGAMAX_HEADERS = {
  "X-Inertia-Partial-Component": "files/mirror/video",
  "X-Inertia-Partial-Data": "streams",
  "X-Requested-With": "XMLHttpRequest",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0"
};

async function searchResults(keyword) {
    try {
        const pages = Array.from({ length: 5 }, (_, i) => i + 1);
        const results = [];
        const seen = new Set();

        for (const page of pages) {
            const url = `${SEARCH_URL}${encodeURIComponent(keyword)}&page=${page}`;
            const res = await soraFetch(url, { headers: { Referer: BASE_URL, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0" } });
            if (!res) continue;
            const html = await res.text();

            const itemRegex = /<div class="col-6 col-sm-4 col-lg-3 col-xl-2dot4[^"]*">([\s\S]*?)(?=<div class="col-6|$)/g;
            const items = html.match(itemRegex) || [];

            items.forEach(itemHtml => {
                const hrefMatch = itemHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*anime-details[^"]*">/);
                const imgMatch = itemHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
                const titleMatch = itemHtml.match(/<h3>([^<]+)<\/h3>/);

                const href = hrefMatch ? hrefMatch[1].trim() : "";
                const image = imgMatch ? imgMatch[1].trim() : "";
                const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : "";

                if (href && image && title && !seen.has(href)) {
                    seen.add(href);
                    results.push({ title, href, image });
                }
            });
        }

        return JSON.stringify(results);
    } catch (error) {
        console.error("Search error:", error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const res = await soraFetch(url);
        const html = await res.text();

        const details = [];
        const descriptionMatch = html.match(/<div class="review-content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
        let description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : "";

        const airdateMatch = html.match(/<div class="full-list-info">\s*<small>\s* سنة بداية العرض \s*<\/small>\s*<small>\s*(\d{4})\s*<\/small>\s*<\/div>/);
        let airdate = airdateMatch ? airdateMatch[1].trim() : "";

        const genres = [];
        const aliasesMatch = html.match(/<div class="review-author-info">([\s\S]*?)<\/div>/);
        const inner = aliasesMatch ? aliasesMatch[1] : "";

        const anchorRe = /<a[^>]*class="subtitle mr-1 mt-2 "[^>]*>([^<]+)<\/a>/g;
        let m;
        while ((m = anchorRe.exec(inner)) !== null) {
            genres.push(m[1].trim());
        }

        if (description && airdate) {
            details.push({
                description: description,
                aliases: genres.join(", "),
                airdate: airdate
            });
        }

        return JSON.stringify(details);
    } catch (error) {
        console.error("Details error:", error);
        return JSON.stringify([{
            description: "Error loading description",
            aliases: "",
            airdate: ""
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const res = await soraFetch(url);
        const html = await res.text();

        const episodes = [];
        const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>\s*الحلقة\s*(\d+)\s*<\/a>/gi;
        const plainTextRegex = /<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/gi;

        let matches;
        if ((matches = html.match(htmlRegex))) {
            matches.forEach(link => {
                const hrefMatch = link.match(/href="([^"]+)"/);
                const numberMatch = link.match(/<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/);
                if (hrefMatch && numberMatch) {
                    episodes.push({ href: hrefMatch[1], number: parseInt(numberMatch[1], 10) });
                }
            });
        } else if ((matches = html.match(plainTextRegex))) {
            matches.forEach(match => {
                const numberMatch = match.match(/\d+/);
                if (numberMatch) {
                    episodes.push({ href: null, number: parseInt(numberMatch[0], 10) });
                }
            });
        }

        episodes.sort((a, b) => a.number - b.number);
        return JSON.stringify(episodes);
    } catch (error) {
        console.error("Episodes error:", error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
  const multiStreams = { streams: [] };

  function resolveForFetch(raw) {
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return "https:" + raw;
    return raw;
  }

  function cleanTitle(title) {
    return title.replace(/\s*\(source\)\s*/i, "");
  }

  try {
    const res = await soraFetch(url, { headers: { Referer: BASE_URL } });
    const html = await res.text();

    const containerMatch = html.match(
      /<div class="filter-links-container overflow-auto" id="streamlinks">([\s\S]*?)<\/div>/
    );
    if (!containerMatch) throw new Error("Stream links container not found.");
    const containerHTML = containerMatch[1];

    // === MP4UPLOAD ===
    const mp4uploadMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*mp4upload\.com[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of mp4uploadMatches) {
      const embedUrl = normalizeEmbedUrl(match[1]);
      const quality = cleanTitle((match[2] || "Unknown").trim());
      const stream = await mp4Extractor(embedUrl);
      if (stream?.url) {
        multiStreams.streams.push({
          title: `[${quality}] Mp4upload`,
          streamUrl: stream.url,
          headers: stream.headers || null
        });
      }
    }

    // === UQLOAD ===
    const uqloadMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*uqload\.net[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of uqloadMatches) {
      const embedUrl = normalizeEmbedUrl(match[1]);
      const quality = cleanTitle((match[2] || "Unknown").trim());
      const stream = await uqloadExtractor(embedUrl);
      if (stream?.url) {
        multiStreams.streams.push({
          title: `[${quality}] Uqload`,
          streamUrl: stream.url,
          headers: stream.headers || null
        });
      }
    }

    // === VIDMOLY ===
    const vidmolyMatches = [...containerHTML.matchAll(/<a[^>]*data-src="(\/\/vidmoly\.to[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of vidmolyMatches) {
      const embedUrl = match[1].trim();
      const quality = cleanTitle((match[2] || "Unknown").trim());
      const stream = await vidmolyExtractor(embedUrl);
      if (stream?.url) {
        multiStreams.streams.push({
          title: `[${quality}] Vidmoly`,
          streamUrl: stream.url,
          headers: stream.headers || null
        });
      } else if (typeof stream === "string" && stream) {
        multiStreams.streams.push({
          title: `[${quality}] Vidmoly`,
          streamUrl: stream,
          headers: null
        });
      }
    }

    // === VKVIDEO ===
    const vkvideoMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*vkvideo\.ru[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of vkvideoMatches) {
      const embedUrl = normalizeVkUrl(match[1]);
      const quality = cleanTitle((match[2] || "Unknown").trim());
      const stream = await vkvideoExtractor(embedUrl);
      if (stream?.url) {
        multiStreams.streams.push({
          title: `[${quality}] VKVideo`,
          streamUrl: stream.url,
          headers: stream.headers || null
        });
      }
    }

    // === MEGAMAX ===
    const megamaxRegex = /<a[^>]*data-src="([^"]*megamax\.(?:me|cam)[^"]*)"[^>]*>\s*(?:<span[^>]*>([^<]*)<\/span>)?([^<]*)<\/a>/g;
    const megamaxMatches = [...containerHTML.matchAll(megamaxRegex)];
    if (megamaxMatches.length > 0) {
      const bestPerProvider = {};

      await Promise.all(megamaxMatches.map(async m => {
        const rawEmbed = normalizeEmbedUrl(m[1]);
        const spanQ = (m[2] || "").trim();
        const plainQ = (m[3] || "").trim();
        const quality = cleanTitle(spanQ || plainQ || "Unknown");

        try {
          const iframeHeaders = { ...MEGAMAX_HEADERS, Referer: url };
          const embHtml = await (await soraFetch(resolveForFetch(rawEmbed), { headers: iframeHeaders, method: "GET" })).text();

          const dataPageMatch = embHtml.match(/data-page="([^"]+)"/);
          if (dataPageMatch) {
            const decoded = dataPageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
            const parsed = JSON.parse(decoded);
            const streamsArr = parsed?.props?.streams?.data || [];
            for (const s of streamsArr) {
              const qLabel = cleanTitle(s.label || quality);
              for (const mmirror of (s.mirrors || [])) {
                const driver = mmirror.driver.toLowerCase();
                if (!["voe", "streamwish", "vidhide", "filemoon", "mp4upload"].includes(driver)) continue;
                if (!bestPerProvider[driver] || compareQualityLabels(qLabel, bestPerProvider[driver].quality) > 0) {
                  bestPerProvider[driver] = { quality: qLabel, link: normalizeEmbedUrl(mmirror.link || "") };
                }
              }
            }
          }
        } catch {}
      }));

      await Promise.all(Object.entries(bestPerProvider).map(async ([provider, item]) => {
        const fetchUrl = resolveForFetch(item.link);
        let providerHtml = null;

        if (provider !== "mp4upload") {
          const providerRes = await soraFetch(fetchUrl, { headers: { Referer: url }, method: "GET" });
          if (!providerRes) return;
          providerHtml = await providerRes.text();
        }

        let extractorResult = null;
        if (provider === "voe") {
          extractorResult = await voeExtractor(providerHtml, fetchUrl);
          if (extractorResult && typeof extractorResult !== "string" && !extractorResult.headers) {
            const redirectMatch = providerHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
            if (redirectMatch) {
              try {
                const redirectUrl = redirectMatch[1];
                const refererBase = redirectUrl.split("/e/")[0] + "/";
                extractorResult.headers = { Referer: refererBase };
              } catch {
                extractorResult.headers = { Referer: "https://voe.sx/" };
              }
            } else {
              extractorResult.headers = { Referer: "https://voe.sx/" };
            }
          }
        }
        else if (provider === "streamwish" || provider === "vidhide") extractorResult = await streamwishExtractor(providerHtml, fetchUrl);
        else if (provider === "filemoon") extractorResult = await filemoonExtractor(providerHtml || fetchUrl, fetchUrl);
        else if (provider === "mp4upload") extractorResult = await mp4Extractor(fetchUrl);

        if (extractorResult) {
          multiStreams.streams.push({
            title: `${provider}-${cleanTitle(item.quality)} [Megamax]`,
            streamUrl: typeof extractorResult === "string" ? extractorResult : extractorResult.url,
            headers: typeof extractorResult === "string" ? null : extractorResult.headers || null
          });
        }
      }));
    }

    return JSON.stringify(multiStreams);
  } catch (error) {
    console.error("Error in extractStreamUrl:", error);
    return JSON.stringify({ streams: [] });
  }
}

function normalizeEmbedUrl(raw) {
  if (!raw) return "";
  return raw.replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
}

function pickNumberFromLabel(label = "") {
  const m = label.match(/(\d{2,4})p/);
  return m ? parseInt(m[1], 10) : 0;
}

function compareQualityLabels(a, b) {
  return pickNumberFromLabel(a) - pickNumberFromLabel(b);
}

function voeRot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}
function voeRemovePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let result = str;
  for (const pat of patterns) result = result.split(pat).join("");
  return result;
}
function voeBase64Decode(str) {
  if (typeof atob === "function") return atob(str);
  return Buffer.from(str, "base64").toString("utf-8");
}
function voeShiftChars(str, shift) {
  return str.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - shift)).join("");
}

async function voeExtractor(html, url = null) {
  let redirectUrl = null;

  const redirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
  if (redirectMatch) {
    redirectUrl = redirectMatch[1].startsWith("http")
      ? redirectMatch[1]
      : (url ? new URL(redirectMatch[1], url).toString() : redirectMatch[1]);

    console.log("VOE redirect found:", redirectUrl);

    try {
      const res = await soraFetch(redirectUrl, { headers: { Referer: url || redirectUrl } });
      html = await res.text();
    } catch (e) {
      console.error("Failed to fetch redirected VOE page:", e);
      return null;
    }
  }

  const jsonScriptMatch = html.match(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!jsonScriptMatch) {
    console.log("No application/json script tag found");
    return null;
  }

  const obfuscatedJson = jsonScriptMatch[1].trim();
  let data;
  try {
    data = JSON.parse(obfuscatedJson);
  } catch {
    throw new Error("Invalid JSON input.");
  }
  if (!Array.isArray(data) || typeof data[0] !== "string") {
    throw new Error("Input doesn't match expected format.");
  }
  let obfuscatedString = data[0];

  let step1 = voeRot13(obfuscatedString);
  let step2 = voeRemovePatterns(step1);
  let step3 = voeBase64Decode(step2);
  let step4 = voeShiftChars(step3, 3);
  let step5 = step4.split("").reverse().join("");
  let step6 = voeBase64Decode(step5);

  let result;
  try {
    result = JSON.parse(step6);
  } catch (e) {
    throw new Error("Final JSON parse error: " + e.message);
  }

  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      (result.source || []).map((source) => source.direct_access_url).find((u) => u && u.startsWith("http"));
    if (streamUrl) {
      console.log("Voe Stream URL:", streamUrl);
      const referer = redirectUrl
        ? new URL(redirectUrl).origin + "/"
        : "https://voe.sx/";
      return { url: streamUrl, headers: { Referer: referer } };
    }
  }
  return null;
}

/* ----------------- (p.a.c.k.e.r.) helpers ----------------- */
class Unbaser {
  constructor(base) {
    this.ALPHABET = {
      62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'"
    };
    this.dictionary = {};
    this.base = base;
    if (36 < base && base < 62) {
      this.ALPHABET[base] = this.ALPHABET[base] || this.ALPHABET[62].substr(0, base);
    }
    if (2 <= base && base <= 36) {
      this.unbase = (value) => parseInt(value, base);
    } else {
      try {
        [...this.ALPHABET[base]].forEach((cipher, index) => {
          this.dictionary[cipher] = index;
        });
      } catch (er) {
        throw Error("Unsupported base encoding.");
      }
      this.unbase = this._dictunbaser;
    }
  }
  _dictunbaser(value) {
    let ret = 0;
    [...value].reverse().forEach((cipher, index) => {
      ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
    });
    return ret;
  }
}
function detectPacked(source) {
  return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}
function unpack(source) {
  let { payload, symtab, radix, count } = _filterargs(source);
  if (count != symtab.length) throw Error("Malformed p.a.c.k.e.r. symtab.");
  let unbase;
  try {
    unbase = new Unbaser(radix);
  } catch (e) {
    throw Error("Unknown p.a.c.k.e.r. encoding.");
  }
  function lookup(match) {
    const word = match;
    let word2;
    if (radix == 1) word2 = symtab[parseInt(word)];
    else word2 = symtab[unbase.unbase(word)];
    return word2 || word;
  }
  source = payload.replace(/\b\w+\b/g, lookup);
  return _replacestrings(source);

  function _filterargs(source) {
    const juicers = [
      /}\('(.*)', *(\n?\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
      /}\('(.*)', *(\n?\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
    ];
    for (const juicer of juicers) {
      const args = juicer.exec(source);
      if (args) {
        let a = args;
        try {
          return {
            payload: a[1],
            symtab: a[4].split("|"),
            radix: parseInt(a[2]),
            count: parseInt(a[3]),
          };
        } catch (ValueError) {
          throw Error("Corrupted p.a.c.k.e.r. data.");
        }
      }
    }
    throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
  }

  function _replacestrings(source) {
    return source;
  }
}

async function streamwishExtractor(data, url = null) {
  const obfuscatedScriptMatch = data.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
  if (!obfuscatedScriptMatch) throw new Error("No packed script found for streamwish");
  const obfuscatedScript = obfuscatedScriptMatch[1];
  const unpackedScript = unpack(obfuscatedScript);
  const m3u8Match = unpackedScript.match(/"hls2"\s*:\s*"([^"]+)"/);
  const m3u8Url = m3u8Match ? m3u8Match[1] : null;
  return m3u8Url;
}

async function filemoonExtractor(html, url = null) {
  try {
    let workingHtml = html;
    const iframeRegex = /<iframe[^>]+src="([^"]+)"[^>]*><\/iframe>/;
    const iframeMatch = (typeof workingHtml === "string") ? workingHtml.match(iframeRegex) : null;
    if (iframeMatch) {
      const iframeUrl = iframeMatch[1];
      const iframeRes = await soraFetch(iframeUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Referer": url
        },
        method: "GET",
        encoding: "utf-8"
      });
      if (!iframeRes) return null;
      workingHtml = await iframeRes.text();
    } else if (!iframeMatch && (typeof workingHtml === "string" && workingHtml.startsWith("http"))) {
      const resp = await soraFetch(workingHtml, { headers: { Referer: url }, method: "GET", encoding: "utf-8" });
      if (!resp) return null;
      workingHtml = await resp.text();
    }

    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let m;
    while ((m = scriptRegex.exec(workingHtml)) !== null) scripts.push(m[1]);
    const evalScript = scripts.find(s => /eval\(/.test(s) && /m3u8/.test(s));
    if (!evalScript) return null;
    const unpacked = unpack(evalScript);
    const m3u8Match = unpacked.match(/https?:\/\/[^\s]+master\.m3u8[^\s]*?(\?[^"]*)?/);
    if (m3u8Match) return m3u8Match[0];
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * @name vidmolyExtractor
 * @author Ibro
 */
async function vidmolyExtractor(html, url = null) {
  const regexSub = /<option value="([^"]+)"[^>]*>\s*SUB - Omega\s*<\/option>/;
  const regexFallback = /<option value="([^"]+)"[^>]*>\s*Omega\s*<\/option>/;
  const fallback =
    /<option value="([^"]+)"[^>]*>\s*SUB v2 - Omega\s*<\/option>/;

  let match =
    html.match(regexSub) || html.match(regexFallback) || html.match(fallback);
  if (match) {
    const decodedHtml = atob(match[1]);
    const iframeMatch = decodedHtml.match(/<iframe\s+src="([^"]+)"/);

    if (!iframeMatch) {
      console.log("Vidmoly extractor: No iframe match found");
      return null;
    }

    const streamUrl = iframeMatch[1].startsWith("//")
      ? "https:" + iframeMatch[1]
      : iframeMatch[1];

    const responseTwo = await soraFetch(streamUrl);
    const htmlTwo = await responseTwo.text();

    const m3u8Match = htmlTwo.match(/sources:\s*\[\{file:"([^"]+\.m3u8)"/);
    return m3u8Match ? m3u8Match[1] : null;
  } else {
    console.log("Vidmoly extractor: No match found, using fallback");
    const sourcesRegex = /sources:\s*\[\{file:"(https?:\/\/[^"]+)"\}/;
    const sourcesMatch = html.match(sourcesRegex);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;

    return sourcesString;
  }
}

async function vkvideoExtractor(embedUrl) {
    console.log(embedUrl);
    const headers = {
        "Referer": "https://vk.com/"
    };

    try {
        const response = await soraFetch(embedUrl, {
            method: "GET",
            headers,
            encoding: 'windows-1251'
        });

        const html = await response.text();
        console.log(html);

        const hlsMatch = html.match(/"hls"\s*:\s*"([^"]+)"/);
        if (!hlsMatch || !hlsMatch[1]) {
            throw new Error("HLS stream not found in VK embed");
        }

        const videoSrc = hlsMatch[1].replace(/\\\//g, "/");

        return {
            url: videoSrc,
            headers: headers
        };
    } catch (error) {
        console.log("vkExtractor error: " + error.message);
        return null;
    }
}

async function uqloadExtractor(embedUrl) {
    const headers = { Referer: embedUrl, Origin: "https://uqload.net" };
    const res = await soraFetch(embedUrl, { headers });
    const htmlText = await res.text();
    const match = htmlText.match(/sources:\s*\[\s*"([^"]+\.mp4)"\s*\]/);
    return { url: match ? match[1] : "", headers };
}

async function mp4Extractor(embedUrl) {
    const headers = { Referer: "https://mp4upload.com" };
    const res = await soraFetch(embedUrl, { headers });
    const htmlText = await res.text();
    const streamUrl = extractMp4Script(htmlText);
    return { url: streamUrl, headers };
}

function extractMp4Script(htmlText) {
    const scripts = extractScriptTags(htmlText);
    const srcScript = scripts.find(script => script.includes("player.src"));
    return srcScript
        ? srcScript.split(".src(")[1].split(")")[0].split("src:")[1].split('"')[1]
        : "";
}

function extractScriptTags(html) {
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        scripts.push(match[1]);
    }
    return scripts;
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null, encoding: 'utf-8' }) {
    try {
        return await fetchv2(
            url,
            options.headers ?? {},
            options.method ?? 'GET',
            options.body ?? null,
            true,
            options.encoding ?? 'utf-8'
        );
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
    }
}

function decodeHTMLEntities(text) {
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

  const entities = {
    '&quot;': '"',
    '&amp;': '&',
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>'
  };

  for (const entity in entities) {
    text = text.replace(new RegExp(entity, 'g'), entities[entity]);
  }

  return text;
}

function normalizeVkUrl(url) {
  if (!url) return "";
  return url
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}
