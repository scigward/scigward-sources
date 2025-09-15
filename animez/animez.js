const BASE_URL = 'https://animeyy.com';
const SEARCH_URL = 'https://animeyy.com/?act=search&f[status]=all&f[sortby]=lastest-chap&f[keyword]=';

async function searchResults(keyword) {
    try {
        const response = await soraFetch(`${SEARCH_URL}${encodeURIComponent(keyword)}`);
        const html = await response.text();

        const results = [];

        const regex = /<li class="TPostMv">\s*<article[^>]*>\s*<a href="([^"]+)"\s+title="([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2 class="Title">([^<]+)<\/h2>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            const href = BASE_URL + match[1];
            const titleAttr = decodeHTMLEntities(match[2].trim());
            const imgPath = match[3].replace(/^\/+/, '');
            const titleText = decodeHTMLEntities(match[4].trim());

            results.push({
                title: titleText || titleAttr,
                image: BASE_URL + '/' + imgPath,
                href
            });
        }

        return JSON.stringify(results);
    } catch (error) {
        console.error('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();

        const descMatch = html.match(/<div id="summary_shortened">([\s\S]*?)<\/div>/);
        const description = descMatch ? decodeHTMLEntities(descMatch[1].trim()) : '';

        const aliasMatch = html.match(/<strong>Alternative:<\/strong>\s*([^<]+)/);
        const aliases = aliasMatch ? decodeHTMLEntities(aliasMatch[1].trim()) : '';

        const airdate = '';

        const details = [{
            description,
            aliases,
            airdate
        }];

        return JSON.stringify(details);
    } catch (error) {
        console.log('Details error: ' + error.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: '',
            airdate: ''
        }]);
    }
}

async function extractEpisodes(url) {
  try {
    const pageRes = await soraFetch(url);
    if (!pageRes) throw new Error('Failed to fetch main page');
    const pageHtml = await pageRes.text();

    const mangaMatch = pageHtml.match(/<input[^>]*\bid=['"]manga_id['"][^>]*\bvalue=['"](\d+)['"]/i);
    if (!mangaMatch) return JSON.stringify([]);
    const mangaId = mangaMatch[1];

    const pageNums = [...pageHtml.matchAll(/load_list_chapter\(\s*(\d+)\s*\)/g)].map(m => parseInt(m[1], 10));
    const lastPage = pageNums.length ? Math.max(...pageNums) : 1;

    async function fetchAjaxChunk(ajaxUrl) {
      const res = await soraFetch(ajaxUrl, {
        headers: {
          Referer: url,
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0'
        },
        method: 'GET'
      });
      if (!res) return '';
      const text = await res.text();
      if (!text) return '';
      const m = text.match(/["']list_chap["']\s*:\s*["']([\s\S]*?)["']\s*(?:,|\})/i);
      if (m && m[1]) {
        return unescapeJsonString(m[1]);
      }
      return text;
    }

    const episodes = [];

    const htmlRegex = /<li[^>]*class=["']wp-manga-chapter["'][^>]*>\s*<a\s+href=["']([^"']+)["'][^>]*>\s*(\d+)\s*<\/a>/g;
    for (const m of pageHtml.matchAll(htmlRegex)) {
      const href = BASE_URL + m[1].replace(/^\/+/, '/');
      const num = parseInt(m[2], 10);
      episodes.push({ href, number: num });
    }

    const ajaxUrls = [];
    for (let p = lastPage; p >= 2; p--) {
      ajaxUrls.push(`${BASE_URL}/?act=ajax&code=load_list_chapter&manga_id=${mangaId}&page_num=${p}&chap_id=0&keyword=`);
    }

    const chunks = await Promise.all(ajaxUrls.map(fetchAjaxChunk));
    const epRegex = /<a\s+href=(?:'|")?(\/[^"'<>]+)(?:'|")?[^>]*>\s*(\d+)\s*<\/a>/g;
    for (const chunk of chunks) {
      if (!chunk) continue;
      for (const m of chunk.matchAll(epRegex)) {
        const href = BASE_URL + m[1].replace(/^\/+/, '/');
        const num = parseInt(m[2], 10);
        episodes.push({ href, number: num });
      }
    }

    const seen = new Set();
    const unique = [];
    for (const ep of episodes) {
      if (!ep || !ep.href) continue;
      if (seen.has(ep.href)) continue;
      seen.add(ep.href);
      unique.push({ href: ep.href, number: Number(ep.number) || 0 });
    }
    unique.sort((a, b) => a.number - b.number);

    return JSON.stringify(unique);
  } catch {
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const api = `https://animez-proxy.onrender.com/getStream?url=${encodeURIComponent(
      url
    )}`;
    const resp = await soraFetch(api);
    if (!resp) return JSON.stringify({ streams: [] });
    const json = await resp.json();
    return JSON.stringify(json);

  } catch (e) {
    return JSON.stringify({ streams: [] });

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

function unescapeJsonString(s) {
  if (!s) return '';
    s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    s = s.replace(/\\"/g, '"')
         .replace(/\\\//g, '/')
         .replace(/\\\\/g, '\\')
         .replace(/\\r\\n/g, '\n')
         .replace(/\\n/g, '\n')
         .replace(/\\r/g, '\r')
         .replace(/\\t/g, '\t');
    return s;
}


async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}