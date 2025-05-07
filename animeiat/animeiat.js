function searchResults(html) {
    const results = [];
    
    const itemRegex = /<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div><\/div>/g;
    
    const titleRegex = /<h2 class="anime_name[^>]*>([^<]+)<\/h2>/;
    const imageRegex = /background-image: url\(&quot;([^"]+\.jpg)&quot;\)/;
    const hrefRegex = /<a[^>]+href="(\/anime\/[^"]+)"[^>]*>/;
    
    let itemMatch;
    while ((itemMatch = itemRegex.exec(html)) !== null) {
        const itemHtml = itemMatch[1];
        
        const titleMatch = itemHtml.match(titleRegex);
        const imageMatch = itemHtml.match(imageRegex);
        const hrefMatch = itemHtml.match(hrefRegex);
        
        if (titleMatch && hrefMatch) {
            results.push({
                title: decodeHTMLEntities(titleMatch[1].trim()),
                image: imageMatch ? imageMatch[1].trim() : '',
                href: `https://www.animeiat.xyz${hrefMatch[1].trim()}`
            });
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
