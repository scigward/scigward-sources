async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetchv2(`https://www.animeiat.xyz/search?q=${encodedKeyword}`, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://www.animeiat.xyz/'
        });

        const html = await response.text();
        
        // Step 1: Extract titles and hrefs from containers
        const results = [];
        const containerRegex = /<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div><\/div><\/div>/g;
        let containerMatch;
        
        while ((containerMatch = containerRegex.exec(html)) !== null) {
            const container = containerMatch[1];
            const titleMatch = container.match(/<h2[^>]*>(.*?)<\/h2>/);
            const hrefMatch = container.match(/href="([^"]+)"/);
            
            if (titleMatch && hrefMatch) {
                const rawTitle = titleMatch[1].trim();
                const title = decodeHTMLEntities(rawTitle);
                const href = hrefMatch[1].trim();
                
                // Add the base URL to href if it's a relative path
                const fullHref = href.startsWith('/') 
                    ? `https://animeiat.xyz${href}` 
                    : href;
                
                results.push({
                    title: title,
                    href: fullHref,
                    image: ''
                });
            }
        }
        
        // Step 2: Match posters with extracted titles
        const scriptRegex = /anime_name:\s*"(.*?)"[\s\S]*?slug:\s*"(.*?)"[\s\S]*?poster_path:\s*"(.*?)"/g;
        let scriptMatch;
        
        while ((scriptMatch = scriptRegex.exec(html)) !== null) {
            const scriptTitle = decodeHTMLEntities(scriptMatch[1]?.trim() || '');
            const poster = scriptMatch[3]?.trim().replace(/\\u002F/g, '/') || '';
            
            // Find matching result by exact title
            const foundIndex = results.findIndex(result => {
                // Normalize both titles by trimming and converting to lowercase
                const normalizedResultTitle = result.title.toLowerCase().trim();
                const normalizedScriptTitle = scriptTitle.toLowerCase().trim();
                return normalizedResultTitle === normalizedScriptTitle;
            });
            
            if (foundIndex !== -1) {
                results[foundIndex].image = `https://api.animeiat.co/storage/${poster}`;
            }
        }
        
        // Return results
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
        // Step 1: Get initial page and extract slug
        const response = await fetchv2(url, headers);
        const html = await response.text();
        
        let slug = html.match(/window\.__NUXT__=.*?anime_name:"[^"]+",slug:"([^"]+)"/)?.[1] || 
                 html.match(/slug:"([^"]+)"/)?.[1] || 
                 url.match(/\/anime\/([^\/]+)/)?.[1];
        
        if (!slug) return JSON.stringify([]);
        
        // Step 2: Determine episode count
        let episodeCount = 0;
        
        // Method 1: Check last page
        try {
            const apiUrl = `https://api.animeiat.co/v1/anime/${slug}/episodes`;
            const apiData = await (await fetchv2(apiUrl, headers)).json();
            
            if (apiData?.meta?.last_page) {
                const lastPageHtml = await (await fetchv2(`${url}?page=${apiData.meta.last_page}`, headers)).text();
                
                const episodeMatches = [...lastPageHtml.matchAll(/الحلقة:\s*(\d+)/g)];
                const urlMatches = [...lastPageHtml.matchAll(/episode-(\d+)/g)];
                
                const highestFromMatches = Math.max(
                    ...episodeMatches.map(m => parseInt(m[1])),
                    ...urlMatches.map(m => parseInt(m[1])),
                    0
                );
                
                if (highestFromMatches > 0) episodeCount = highestFromMatches;
            }
        } catch (error) {
            console.error('Last page method failed:', error);
        }
        
        // Method 2: API total fallback
        if (!episodeCount) {
            try {
                const apiUrl = `https://api.animeiat.co/v1/anime/${slug}/episodes`;
                const apiData = await (await fetchv2(apiUrl, headers)).json();
                if (apiData?.meta?.total) episodeCount = apiData.meta.total;
            } catch (error) {
                console.error('API total method failed:', error);
            }
        }
        
        // Method 3: First page fallback
        if (!episodeCount) {
            const urlMatches = [...html.matchAll(/href="[^"]*\/watch\/[^"]*-episode-(\d+)/g)];
            const spanMatches = [...html.matchAll(/الحلقة\s*[:\s]\s*(\d+)/g)];
            episodeCount = Math.max(
                ...urlMatches.map(m => parseInt(m[1])),
                ...spanMatches.map(m => parseInt(m[1])),
                0
            );
        }
        
        // Step 3: Generate episode links
        if (episodeCount > 0) {
            for (let i = 1; i <= episodeCount; i++) {
                episodes.push({
                    href: `https://www.animeiat.xyz/watch/${slug}-episode-${i}`,
                    number: i
                });
            }
        }
        
        return JSON.stringify(episodes);
        
    } catch (error) {
        console.error('Extraction failed:', error);
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
    const apiResponse = await fetchv2(apiUrl, { headers: apiHeaders });
    const data = await apiResponse.json();

    const result = { streams: [] };

    if (data.data && Array.isArray(data.data)) {
      for (const stream of data.data) {
        if (stream.file && stream.label) {
          result.streams.push({
            title: stream.label,
            streamUrl: stream.file,
            headers: { referer: stream.file },
            subtitles: null
          });
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
