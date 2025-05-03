function searchResults(html) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz/";

    const items = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g) || [];

    for (const itemHtml of items) {
        let title = '', href = '', imageUrl = '';
        
        try {
            // Extract data
            const titleMatch = itemHtml.match(/<h2 class="anime_name[^>]*>([^<]+)<\/h2>/i);
            title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

            const hrefMatch = itemHtml.match(/<a [^>]*href="(\/anime\/[^"]*)"[^>]*class="card-link"/i);
            href = hrefMatch ? baseUrl + hrefMatch[1].replace(/^\/+/, '') : '';

            const imgMatch = itemHtml.match(/background-image:\s*url\(&quot;(https:\/\/api\.animeiat\.co\/storage\/posters\/[^&]+\.jpg)&quot;/);
            imageUrl = imgMatch ? imgMatch[1] : '';

            // Validate and log if incomplete
            if (!title || !href) {
                console.error('Incomplete data:', { title, href, imageUrl });
                continue;
            }

            results.push({ title, href, image: imageUrl });

        } catch (e) {
            console.error('Processing error:', { title, href, imageUrl });
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
