async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://web.animerco.org/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];
        const baseUrl = "https://web.animerco.org";

        const itemRegex = /<div id="post-\d+" class="col-12[\s\S]*?<a href="([^"]+)" class="image[^"]*"[^>]*?data-src="([^"]+)"[^>]*?title="([^"]+)"[\s\S]*?<div class="info">/g;
        let match;

        while ((match = itemRegex.exec(responseText)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = decodeHTMLEntities(match[3].trim());
            results.push({ title, href, image });
        }

        console.log(results);
        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error in searchResults:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}
    
async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const responseText = await response.text();

        const details = [];

        // If the URL indicates it's a movie
        if (url.includes('/movies/')) {
            const descriptionMatch = responseText.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
            let description = descriptionMatch 
                ? decodeHTMLEntities(descriptionMatch[1].trim()) 
                : 'N/A';

            // Updated regex to support the <span><a ...> structure for movies
            const airdateMatch = responseText.match(/<li>\s*بداية العرض:\s*<span>\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>/);
            let airdate = airdateMatch ? airdateMatch[1].trim() : 'Unknown';

            const genres = [];
            const aliasesMatch = responseText.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
            const inner = aliasesMatch ? aliasesMatch[1] : '';

            const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
            let m;
            while ((m = anchorRe.exec(inner)) !== null) {
                genres.push(decodeHTMLEntities(m[1].trim()));
            }

            details.push({
                description: description,
                aliases: genres.join(', '),
                airdate: `Released: ${airdate}`
            });

        } else if (url.includes('/animes/')) {
            const descriptionMatch = responseText.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
            let description = descriptionMatch 
                ? decodeHTMLEntities(descriptionMatch[1].trim()) 
                : 'N/A';

            const airdateMatch = responseText.match(/<li>\s*بداية العرض:\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>/);
            let airdate = airdateMatch ? airdateMatch[1].trim() : 'Unknown';

            const genres = [];
            const aliasesMatch = responseText.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
            const inner = aliasesMatch ? aliasesMatch[1] : '';

            const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
            let m;
            while ((m = anchorRe.exec(inner)) !== null) {
                genres.push(decodeHTMLEntities(m[1].trim()));
            }

            details.push({
                description: description,
                aliases: genres.join(', '),
                airdate: `Aired: ${airdate}`
            });

        } else {
            throw new Error("URL does not match known anime or movie paths.");
        }

        return JSON.stringify(details);

    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Aliases: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const pageResponse = await fetchv2(url);
        const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

        const episodes = [];

        // Handle movie pages
        if (url.includes('/movies/')) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        // Find all season URLs
        const seasonUrlRegex = /<li\s+data-number='[^']*'>\s*<a\s+href='([^']+)'/g;
        const seasonUrls = [...html.matchAll(seasonUrlRegex)].map(match => match[1]);

        for (const seasonUrl of seasonUrls) {
            const seasonResponse = await fetchv2(seasonUrl);
            const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

            const episodeRegex = /data-number='(\d+)'[\s\S]*?href='([^']+)'/g;
            for (const match of seasonHtml.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[1]),
                    href: match[2]
                });
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error("extractEpisodes failed:", error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
  const multiStreams = {
    streams: [],
  };
  const res = await fetchv2(url);
  const html = await res.text();

  try {
    // Match mp4upload links
    const mp4uploadRegex = /<a[^>]+class=['"][^'"]*option[^'"]*['"][^>]+data-type=['"]([^'"]+)['"][^>]+data-post=['"]([^'"]+)['"][^>]+data-nume=['"]([^'"]+)['"][^>]*>(?:(?!<span[^>]*class=['"]server['"]>).)*<span[^>]*class=['"]server['"]>\s*mp4upload\s*<\/span>/gi;
    const mp4uploadMatches = [...html.matchAll(mp4uploadRegex)];
    
    // Match yourupload links
    const youruploadRegex = /<a[^>]+class=['"][^'"]*option[^'"]*['"][^>]+data-type=['"]([^'"]+)['"][^>]+data-post=['"]([^'"]+)['"][^>]+data-nume=['"]([^'"]+)['"][^>]*>(?:(?!<span[^>]*class=['"]server['"]>).)*<span[^>]*class=['"]server['"]>\s*yourupload\s*<\/span>/gi;
    const youruploadMatches = [...html.matchAll(youruploadRegex)];

    // Process mp4upload matches
    for (const match of mp4uploadMatches) {
      const [_, type, post, nume] = match;
      const stream = await processServer(url, type, post, nume, 'mp4upload');
      if (stream?.url) {
        multiStreams.streams.push({
          title: "mp4upload",
          streamUrl: stream.url,
          headers: stream.headers,
          subtitles: null
        });
      }
    }

    // Process yourupload matches
    for (const match of youruploadMatches) {
      const [_, type, post, nume] = match;
      const stream = await processServer(url, type, post, nume, 'yourupload');
      if (stream?.url) {
        multiStreams.streams.push({
          title: "Yourupload",
          streamUrl: stream.url,
          headers: stream.headers,
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

async function processServer(url, type, post, nume, server) {
  const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;
  const response = await fetchv2("https://web.animerco.org/wp-admin/admin-ajax.php", {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': 'https://web.animerco.org',
      'Referer': url,
      'accept-encoding': 'gzip, deflate, br, zstd',
      'x-requested-with': 'XMLHttpRequest',
      'Accept': '*/*',
      'Path': '/wp-admin/admin-ajax.php'
    },
    body: body
  });
  
  const json = await response.json();
  if (!json?.embed_url) return null;

  return server === 'mp4upload' 
    ? await mp4Extractor(json.embed_url)
    : await youruploadExtractor(json.embed_url);
}

async function youruploadExtractor(embedUrl) {
  const headers = { "Referer": "https://www.yourupload.com/" };
  const response = await fetchv2(embedUrl, headers);
  const html = await response.text();
  const match = html.match(/file:\s*['"]([^'"]+\.mp4)['"]/);
  return {
    url: match?.[1] || null,
    headers: headers
  };
}

async function mp4Extractor(url) {
  const headers = { "Referer": "https://mp4upload.com" };
  const response = await fetchv2(url, headers);
  const htmlText = await response.text();
  const streamUrl = extractMp4Script(htmlText);
  return {
    url: streamUrl,
    headers: headers
  };
}

function extractMp4Script(htmlText) {
    const scripts = extractScriptTags(htmlText);
    let scriptContent = scripts.find(script => script.includes('player.src'));
    return scriptContent?.split(".src(")[1]?.split(")")[0]?.split("src:")[1]?.split('"')[1] || '';
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
