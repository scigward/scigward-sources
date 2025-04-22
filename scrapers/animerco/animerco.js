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

function extractDetails(html) {
    const details = [];

    const descriptionMatch = html.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
    let description = descriptionMatch ? descriptionMatch[1].trim() : '';

    const airdateMatch = html.match(/<li>\s*بداية العرض:\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>\s*<\/li>/);
    let airdate = airdateMatch ? airdateMatch[1].trim() : '';

    const aliasesMatch = html.match(/<a\s+class="badge yellow-soft"\s+[^>]*?>([^<]+)<\/a>/g);
    let aliases = aliasesMatch ? aliasesMatch[1].trim() : '';

    if (description && airdate && aliases) {
        details.push({
            description: description,
            aliases: aliases,
            airdate: airdate
        });
    }
    console.log(details);
    return details;
}

async function extractEpisodes(url) {
  try {
    const pageResponse = await fetch(url);
    const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

    const season1Regex = /<li data-number='1'><a href='([\s\S]+?)\'/;
    const season1Match = html.match(season1Regex);

    if (!season1Match || !season1Match[1]) {
      return [];
    }

    const season1Url = season1Match[1];
    const response = await fetch(season1Url);
    if (!response.ok) {
      return [];
    }
    const season1Html = typeof response === 'object' ? await response.text() : await response;

    const episodeRegex = /data-number='(\d+)'[\s\S]*?href='([\s\S]*?)'/g;
    const episodeMatches = Array.from(season1Html.matchAll(episodeRegex));

    const episodes = episodeMatches.map(match => ({
      number: parseInt(match[1]),
      url: match[2],
    }));

    return episodes;

  } catch (error) {
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
