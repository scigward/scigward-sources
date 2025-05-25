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



function extractHlsUrl(htmlText) {
    /**
     * Extract the final .m3u8 HLS stream URL from obfuscated JS in the given HTML text.
     * Handles the hide_my_HTML_wyg obfuscation pattern with Base64 decoding and offset subtraction.
     * 
     * @param {string} htmlText - The HTML content containing obfuscated JavaScript
     * @returns {string|null} - The extracted m3u8 URL or null if not found
     */
    
    try {
        // 1. Find the obfuscated string assignment
        const obfMatch = htmlText.match(/var\s+hide_my_HTML_wyg\s*=\s*'([^']*?)'/s);
        if (!obfMatch) {
            return null;
        }
        
        let obfuscated = obfMatch[1];
        
        // Remove line joins and concatenation operators
        obfuscated = obfuscated.replace(/'\s*\+\s*'/g, '').replace(/\n/g, '').replace(/\s/g, '');
        
        // 2. Split on dots to get each Base64-like token
        const tokens = obfuscated.split('.');
        const decodedChars = [];
        
        for (const token of tokens) {
            if (!token) continue;
            
            try {
                // Pad for Base64 if needed
                const padded = token + '='.repeat((4 - token.length % 4) % 4);
                
                // Base64 decode
                const decoded = atob(padded);
                
                // Extract only digits
                const digitStr = decoded.replace(/\D/g, '');
                
                if (digitStr === '') continue;
                
                const val = parseInt(digitStr, 10);
                
                // Subtract the fixed offset (commonly 89, but could vary)
                // Try different common offsets if one doesn't work
                const commonOffsets = [89, 93099912, 12345, 54321];
                let charCode = null;
                
                for (const offset of commonOffsets) {
                    const testCode = val - offset;
                    if (testCode > 0 && testCode < 1114112) { // Valid Unicode range
                        charCode = testCode;
                        break;
                    }
                }
                
                if (charCode !== null) {
                    decodedChars.push(String.fromCharCode(charCode));
                }
                
            } catch (e) {
                // Skip invalid tokens
                continue;
            }
        }
        
        let decodedHtml = decodedChars.join('');
        
        // 3. Decode URI-encoded text (equivalent to decodeURIComponent(escape(...)))
        try {
            decodedHtml = decodeURIComponent(escape(decodedHtml));
        } catch (e) {
            // If decoding fails, use the raw decoded HTML
        }
        
        // 4. Extract the .m3u8 URL with regex
        const urlMatch = decodedHtml.match(/(https?:\/\/[^'"<>\s]*?\.m3u8[^'"<>\s]*)/);
        
        return urlMatch ? urlMatch[1] : null;
        
    } catch (error) {
        console.error('Error extracting HLS URL:', error);
        return null;
    }
}

// Helper function for escape() which is deprecated in modern JS
function escape(str) {
    return str.replace(/[^\w\s.-]/g, function(char) {
        const code = char.charCodeAt(0);
        if (code < 256) {
            return '%' + code.toString(16).toUpperCase().padStart(2, '0');
        } else {
            return '%u' + code.toString(16).toUpperCase().padStart(4, '0');
        }
    });
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

    // ADDITION: Extract .m3u8 stream using the helper
    const streamUrl = extractHlsUrl(embedHtml);
    if (!streamUrl) throw new Error("Stream URL not found.");
    return streamUrl;
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
