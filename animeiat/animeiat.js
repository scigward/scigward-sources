function searchResults(html) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz/";

    // Match all anime items
    const items = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g) || [];

    for (const itemHtml of items) {
        try {
            // Extract title
            const titleMatch = itemHtml.match(/<h2 class="anime_name[^>]*>([^<]+)<\/h2>/i);
            const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

            // Extract href
            const hrefMatch = itemHtml.match(/<a [^>]*href="(\/anime\/[^"]*)"[^>]*class="card-link"/i);
            const href = hrefMatch ? baseUrl + hrefMatch[1].replace(/^\/+/, '') : '';

            // EXACT image URL extraction
            const imgMatch = itemHtml.match(/background-image:\s*url\(&quot;(https:\/\/api\.animeiat\.co\/storage\/posters\/[^&]+\.jpg)&quot;/);
            const imageUrl = imgMatch ? imgMatch[1] : '';

            if (title && href) {
                results.push({
                    title: title,
                    image: imageUrl,
                    href: href
                });
            }
        } catch (e) {
            console.error('Error processing item:', e);
        }
    }

    return results;
}

function extractEpisodes(html) {
    const episodes = [];
    const baseUrl = "https://www.animeiat.xyz";
    
    // Match all episode containers
    const containerRegex = /<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g;
    
    let containerMatch;
    while ((containerMatch = containerRegex.exec(html)) !== null) {
        const containerHtml = containerMatch[1];
        
        // Extract episode number
        const numberMatch = containerHtml.match(/الحلقة:\s*(\d+)/);
        if (!numberMatch) continue;
        
        // Extract href
        const hrefMatch = containerHtml.match(/<a [^>]*href="(\/watch\/[^"]*)"/);
        if (!hrefMatch) continue;
        
        episodes.push({
            number: parseInt(numberMatch[1]),
            href: baseUrl + hrefMatch[1]
        });
    }
    
    return episodes;
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
