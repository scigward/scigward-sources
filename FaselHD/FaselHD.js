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
        const BaseUrl = 'https://web30.faselhd1watch.one';
        const pageResponse = await fetchv2(url);
        const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

        const episodes = [];

        if (
            url.includes('/movies/') ||
            url.includes('/anime-movies/') ||
            url.includes('/asian-movies/')
        ) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        const seasonUrls = [];

        const seasonListMatch = html.match(
            /<div class="form-row" id="seasonList">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
        );

        if (seasonListMatch) {
            const seasonListHtml = seasonListMatch[1];

            const seasonBlockRegex = /<div class="col-xl-2 col-lg-3 col-md-6">([\s\S]*?)<\/div>\s*<\/div>/gi;

            for (const seasonMatch of seasonListHtml.matchAll(seasonBlockRegex)) {
                const block = seasonMatch[1];
                const pMatch = block.match(/onclick="window\.location\.href = '(\?p=\d+)'/);
                if (pMatch) {
                    const seasonUrl = `${BaseUrl}${pMatch[1]}`;
                    console.log("Season URL:", seasonUrl);
                    seasonUrls.push(seasonUrl);
                }
            }
        }

        if (seasonUrls.length === 0) {
            const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
            for (const match of html.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[2]),
                    href: match[1],
                });
            }
        } else {
            for (const seasonUrl of seasonUrls) {
                const seasonResponse = await fetchv2(seasonUrl);
                const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

                const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
                for (const match of seasonHtml.matchAll(episodeRegex)) {
                    episodes.push({
                        number: parseInt(match[2]),
                        href: match[1],
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
    /<li[^>]*onclick="player_iframe\.location\.href\s*=\s*'([^']+)'[^>]*>\s*<a[^>]*>\s*<i[^>]*><\/i>\s*سيرفر المشاهدة #01\s*<\/a>/
  );
  if (!serverMatch) throw new Error("Server #01 not found.");
  const embedUrl = serverMatch[1];

  const embedResponse = await fetchv2(embedUrl);
  const embedHtml = await embedResponse.text();

  const streamUrls = extractM3U8Urls(embedHtml);
  if (!streamUrls || streamUrls.length === 0) throw new Error("Stream URL not found.");
  return streamUrls[0];  // Return first found URL

function extractM3U8Urls(embedHtml) {
    // 1. Locate the hide_my_HTML definition with any suffix and concatenate its quoted parts
    const hideStart = embedHtml.indexOf("var hide_my_HTML_");
    if (hideStart < 0) return [];
    const varDeclaration = embedHtml.substring(hideStart, embedHtml.indexOf("=", hideStart));
    const suffixMatch = varDeclaration.match(/hide_my_HTML_([a-zA-Z0-9]+)/);
    if (!suffixMatch) return [];
    const suffix = suffixMatch[1];
    
    const splitIndex = embedHtml.indexOf(`hide_my_HTML_${suffix}['split'`, hideStart);
    if (splitIndex < 0) return [];
    const hideSection = embedHtml.substring(hideStart, splitIndex);
    // Match all single-quoted segments in hideSection and join them
    const parts = [...hideSection.matchAll(/'([^']*)'/g)].map(m => m[1]);
    const hideStr = parts.join('');
    
    // 2. Split on dots and decode each piece (rest of the function remains unchanged)
    const segments = hideStr.split('.');
    let decoded = '';
    for (let seg of segments) {
        if (!seg) continue;
        // Pad Base64 if needed
        while (seg.length % 4) seg += '=';
        // atob decode, strip non-digits, parse integer, subtract offset, and char
        const num = parseInt(atob(seg).replace(/\D/g,''), 10);
        if (!isNaN(num)) {
            decoded += String.fromCharCode(num - 52);
        }
    }
    // 3. The decoded string is the hidden HTML; now extract all .m3u8 URLs
    const urlMatches = decoded.match(/https?:\/\/[^"']+\.m3u8\b/g);
    // Return unique URLs (in case of duplicates)
    return urlMatches ? Array.from(new Set(urlMatches)) : [];
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
