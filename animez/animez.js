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
        if (!mangaMatch) {
            console.warn('manga_id not found on page');
            return JSON.stringify([]);
        }
        const mangaId = mangaMatch[1];

        const pageNums = [...pageHtml.matchAll(/load_list_chapter\(\s*(\d+)\s*\)/g)].map(m => parseInt(m[1], 10));
        const lastPage = pageNums.length ? Math.max(...pageNums) : 1;

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

        const epRegex = /<a\s+href=(?:'|")?(\/[^"'<>]+)(?:'|")?[^>]*>\s*([\d]+)\s*<\/a>/g;

        const episodes = [];

        for (let p = lastPage; p >= 2; p--) {
            const ajaxUrl = `${BASE_URL}/?act=ajax&code=load_list_chapter&manga_id=${mangaId}&page_num=${p}&chap_id=0&keyword=`;
            const chunk = await fetchAjaxChunk(ajaxUrl);
            if (!chunk) {
                await new Promise(r => setTimeout(r, 200));
                continue;
            }

            for (const m of chunk.matchAll(epRegex)) {
                const href = BASE_URL + m[1].replace(/^\/+/, '/');
                const num = parseInt(m[2], 10);
                episodes.push({ href, number: num });
            }

            await new Promise(r => setTimeout(r, 150));
        }

        const firstAjax = `${BASE_URL}/?act=ajax&code=load_list_chapter&manga_id=${mangaId}&chap_id=0&keyword=`;
        const firstChunk = await fetchAjaxChunk(firstAjax);
        if (firstChunk) {
            for (const m of firstChunk.matchAll(epRegex)) {
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
    } catch (err) {
        console.error('extractEpisodes error:', err && err.message ? err.message : err);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
  try {
    const pageRes = await soraFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
      }
    });
    const pageHtml = await pageRes.text();

    const iframeMatch = pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) return JSON.stringify({ streams: [], subtitles: null });

    const embedUrl = new URL(iframeMatch[1], url).href;

    const embedRes = await soraFetch(embedUrl, {
      headers: {
        "Referer": "https://animeyy.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
      }
    });
    const embedHtml = await embedRes.text();

    const srcMatch = embedHtml.match(/<source[^>]+src=["']([^"']+\.m3u8)["']/i);
    if (!srcMatch) return JSON.stringify({ streams: [], subtitles: null });

    const streamUrl = new URL(srcMatch[1], embedUrl).href;

    return JSON.stringify({
      streams: [
        {
          streamUrl: streamUrl,
          headers: { Referer: embedUrl }
        }
      ],
    });
  } catch (e) {
    return JSON.stringify({ streams: [], subtitles: null });
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