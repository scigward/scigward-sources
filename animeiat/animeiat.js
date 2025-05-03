async function searchResults(keyword) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz/";
    const apiUrl = "https://api.animeiat.co/";
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': baseUrl,
        'Sec-CH-UA': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"'
    };

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchResponse = await fetchv2(`${baseUrl}search?q=${encodedKeyword}`, { headers });
        const html = await searchResponse.text();

        const items = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g) || [];

        for (const itemHtml of items) {
            const titleMatch = itemHtml.match(/<h2 class="anime_name[^>]*>([^<]+)<\/h2>/i);
            const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

            const hrefMatch = itemHtml.match(/<a [^>]*href="(\/anime\/[^"]*)"[^>]*class="card-link"/i);
            const href = hrefMatch ? baseUrl + hrefMatch[1].replace(/^\/+/, '') : '';

            const imgMatch = itemHtml.match(/background-image:\s*url\(&quot;(https:\/\/api\.animeiat\.co\/storage\/posters\/[^&]+\.jpg)&quot;/);
            let imageUrl = imgMatch ? decodeHTMLEntities(imgMatch[1]) : '';

            // Verify image with exact request replication
            if (imageUrl && imageUrl.startsWith(apiUrl)) {
                try {
                    const imgHeaders = {
                        ...headers,
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                    };
                    const imgResponse = await fetchv2(imageUrl, { 
                        method: 'GET',
                        headers: imgHeaders
                    });
                    
                    if (imgResponse.status !== 200) {
                        imageUrl = '';
                    }
                } catch {
                    imageUrl = '';
                }
            }

            if (title && href) {
                results.push({
                    title,
                    image: imageUrl,
                    href
                });
            }
        }

        return results;

    } catch (error) {
        console.error(`Search failed for "${keyword}":`, error);
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
