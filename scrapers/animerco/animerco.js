async function searchResults(keyword) {
    const results = [];
    const response = await fetchv2(`https://web.animerco.org/?s=${keyword}`);
    const html = await response.text();

    try {
        const itemRegex = /<div id="post-\d+" class="col-12[\s\S]*?<a href="([^"]+)" class="image[^"]*"[^>]*?data-src="([^"]+)"[^>]*?title="([^"]+)"[\s\S]*?<div class="info">/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = match[3].trim();
            results.push({ title, href, image });
        }

        console.log(results);
        return JSON.stringify(results);
    } catch (error) {
        throw error;
    }
}

async function extractDetails(url) {
    const details = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descriptionMatch = html.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
        let description = descriptionMatch
            ? decodeHTMLEntities(descriptionMatch[1].trim())
            : 'N/A';

        const airdateMatch = html.match(/<li>\s*بداية العرض:\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>\s*<\/li>/);
        let airdate = airdateMatch ? airdateMatch[1].trim() : '';

        const genres = [];

        const aliasesMatch = html.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
        let inner = aliasesMatch ? aliasesMatch[1].trim() : '';

        const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
        let m;
        while ((m = anchorRe.exec(inner)) !== null) {
            genres.push(decodeHTMLEntities(m[1].trim()));
        }

        if (description && airdate && inner) {
            details.push({
                description: description,
                aliases: genres.join(', '),
                airdate: airdate
            });
        }

        return JSON.stringify(details);
    } catch (error) {
        console.log('Details error: ' + error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Aliases: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
  try {
    const pageResponse = await fetch(url);
    const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

    const ulMatch = html.match(/<ul class="episodes-lists">([\s\S]*?)<\/ul>/);
    if (!ulMatch) return [];

    const ulContent = ulMatch[1];
    const seasonRegex = /<li\s+data-number="(\d+)"><a\s+href="([^"]+)"/g;
    const seasonMatches = Array.from(ulContent.matchAll(seasonRegex));

    if (!seasonMatches.length) return [];

    const allEpisodes = [];

    for (const match of seasonMatches) {
      const seasonNumber = match[1];
      const seasonHref = match[2];
      const seasonUrl = seasonHref.startsWith('http') ? seasonHref : new URL(seasonHref, url).href;

      const response = await fetch(seasonUrl);
      if (!response.ok) continue;

      const seasonHtml = typeof response === 'object' ? await response.text() : await response;

      const episodeRegex = /<li\s+data-number='(\d+)'.*?href='([^']+)'/g;
      const episodeMatches = Array.from(seasonHtml.matchAll(episodeRegex));

      const episodes = episodeMatches.map(epMatch => ({
        season: parseInt(seasonNumber),
        number: parseInt(epMatch[1]),
        url: epMatch[2].startsWith('http') ? epMatch[2] : new URL(epMatch[2], seasonUrl).href,
      }));

      allEpisodes.push(...episodes);
    }

    return allEpisodes;

  } catch (error) {
    console.error('Error extracting episodes:', error);
    return [];
  }
}

async function extractStreamUrl(html) {
    try {
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]*mp4upload\.com[^"]*)"/);
        const iframeUrl = iframeMatch ? iframeMatch[1] : null;

        if (!iframeUrl) {
            console.warn("No supported video source iframe found in HTML.");
            return null;
        }

        console.log("Found video source iframe URL:", iframeUrl);

        return iframeUrl;

    } catch (error) {
        console.error("Error extracting video source URL:", error);
        return null;
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
