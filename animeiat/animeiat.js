async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetchv2(`https://www.animeiat.xyz/search?q=${encodedKeyword}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeiat.xyz/'
            }
        });

        const html = await response.text();

        // Extract each anime card container
        const cardRegex = /<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)(?:<\/div>\s*){3}/g;
        const cards = [...html.matchAll(cardRegex)];

        const results = [];

        for (const card of cards) {
            const block = card[1];

            const titleMatch = block.match(/<h2[^>]*class="anime_name[^"]*"[^>]*>(.*?)<\/h2>/);
            const hrefMatch = block.match(/<a[^>]+href="(\/anime\/[^"]+)"/);

            if (!titleMatch || !hrefMatch) continue;

            const title = decodeHTMLEntities(titleMatch[1].trim());
            const href = hrefMatch[1];

            // Match poster in the full HTML
            const posterRegex = new RegExp(`anime_name:\\s*"?${title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}"?,[\\s\\S]*?poster_path:\\s*"(.*?)"`, "i");
            const posterMatch = html.match(posterRegex);

            const poster = posterMatch ? posterMatch[1].replace(/\\u002F/g, "/") : "";

            results.push({
                title,
                href: `https://www.animeiat.xyz${href}`,
                image: poster ? `https://api.animeiat.co/storage/${poster}` : ""
            });
        }

        if (results.length === 0) {
            return JSON.stringify([{
                title: 'No results found',
                href: '',
                image: ''
            }]);
        }

        return JSON.stringify(results);
    } catch (error) {
        console.error('Search failed:', error);
        return JSON.stringify([{
            title: 'Error',
            href: '',
            image: '',
            error: error.message
        }]);
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
        const airdateMatch = html.match(/<span draggable="false" class="mb-1 v-chip theme--dark v-size--small blue darken-4"><span class="v-chip__content"><span>(\d{4})<\/span><\/span><\/span>/i);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

        // Extract aliases
        const aliasContainerMatch = html.match(
            /<div class="v-card__text pb-0 px-1">\s*<div class="text-center d-block align-center">([\s\S]*?)<\/div>\s*<\/div>/i
        );

        const aliases = [];

        if (aliasContainerMatch && aliasContainerMatch[1]) {
            const aliasSpanRegex = /<span draggable="false" class="ml-1 mb-1 v-chip v-chip--no-color theme--dark v-size--small">[\s\S]*?<span class="v-chip__content"><span>([^<]+)<\/span><\/span>/g;
            let match;
            while ((match = aliasSpanRegex.exec(aliasContainerMatch[1])) !== null) {
                aliases.push(decodeHTMLEntities(match[1].trim()));
            }
        }

        results.push({
            description: description,
            aliases: aliases.length ? aliases.join(', ') : 'N/A',
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
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeiat.xyz/'
    };
    
    try {
        // Fetch initial page to get slug
        const response = await fetchv2(url, headers);
        const html = await response.text();
        
        // Extract slug from window.__NUXT__
        const nuxtMatch = html.match(/window\.__NUXT__=.*?anime_name:"[^"]+",slug:"([^"]+)"/);
        const slug = nuxtMatch ? nuxtMatch[1] : '';
        if (!slug) return JSON.stringify(episodes);
        
        // Fetch API endpoint to get last page and total count
        const apiUrl = `https://api.animeiat.co/v1/anime/${slug}/episodes`;
        const apiResponse = await fetchv2(apiUrl, headers);
        const apiData = await apiResponse.json();
        
        // Get the last page number and total episodes from API
        const lastPage = apiData.meta.last_page;
        const totalEpisodes = apiData.meta.total;
        
        // Try to fetch the last page first (preferred method)
        let latestEpisodeNum = 0;
        try {
            const lastPageUrl = `${url}?page=${lastPage}`;
            const lastPageResponse = await fetchv2(lastPageUrl, headers);
            const lastPageHtml = await lastPageResponse.text();
            
            // Extract the highest episode number from last page
            const episodeMatches = [...lastPageHtml.matchAll(/الحلقة:\s*(\d+)/g)];
            if (episodeMatches.length > 0) {
                latestEpisodeNum = Math.max(...episodeMatches.map(m => parseInt(m[1])));
            }
        } catch (error) {
            console.log('Falling back to API total count due to last page fetch error:', error);
        }
        
        // Determine which count to use (prefer last page scraping result)
        const episodeCount = latestEpisodeNum > 0 ? latestEpisodeNum : totalEpisodes;
        
        // Generate all episode links
        for (let i = 1; i <= episodeCount; i++) {
            episodes.push({
                href: `https://www.animeiat.xyz/watch/${slug}-episode-${i}`,
                number: i
            });
        }
        
        return JSON.stringify(episodes);
        
    } catch (error) {
        console.error('Failed to extract episodes:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
  try {
    // 1. Fetch the episode page
    const pageResponse = await fetchv2(url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      'Referer': 'https://www.animeiat.xyz/'
    });

    const html = await pageResponse.text();

    // 2. Extract the video slug
    const videoSlugMatch = html.match(/video:\{id:[^,]+,name:"[^"]+",slug:"([^"]+)"/i);
    if (!videoSlugMatch || !videoSlugMatch[1]) {
      throw new Error('Video slug not found in page');
    }
    const videoSlug = videoSlugMatch[1];

    // 3. Prepare headers
    const apiHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.animeiat.xyz/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      'Origin': 'https://www.animeiat.xyz'
    };

    // 4. Fetch stream data
    const apiUrl = `https://api.animeiat.co/v1/video/${videoSlug}/download`;
    const apiResponse = await fetchv2(apiUrl, apiHeaders);
    const data = await apiResponse.json();

    const result = { streams: [] };

    if (data.data && Array.isArray(data.data)) {
      for (const stream of data.data) {
        if (stream.file && stream.label) {
          result.streams.push(`${stream.label}`, stream.file);
        }
      }
    }

    if (result.streams.length === 0) {
      throw new Error('No stream URLs found in API response');
    }

    return JSON.stringify(result);

  } catch (error) {
    console.error('Error in extractStreamUrl:', error);
    return JSON.stringify({ streams: [] });
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
