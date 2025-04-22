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
    let description = descriptionMatch 
       ? decodeHTMLEntities(descriptionMatch[1].trim()) 
       : 'N/A';

    const airdateMatch = html.match(/<li>\s*بداية العرض:\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>\s*<\/li>/);
    let airdate = airdateMatch ? airdateMatch[1].trim() : '';

    const genres = [];

    const aliasesMatch = html.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
    let aliases = aliasesMatch ? aliasesMatch[1].trim() : '';

    const inner = aliasesMatch[1];

    // 2) find every <a>…</a> and grab the text content
    const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = anchorRe.exec(inner)) !== null) {
        // m[1] is the text between the tags
        genres.push(decodeHTMLEntities(m[1].trim()));
    }

    if (description && airdate && aliases) {
        details.push({
            description: description,
            aliases: genres.join(', '),
            airdate: airdate
        });
    }

    console.log(details);
    return details;
}

function extractEpisodes(html) {
  const seasonRegex = /<li\s+data-number="\d+">.*?<a\s+href="([^"]+\/seasons\/[^"]+)"/g;
  const episodeRegex = /<li\s+data-number="\d+">.*?<a\s+href="([^"]+\/episodes\/[^"]+)"/g;

  const seasonUrls = [];
  let match;

  while ((match = seasonRegex.exec(html)) !== null) {
    seasonUrls.push(match[1]);
  }

  const allEpisodeUrls = [];

  for (const seasonUrl of seasonUrls) {
    try {
      const res = await fetch(seasonUrl);
      const seasonHtml = await res.text();

      let epMatch;
      while ((epMatch = episodeRegex.exec(seasonHtml)) !== null) {
        allEpisodeUrls.push(epMatch[1]);
      }
    } catch (err) {
      console.error(`Error fetching season: ${seasonUrl}`, err);
    }
  }

  return allEpisodeUrls;
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
