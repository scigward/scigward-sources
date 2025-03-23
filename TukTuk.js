let isSearching = false;

async function searchResults(searchTerm) {
    if (isSearching) return; // Prevent multiple searches at the same time
    isSearching = true; // Set the search flag to true
    
    try {
        console.log(`Searching for ${searchTerm}...`);
        const searchUrl = `https://www.tuktukcinma.com/?s=${encodeURIComponent(searchTerm)}`;  // Updated URL for TukTuk Cinema search
        const response = await fetch(searchUrl);
        const html = await response.text();
        
        console.log("Search response received.");
        const results = extractSearchResults(html);
        
        if (results.length > 0) {
            console.log("Search results found:", results);
        } else {
            console.log("No results found.");
        }
    } catch (error) {
        console.error("Error during search:", error);
    } finally {
        isSearching = false; // Reset search flag after operation
    }
}

function extractSearchResults(html) {
    const results = [];
    
    // Add the regex pattern to find the anime list on the page
    const itemRegex = /<div class="search-item[^"]*">[\s\S]*?<\/div>/g;
    const items = html.match(itemRegex) || [];
    
    items.forEach(itemHtml => {
        const titleMatch = itemHtml.match(/<h2[^>]*>(.*?)<\/h2>/);
        const hrefMatch = itemHtml.match(/<a\s+href="([^"]+)"/);
        const imgMatch = itemHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/);
        
        const title = titleMatch ? titleMatch[1].trim() : '';
        const href = hrefMatch ? hrefMatch[1].trim() : '';
        const imageUrl = imgMatch ? imgMatch[1].trim() : '';
        
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

function extractDetails(html) {
    const details = [];

    const descriptionMatch = html.match(/<p class="sm:text-\[1\.05rem\] leading-loose text-justify">([\s\S]*?)<\/p>/);
    let description = descriptionMatch ? descriptionMatch[1].trim() : '';

    const airdateMatch = html.match(/<td[^>]*title="([^"]+)">[^<]+<\/td>/);
    let airdate = airdateMatch ? airdateMatch[1].trim() : '';

    if (description && airdate) {
        details.push({
            description: description,
            aliases: 'N/A',
            airdate: airdate
        });
    }
    console.log(details);
    return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>[\s\S]*?الحلقة\s+(\d+)[\s\S]*?<\/a>/gi;
    const plainTextRegex = /الحلقة\s+(\d+)/g;

    let matches;

    if ((matches = html.match(htmlRegex))) {
        matches.forEach(link => {
            const hrefMatch = link.match(/href="([^"]+)"/);
            const numberMatch = link.match(/الحلقة\s+(\d+)/);
            if (hrefMatch && numberMatch) {
                const href = hrefMatch[1];
                const number = numberMatch[1];
                episodes.push({
                    href: href,
                    number: number
                });
            }
        });
    } 
    else if ((matches = html.match(plainTextRegex))) {
        matches.forEach(match => {
            const numberMatch = match.match(/\d+/);
            if (numberMatch) {
                episodes.push({
                    href: null, 
                    number: numberMatch[0]
                });
            }
        });
    }

    console.log(episodes);
    return episodes;
}

async function extractStreamUrl(html) {
    try {
        const sourceMatch = html.match(/data-source="([^"]+)"/);
        const embedUrl = sourceMatch?.[1]?.replace(/&amp;/g, '&');
        if (!embedUrl) return null;

        const response = await fetch(embedUrl);
        const data = await response.text();
        const videoUrl = data.match(/src:\s*'(https:\/\/[^']+\.mp4[^']*)'/)?.[1];
        console.log(videoUrl);
        return videoUrl || null;
    } catch (error) {
        return null;
    }
}
