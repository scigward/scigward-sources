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

async function extractEpisodes(html, type, titleUrl) {
  try {
   if (type === "seasons") {
    // We don't need this anymore, so return an empty array
    return [];
   } else if (type === "episodes") {
    if (!titleUrl) {
     throw new Error("titleUrl is required to extract episodes");
    }

    const episodes = [];
    const baseUrl = new URL(titleUrl).origin; // Extract base URL

    // 1. Fetch Season 1 URL
    const season1Regex = /<li\s+data-number="1"\s*>.*?<a\s+href="([^"]*?\/seasons\/[^"]*?)"/i;
    const season1Match = html.match(season1Regex);
    const season1Url = season1Match ? baseUrl + season1Match[1] : titleUrl;

    const season1Response = await fetch(season1Url);
    if (!season1Response.ok) {
     throw new Error(`HTTP error fetching season 1: ${season1Response.status} for ${season1Url}`);
    }
    const season1Html = await season1Response.text();

    // 2. Extract episodes from Season 1 page
    const episodeRegex = /<li\s+data-number="\d+"\s*>.*?<a\s+href="([^"]*?\/episodes\/[^"]*?)"[^>]*?>.*?<\/a>/gi;
    const episodeMatches = season1Html.match(episodeRegex) || [];

    episodeMatches.forEach(match => {
     const hrefMatch = match.match(/href="([^"]+)"/);
     const href = hrefMatch ? hrefMatch[1].trim() : null;
     const numberMatch = match.match(/data-number="(\d+)"/);
     const number = numberMatch ? numberMatch[1].trim() : null;

     if (href && number) {
      episodes.push({
       href,
       number
      });
     }
    });

    return episodes.reverse();
   } else {
    throw new Error(`Invalid type: ${type}`);
   }
  } catch (error) {
   console.error(`extractEpisodes error (type: ${type}):`, error);
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
