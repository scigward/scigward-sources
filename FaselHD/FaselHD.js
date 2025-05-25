async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.faselhds.center/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];

        const itemRegex = /<div class="col-xl-2 col-lg-2 col-md-3 col-sm-3">\s*<div class="postDiv[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]+)"/g;
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
    const results = [];
  
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descriptionMatch = html.match(/<div class="singleDesc">\s*<p>([\s\S]*?)<\/p>/i);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';

        const airdateMatch = html.match(/<i class="far fa-calendar-alt"><\/i>\s*موعد الصدور : (\d{4})/i);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

        const aliasContainerMatch = html.match(/<i class="far fa-folders"><\/i>\s*تصنيف المسلسل : ([\s\S]*?)<\/span>/i);
        const aliases = [];

        if (aliasContainerMatch && aliasContainerMatch[1]) {
            const aliasText = aliasContainerMatch[1];
            const aliasMatches = [...aliasText.matchAll(/>([^<]+)</g)];
            aliasMatches.forEach(match => {
                aliases.push(decodeHTMLEntities(match[1].trim()));
            });
        }

        results.push({
            description: description,
            aliases: aliases.length ? aliases.join(', ') : 'N/A',
            airdate: airdate
        });

        return JSON.stringify(results);

    } catch (error) {
        console.error('Error extracting details:', error);
        return JSON.stringify([{
            description: 'N/A',
            aliases: 'N/A',
            airdate: 'N/A'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const pageResponse = await fetchv2(url);
        const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

        const episodes = [];

        // Handle movie pages (both /movies/ and /anime-movies/)
        if (url.includes('/movies/') || url.includes('/anime-movies/')) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        // Find all season URLs within seasonList container
        const seasonListMatch = html.match(/<div class="form-row" id="seasonList">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
        const seasonUrls = [];

        if (seasonListMatch) {
            const seasonListHtml = seasonListMatch[1];
            const seasonDivRegex = /<div class="seasonDiv[^>]*onclick="window\.location\.href = '\?p=(\d+)'/g;
            
            for (const match of seasonListHtml.matchAll(seasonDivRegex)) {
                // Append /?p=VALUE directly to original URL
                seasonUrls.push(`${url}/?p=${match[1]}`);
            }
        }

        // If no seasons found, check for episodes directly
        if (seasonUrls.length === 0) {
            const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
            for (const match of html.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[2]),
                    href: match[1]
                });
            }
        } else {
            // Process each season
            for (const seasonUrl of seasonUrls) {
                const seasonResponse = await fetchv2(seasonUrl);
                const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

                const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
                for (const match of seasonHtml.matchAll(episodeRegex)) {
                    episodes.push({
                        number: parseInt(match[2]),
                        href: match[1]
                    });
                }
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error("extractEpisodes failed:", error);
        return JSON.stringify([]);
    }
}


async function extractStreamUrl(url) {
    const response = await fetchv2(url);
    const html = await response.text();

    const serverMatch = html.match(
        /<li[^>]*onclick="player_iframe\.location\.href\s*=\s*'([^']+)'[^>]*>\s*<a[^>]*>\s*<i[^>]*><\/i>\s*سيرفر المشاهدة #01\s*<\/a>/,
    );
    if (!serverMatch) throw new Error("Server #01 not found.");
    const embedUrl = serverMatch[1];

    const embedResponse = await fetchv2(embedUrl);
    const embedHtml = await embedResponse.text();

    // await the async function
    const streamUrl = await extractMasterM3U8(embedHtml);
    if (!streamUrl) throw new Error("Stream URL not found.");
    return streamUrl;
}
    
async function extractMasterM3U8(html) {
  // 1. Match any var hide_my_HTML_<suffix> = '<base64 dots>'
  const base64ScriptMatch = html.match(/var\s+hide_my_HTML_\w+\s*=\s*'([^']+)'/);
  if (!base64ScriptMatch) {
    console.log("[Debug] No hide_my_HTML_<var> Base64 script found.");
    return null;
  }

  const dotSeparatedBase64 = base64ScriptMatch[1];
  const parts = dotSeparatedBase64.split(".");
  let decoded = "";

  // 2. Decode each base64 part using atob
  for (const part of parts) {
    try {
      const clean = part.replace(/[^A-Za-z0-9+/=]/g, '');
      const padded = clean + "=".repeat((4 - clean.length % 4) % 4);
      decoded += atob(padded);
    } catch (e) {
      // Skip invalid base64
    }
  }

  // 3. Find master.m3u8 URL pattern
  const regex = /https:\/\/master\.c\.scdns\.io\/stream\/v2\/[^\/]+\/\d+\/normal\/0\/[0-9a-fA-F:]+\/no\/[0-9a-f]{32}\/web\d+\.faselhd1watch\.one\/master\.m3u8/;
  const match = decoded.match(regex);

  if (match) {
    return match[0];
  }

  console.log("[Debug] No master.m3u8 URL found.");
  return null;
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

function btoa(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input);
    let output = '';

    for (let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || (map = '=', i % 1);
        output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) {
            throw new Error("btoa failed: The string contains characters outside of the Latin1 range.");
        }
        block = (block << 8) | charCode;
    }

    return output;
}

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}
