const ENCODED = {
  BASE: 'aHR0cHM6Ly93d3cuZmFzZWxoZHMuY2VudGVy',
  WATCH: 'aHR0cHM6Ly93d3cuZmFzZWxoZHMuY2VudGVyL3dhdGNo',
};

const DECODED = {};
for (const key in ENCODED) {
  DECODED[key] = atob(ENCODED[key]);
}

// Test code
//(async () => {
//    const results = await searchResults('Cowboy Bebop');
//    console.log('RESULTS:', results);
//
//    const parsedResults = JSON.parse(results);
//    const target = parsedResults[1]; // Index 1 is safe
//
//    const details = await extractDetails(target.href);
//    console.log('DETAILS:', details);
//
//    const eps = await extractEpisodes(target.href);
//    console.log('EPISODES:', eps);
//
//    const parsedEpisodes = JSON.parse(eps);
//    if (parsedEpisodes.length > 0) {
//        const streamUrl = await extractStreamUrl(parsedEpisodes[0].href);
//        console.log('STREAMURL:', streamUrl);
//    } else {
//        console.log('No episodes found.');
//    }
//})();

async function searchResults(keyword) {
  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const results = [];

    async function fetchSearchPage(page) {
      const url = page === 1
        ? `${DECODED.BASE}/?s=${encodedKeyword}`
        : `${DECODED.BASE}/page/${page}?s=${encodedKeyword}`;
      const res = await soraFetch(url);
      const html = await res.text();

      const localResults = [];
      const itemRegex = /<div class="col-xl-2 col-lg-2 col-md-3 col-sm-3">\s*<div class="postDiv[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]+)"/g;
      let match;

      while ((match = itemRegex.exec(html)) !== null) {
        localResults.push({
          title: decodeHTMLEntities(match[3].trim()),
          href: match[1].trim(),
          image: match[2].trim(),
        });
      }

      return localResults;
    }

    for (let page = 1; page <= 5; page++) {
      const pageResults = await fetchSearchPage(page);
      if (!pageResults.length) break;
      results.push(...pageResults);
    }

    return JSON.stringify(results);
  } catch (error) {
    console.log('Fetch error in searchResults:', error);
    return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
  }
}

async function extractDetails(url) {
  const results = [];

  try {
    const response = await soraFetch(url);
    const html = await response.text();

    const description = html.match(/<div class="singleDesc">\s*<p>([\s\S]*?)<\/p>/i)?.[1]?.trim() || 'N/A';
    const airdate = html.match(/<i class="far fa-calendar-alt"><\/i>\s*موعد الصدور : (\d{4})/i)?.[1] || 'N/A';
    const aliasContainer = html.match(/<i class="far fa-folders"><\/i>\s*تصنيف المسلسل :([\s\S]*?)<\/span>/i)?.[1];

    let aliases = [];
    if (aliasContainer) {
      const matches = [...aliasContainer.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
      aliases = matches.map(m => decodeHTMLEntities(m[1].trim())).filter(Boolean);
    }

    results.push({
      description: decodeHTMLEntities(description),
      airdate,
      aliases: aliases.length ? aliases.join(', ') : 'N/A'
    });

    return JSON.stringify(results);

  } catch (error) {
    console.error('Error extracting details:', error);
    return JSON.stringify([{ description: 'N/A', aliases: 'N/A', airdate: 'N/A' }]);
  }
}

async function extractEpisodes(url) {
  try {
    const pageResponse = await soraFetch(url);
    const html = typeof pageResponse === 'object' ? await pageResponse.text() : pageResponse;

    const episodes = [];

    if (/\/(movies|anime-movies|asian-movies|dubbed-movies)\//.test(url)) {
      episodes.push({ number: 1, href: url });
      return JSON.stringify(episodes);
    }

    const seasonUrls = [];
    let seasonMatch;
    const seasonRegex = /<div\s+class="seasonDiv[^"]*"\s+onclick="window\.location\.href\s*=\s*'\/\?p=(\d+)'"/g;
    while ((seasonMatch = seasonRegex.exec(html)) !== null) {
      seasonUrls.push(`${DECODED.BASE}/?p=${seasonMatch[1]}`);
    }

    const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/g;

    if (seasonUrls.length === 0) {
      for (const match of html.matchAll(episodeRegex)) {
        episodes.push({ number: parseInt(match[2]), href: match[1] });
      }
    } else {
      const seasonHtmls = await Promise.all(
        (await Promise.all(seasonUrls.map(url => soraFetch(url))))
          .map(res => res.text?.() || res)
      );

      for (const seasonHtml of seasonHtmls) {
        for (const match of seasonHtml.matchAll(episodeRegex)) {
          episodes.push({ number: parseInt(match[2]), href: match[1] });
        }
      }
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.error("extractEpisodes failed:", error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();

        const regex = /<li\s+class="active"\s+onclick="player_iframe\.location\.href\s*=\s*'([^']+)'"/i;
        const match = regex.exec(html);

        if (!match || !match[1]) {
            console.log("No stream URL found in page");
            return "";
        }
        const streamUrl = match[1].trim();

        console.log(streamUrl);

        const response2 = await networkFetch(streamUrl, {
            timeoutSeconds: 2,
            returnHTML: true
        });
        const html2 = response2.html;

        const match2 = html2.match(/data-url="([^"]+\.m3u8)"/);
        if (match2) {
            return match2[1];
        } else {
            return null;
        }
    } catch (err) {
        console.log("Error fetching stream URL content:"+ err);
        return "";
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
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
