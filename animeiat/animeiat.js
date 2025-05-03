async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Referer': 'https://www.animeiat.xyz/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        // First fetch the search page HTML
        const searchResponse = await fetchv2(`https://www.animeiat.xyz/search?q=${encodedKeyword}`, headers);
        const html = await searchResponse.text();

        // Parse the HTML for results
        const items = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g) || [];

        for (const itemHtml of items) {
            try {
                const titleMatch = itemHtml.match(/<h2 class="anime_name[^>]*>([^<]+)<\/h2>/i);
                const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : 'Unknown Title';

                const hrefMatch = itemHtml.match(/<a [^>]*href="(\/anime\/[^"]*)"[^>]*class="card-link"/i);
                const href = hrefMatch ? `https://www.animeiat.xyz${hrefMatch[1]}` : '';

                const imgMatch = itemHtml.match(/background-image:\s*url\(&quot;(https:\/\/api\.animeiat\.co\/storage\/posters\/[^&]+)&quot;/);
                const image = imgMatch ? imgMatch[1] : '';

                if (title && href && image) {
                    results.push({
                        title: title,
                        image: image,
                        href: href
                    });
                } else {
                    console.error("Missing data in:", {
                        title,
                        href, 
                        image
                    });
                }
            } catch (e) {
                console.error("Error processing item:", e);
            }
        }

        return JSON.stringify(results);

    } catch (error) {
        console.error("Search failed:", error);
        return JSON.stringify([]);
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
