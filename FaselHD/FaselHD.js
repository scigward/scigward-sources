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

   const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const embedResponse = await fetchv2(embedUrl, headers);
  const embedHtml = await embedResponse.text();
  console.log("EmbedHTML", embedResponse.text);

  const streamUrls = extractM3U8Urls(embedHtml);
  if (!streamUrls || streamUrls.length === 0) throw new Error("Stream URL not found.");
  return streamUrls[0];  // Return first found URL
}

function extractM3U8Urls(embedHtml) {
    // STEP 1 — Find the offset from the exact obfuscated code
    const offsetMatch = embedHtml.match(/adilbo_HTML_encoder_\w+\s*\+=\s*String\s*\[.*?\]\s*\(\s*parseInt[^\)]*\)\s*-\s*(\d+)\s*\)\s*;/);
    if (!offsetMatch) {
        console.log("Offset not found. Cannot decode hidden HTML.");
        return [];
    }
    const offset = parseInt(offsetMatch[1], 10);
    console.log("Detected offset:", offset);

    // STEP 2 — Find the hide_my_HTML variable
    const arrayVarRegex = /var\s+(hide_my_HTML_\w+)\s*=\s*\[\s*((?:'[^']*'(?:\s*,\s*)?)*)\]/;
    const varMatch = embedHtml.match(arrayVarRegex);
    if (!varMatch) {
        console.log("Obfuscated array variable not found.");
        return [];
    }
    const arrayContent = varMatch[2];

    // STEP 3 — Extract all array parts
    const parts = [...arrayContent.matchAll(/'([^']*)'/g)].map(m => m[1]);
    const hideStr = parts.join('');

    // STEP 4 — Split, decode, and reconstruct the HTML
    const segments = hideStr.split('.');
    let decodedHTML = '';
    for (let seg of segments) {
        if (!seg) continue;
        while (seg.length % 4) seg += '=';
        const b64decoded = atob(seg);
        const digitsOnly = b64decoded.replace(/\D/g, '');
        const num = parseInt(digitsOnly, 10);
        if (!isNaN(num)) {
            decodedHTML += String.fromCharCode(num - offset);
        }
    }

    // STEP 5 — decodeURIComponent(escape(...)) to finalize HTML
    decodedHTML = decodeURIComponent(escape(decodedHTML));
    console.log("Decoded HTML length:", decodedHTML.length);
    // STEP 6 — Extract all .m3u8 URLs
    const urlMatches = decodedHTML.match(/https?:\/\/[^"'<>\s]+\.m3u8\b/g);
    const urls = urlMatches ? Array.from(new Set(urlMatches)) : [];

    console.log("Extracted .m3u8 URLs:", urls);
    return urls;
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
