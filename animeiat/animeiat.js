const ENCODED = {
    API_ANIME_QUERY: 'aHR0cHM6Ly9hcGkuYW5pbWVpYXQuY28vdjEvYW5pbWU/cT0=',
    WEBSITE: 'aHR0cHM6Ly93d3cuYW5pbWVpYXQueHl6Lw==',
    STORAGE: 'aHR0cHM6Ly9hcGkuYW5pbWVpYXQuY28vc3RvcmFnZS8=',
    WEBSITE_ANIME: 'aHR0cHM6Ly93d3cuYW5pbWVpYXQueHl6L2FuaW1lLw==',
    API_EPISODES: 'aHR0cHM6Ly9hcGkuYW5pbWVpYXQuY28vdjEvYW5pbWUv',
    WEBSITE_WATCH: 'aHR0cHM6Ly93d3cuYW5pbWVpYXQueHl6L3dhdGNoLw==',
    API_VIDEO_DOWNLOAD: 'aHR0cHM6Ly9hcGkuYW5pbWVpYXQuY28vdjEvdmlkZW8v'
};

const DECODED = {};
for (const key in ENCODED) {
    DECODED[key] = atob(ENCODED[key]);
}

// Test code
// (async () => {
//     try {
//         const results = await searchResults('Cowboy Bebop');
//         console.log('RESULTS:', results);

//         const parsedResults = JSON.parse(results);
        
//         if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
//             console.error('No search results found');
//             return;
//         }

//         const target = parsedResults[1] || parsedResults[0];
        
//         if (!target || !target.href) {
//             console.error('No valid target found in search results');
//             return;
//         }

//         const details = await extractDetails(target.href);
//         console.log('DETAILS:', details);

//         const eps = await extractEpisodes(target.href);
//         console.log('EPISODES:', eps);

//         const parsedEpisodes = JSON.parse(eps);
//         if (parsedEpisodes.length > 0) {
//             const streamUrl = await extractStreamUrl(parsedEpisodes[0].href);
//             console.log('STREAMURL:', streamUrl);
            
//             if (streamUrl) {
//                 const streams = JSON.parse(streamUrl);
//                 console.log(`Found ${streams.streams?.length || 0} total streams`);
//             }
//         } else {
//             console.log('No episodes found.');
//         }
//     } catch (error) {
//         console.error('Test failed:', error.message);
//     }
// })();

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);

        async function fetchSearchPage(page) {
            const apiUrl = `${DECODED.API_ANIME_QUERY}${encodedKeyword}&page=${page}`;
            const res = await soraFetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'Referer': DECODED.WEBSITE
                }
            });
            const json = await res.json();
            return json?.data || [];
        }

        const results = [];

        for (let page = 1; page <= 5; page++) {
            const pageResults = await fetchSearchPage(page);
            if (!pageResults.length) break;

            for (const item of pageResults) {
                const title = decodeHTMLEntities(item.anime_name || '');
                const href = `${DECODED.WEBSITE_ANIME}${item.slug || ''}`;
                const poster = item.poster_path ? `${DECODED.STORAGE}${item.poster_path.replace(/\\u002F/g, '/')}` : '';
                results.push({ title, href, image: poster });
            }
        }

        if (results.length === 0) {
            return JSON.stringify([{ title: 'No results found', href: '', image: '' }]);
        }

        return JSON.stringify(results);
    } catch (error) {
        console.error('Search failed:', error);
        return JSON.stringify([{ title: 'Error', href: '', image: '', error: error.message }]);
    }
}

async function extractDetails(url) {
    const results = [];

    try {
        const response = await soraFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': DECODED.WEBSITE
            }
        });
        const html = await response.text();

        const descriptionMatch = html.match(/<p class="text-justify">([\s\S]*?)<\/p>/i);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';

        const airdateMatch = html.match(/<span draggable="false" class="mb-1 v-chip theme--dark v-size--small blue darken-4"><span class="v-chip__content"><span>(\d{4})<\/span><\/span><\/span>/i);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

        const aliasContainerMatch = html.match(/<div class="v-card__text pb-0 px-1">\s*<div class="text-center d-block align-center">([\s\S]*?)<\/div>\s*<\/div>/i);

        const aliases = [];
        if (aliasContainerMatch && aliasContainerMatch[1]) {
            const aliasSpanRegex = /<span draggable="false" class="ml-1 mb-1 v-chip v-chip--no-color theme--dark v-size--small">[\s\S]*?<span class="v-chip__content"><span>([^<]+)<\/span><\/span>/g;
            let match;
            while ((match = aliasSpanRegex.exec(aliasContainerMatch[1])) !== null) {
                aliases.push(decodeHTMLEntities(match[1].trim()));
            }
        }

        results.push({
            description,
            aliases: aliases.length ? aliases.join(', ') : 'N/A',
            airdate
        });

        return JSON.stringify(results);
    } catch (error) {
        console.error('Error extracting details:', error);
        return JSON.stringify([{ description: 'N/A', aliases: 'N/A', airdate: 'N/A' }]);
    }
}

async function extractEpisodes(url) {
    const episodes = [];
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': DECODED.WEBSITE
    };

    try {
        const response = await soraFetch(url, { headers });
        const html = await response.text();

        const slug = html.match(/window\.__NUXT__=.*?anime_name:"[^"]+",slug:"([^"]+)"/)?.[1]
                  || html.match(/slug:"([^"]+)"/)?.[1]
                  || url.match(/\/anime\/([^\/]+)/)?.[1];

        if (!slug) return JSON.stringify([]);

        let episodeCount = 0;

        try {
            const apiUrl = `${DECODED.API_EPISODES}${slug}/episodes`;
            const apiData = await (await soraFetch(apiUrl, { headers })).json();

            if (apiData?.meta?.last_page) {
                const lastPageHtml = await (await soraFetch(`${url}?page=${apiData.meta.last_page}`, { headers })).text();

                const episodeMatches = [...lastPageHtml.matchAll(/الحلقة:\s*(\d+)/g)];
                const urlMatches = [...lastPageHtml.matchAll(/episode-(\d+)/g)];

                let highest = 0;
                for (const m of episodeMatches.concat(urlMatches)) {
                    const n = parseInt(m[1]);
                    if (n > highest) highest = n;
                }

                episodeCount = highest;
            }
        } catch (error) {
            console.error('Last page method failed:', error);
        }

        if (!episodeCount) {
            try {
                const apiUrl = `${DECODED.API_EPISODES}${slug}/episodes`;
                const apiData = await (await soraFetch(apiUrl, { headers })).json();
                if (apiData?.meta?.total) episodeCount = apiData.meta.total;
            } catch (error) {
                console.error('API total method failed:', error);
            }
        }

        if (!episodeCount) {
            const urlMatches = [...html.matchAll(/href="[^"]*\/watch\/[^"]*-episode-(\d+)/g)];
            const spanMatches = [...html.matchAll(/الحلقة\s*[:\s]\s*(\d+)/g)];
            let highest = 0;
            for (const m of urlMatches.concat(spanMatches)) {
                const n = parseInt(m[1]);
                if (n > highest) highest = n;
            }
            episodeCount = highest;
        }

        for (let i = 1; i <= episodeCount; i++) {
            episodes.push({
                href: `${DECODED.WEBSITE_WATCH}${slug}-episode-${i}`,
                number: i
            });
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error('Extraction failed:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const pageResponse = await soraFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Referer': DECODED.WEBSITE
            }
        });

        const html = await pageResponse.text();
        const videoSlugMatch = html.match(/video:\{id:[^,]+,name:"[^"]+",slug:"([^"]+)"/i);
        if (!videoSlugMatch || !videoSlugMatch[1]) {
            throw new Error('Video slug not found in page');
        }
        const videoSlug = videoSlugMatch[1];

        const apiUrl = `${DECODED.API_VIDEO_DOWNLOAD}${videoSlug}/download`;
        const apiResponse = await soraFetch(apiUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Referer': DECODED.WEBSITE,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Origin': DECODED.WEBSITE
            }
        });

        const data = await apiResponse.json();
        const result = { streams: [] };

        if (data.data && Array.isArray(data.data)) {
            for (const stream of data.data) {
                if (stream.file && stream.label) {
                    result.streams.push({
                        title: `[${stream.label}]`,
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

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
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