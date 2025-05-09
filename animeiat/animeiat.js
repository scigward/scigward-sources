async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Referer': 'https://www.animeiat.xyz/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
        // Make the search request
        const response = await fetchv2(`https://www.animeiat.xyz/search?q=${encodeURIComponent(keyword)}`, headers);
        const html = await response.text();

        // Extract the script content containing anime data
        const scriptMatch = html.match(/<script>window\.__NUXT__=\(function\(.*?\)\s*{return\s*({[\s\S]+?})}\(.*?\)\);<\/script>/);
        if (!scriptMatch) return JSON.stringify([]);

        // Extract just the anime array portion
        const animeArrayMatch = scriptMatch[1].match(/animes:\s*(\[[\s\S]+?\](?=\s*,\s*meta))/);
        if (!animeArrayMatch) return JSON.stringify([]);

        // Process each anime entry
        const animeEntries = animeArrayMatch[1].split(/\},\s*{/);
        
        animeEntries.forEach(entry => {
            // Clean and normalize the entry
            let cleanEntry = entry.trim();
            if (!cleanEntry.startsWith('{')) cleanEntry = '{' + cleanEntry;
            if (!cleanEntry.endsWith('}')) cleanEntry = cleanEntry + '}';

            // Extract fields using simple text matching
            const extractField = (str, field) => {
                const match = str.match(new RegExp(`${field}:\\s*"([^"]+)"`));
                return match ? match[1] : null;
            };

            const title = extractField(cleanEntry, 'anime_name');
            const slug = extractField(cleanEntry, 'slug');
            const posterPath = extractField(cleanEntry, 'poster_path');

            if (title && slug) {
                results.push({
                    title: title,
                    href: `https://www.animeiat.xyz/anime/${slug}`,
                    image: posterPath ? `https://api.animeiat.co/storage/${posterPath.replace(/\\u002F/g, '/')}` : ''
                });
            }
        });

        return JSON.stringify(results);

    } catch (error) {
        console.error('Search failed:', error);
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
