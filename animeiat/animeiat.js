async function searchResults(html) {
    const results = [];
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeiat.xyz/'
    };

    const items = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div>\s*<\/div>/g) || [];

    for (const itemHtml of items) {
        try {
            const title = (itemHtml.match(/<h2 class="anime_name[^>]*>([^<]+)<\/h2>/i) || [])[1];
            const href = (itemHtml.match(/<a [^>]*href="(\/anime\/[^"]*)"[^>]*class="card-link"/i) || [])[1];
            let imageUrl = (itemHtml.match(/background-image:\s*url\(&quot;([^&]*)&quot;/) || [])[1];

            if (imageUrl) {
                imageUrl = decodeHTMLEntities(imageUrl);
                try {
                    const imgResponse = await fetchv2(imageUrl, {
                        method: 'GET',
                        headers: {
                            ...headers,
                            'Referer': 'https://www.animeiat.xyz/' // Force correct referer
                        }
                    });
                    if (!imgResponse.ok) imageUrl = '';
                } catch {
                    imageUrl = '';
                }
            }

            if (title && href) {
                results.push({
                    title: decodeHTMLEntities(title.trim()),
                    image: imageUrl || '',
                    href: `https://www.animeiat.xyz${href.replace(/^\/+/, '')}`
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
