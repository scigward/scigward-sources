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
  const episodes = [];

  // Step 1: Extract all seasons from <ul class="episodes-lists">
  const seasonListMatch = html.match(/<ul class="episodes-lists">([\s\S]*?)<\/ul>/);
  if (!seasonListMatch) return [];

  const seasonListHtml = seasonListMatch[1];

  // Step 2: Find all season links and data-number
  const seasonLinkRegex = /<li\s+data-number="(\d+)">.*?<a\s+href="([^"]+)"/g;
  const seasonLinks = [...seasonListHtml.matchAll(seasonLinkRegex)];

  // Step 3: Loop through each season
  for (const [, seasonNumber, seasonHref] of seasonLinks) {
    const seasonUrl = seasonHref.startsWith("http") ? seasonHref : new URL(seasonHref, titleUrl).href;

    try {
      const res = await fetch(seasonUrl);
      const seasonHtml = await res.text();

      // Step 4: Restrict to episodes within <ul id="filter">
      const filterMatch = seasonHtml.match(/<ul class="episodes-lists"[^>]*id="filter"[^>]*>([\s\S]*?)<\/ul>/);
      if (!filterMatch) continue;

      const filterHtml = filterMatch[1];

      // Step 5: Extract only episodes with 'season' in the href
      const episodeRegex = /<li[^>]+data-number="(\d+)"[^>]*>[\s\S]*?<a[^>]+href="([^"]*season[^"]+)"[^>]*class="title"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<span>[^<]*<\/span><\/h3>/g;

      let match;
      while ((match = episodeRegex.exec(filterHtml)) !== null) {
        const [_, number, url, name] = match;
        episodes.push({
          number,
          name: name.trim(),
          url: url.startsWith("http") ? url : new URL(url, seasonUrl).href,
          season: seasonNumber
        });
      }
    } catch (e) {
      console.error(`Failed to fetch season ${seasonNumber} at ${seasonUrl}`, e);
    }
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
