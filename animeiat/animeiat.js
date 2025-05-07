function searchResults(html) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz";

    const titleRegex = /<h2[^>]*class="anime_name[^>]*>([^<]*)<\/h2>/i;
    const hrefRegex = /<a[^>]*href="(\/anime\/[^"]*)"[^>]*class="(?:card-link|white--text)"/i;
    const itemRegex = /<div\s+class="pa-1\s+col-sm-4\s+col-md-3\s+col-lg-2\s+col-6"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
        const titleMatch = itemHtml.match(titleRegex);
        const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

        const hrefMatch = itemHtml.match(hrefRegex);
        const href = hrefMatch ? baseUrl + hrefMatch[1] : '';

        const imageUrl = extractImageUrl(itemHtml);

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

function extractImageUrl(html) {

    const containerRegex = /<div\s+class="v-image\s+v-responsive[^>]*>([\s\S]*?)<\/div>/i;
    const containerMatch = html.match(containerRegex);
    if (!containerMatch) return '';
    

    const imageRegex = /<div\s+class="v-image__image[^>]+style="[^"]*background-image:\s*url\(&quot;([^"]+\.jpg)&quot;[^"]*"/i;
    const imageMatch = containerMatch[0].match(imageRegex);
    
    return imageMatch ? imageMatch[1].trim() : '';
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
