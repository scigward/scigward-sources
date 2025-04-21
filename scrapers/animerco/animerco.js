function searchResults(html) {
    const results = [];
    try {
        const itemRegex = /<div id="post-\d+" class="col-12[\s\S]*?<a href="([^"]+)" class="image[^"]*"[^>]*?data-src="([^"]+)"[^>]*?title="([^"]+)"[\s\S]*?<div class="info">/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = match[3].trim();
            results.push({ title, href, image });
        }
    } catch (error) {
        console.error("searchResults error:", error);
        return [];
    }
    return results;
}

async function extractEpisodes(html) {
  try {
    const allEpisodes = [];
    const seasonRegex = /<li data-number='(\d+)'><a href='(https?:\/\/[^\/]+\/seasons\/[^\/]+)\/'/g;
    const seasonMatches = Array.from(html.matchAll(seasonRegex));

    if (!seasonMatches || seasonMatches.length === 0) {
      return [];
    }

    for (const seasonMatch of seasonMatches) {
      const seasonNumber = seasonMatch[1];
      const seasonUrl = seasonMatch[2];
      const response = await fetch(seasonUrl);
      if (!response.ok) {
        continue;
      }
      const seasonHtml = typeof response === 'object' ? await response.text() : await response;
      const episodeRegex = /data-number='(\d+)'[\s\S]*?href='(https?:\/\/[^\/]+\/episodes\/[^\/]+)\/'/g;
      const episodeMatches = Array.from(seasonHtml.matchAll(episodeRegex));
      const episodes = episodeMatches.map(match => ({
        number: parseInt(match[1]),
        url: match[2],
        season: parseInt(seasonNumber)
      }));
      allEpisodes.push(...episodes);
    }

    return allEpisodes;
  } catch (error) {
    console.error(error);
    return [];
  }
}

function extractDetails(html) {
    try {
        const descriptionMatch = html.match(/<meta name="description" content="([^"]+)"/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';

        const aliasesMatch = html.match(/<span class="alternatives">([^<]+)<\/span>/);
        const aliases = aliasesMatch ? aliasesMatch[1].trim() : 'N/A';

        const yearRegex = /<div class="textd">Year:<\/div>\s*<div class="textc">([^<]+)<\/div>/;
        const yearMatch = html.match(yearRegex);
        const year = yearMatch ? yearMatch[1].trim() : '';

        const airdate = `${year} `.trim();

        if (description) {
            return { description, aliases, airdate };
        } else {
            return null;
        }
    } catch (error) {
        return null;
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
