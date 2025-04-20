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

async function extractEpisodes(html, titleUrl) {
  try {
    const season1Regex = /<div class="content-box">[\s\S]*?<li data-number="1">[\s\S]*?<a href="(https?:\/\/[^\/]+\/seasons\/[^\/]+)\/"/;
    const season1Match = html.match(season1Regex);

    if (!season1Match || !season1Match[1]) {
      return [];
    }

    const season1Url = season1Match[1];
    const response = await fetch(season1Url);
    if (!response.ok) {
      return [];
    }
    const season1Html = await response.text();

    const episodeRegex = /<div class="content-box tns-ovh">[\s\S]*?<ul class="episodes-lists"[\s\S]*?>[\s\S]*?<li data-number="(\d+)"><a href="(https?:\/\/[^\/]+\/episodes\/[^\/]+)"/;
    const episodeMatches = Array.from(season1Html.matchAll(episodeRegex));

    const episodes = episodeMatches.map(match => ({
      number: match[1],
      url: match[2],
    }));

    return episodes;

  } catch (error) {
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
