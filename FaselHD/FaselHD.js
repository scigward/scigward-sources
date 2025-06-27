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
    try {
        // STEP 1: Strict offset extraction
        const offsetMatch = embedHtml.match(/parseInt\(atob\([^)]+\)\[[^\]]+\]\(\/\\D\/g,''\)\)\s*-\s*(\d+)\)/);
        if (!offsetMatch) {
            console.error("Offset not found in the expected format");
            return [];
        }
        const offset = parseInt(offsetMatch[1], 10);

        // STEP 2: Fixed array extraction regex (removed /s flag)
        const arrayMatch = embedHtml.match(/var\s+hide_my_HTML_\w+\s*=\s*((?:'[^']*'(?:\s*\+\s*'[^']*')*\s*);)/);
        if (!arrayMatch) {
            console.error("Array declaration not found. Potential matches:", {
                found: embedHtml.match(/hide_my_HTML_\w+/g) || [],
                sample: embedHtml.substring(0, 500)
            });
            return [];
        }

        // Process array content
        const arrayContent = arrayMatch[1]
            .replace(/'/g, '')
            .replace(/\s*\+\s*/g, '')
            .trim();

        const segments = arrayContent.split('.').filter(Boolean);
        console.log("Found segments:", segments.length);

        // STEP 3: Decoding with validation
        let decodedHtml = '';
        for (const seg of segments) {
            try {
                const paddedSeg = seg + '='.repeat((4 - seg.length % 4) % 4);
                const decoded = atob(paddedSeg);
                const numberStr = decoded.replace(/\D/g, '');
                
                if (!numberStr) continue;
                
                const number = parseInt(numberStr, 10);
                if (!isNaN(number)) {
                    decodedHtml += String.fromCharCode(number - offset);
                }
            } catch (e) {
                console.warn(`Failed segment: ${seg}`, e.message);
            }
        }

        // Final processing
        if (!decodedHtml) {
            console.error("No valid content decoded");
            return [];
        }

        const finalHtml = decodeURIComponent(escape(decodedHtml));
        const m3u8Urls = finalHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8\b/gi) || [];
        return [...new Set(m3u8Urls)];

    } catch (error) {
        console.error("Critical error:", error.message);
        return [];
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
