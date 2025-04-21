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

    const seasonRegex = /<li data-number="(\d+)"><a href="(https?:\/\/[^\/]+\/seasons\/[^\/]+)\/"/;
    const seasonMatches = Array.from(html.matchAll(seasonRegex));

    if (!seasonMatches || seasonMatches.length === 0) {
      console.log("No seasons found");
      return JSON.stringify([]);
    }

    for (const seasonMatch of seasonMatches) {
      const seasonNumber = seasonMatch[1];
      const seasonUrl = seasonMatch[2];

      const seasonResponse = await fetch(seasonUrl);
      if (!seasonResponse.ok) {
        console.log(`Failed to fetch season ${seasonNumber}`);
        continue;
      }
      const seasonHtml = await seasonResponse.text();

      const episodeRegex = /<li data-number="(\d+)">[\s\S]*?<a href="(https?:\/\/[^\/]+\/episodes\/[^\/]+)\/"/;
      const episodeMatches = Array.from(seasonHtml.matchAll(episodeRegex));

      if (episodeMatches && episodeMatches.length > 0) {
        const episodes = episodeMatches.map(episodeMatch => ({
          href: episodeMatch[2],
          number: episodeMatch[1],
          title: `Episode ${episodeMatch[1]}`
        }));
        allEpisodes.push(...episodes);
      }
    }

    return JSON.stringify(allEpisodes);

  } catch (error) {
    console.error('Fetch error in extractEpisodes:', error);
    return JSON.stringify([]);
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
