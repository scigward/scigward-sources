async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.animeiat.xyz/search?q=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const html = await response.text();

        const results = [];
        const baseUrl = "https://www.animeiat.xyz";

        const titleRegex = /<h2[^>]*class="anime_name[^>]*>([^<]*)<\/h2>/i;
        const hrefRegex = /<a[^>]*href="(\/anime\/[^"]*)"[^>]*class="(?:card-link|white--text)"/i;
        const imgRegex = /background-image:\s*url\(([^)]+)\)/i;
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
                    image: imgMatch ? imgMatch[1].replace(/&quot;/g, '"') : ''
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
    const baseUrl = "https://www.animeiat.xyz";
    const result = {
        totalEpisodes: 0,
        episodes: []
    };

    try {
        // 1. Fetch the title page
        const response = await fetchv2(url);
        const html = await response.text();

        // 2. Extract total episodes count
        const countMatch = html.match(/الحلقات:\s*(\d+)/i);
        if (!countMatch) throw new Error("Episode count not found");
        
        const totalEpisodes = parseInt(countMatch[1], 10);
        result.totalEpisodes = totalEpisodes;

        // 3. Generate episode URLs
        const animeSlug = url.split('/anime/')[1].split('?')[0];
        for (let i = 1; i <= totalEpisodes; i++) {
            result.episodes.push({
                number: i,
                href: `${baseUrl}/watch/${animeSlug}-episode-${i}`
            });
        }

    } catch (error) {
        console.error("Error:", error.message);
        result.error = error.message;
    }

    return JSON.stringify(result);
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
