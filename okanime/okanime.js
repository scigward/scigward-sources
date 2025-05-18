function searchResults(html) {
    const results = [];

    const itemRegex = /<div class="col-6 col-sm-4 col-lg-3 col-xl-2dot4[^"]*">([\s\S]*?)(?=<div class="col-6|$)/g;
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
        const hrefMatch = itemHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*anime-details[^"]*">/);
        const imgMatch = itemHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        const titleMatch = itemHtml.match(/<h3>([^<]+)<\/h3>/);

        const href = hrefMatch ? hrefMatch[1].trim() : '';
        const image = imgMatch ? imgMatch[1].trim() : '';
        const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

        if (href && image && title) {
            results.push({ title, href, image });
        }
    });

    return results;
}

function extractDetails(html) {
  const details = [];

  const descriptionMatch = html.match(
   /<div class="review-content">\s*<p>(.*?)<\/p>\s*<\/div>/s
  );
  let description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : "";

  const airdateMatch = html.match(/<div class="full-list-info">\s*<small>\s* سنة بداية العرض \s*<\/small>\s*<small>\s*(\d{4})\s*<\/small>\s*<\/div>/);
  let airdate = airdateMatch ? airdateMatch[1].trim() : "";

  const genres = [];
  const aliasesMatch = html.match(
    /<div class="review-author-info">([\s\S]*?)<\/div>/
  );
  const inner = aliasesMatch ? aliasesMatch[1] : "";

  const anchorRe = /<a[^>]*class="subtitle mr-1 mt-2 "[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = anchorRe.exec(inner)) !== null) {
    genres.push(m[1].trim());
  }

  if (description && airdate) {
    details.push({
      description: description,
      aliases: genres.join(", "),
      airdate: airdate,
    });
  }

  console.log(details);
  return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>\s*الحلقة\s*(\d+)\s*<\/a>/gi;
    const plainTextRegex = /<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/gi;

    let matches;

    if ((matches = html.match(htmlRegex))) {
        matches.forEach(link => {
            const hrefMatch = link.match(/href="([^"]+)"/);
            const numberMatch = link.match(/<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/);
            if (hrefMatch && numberMatch) {
                const href = hrefMatch[1];
                const number = numberMatch[1];
                episodes.push({
                    href: href,
                    number: number
                });
            }
        });
    } 
    else if ((matches = html.match(plainTextRegex))) {
        matches.forEach(match => {
            const numberMatch = match.match(/\d+/);
            if (numberMatch) {
                episodes.push({
                    href: null, 
                    number: numberMatch[0]
                });
            }
        });
    }

    episodes.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    console.log(episodes);
    return episodes;
}

async function extractStreamUrl(html) {
  const result = {
    streams: [],
  };

  try {
    const containerMatch = html.match(
      /<div class="filter-links-container overflow-auto" id="streamlinks">([\s\S]*?)<\/div>/
    );
    if (!containerMatch) {
      throw new Error("Stream links container not found.");
    }

    const containerHTML = containerMatch[1];

    // Match mp4upload servers + quality labels
    const mp4uploadMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*mp4upload\.com[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of mp4uploadMatches) {
      const embedUrl = match[1].trim();
      const quality = (match[2] || 'Unknown').trim();
      const streamUrl = await mp4Extractor(embedUrl);
      if (streamUrl) {
        result.streams.push(`Mp4upload ${quality}`, streamUrl);
      }
    }

    // Match uqload servers + quality labels
    const uqloadMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*uqload\.net[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>\s*uqload/gi)];
    for (const match of uqloadMatches) {
      const embedUrl = match[1].trim();
      const quality = (match[2] || 'Unknown').trim();
      const streamUrl = await uqloadExtractor(embedUrl);
      if (streamUrl) {
        result.streams.push(`Uqload ${quality}`, streamUrl);
      }
    }

    return JSON.stringify(result);
  } catch (error) {
    console.error("Error in extractStreamUrl:", error);
    return JSON.stringify({ streams: [] });
  }
}

async function mp4Extractor(url) {
  const Referer = "https://mp4upload.com";
  const headers = { "Referer": Referer };
  const response = await fetchv2(url, headers);
  const htmlText = await response.text();
  const streamUrl = extractMp4Script(htmlText);
  return streamUrl;
}

async function uqloadExtractor(url) {
  // Fetch the page first to get its content
  const uqloadUrl = "https://uqload.net/embed-cu5ltruefjkf.html";
  const response = await fetchv2(uqloadUrl);
  const htmlText = await response.text();
  
  // Extract the MP4 source URL
  const match = htmlText.match(/sources:\s*\[\s*"([^"]+\.mp4)"\s*\]/);
  const videoSrc = match ? match[1] : '';
  
  if (videoSrc) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Referer': uqloadUrl,
      'Origin': 'https://uqload.net'
    };
    
    return videoSrc;
  }

  return '';
}

function extractMp4Script(htmlText) {
  const scripts = extractScriptTags(htmlText);
  let scriptContent = null;

  scriptContent = scripts.find(script =>
    script.includes('eval')
  );

  scriptContent = scripts.find(script => script.includes('player.src'));

  return scriptContent
    .split(".src(")[1]
    .split(")")[0]
    .split("src:")[1]
    .split('"')[1] || '';
}

function extractScriptTags(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
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
