async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Referer': 'https://www.animeiat.xyz/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
    };

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.animeiat.xyz/search?q=${encodedKeyword}`;
        const response = await fetchv2(searchUrl, headers);
        const html = await response.text();

        const baseUrl = "https://www.animeiat.xyz";
        const titleRegex = /<h2[^>]*class="anime_name[^>]*>([^<]*)<\/h2>/i;
        const hrefRegex = /<a[^>]*href="(\/anime\/[^"]*)"[^>]*class="(?:card-link|white--text)"/i;
        const imgRegex = /background-image:\s*url\((?:"|&quot;)?(https:\/\/[^")&]+\.jpg)(?:"|&quot;)?\)/i;
        const itemRegex = /<div\s+class="pa-1\s+col-sm-4\s+col-md-3\s+col-lg-2\s+col-6"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

        let itemMatch;
        while ((itemMatch = itemRegex.exec(html)) !== null) {
            const itemHtml = itemMatch[1];
            
            const titleMatch = itemHtml.match(titleRegex);
            const hrefMatch = itemHtml.match(hrefRegex);
            const imgMatch = itemHtml.match(imgRegex);

            if (titleMatch && hrefMatch) {
                results.push({
                    title: decodeHTMLEntities(titleMatch[1].trim()),
                    href: baseUrl + hrefMatch[1],
                    image: imgMatch ? imgMatch[1] : '' 
                });
            }
        }

        return JSON.stringify(results);

    } catch (error) {
        console.error('Search failed:', error);
        return JSON.stringify([]);
    }
}

async function extractEpisodes(url) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz";
    
    try {
        // Fetch the anime page
        const response = await fetchv2(url);
        const html = await response.text();

        // Extract episode count from title page
        const countMatch = html.match(/<span class="v-chip__content">\s*<span>\s*الحلقات:\s*(\d+)\s*<\/span>\s*<\/span>/i);
        if (!countMatch) return JSON.stringify(results);
        
        const totalEpisodes = parseInt(countMatch[1], 10);
        const animeSlug = url.split('/anime/')[1].split('?')[0];

        // Generate episode URLs
        for (let i = 1; i <= totalEpisodes; i++) {
            results.push({
                href: `${baseUrl}/watch/${animeSlug}-episode-${i}`,
                number: i
            });
        }

    } catch (error) {
        console.error("Error extracting episodes:", error);
    }

    return JSON.stringify(results);
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
