function searchResults(html) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz/";

    // Title and href regex (unchanged)
    const titleRegex = /<h2[^>]*class="anime_name[^>]*>([^<]*)<\/h2>/i;
    const hrefRegex = /<a[^>]*href="([^"]*)"[^>]*class="card-link"/i;
    
    // NEW: Ultra-specific image regex
    const imgRegex = /<div\s+class="v-image__image\s+v-image__image--cover"[^>]*style="[^"]*background-image:\s*url\([^"]*"([^"]*)"[^"]*\)[^"]*"/i;
    
    const itemRegex = /<div\s+class="pa-1\s+col-sm-4\s+col-md-3\s+col-lg-2\s+col-6"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
        const titleMatch = itemHtml.match(titleRegex);
        const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

        const hrefMatch = itemHtml.match(hrefRegex);
        const href = hrefMatch ? baseUrl + hrefMatch[1].trim().replace(/^\/+/, '') : '';

        // NEW: More robust image extraction
        let imageUrl = '';
        const imgMatch = itemHtml.match(imgRegex);
        if (imgMatch && imgMatch[1]) {
            imageUrl = imgMatch[1].trim();
            // Handle both quoted and unquoted URLs
            if (imageUrl.startsWith('&quot;') && imageUrl.endsWith('&quot;')) {
                imageUrl = imageUrl.slice(6, -6);
            } else if (imageUrl.startsWith('"') && imageUrl.endsWith('"')) {
                imageUrl = imageUrl.slice(1, -1);
            }
        }

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
