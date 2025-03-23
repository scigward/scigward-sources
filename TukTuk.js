async function search(query) {
    console.log(`Searching for: ${query}`);
    const url = `https://www.tuktukcinma.com/?s=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        const html = await response.text();
        const results = extractSearchResults(html);
        console.log(results);
    } catch (error) {
        console.error('Error during search:', error);
    }
}

function extractSearchResults(html) {
    const results = [];
    const itemRegex = /<div class="my-2 w-64[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    const items = html.match(itemRegex) || [];

    const titleRegex = /<h2[^>]*>(.*?)<\/h2>/;
    const hrefRegex = /<a\s+href="([^"]+)"\s*[^>]*>/;
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/;

    items.forEach((itemHtml) => {
        const titleMatch = itemHtml.match(titleRegex);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        const hrefMatch = itemHtml.match(hrefRegex);
        const href = hrefMatch ? hrefMatch[1].trim() : '';
        
        const imgMatch = itemHtml.match(imgRegex);
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

async function extractDetails(html) {
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
    return details;
}

async function extractEpisodes(html) {
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
    } else if ((matches = html.match(plainTextRegex))) {
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

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        const sourceMatch = html.match(/data-source="([^"]+)"/);
        const embedUrl = sourceMatch?.[1]?.replace(/&amp;/g, '&');
        if (!embedUrl) return null;

        const response = await fetch(embedUrl);
        const data = await response;
        const videoUrl = data.match(/src:\s*'(https:\/\/[^']+\.mp4[^']*)'/)?.[1];
        return videoUrl || null;
    } catch (error) {
        return null;
    }
}

// Example usage
search("Hunter x Hunter"); // Replace with any search query
