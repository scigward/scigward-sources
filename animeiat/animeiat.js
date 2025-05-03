async function searchResults(keyword) {
    const results = [];
    const baseUrl = "https://www.animeiat.xyz/";
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': baseUrl
    };

    try {
        // Encode the keyword for URL safety
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `${baseUrl}search?q=${encodedKeyword}`;
        
        // Fetch search results page
        const response = await fetchv2(searchUrl, { headers });
        const html = await response.text();

        // Parse results
        const items = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g) || [];

        for (const itemHtml of items) {
            const titleMatch = itemHtml.match(/<h2 class="anime_name[^>]*>([^<]+)<\/h2>/i);
            const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

            const hrefMatch = itemHtml.match(/<a [^>]*href="(\/anime\/[^"]*)"[^>]*class="card-link"/i);
            const href = hrefMatch ? baseUrl + hrefMatch[1].replace(/^\/+/, '') : '';

            const imgMatch = itemHtml.match(/background-image:\s*url\(&quot;([^&]*)&quot;/);
            let imageUrl = imgMatch ? decodeHTMLEntities(imgMatch[1]) : '';

            // Verify image with proper referer
            if (imageUrl) {
                try {
                    const imgResponse = await fetchv2(imageUrl, {
                        method: 'GET',
                        headers: { ...headers, 'Referer': baseUrl }
                    });
                    if (!imgResponse.ok) imageUrl = '';
                } catch {
                    imageUrl = '';
                }
            }

            if (title && href) {
                results.push({
                    title: title,
                    image: imageUrl,
                    href: href
                });
            }
        }

        return results;

    } catch (error) {
        console.error("Search failed for keyword:", keyword, error);
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
