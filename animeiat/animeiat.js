async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetchv2(`https://www.animeiat.xyz/search?q=${encodeURIComponent(keyword)}`);
        const html = await response.text();
        const results = [];
        
        const regex = /<div class="pa-1[^>]*>[\s\S]*?<h2 class="anime_name[^>]*>([^<]+)<\/h2>[\s\S]*?url\(&quot;(https:\/\/api\.animeiat\.co\/storage\/posters\/[^&]+\.jpg)&quot;\)[\s\S]*?href="(\/anime\/[^"]+)"/g;
        
        let match;
        while ((match = regex.exec(html))) {
            results.push({
                title: decodeHTMLEntities(match[1].trim()),
                image: match[2].trim(),
                href: `https://www.animeiat.xyz${match[3]}`
            });
        }

        return results;

    } catch (error) {
        console.error('Search failed');
        return [];
    }
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
