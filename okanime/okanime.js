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
  const multiStreams = {
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

    // Mp4upload
    const mp4uploadMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*mp4upload\.com[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of mp4uploadMatches) {
      const embedUrl = match[1].trim();
      const quality = (match[2] || 'Unknown').trim();
      const stream = await mp4Extractor(embedUrl);
      if (stream?.url) {
        let title = `[${quality}] Mp4upload`;
        const headers = stream.headers || {};
        multiStreams.streams.push({
          title,
          streamUrl: stream.url,
          headers: stream.headers,
          subtitles: null
        });
      }
    }

    // Uqload
    const uqloadMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*uqload\.net[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of uqloadMatches) {
      const embedUrl = match[1].trim();
      const quality = (match[2] || 'Unknown').trim();
      const stream = await uqloadExtractor(embedUrl);
      if (stream?.url) {
        let title = `[${quality}] Uqload`;
        const headers = stream.headers || {};
        multiStreams.streams.push({
          title,
          streamUrl: stream.url,
          headers: stream.headers,
          subtitles: null
        });
      }
    }

    // Vidmoly
    const vidmolyMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*vidmoly\.to[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of vidmolyMatches) {
      const embedUrl = match[1].trim();
      const quality = (match[2] || 'Unknown').trim();
      const stream = await vidmolyExtractor(embedUrl);
      if (stream?.url) {
        let title = `[${quality}] Vidmoly`;
        const headers = stream.headers || {};
        multiStreams.streams.push({
          title,
          streamUrl: stream.url,
          headers,
          subtitles: null
        });
      }
    }

    // VKVideo
    const vkvideoMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]*vkvideo\.ru[^"]*)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>/gi)];
    for (const match of vkvideoMatches) {
      const embedUrl = match[1].trim();
      const quality = (match[2] || 'Unknown').trim();
      const stream = await vkvideoExtractor(embedUrl);
      if (stream?.url) {
        let title = `[${quality}] VKVideo`;
        const headers = stream.headers || {};
        multiStreams.streams.push({
          title,
          streamUrl: stream.url,
          headers,
          subtitles: null
        });
      }
    }

    return JSON.stringify(multiStreams);
  } catch (error) {
    console.error("Error in extractStreamUrl:", error);
    return JSON.stringify({ streams: [] });
  }
}
/* --- vidmoly --- */

/**
 * @name vidmolyExtractor
 * @author Ibro
 */
async function vidmolyExtractor(html, url = null) {
  const regexSub = /<option value="([^"]+)"[^>]*>\s*SUB - Omega\s*<\/option>/;
  const regexFallback = /<option value="([^"]+)"[^>]*>\s*Omega\s*<\/option>/;
  const fallback =
    /<option value="([^"]+)"[^>]*>\s*SUB v2 - Omega\s*<\/option>/;
  let match =
    html.match(regexSub) || html.match(regexFallback) || html.match(fallback);
  if (match) {
    const decodedHtml = atob(match[1]); // Decode base64
    const iframeMatch = decodedHtml.match(/<iframe\s+src="([^"]+)"/);
    if (!iframeMatch) {
      console.log("Vidmoly extractor: No iframe match found");
      return null;
    }
    const streamUrl = iframeMatch[1].startsWith("//")
      ? "https:" + iframeMatch[1]
      : iframeMatch[1];
    const responseTwo = await fetchv2(streamUrl);
    const htmlTwo = await responseTwo.text();
    const m3u8Match = htmlTwo.match(/sources:\s*\[\{file:"([^"]+\.m3u8)"/);
    return m3u8Match ? m3u8Match[1] : null;
  } else {
    console.log("Vidmoly extractor: No match found, using fallback");
    //  regex the sources: [{file:"this_is_the_link"}]
    const sourcesRegex = /sources:\s*\[\{file:"(https?:\/\/[^"]+)"\}/;
    const sourcesMatch = html.match(sourcesRegex);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;
    return sourcesString;
  }
}

async function vkvideoExtractor(embedUrl) {
  try {
    const response = await fetchv2(embedUrl);
    const html = await response.text();
    
    const hlsMatch = html.match(/"hls":\s*"(https:\\\/\\\/[^"]+\.m3u8[^"]*)"/);
    return hlsMatch ? hlsMatch[1].replace(/\\\//g, '/') : null;
  } catch (error) {
    console.error("VKVideo extractor error:", error);
    return null;
  }
}

async function mp4Extractor(url) {
  const headers = {
    "Referer": "https://mp4upload.com"
  };
  const response = await fetchv2(url, headers);
  const htmlText = await response.text();
  const streamUrl = extractMp4Script(htmlText);

  return {
    url: streamUrl,
    headers: headers
  };
}

async function uqloadExtractor(url) {
  const headers = {
    "Referer": url,
    "Origin": "https://uqload.net"
  };

  const response = await fetchv2(url, headers);
  const htmlText = await response.text();

  const match = htmlText.match(/sources:\s*\[\s*"([^"]+\.mp4)"\s*\]/);
  const videoSrc = match ? match[1] : '';

  return {
    url: videoSrc,
    headers: headers
  };
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
