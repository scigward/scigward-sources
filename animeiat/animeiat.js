function searchResults(html) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz/";

    const titleRegex = /<h2[^>]*class="anime_name[^>]*>([^<]*)<\/h2>/i;
    const hrefRegex = /<a[^>]*href="([^"]*)"[^>]*class="card-link"/i;
    const imgRegex = /<div\s+class="v-image__image v-image__image--cover"[^>]*style="[^"]*background-image:\s*url\(&quot;([^"]*)&quot;\)[^"]*"/i;
    
    const itemRegex = /<div\s+class="pa-1\s+col-sm-4\s+col-md-3\s+col-lg-2\s+col-6"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
        const titleMatch = itemHtml.match(titleRegex);
        const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

        const hrefMatch = itemHtml.match(hrefRegex);
        const href = hrefMatch ? baseUrl + hrefMatch[1].trim().replace(/^\/+/, '') : '';

        const imgMatch = itemHtml.match(imgRegex);
        const imageUrl = imgMatch ? decodeHTMLEntities(imgMatch[1].trim()) : '';

        if (title && href) {
            results.push({
                title: title,
                image: imageUrl,
                href: href
            });
        }
    });

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
