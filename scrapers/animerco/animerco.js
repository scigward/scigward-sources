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
  const parser = new DOMParser();
  let doc = parser.parseFromString(html, "text/html");

  // Step 1: Find Season 1 URL
  let season1Url = null;
  const seasonItems = doc.querySelectorAll(".media-seasons li");

  for (const li of seasonItems) {
    const h3 = li.querySelector(".title h3");
    const a = li.querySelector("a");
    if (!h3 || !a) continue;

    const text = h3.textContent.trim().replace(/\s+/g, "-").toLowerCase();
    if (
      text.includes("الموسم-1") ||
      text.includes("الموسم-الاول") ||
      text.includes("season-1")
    ) {
      season1Url = new URL(a.getAttribute("href"), titleUrl).href;
      break;
    }
  }

  // Step 2: Fetch and update DOM if Season 1 exists
  if (season1Url && season1Url !== titleUrl) {
    const seasonRes = await fetch(season1Url);
    const seasonHtml = await seasonRes.text();
    doc = parser.parseFromString(seasonHtml, "text/html");
  }

  // Step 3: Extract Episodes
  const episodes = [];
  const items = doc.querySelectorAll(".episodes-lists li");

  for (const li of items) {
    const a = li.querySelector("a");
    if (!a) continue;

    const href = a.getAttribute("href");
    const title = a.getAttribute("title") || a.textContent.trim();

    if (!href) continue;

    episodes.push({
      url: href,
      title: title.replace(/\s+/g, " "),
    });
  }

  return episodes;
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