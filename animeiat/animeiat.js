async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Referer': 'https://www.animeiat.xyz/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.animeiat.xyz/search?q=${encodedKeyword}`;
        const response = await fetchv2(searchUrl, headers);
        const html = await response.text();

        const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\(function\(.*?\)\s*{return\s*({[\s\S]+?})}\(.*?\)\));/);
        if (!nuxtMatch) throw new Error("NUXT data not found");

        const jsonStart = nuxtMatch[2].indexOf('{');
        const jsonEnd = nuxtMatch[2].lastIndexOf('}') + 1;
        let jsonStr = nuxtMatch[2].slice(jsonStart, jsonEnd);

        // Clean the JSON string
        jsonStr = jsonStr
            .replace(/(\w+):/g, '"$1":')  // Quote keys
            .replace(/'/g, '"')           // Single to double quotes
            .replace(/\\u002F/g, '/')     // Fix slashes
            .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas

        const nuxtData = JSON.parse(jsonStr);

        // Process anime data
        if (nuxtData.state?.anime?.animes) {
            nuxtData.state.anime.animes.forEach(anime => {
                const posterUrl = anime.poster_path 
                    ? `https://api.animeiat.co/storage/${anime.poster_path.replace(/\\u002F/g, '/')}`
                    : '';

                results.push({
                    title: anime.anime_name,
                    href: `https://www.animeiat.xyz/anime/${anime.slug}`,
                    image: posterUrl
                });
            });
        }

        return JSON.stringify(results);

    } catch (error) {
        console.error('Search failed:', error.message);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    const results = [];
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeiat.xyz/'
    };

    try {
        // Fetch the page
        const response = await fetchv2(url, headers);
        const html = await response.text();

        // Extract description
        const descriptionMatch = html.match(/<p class="text-justify">([\s\S]*?)<\/p>/i);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';

        // Extract airdate
        const airdateMatch = html.match(/<span class="mb-1 v-chip theme--dark v-size--small blue darken-4">\s*<span class="v-chip__content">\s*<span>([^<]+)<\/span>\s*<\/span>\s*<\/span>/i;);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

        results.push({
            description: description,
            aliases: 'N/A',
            airdate: airdate
        });

        return JSON.stringify(results);

    } catch (error) {
        console.error('Error extracting details:', error);
        return JSON.stringify([{
            description: 'N/A',
            aliases: 'N/A',
            airdate: 'N/A'
        }]);
    }
}

async function extractEpisodes(url) {
    const episodes = [];

    try {
        const response = await fetchv2(url);
        const html = await response.text();

        // Match episode count
        const countMatch = html.match(/<span class="v-chip__content"><span>الحلقات:\s*(\d+)<\/span><\/span>/);
        const episodeCount = countMatch ? parseInt(countMatch[1]) : 0;

        // Match slug
        const slugMatch = html.match(/<div class="v-card__title py-0"><div class="mx-auto text-center ltr">([^<]+)<\/div><\/div>/);
        const rawSlug = slugMatch ? slugMatch[1].trim() : '';

        // Convert title to slug format
        const slug = rawSlug
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')  // remove special characters
            .replace(/\s+/g, '-')      // replace spaces with hyphens
            .trim();

        // Generate episode links
        if (episodeCount && slug) {
            for (let i = 1; i <= episodeCount; i++) {
                episodes.push({
                    href: `https://www.animeiat.xyz/watch/${slug}-episode-${i}`,
                    number: i
                });
            }
        }

        return JSON.stringify(episodes);

    } catch (error) {
        console.error('Failed to extract episodes:', error);
        return JSON.stringify([]);
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
