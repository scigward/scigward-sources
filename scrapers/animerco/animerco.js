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

async function extractEpisodes(url) {
  try {
    const pageResponse = await fetch(url);
    const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

    const season1Regex = /<li data-number='1'><a href='([\s\S]+?)\'/;
    const season1Match = html.match(season1Regex);

    if (!season1Match || !season1Match[1]) {
      console.log("Season 1 URL not found.");
      return [];
    }

    const season1Url = season1Match[1];
    console.log("Season 1 URL:", season1Url); // Log the season URL

    const response = await fetch(season1Url);
    if (!response.ok) {
      console.log("Failed to fetch season 1 HTML");
      return [];
    }

    const season1Html = typeof response === 'object' ? await response.text() : await response;

    const episodeRegex = /data-number='(\d+)'[\s\S]*?href='([\s\S]*?)'/g;
    const episodeMatches = Array.from(season1Html.matchAll(episodeRegex));

    const episodes = episodeMatches.map(match => {
      const episode = {
        number: parseInt(match[1]),
        url: match[2],
      };
      console.log(`Episode ${episode.number} URL:`, episode.url); // Log the episode URLs
      return episode;
    });

    return episodes;

  } catch (error) {
    console.log("Error extracting episodes:", error);
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
