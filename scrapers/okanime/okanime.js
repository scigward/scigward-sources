function searchResults(html) {
    const results = [];
    const itemRegex = /<a class="item" href="([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<span class="video-title">([^<]+)<\/span>/g;
    
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
        results.push({
            title: match[3].trim(),
            href: match[1].trim(),
            image: match[2].trim()
        });
    }
    return results;
}

function extractDetails(html) {

    const airdateMatch = html.match(/<a href="\/search\?aired_year_from=\d+[^"]*">[\s\S]*?<small>(\d{4})<\/small>/);
    const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

 
    const descMatch = html.match(/<div class="review-content">\s*<p>([\s\S]*?)<\/p>/);
    const description = descMatch ? descMatch[1].trim() : 'N/A';

    const genreRegex = /<a class="subtitle" href="\/search\?genre=([^"]+)">([^<]+)<\/a>/g;
    const genres = [];
    let genreMatch;
    while ((genreMatch = genreRegex.exec(html))) {
        genres.push({
            encoded: genreMatch[1],
            clean: genreMatch[2] 
        });
    }

    return [{
        airdate: airdate,
        description: description,
        genres: genres
    }];
}

function extractEpisodes(html) {
    const episodes = [];
    const episodeRegex = /<a class="item" href="(\/animes\/[^"]+)">[\s\S]*?<img src="(\/uploads\/anime\/cover\/[^"]+\.webp)"[^>]*>[\s\S]*?<span class="video-subtitle">\s*الحلقة\s*(\d+)\s*<\/span>/gi;
    
    let match;
    while ((match = episodeRegex.exec(html))) {
        episodes.push({
            href: match[1],
            image: match[2],
            number: match[3]
        });
    }
    return episodes;
}

async function extractStreamUrl(html) {
  
    try {
        const embedMatch = html.match(/<iframe[^>]+src="(https:\/\/www\.mp4upload\.com\/embed-[^"]+\.html)"/i);
        if (!embedMatch) return null;

        const response = await fetch(embedMatch[1]);
        const embedHtml = await response.text();
        const streamMatch = embedHtml.match(/player\.src\(\{\s*type:\s*["']video\/mp4["'],\s*src:\s*["']([^"']+)["']/i);
        
        return streamMatch ? streamMatch[1] : null;
    } catch (error) {
        console.error('Stream extraction failed:', error);
        return null;
    }
}
