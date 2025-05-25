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
    const streamUrl = await extractM3U8Url(embedHtml);
    if (!streamUrl) throw new Error("Stream URL not found.");
    return streamUrl;
}
    
async function extractM3U8Url(htmlText) {
    /**
     * Simple m3u8 URL extractor - finds obfuscated variable and decodes it
     * @param {string} htmlText - The HTML/JS text containing obfuscated code
     * @returns {Promise<string|null>} - The extracted m3u8 URL or null if not found
     */
    
    try {
        // Find script tags with the obfuscated content
        const scriptMatch = htmlText.match(/<script type="text\/javascript" language="Javascript">(.*?)<\/script>/s);
        if (!scriptMatch) return null;
        
        const scriptContent = scriptMatch[1];
        
        // Find the specific hide_my_HTML variable with dynamic suffix
        const match = scriptContent.match(/var\s+hide_my_HTML_\w+\s*=\s*'([^']*?)'/s);
        if (!match) return null;
        
        let obfuscatedString = match[1];
        
        // Clean up the string
        obfuscatedString = obfuscatedString.replace(/'\s*\+\s*'/g, '').replace(/\s/g, '');
        
        // Split on dots and decode
        const tokens = obfuscatedString.split('.');
        const decodedChars = [];
        
        // Get offset from script content (default 89)
        let offset = 89;
        const offsetMatch = scriptContent.match(/parseInt\([^)]+\)\s*-\s*(\d+)/);
        if (offsetMatch) offset = parseInt(offsetMatch[1]);
        
        // Decode each token
        for (const token of tokens) {
            if (!token) continue;
            
            try {
                // Add base64 padding
                const padding = '='.repeat((4 - (token.length % 4)) % 4);
                const decoded = await atob(token + padding);
                
                // Extract digits only
                const digits = decoded.replace(/\D/g, '');
                if (!digits) continue;
                
                // Convert to character
                const charCode = parseInt(digits) - offset;
                if (charCode > 0) {
                    decodedChars.push(String.fromCharCode(charCode));
                }
            } catch (e) {
                continue;
            }
        }
        
        // Get decoded HTML
        const decodedHtml = decodedChars.join('');
        
        // Extract m3u8 URL
        const urlMatch = decodedHtml.match(/(https?:\/\/[^'"<>\s]*\.m3u8[^'"<>\s]*)/i);
        return urlMatch ? urlMatch[1] : null;
        
    } catch (error) {
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
