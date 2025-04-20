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

async function extractEpisode(html, type, titleUrl) {
  // Step 1: Find Season 1 URL inside .media-seasons
  const seasonRegex = /<div class="media-seasons">([\s\S]*?)<\/div>/;
  const seasonBlock = html.match(seasonRegex)?.[1];
  if (!seasonBlock) return [];

  const season1Link = [...seasonBlock.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .find(([, , label]) => label.trim() === 'Season 1');

  if (!season1Link) return [];

  const season1Url = season1Link[1].startsWith("http") ? season1Link[1] : new URL(season1Link[1], titleUrl).href;

  // Step 2: Fetch the Season 1 HTML
  const res = await fetch(season1Url);
  const seasonHtml = await res.text();

  // Step 3: Use your unchanged episode regex to extract episodes
  const episodeRegex = /<li[^>]+data-number="(\d+)"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*class="title"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<span>[^<]*<\/span><\/h3>/g;
  const episodes = [];
  let match;
  while ((match = episodeRegex.exec(seasonHtml)) !== null) {
    const [_, number, url, name] = match;
    episodes.push({
      number,
      name: name.trim(),
      url: url.startsWith("http") ? url : new URL(url, season1Url).href
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
