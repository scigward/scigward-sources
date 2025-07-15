async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);

        async function fetchSearchPage(page) {
            const apiUrl = `https://api.animeiat.co/v1/anime?q=${encodedKeyword}&page=${page}`;
            const res = await soraFetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'Referer': 'https://www.animeiat.xyz/'
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
                const href = `https://www.animeiat.xyz/anime/${item.slug || ''}`;
                const poster = item.poster_path
                    ? `https://api.animeiat.co/storage/${item.poster_path.replace(/\\u002F/g, '/')}`
                    : '';
                results.push({ title, href, image: poster });
            }
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

    try {
        const response = await soraFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeiat.xyz/'
            }
        });
        const html = await response.text();

        const descriptionMatch = html.match(/<p class="text-justify">([\s\S]*?)<\/p>/i);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';

        const airdateMatch = html.match(/<span draggable="false" class="mb-1 v-chip theme--dark v-size--small blue darken-4"><span class="v-chip__content"><span>(\d{4})<\/span><\/span><\/span>/i);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

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

    try {
        const response = await soraFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeiat.xyz/'
            }
        });
        const html = await response.text();

        let slug = html.match(/window\.__NUXT__=.*?anime_name:"[^"]+",slug:"([^"]+)"/)?.[1] ||
                 html.match(/slug:"([^"]+)"/)?.[1] ||
                 url.match(/\/anime\/([^\/]+)/)?.[1];

        if (!slug) return JSON.stringify([]);

        let episodeCount = 0;

        try {
            const apiUrl = `https://api.animeiat.co/v1/anime/${slug}/episodes`;
            const apiData = await (await soraFetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.animeiat.xyz/'
                }
            })).json();

            if (apiData?.meta?.last_page) {
                const lastPageHtml = await (await soraFetch(`${url}?page=${apiData.meta.last_page}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.animeiat.xyz/'
                    }
                })).text();

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

        if (!episodeCount) {
            try {
                const apiUrl = `https://api.animeiat.co/v1/anime/${slug}/episodes`;
                const apiData = await (await soraFetch(apiUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.animeiat.xyz/'
                    }
                })).json();
                if (apiData?.meta?.total) episodeCount = apiData.meta.total;
            } catch (error) {
                console.error('API total method failed:', error);
            }
        }

        if (!episodeCount) {
            const urlMatches = [...html.matchAll(/href="[^"]*\/watch\/[^"]*-episode-(\d+)/g)];
            const spanMatches = [...html.matchAll(/الحلقة\s*[:\s]\s*(\d+)/g)];
            episodeCount = Math.max(
                ...urlMatches.map(m => parseInt(m[1])),
                ...spanMatches.map(m => parseInt(m[1])),
                0
            );
        }

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
    const pageResponse = await soraFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeiat.xyz/'
      }
    });

    const html = await pageResponse.text();
    const videoSlugMatch = html.match(/video:\{id:[^,]+,name:"[^"]+",slug:"([^"]+)"/i);
    if (!videoSlugMatch || !videoSlugMatch[1]) {
      throw new Error('Video slug not found in page');
    }
    const videoSlug = videoSlugMatch[1];

    const apiUrl = `https://api.animeiat.co/v1/video/${videoSlug}/download`;
    const apiResponse = await soraFetch(apiUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.animeiat.xyz/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Origin': 'https://www.animeiat.xyz'
      }
    });
    const data = await apiResponse.json();

    const result = { streams: [] };

    if (data.data && Array.isArray(data.data)) {
      for (const stream of data.data) {
        if (stream.file && stream.label) {
          let title = `[${stream.label}]`;
          result.streams.push({
            title,
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
