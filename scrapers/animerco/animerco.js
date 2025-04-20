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

async function fetchSeason1Episodes(animeUrl, titleSlug) {
  const res = await fetch(animeUrl);
  const html = await res.text();

  // Match all possible variants of Season 1
  const seasonRegex = new RegExp(
    `<a[^>]+href="([^"]+)"[^>]*>\\s*(?:.*?)(?:الموسم[-\\s]?1|season[-\\s]?1|الموسم[-\\s]?الاول)[^<]*</a>`,
    'gi'
  );

  let season1Url = null;
  let match;
  while ((match = seasonRegex.exec(html)) !== null) {
    if (match[1] && match[1].includes(titleSlug)) {
      season1Url = match[1];
      break;
    }
  }

  if (!season1Url) throw new Error("Season 1 URL not found");

  // Fetch the Season 1 page
  const seasonRes = await fetch(season1Url);
  const seasonHtml = await seasonRes.text();

  // Extract episodes from the Season 1 page
  const episodeRegex = /<a[^>]+href="([^"]+\/episodes\/[^"]+)"[^>]*?title="([^"]*الحلقة[^"]*)"[^>]*?data-src="([^"]+)"[^>]*?>/gi;

  const episodes = [];
  while ((match = episodeRegex.exec(seasonHtml)) !== null) {
    episodes.push({
      title: match[2].trim(),
      url: match[1],
      image: match[3],
    });
  }

  return episodes;
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