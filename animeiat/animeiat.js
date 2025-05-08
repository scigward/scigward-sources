async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.animeiat.xyz/search?q=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const html = await response.text();

        const results = [];
        const baseUrl = "https://www.animeiat.xyz";

        const titleRegex = /<h2[^>]*class="anime_name[^>]*>([^<]*)<\/h2>/i;
        const hrefRegex = /<a[^>]*href="(\/anime\/[^"]*)"[^>]*class="(?:card-link|white--text)"/i;
        const imgRegex = /background-image:\s*url\(([^)]+)\)/i;
        const itemRegex = /<div\s+class="pa-1\s+col-sm-4\s+col-md-3\s+col-lg-2\s+col-6"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

        let itemMatch;
        while ((itemMatch = itemRegex.exec(html)) !== null) {
            const itemHtml = itemMatch[1];
            
            const titleMatch = itemHtml.match(titleRegex);
            const hrefMatch = itemHtml.match(hrefRegex);
            const imgMatch = itemHtml.match(imgRegex);

            if (titleMatch && hrefMatch) {
                results.push({
                    title: decodeHTMLEntities(titleMatch[1].trim()),
                    href: baseUrl + hrefMatch[1],
                    image: imgMatch ? imgMatch[1].replace(/&quot;/g, '"') : ''
                });
            }
        }

        return JSON.stringify(results);

    } catch (error) {
        console.error('Search failed:', error);
        return JSON.stringify([]);
    }
}

async function extractEpisodes(url) {
    try {
        const baseUrl = "https://www.animeiat.xyz";
        const episodes = [];
        
        // Fetch initial page
        const firstPageResponse = await fetchv2(url);
        const firstPageHtml = await firstPageResponse.text();
        
        // Extract total pages
        const paginationMatch = firstPageHtml.match(/<button[^>]*class="v-pagination__item"[^>]*>(\d+)<\/button>/gi);
        const totalPages = paginationMatch ? 
            parseInt(paginationMatch[paginationMatch.length - 1].match(/>(\d+)</)[1], 10) : 1;
        
        // Process all pages
        for (let page = 1; page <= totalPages; page++) {
            const pageUrl = page === 1 ? url : `${url.split('?')[0]}?page=${page}`;
            const response = await fetchv2(pageUrl);
            const html = await response.text();
            
            // Extract episodes from current page
            const episodeMatches = html.match(/<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div><\/div>/gi) || [];
            
            episodeMatches.forEach(episodeHtml => {
                const numberMatch = episodeHtml.match(/الحلقة:\s*(\d+)/i);
                const hrefMatch = episodeHtml.match(/href="(\/watch\/[^"]+)"/i);
                
                if (numberMatch && hrefMatch) {
                    episodes.push({
                        number: parseInt(numberMatch[1], 10),
                        href: baseUrl + hrefMatch[1]
                    });
                }
            });
        }
        
        return JSON.stringify({
            totalEpisodes: episodes.length,
            episodes: episodes.sort((a, b) => a.number - b.number)
        });
        
    } catch (error) {
        console.error('Episode extraction failed:', error);
        return JSON.stringify({
            totalEpisodes: 0,
            episodes: []
        });
    }
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
