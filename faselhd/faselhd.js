const ENCODED = {
  BASE: 'aHR0cHM6Ly93d3cuZmFzZWxoZHMuY2VudGVy',
  WATCH: 'aHR0cHM6Ly93d3cuZmFzZWxoZHMuY2VudGVyL3dhdGNo',
};

const DECODED = {};
for (const key in ENCODED) {
  DECODED[key] = atob(ENCODED[key]);
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8230;/g, '...')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num));
}

async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://www.faselhds.xyz/?s=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<div class="postDiv[^"]*">[\s\S]*?<a href="([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<div class="h1">([\s\S]*?)<\/div>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[3].trim(),
                image: match[2].trim(),
                href: match[1].trim()
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}


async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const match = /<div class="singleDesc">\s*<p>([\s\S]*?)<\/p>/.exec(html);
        const description = match ? match[1].trim() : "N/A";

        return JSON.stringify([{
            description: decodeHtmlEntities(description),
            aliases: "N/A",
            airdate: "N/A"
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}

async function extractEpisodes(url) {
    const baseUrl = "https://www.faselhds.xyz";
    const allEpisodes = [];

    function extractEpisodesFromHtml(html) {
        const episodes = [];
        const regex = /<a href="([^"]+)"[^>]*>\s*الحلقة\s*(\d+)\s*<\/a>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            episodes.push({
                href: match[1].trim(),
                number: parseInt(match[2], 10),
            });
        }
        return episodes;
    }

    try {
        const response = await fetchv2(url);
        const html = await response.text();
        
        const seasonDivRegex = /<div[^>]+class=["'][^"']*seasonDiv[^"']*["'][^>]*>/g;
        const seasonMatches = html.match(seasonDivRegex);
        const seasonCount = seasonMatches ? seasonMatches.length : 0;
        
        console.log(`Found ${seasonCount} seasons`);
        
        if (seasonCount > 1) {
            const seasonHrefRegex = /<div[^>]+class=["'][^"']*seasonDiv[^"']*["'][^>]*onclick=["']window\.location\.href\s*=\s*['"](([^'"]+))['"][^>]*>/g;
            const seasonPaths = [];
            let match;
            
            while ((match = seasonHrefRegex.exec(html)) !== null) {
                seasonPaths.push(match[1]);
            }
            
            
            for (const path of seasonPaths) {
                const seasonUrl = path.startsWith("http") ? path : baseUrl + path;
                
                const seasonResponse = await fetchv2(seasonUrl);
                const seasonPageHtml = await seasonResponse.text();
                const episodes = extractEpisodesFromHtml(seasonPageHtml);
                
                allEpisodes.push(...episodes);
            }
            
            return JSON.stringify(allEpisodes);
        } else {
            const episodes = extractEpisodesFromHtml(html);
            
            if (episodes.length === 0) {
                return JSON.stringify([{ href: url, number: 1 }]);
            }
            
            return JSON.stringify(episodes);
        }
        
    } catch (err) {
        console.error("Error:", err);
        return JSON.stringify([{ href: "Error", number: "Error" }]);
    }
}

async function extractStreamUrl(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();

    const regex = /<li\s+class="active"\s+onclick="player_iframe\.location\.href\s*=\s*'([^']+)'"/i;
    const match = regex.exec(html);
    if (!match || !match[1]) {
      console.log("No stream URL found in page");
      return null;
    }
    const streamUrl = match[1].trim();
    console.log("Player URL:", streamUrl);

    const result = await networkFetch(streamUrl, {
      timeoutSeconds: 15,
      cutoff: "master.m3u8",
      waitForSelectors: [".jw-icon.jw-icon-display"],
      clickSelectors: [".jw-icon.jw-icon-display"]
    });

    if (result.cutoffTriggered && result.cutoffUrl) {
      return result.cutoffUrl;
    }

    const m3u8 = result.requests.find(r => r.includes("master.m3u8")) || null;
    return m3u8;
  } catch (err) {
    console.log("Error extracting stream URL:", err);
    return null;
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
