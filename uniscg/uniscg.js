const STREAM_MAPPERS = {
    'animerco': { name: 'Animerco', streams: 'animerco_extractStreamUrl' },
    'animeiat': { name: 'Animeiat', streams: 'animeiat_extractStreamUrl' },
    'okanime': { name: 'Okanime', streams: 'okanime_extractStreamUrl' }
};

async function searchResults(keyword) {
    console.log('Running....');
    console.log('Providers:', Object.values(STREAM_MAPPERS).map(m => m.name).join(', '));

    const filters = { "isAdult": false };
    let languageCode = 'en';

    try {
        if (keyword.match(/\?[a-z]{2}$/)) {
            languageCode = keyword.slice(-3, -1);
            keyword = keyword.slice(0, -3);
        }

        let searchResults = null;
        if (keyword.startsWith('!')) {
            const anilistResults = await Anilist.getLatest(filters);
            searchResults = anilistResults?.Page?.media ?? [];
        } else {
            const anilistResults = await Anilist.search(keyword, filters);
            searchResults = anilistResults?.Page?.media ?? [];
        }

        const results = searchResults.map(item => {
            const alternativeTitles = [item.title.english, item.title.native].filter(Boolean).join(', ');
            let episodeCount = (parseInt(item?.nextAiringEpisode?.episode) - 1);
            if (isNaN(episodeCount)) {
                episodeCount = item?.episodes ?? null;
            }

            const transferData = JSON.stringify({
                id: item.id,
                idMal: item.idMal,
                titleRomaji: cleanTitle(item?.title?.romaji),
                titleEnglish: cleanTitle(item?.title?.english),
                titleNative: item?.title?.native,
                aliases: alternativeTitles,
                nextAiringEpisodeCountdown: Anilist.nextAnilistAirDateToCountdown(item?.nextAiringEpisode?.airingAt) ?? null,
                status: item.status,
                genres: item.genres,
                format: item.format,
                description: item.description,
                year: item.startDate?.year,
                startDate: Anilist.convertAnilistDateToDateStr(item.startDate) ?? '',
                endDate: Anilist.convertAnilistDateToDateStr(item.endDate) ?? '',
                episodeCount: episodeCount,
                languageCode: languageCode ?? "en",
                host: ''
            });

            return {
                title: item.title.romaji,
                image: item.coverImage.extraLarge ?? item.coverImage.large ?? '#',
                href: `unified://anime/${item.id}/episodes|${transferData}`
            };
        });

        return JSON.stringify(results);

    } catch (error) {
        console.log('Search error:', error.message);
        return JSON.stringify([]);
    }
}

async function extractDetails(objString) {
    const encodedDelimiter = '|';
    const [url, jsonString] = decodeURIComponent(objString).split(encodedDelimiter);
    const json = JSON.parse(jsonString || '{}');

    if (url.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    let description = `${json.description}\n\nGenres: ${json.genres.join(', ')}\nFormat: ${json.format}\nEpisodes: ${json.episodeCount}\nStatus: ${json.status}\nStart Date: ${json.startDate}\nEnd Date: ${json.endDate}\n\n`;
    const timeUntilNextEpisode = json.nextAiringEpisodeCountdown;

    if (timeUntilNextEpisode != null) {
        description += 'Time until next episode: ' + timeUntilNextEpisode;
    }

    return JSON.stringify([{
        description: description,
        aliases: json.aliases ?? '',
        airdate: json.airdate ?? 'Airdates unknown'
    }]);
}

async function extractEpisodes(objString) {
    const encodedDelimiter = '|';
    const [url, jsonString] = decodeURIComponent(objString).split(encodedDelimiter);
    const json = JSON.parse(jsonString || '{}');

    if (url.startsWith('#')) throw new Error('Host down');

    try {
        let episodes = [];
        if (json.episodeCount && json.episodeCount > 0) {
            for (let i = 1; i <= parseInt(json.episodeCount); i++) {
                const transferData = JSON.stringify({
                    id: json.id,
                    episode: i,
                    languageCode: json.languageCode,
                    titleRomaji: json.titleRomaji,
                    titleEnglish: json.titleEnglish,
                    titleNative: json.titleNative,
                    aliases: json.aliases
                });
                episodes.push({
                    href: `unified://episode/${json.id}/${i}|${transferData}`,
                    number: i
                });
            }
        }
        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Episodes error:', error.message);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(objString) {
    const encodedDelimiter = '|';
    const [url, jsonString] = decodeURIComponent(objString).split(encodedDelimiter);

    let json;
    try {
        json = JSON.parse(jsonString || '{}');
    } catch {
        return JSON.stringify({ streams: [] });
    }

    function calculateTitleSimilarity(title1, title2) {
        if (!title1 || !title2) return 0;
        const normalize = (s) => s.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^\w]/g, '')
            .replace(/×/g, 'x');
        const n1 = normalize(title1);
        const n2 = normalize(title2);
        if (n1 === n2) return 100;
        if (n1.includes(n2) || n2.includes(n1)) return 80;
        let matches = 0;
        for (let i = 0; i < Math.min(n1.length, n2.length); i++) {
            if (n1[i] === n2[i]) matches++;
        }
        return (matches / Math.max(n1.length, n2.length)) * 100;
    }

    function validateAnimeMatch(searchResult, targetTitle, targetYear) {
        const similarity = calculateTitleSimilarity(searchResult.title, targetTitle);
        if (similarity < 70) return false;
        if (targetYear && searchResult.title) {
            const resultYear = searchResult.title.match(/\((\d{4})\)/);
            const targetYearMatch = targetTitle.match(/\((\d{4})\)/);
            if (resultYear && targetYearMatch && resultYear[1] !== targetYearMatch[1]) return false;
        }
        return true;
    }

    function validateEpisodeMatch(episodes, targetEpisodeNumber) {
        const episode = episodes.find(ep => ep.number == targetEpisodeNumber);
        if (!episode) return null;
        const maxEpisode = Math.max(...episodes.map(ep => ep.number));
        if (targetEpisodeNumber > maxEpisode * 2) return null;
        return episode;
    }

    async function runWithLimit(limit, tasks) {
        const results = [];
        const executing = [];
        for (const task of tasks) {
            const p = Promise.resolve().then(task);
            results.push(p);
            if (limit <= tasks.length) {
                const e = p.then(() => executing.splice(executing.indexOf(e), 1));
                executing.push(e);
                if (executing.length >= limit) await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }

    try {
        const allStreams = [];
        const titlesToTry = [json.titleRomaji, json.titleEnglish].filter(Boolean);

        const SEARCH_MAP = {};
        const EPISODES_MAP = {};
        const STREAMS_MAP = {};
        for (const [mapperKey, mapper] of Object.entries(STREAM_MAPPERS)) {
            SEARCH_MAP[mapperKey] = eval(`${mapperKey}_searchResults`);
            EPISODES_MAP[mapperKey] = eval(`${mapperKey}_extractEpisodes`);
            STREAMS_MAP[mapperKey] = eval(mapper.streams);
        }

        await runWithLimit(3, Object.entries(STREAM_MAPPERS).map(([mapperKey, mapper]) => async () => {
            try {
                const resultsArr = await Promise.all(
                    titlesToTry.map(async title => {
                        try {
                            return JSON.parse(await SEARCH_MAP[mapperKey](title));
                        } catch {
                            return [];
                        }
                    })
                );

                let bestResult = null, bestSim = 0;
                for (const r of resultsArr.flat()) {
                    const sim = calculateTitleSimilarity(r.title, json.titleRomaji);
                    if (sim > bestSim && validateAnimeMatch(r, json.titleRomaji, json.year)) {
                        bestResult = r;
                        bestSim = sim;
                    }
                }
                if (!bestResult || bestSim < 70) return;

                const episodes = JSON.parse(await EPISODES_MAP[mapperKey](bestResult.href));
                if (!episodes.length) return;

                const targetEp = validateEpisodeMatch(episodes, json.episode);
                if (!targetEp) return;

                const streams = JSON.parse(await STREAMS_MAP[mapperKey](targetEp.href));
                if (!streams.streams?.length) return;

                const validStreams = streams.streams.filter(s => s.streamUrl?.startsWith('http'));
                for (const stream of validStreams) {
                    const originalTitle = stream.title;
                    let serverName = '';
                    let quality = '';
                    if (originalTitle.includes('[') && originalTitle.includes(']')) {
                        const qualityMatch = originalTitle.match(/\[([^\]]+)\]/);
                        quality = qualityMatch ? qualityMatch[1] : '';
                        if (originalTitle.includes('[Megamax]')) {
                            const serverMatch = originalTitle.match(/^([^-]+)/);
                            serverName = serverMatch ? `Megamax ${serverMatch[1][0].toUpperCase() + serverMatch[1].slice(1)}` : 'Megamax';
                        } else {
                            const serverMatch = originalTitle.replace(/\[[^\]]+\]/, '').trim();
                            serverName = serverMatch || '';
                        }
                    } else {
                        const parts = originalTitle.split(' ');
                        serverName = parts[parts.length - 1] || '';
                    }
                    const formattedTitle = `${mapper.name} - ${serverName} - [${quality}]`;
                    allStreams.push({
                        title: formattedTitle,
                        streamUrl: stream.streamUrl,
                        headers: stream.headers || {}
                    });
                }
            } catch {}
        }));

        allStreams.sort((a, b) => a.title.localeCompare(b.title));
        return JSON.stringify({ streams: allStreams });
    } catch {
        return JSON.stringify({ streams: [] });
    }
}

// ===== ANIMERCO MAPPER =====
function DECODE_SI() { return atob('aHR0cHM6Ly90di5hbmltZXJjby5vcmcv'); }

async function animerco_searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `${DECODE_SI()}/?s=${encodedKeyword}`;
        const response = await soraFetch(searchUrl);
        const responseText = await response.text();

        const results = [];

        const itemRegex = /<div id="post-\d+" class="col-12[\s\S]*?<a href="([^"]+)" class="image[^"]*"[^>]*?data-src="([^"]+)"[^>]*?title="([^"]+)"[\s\S]*?<div class="info">/g;
        let match;

        while ((match = itemRegex.exec(responseText)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = decodeHTMLEntities(match[3].trim());
            results.push({ title, href, image });
        }

        console.log(results);
        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error in searchResults:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function animerco_extractEpisodes(url) {
    try {
        const pageResponse = await soraFetch(url);
        const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

        const episodes = [];

        if (url.includes('movies')) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        const seasonUrlRegex = /<li\s+data-number='[^']*'>\s*<a\s+href='([^']+)'/g;
        const seasonUrls = [...html.matchAll(seasonUrlRegex)].map(match => match[1]);

        for (const seasonUrl of seasonUrls) {
            const seasonResponse = await soraFetch(seasonUrl);
            const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

            const episodeRegex = /data-number='(\d+)'[\s\S]*?href='([^']+)'/g;
            for (const match of seasonHtml.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[1]),
                    href: match[2]
                });
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error("extractEpisodes failed:", error);
        return JSON.stringify([]);
    }
}

async function animerco_extractStreamUrl(url) {


    const multiStreams = {
        streams: [],
        subtitles: null
    };

    try {
        console.log("Page URL received: " + url);
        const res = await soraFetch(url, {
            method: 'GET',
            headers: {
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();

        const servers = ['mp4upload', 'yourupload', 'streamwish', 'sfastwish', 'sibnet', 'uqload', 'vk'];
        
        const serverPromises = servers.map(async (server) => {
            const regex = new RegExp(
                `<a[^>]+class=['"][^'"]*option[^'"]*['"][^>]+data-type=['"]([^'"]+)['"][^>]+data-post=['"]([^'"]+)['"][^>]+data-nume=['"]([^'"]+)['"][^>]*>(?:(?!<span[^>]*class=['"]server['"]>).)*<span[^>]*class=['"]server['"]>\\s*${server}\\s*<\\/span>`,
                "gis"
            );
            const matches = [...html.matchAll(regex)];

            const matchPromises = matches.map(async (match) => {
                const [_, type, post, nume] = match;
                const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'Origin': DECODE_SI(),
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'path': '/wp-admin/admin-ajax.php',
                    'accept-encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'en-US,en;q=0.7',
                    'Referer': url,
                };

                try {
                    const response = await soraFetch(`${DECODE_SI()}/wp-admin/admin-ajax.php`, {
                        headers,
                        method: 'POST',
                        body
                    });
                    const json = await response.json();

                    if (!json?.embed_url) {
                        console.log(`No embed URL found for ${server}`);
                        return null;
                    }

                    const cleanEmbedUrl = json.embed_url.replace(/\\\//g, '/');
                    console.log(`[${server}] Cleaned embed URL: ${ cleanEmbedUrl }`);

                    let streamData;
                    try {
                        const extractors = {
                            'mp4upload': mp4Extractor,
                            'yourupload': youruploadExtractor,
                            'streamwish': streamwishExtractor,
                            'sfastwish': streamwishExtractor,
                            'sibnet': sibnetExtractor,
                            'uqload': uqloadExtractor,
                            'vk': vkvideoExtractor
                        };
                        streamData = await extractors[server]?.(cleanEmbedUrl);

                        if (streamData?.url) {
                            return {
                                title: server,
                                streamUrl: streamData.url,
                                headers: streamData.headers,
                                subtitles: null
                            };
                        } else {
                            console.log(`No stream URL found for ${server}`);
                            return null;
                        }
                    } catch (extractorError) {
                        console.log(`Extractor error for ${server}: ${ extractorError.message }`);
                        return null;
                    }
                } catch (error) {
                    console.log(`Error processing ${server}: ${ error.message }`);
                    return null;
                }
            });

            const results = await Promise.all(matchPromises);
            return results.filter(Boolean); 
        });

        const allStreams = (await Promise.all(serverPromises)).flat();
        multiStreams.streams = allStreams;

        if (multiStreams.streams.length === 0) {
            console.log("No valid streams were extracted from any provider");
            return JSON.stringify({ streams: [], subtitles: null });
        }

        console.log(`Extracted ${multiStreams.streams.length} streams`);
        return JSON.stringify(multiStreams);
    } catch (error) {
        console.log("Error in extractStreamUrl: " + error.message);
        return JSON.stringify({ streams: [], subtitles: null });
    }
}

// ===== ANIMEIAT MAPPER =====
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

async function animeiat_searchResults(keyword) {
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

async function animeiat_extractEpisodes(url) {
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

async function animeiat_extractStreamUrl(url) {
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
                        headers: { referer: stream.file }
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

// ===== OKANIME MAPPER =====
const OKANIME_BASE_URL = "https://ok.okanime.xyz";
const OKANIME_SEARCH_URL = `${OKANIME_BASE_URL}/search/?s=`;
const OKANIME_MEGAMAX_HEADERS = {
  "X-Inertia-Partial-Component": "files/mirror/video",
  "X-Inertia-Partial-Data": "streams",
  "X-Requested-With": "XMLHttpRequest",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0"
};

async function okanime_searchResults(keyword) {
    try {
        const pages = Array.from({ length: 5 }, (_, i) => i + 1);
        const results = [];
        const seen = new Set();

        for (const page of pages) {
            const url = page === 1 
                ? `${OKANIME_SEARCH_URL}${keyword}` 
                : `${OKANIME_SEARCH_URL}${keyword}&page=${page}`;
            const res = await soraFetch(url, { headers: { Referer: OKANIME_BASE_URL, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0" } });
            if (!res) continue;
            const html = await res.text();

            const itemRegex = /<div class="col-6 col-sm-4 col-lg-3 col-xl-2dot4[^"]*">([\s\S]*?)(?=<div class="col-6|$)/g;
            const items = html.match(itemRegex) || [];

            if (items.length === 0) break;

            items.forEach(itemHtml => {
                const hrefMatch = itemHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*anime-details[^"]*">/);
                const imgMatch = itemHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
                const titleMatch = itemHtml.match(/<h3>([^<]+)<\/h3>/);

                const href = hrefMatch ? hrefMatch[1].trim() : "";
                const image = imgMatch ? imgMatch[1].trim() : "";
                const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : "";

                if (href && image && title && !seen.has(href)) {
                    seen.add(href);
                    results.push({ title, href, image });
                }
            });
        }

        return JSON.stringify(results);
    } catch (error) {
        console.error("Okanime search error:", error);
        return JSON.stringify([]);
    }
}

async function okanime_extractEpisodes(url) {
    try {
        const res = await soraFetch(url);
        const html = await res.text();

        const episodes = [];
        const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>\s*الحلقة\s*(\d+)\s*<\/a>/gi;
        const plainTextRegex = /<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/gi;

        let matches;
        if ((matches = html.match(htmlRegex))) {
            matches.forEach(link => {
                const hrefMatch = link.match(/href="([^"]+)"/);
                const numberMatch = link.match(/<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/);
                if (hrefMatch && numberMatch) {
                    episodes.push({ href: hrefMatch[1], number: parseInt(numberMatch[1], 10) });
                }
            });
        } else if ((matches = html.match(plainTextRegex))) {
            matches.forEach(match => {
                const numberMatch = match.match(/\d+/);
                if (numberMatch) {
                    episodes.push({ href: null, number: parseInt(numberMatch[0], 10) });
                }
            });
        }

        episodes.sort((a, b) => a.number - b.number);
        return JSON.stringify(episodes);
    } catch (error) {
        console.error("Okanime episodes error:", error);
        return JSON.stringify([]);
    }
}

async function okanime_extractStreamUrl(url) {
    const multiStreams = { streams: [] };
    const OKANIME_BASE_URL = "https://ok.okanime.xyz";
    const MEGAMAX_HEADERS = {
        "X-Inertia-Partial-Component": "files/mirror/video",
        "X-Inertia-Partial-Data": "streams",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0"
    };

    const resolveForFetch = raw => !raw ? "" : /^https?:\/\//i.test(raw) ? raw : raw.startsWith("//") ? "https:" + raw : raw;
    const cleanTitle = t => t.replace(/\s*\(source\)\s*/i, "");
    const compareQualityLabels = (a, b) => {
        const pick = l => (l.match(/(\d{2,4})p/) ? parseInt(RegExp.$1, 10) : 0);
        return pick(a) - pick(b);
    };

    try {
        const res = await soraFetch(url, { headers: { Referer: OKANIME_BASE_URL } });
        const html = await res.text();
        const containerMatch = html.match(/<div class="filter-links-container overflow-auto" id="streamlinks">([\s\S]*?)<\/div>/);
        if (!containerMatch) throw new Error("Stream links container not found.");
        const containerHTML = containerMatch[1];
        const tasks = [];
        const handleMatch = (regex, extractor, name) => {
            [...containerHTML.matchAll(regex)].forEach(match => {
                tasks.push((async () => {
                    const embedUrl = resolveForFetch(match[1]);
                    if (!embedUrl.startsWith("http")) return;
                    const quality = cleanTitle((match[2] || "Unknown").trim());
                    const stream = await extractor(embedUrl);
                    if (stream?.url || typeof stream === "string") {
                        multiStreams.streams.push({
                            title: `[${quality}] ${name}`,
                            streamUrl: typeof stream === "string" ? stream : stream.url,
                            headers: typeof stream === "string" ? null : stream.headers || null
                        });
                    }
                })());
            });
        };

        handleMatch(/<a[^>]*data-src="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>\s*mp4upload/gi, mp4Extractor, "Mp4upload");
        handleMatch(/<a[^>]*data-src="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>\s*uqload/gi, uqloadExtractor, "Uqload");
        handleMatch(/<a[^>]*data-src="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>\s*vidmoly/gi, vidmolyExtractor, "Vidmoly");
        handleMatch(/<a[^>]*data-src="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?([^<]*)<\/span>\s*vkvideo/gi, vkvideoExtractor, "VKVideo");

        const megamaxMatches = [...containerHTML.matchAll(/<a[^>]*data-src="([^"]+)"[^>]*>\s*(?:<span[^>]*>([^<]*)<\/span>)?([^<]*megamax[^<]*)<\/a>/gi)];
        if (megamaxMatches.length) {
            const bestPerProvider = {};
            await Promise.all(megamaxMatches.map(async m => {
                const rawEmbed = resolveForFetch(m[1]);
                if (!rawEmbed.startsWith("http")) return;
                const quality = cleanTitle((m[2] || m[3] || "Unknown").trim());
                try {
                    const iframeHeaders = { ...MEGAMAX_HEADERS, Referer: url };
                    const embHtml = await (await soraFetch(rawEmbed, { headers: iframeHeaders, method: "GET" })).text();
                    const dataPageMatch = embHtml.match(/data-page="([^"]+)"/);
                    if (dataPageMatch) {
                        const parsed = JSON.parse(dataPageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
                        (parsed?.props?.streams?.data || []).forEach(s => {
                            const qLabel = cleanTitle(s.label || quality);
                            (s.mirrors || []).forEach(mmirror => {
                                const driver = mmirror.driver.toLowerCase();
                                if (!["voe", "streamwish", "vidhide", "doodstream", "filemoon", "mp4upload"].includes(driver)) return;
                                if (!bestPerProvider[driver] || compareQualityLabels(qLabel, bestPerProvider[driver].quality) > 0) {
                                    bestPerProvider[driver] = { quality: qLabel, link: resolveForFetch(mmirror.link || "") };
                                }
                            });
                        });
                    }
                } catch {}
            }));
            Object.entries(bestPerProvider).forEach(([provider, item]) => {
                tasks.push((async () => {
                    const fetchUrl = item.link;
                    if (!fetchUrl.startsWith("http")) return;
                    let providerHtml = null;
                    if (provider !== "mp4upload") {
                        const providerRes = await soraFetch(fetchUrl, { headers: { Referer: url }, method: "GET" });
                        if (!providerRes) return;
                        providerHtml = await providerRes.text();
                    }
                    let extractorResult = null;
                    if (provider === "voe") extractorResult = await voeExtractor(providerHtml, fetchUrl);
                    else if (provider === "streamwish" || provider === "vidhide") extractorResult = await streamwishExtractor(providerHtml, fetchUrl);
                    else if (provider === "doodstream") extractorResult = await doodstreamExtractor(providerHtml, fetchUrl);
                    else if (provider === "filemoon") extractorResult = await filemoonExtractor(providerHtml || fetchUrl, fetchUrl);
                    else if (provider === "mp4upload") extractorResult = await mp4Extractor(fetchUrl);
                    if (extractorResult) {
                        multiStreams.streams.push({
                            title: `${provider}-${item.quality} [Megamax]`,
                            streamUrl: typeof extractorResult === "string" ? extractorResult : extractorResult.url,
                            headers: typeof extractorResult === "string" ? null : extractorResult.headers || null
                        });
                    }
                })());
            });
        }

        await Promise.all(tasks);
        return JSON.stringify(multiStreams);
    } catch {
        return JSON.stringify({ streams: [] });
    }
}

// ===== UTILITY FUNCTIONS =====
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

function cleanTitle(title) {
    if (title == null) return null;
    return title.replaceAll('â€™', "'");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHTMLEntities(text) {
    if (!text || typeof text !== 'string') return '';
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    const entities = { 'quot': '"', 'amp': '&', 'apos': "'", 'lt': '<', 'gt': '>' };
    for (const entity in entities) {
        text = text.replace(new RegExp(`&${entity};`, 'g'), entities[entity]);
    }
    return text;
}

// ===== ANILIST CLASS =====
class Anilist {
    static async search(keyword, filters = {}) {
        const query = `query (
                $search: String,
                $page: Int,
                $perPage: Int,
                $sort: [MediaSort],
                $type: MediaType,
                $format: MediaFormat,
                $status: MediaStatus,
                $isAdult: Boolean,
                $season: MediaSeason,
                $seasonYear: Int
            ) {
                Page(page: $page, perPage: $perPage) {
                media(
                    search: $search,
                    type: $type,
                    sort: $sort,
                    format: $format,
                    status: $status,
                    isAdult: $isAdult,
                    season: $season,
                    seasonYear: $seasonYear
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    nextAiringEpisode {
                        airingAt
                        timeUntilAiring
                        episode
                    }
                    status
                    genres
                    format
                    description
                    startDate {
                        year
                        month
                        day
                    }
                    endDate {
                        year
                        month
                        day
                    }
                    coverImage {
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 50,
            "sort": ["SEARCH_MATCH"],
            "search": keyword,
            "type": "ANIME",
            ...filters
        };

        return Anilist.anilistFetch(query, variables);
    }

    static async getLatest(filters) {
        const currentDate = new Date();
        filters.seasonYear = currentDate.getFullYear();
        filters.season = Anilist.monthToSeason(currentDate.getMonth());

        const query = `query (
            $page: Int,
            $perPage: Int,
            $sort: [MediaSort],
            $type: MediaType,
            $status: MediaStatus,
            $isAdult: Boolean,
            $seasonYear: Int,
            $season: MediaSeason
        ) {
            Page(page: $page, perPage: $perPage) {
                media(
                    type: $type,
                    sort: $sort,
                    status: $status,
                    isAdult: $isAdult,
                    seasonYear: $seasonYear,
                    season: $season
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    nextAiringEpisode {
                        airingAt
                        timeUntilAiring
                        episode
                    }
                    status
                    genres
                    format
                    description
                    startDate {
                        year
                        month
                        day
                    }
                    endDate {
                        year
                        month
                        day
                    }
                    coverImage {
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 50,
            "sort": ["POPULARITY_DESC"],
            "type": "ANIME",
            "status": "RELEASING",
            ...filters
        };

        return Anilist.anilistFetch(query, variables);
    }

    static async anilistFetch(query, variables) {
        const url = 'https://graphql.anilist.co/';

        try {
            const response = await soraFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (response.status !== 200) {
                console.error('Error fetching Anilist data:', response.statusText);
                return null;
            }

            const json = await response.json();
            if (json?.errors) {
                console.error('Error fetching Anilist data:', json.errors);
            }

            return json?.data;

        } catch (error) {
            console.error('Error fetching Anilist data:', error);
            return null;
        }
    }

    static convertAnilistDateToDateStr(dateObject) {
        if (dateObject?.year == null) {
            return null;
        }
        if (dateObject.month == null || parseInt(dateObject.month) < 1) {
            dateObject.month = 1;
        }
        if (dateObject.day == null || parseInt(dateObject.day) < 1) {
            dateObject.day = 1;
        }
        return dateObject.year + "-" + (dateObject.month).toString().padStart(2, '0') + "-" + (dateObject.day).toString().padStart(2, '0');
    }

    static nextAnilistAirDateToCountdown(timestamp) {
        if (timestamp == null) return null;

        const airDate = new Date((timestamp * 1000));
        const now = new Date();

        if (now > airDate) return null;

        let [days, hourRemainder] = (((airDate - now) / 1000) / 60 / 60 / 24).toString().split('.');
        let [hours, minRemainder] = (parseFloat("0." + hourRemainder) * 24).toString().split('.');
        let minutes = Math.ceil((parseFloat("0." + minRemainder) * 60));

        return `Next episode will air in ${days} days, ${hours} hours and ${minutes} minutes at ${airDate.getFullYear()}-${(airDate.getMonth() + 1).toString().padStart(2, '0')}-${(airDate.getDate()).toString().padStart(2, '0')} ${airDate.getHours()}:${airDate.getMinutes()}`;
    }

    static monthToSeason(month) {
        const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
        if (month == 11) return seasons[0];
        if (month <= 1) return seasons[0];
        if (month <= 4) return seasons[1];
        if (month <= 7) return seasons[2];
        return seasons[3];
    }
}

async function youruploadExtractor(embedUrl) {
    const headers = { "Referer": "https://www.yourupload.com/" };
    const response = await soraFetch(embedUrl, {
        headers,
        method: 'GET'
    });
    const html = await response.text();
    const match = html.match(/file:\s*['"]([^'"]+\.mp4)['"]/);
    return {
        url: match?.[1] || null,
        headers: headers
    };
}

async function sibnetExtractor(embedUrl) {
    const headers = {
        Referer: embedUrl
    };

    try {
        const response = await soraFetch(embedUrl, {
            headers,
            method: 'GET',
            encoding: 'windows-1251'
        });
        const html = await response.text();

        const videoMatch = html.match(
            /player\.src\s*\(\s*\[\s*\{\s*src\s*:\s*["']([^"']+)["']/i
        );

        if (!videoMatch || !videoMatch[1]) {
            throw new Error("Sibnet video source not found");
        }

        const videoPath = videoMatch[1];
        const videoUrl = videoPath.startsWith("http")
            ? videoPath
            : `https://video.sibnet.ru${videoPath}`;

        return {
            url: videoUrl,
            headers: headers
        };
    } catch (error) {
        console.log("SibNet extractor error: " + error.message);
        return null;
    }
}

function randomStr(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
  return result;
}

function voeRot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}
function voeRemovePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let result = str;
  for (const pat of patterns) result = result.split(pat).join("");
  return result;
}
function voeBase64Decode(str) {
  if (typeof atob === "function") return atob(str);
  return Buffer.from(str, "base64").toString("utf-8");
}
function voeShiftChars(str, shift) {
  return str.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - shift)).join("");
}

async function voeExtractor(html, url = null) {
  // Check for redirect in HTML
  const redirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
  if (redirectMatch) {
    const redirectUrl = redirectMatch[1].startsWith("http")
      ? redirectMatch[1]
      : (url ? new URL(redirectMatch[1], url).toString() : redirectMatch[1]);

    console.log("VOE redirect found:", redirectUrl);

    try {
      const res = await soraFetch(redirectUrl, { headers: { Referer: url || redirectUrl } });
      html = await res.text();
    } catch (e) {
      console.error("Failed to fetch redirected VOE page:", e);
      return null;
    }
  }

  const jsonScriptMatch = html.match(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!jsonScriptMatch) {
    console.log("No application/json script tag found");
    return null;
  }

  const obfuscatedJson = jsonScriptMatch[1].trim();
  let data;
  try {
    data = JSON.parse(obfuscatedJson);
  } catch (e) {
    throw new Error("Invalid JSON input.");
  }
  if (!Array.isArray(data) || typeof data[0] !== "string") {
    throw new Error("Input doesn't match expected format.");
  }
  let obfuscatedString = data[0];

  let step1 = voeRot13(obfuscatedString);
  let step2 = voeRemovePatterns(step1);
  let step3 = voeBase64Decode(step2);
  let step4 = voeShiftChars(step3, 3);
  let step5 = step4.split("").reverse().join("");
  let step6 = voeBase64Decode(step5);

  let result;
  try {
    result = JSON.parse(step6);
  } catch (e) {
    throw new Error("Final JSON parse error: " + e.message);
  }

  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      (result.source || []).map((source) => source.direct_access_url).find((u) => u && u.startsWith("http"));
    if (streamUrl) {
      console.log("Voe Stream URL:", streamUrl);
      return streamUrl;
    } else {
      console.log("No stream URL found in the decoded JSON");
    }
  }
  return result;
}

/* ----------------- (p.a.c.k.e.r.) helpers ----------------- */
class Unbaser {
  constructor(base) {
    this.ALPHABET = {
      62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'"
    };
    this.dictionary = {};
    this.base = base;
    if (36 < base && base < 62) {
      this.ALPHABET[base] = this.ALPHABET[base] || this.ALPHABET[62].substr(0, base);
    }
    if (2 <= base && base <= 36) {
      this.unbase = (value) => parseInt(value, base);
    } else {
      try {
        [...this.ALPHABET[base]].forEach((cipher, index) => {
          this.dictionary[cipher] = index;
        });
      } catch (er) {
        throw Error("Unsupported base encoding.");
      }
      this.unbase = this._dictunbaser;
    }
  }
  _dictunbaser(value) {
    let ret = 0;
    [...value].reverse().forEach((cipher, index) => {
      ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
    });
    return ret;
  }
}
function detectPacked(source) {
  return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}
function unpack(source) {
  let { payload, symtab, radix, count } = _filterargs(source);
  if (count != symtab.length) throw Error("Malformed p.a.c.k.e.r. symtab.");
  let unbase;
  try {
    unbase = new Unbaser(radix);
  } catch (e) {
    throw Error("Unknown p.a.c.k.e.r. encoding.");
  }
  function lookup(match) {
    const word = match;
    let word2;
    if (radix == 1) word2 = symtab[parseInt(word)];
    else word2 = symtab[unbase.unbase(word)];
    return word2 || word;
  }
  source = payload.replace(/\b\w+\b/g, lookup);
  return _replacestrings(source);

  function _filterargs(source) {
    const juicers = [
      /}\('(.*)', *(\n?\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
      /}\('(.*)', *(\n?\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
    ];
    for (const juicer of juicers) {
      const args = juicer.exec(source);
      if (args) {
        let a = args;
        try {
          return {
            payload: a[1],
            symtab: a[4].split("|"),
            radix: parseInt(a[2]),
            count: parseInt(a[3]),
          };
        } catch (ValueError) {
          throw Error("Corrupted p.a.c.k.e.r. data.");
        }
      }
    }
    throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
  }

  function _replacestrings(source) {
    return source;
  }
}

async function streamwishExtractor(data, url = null) {
  const obfuscatedScriptMatch = data.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
  if (!obfuscatedScriptMatch) throw new Error("No packed script found for streamwish");
  const obfuscatedScript = obfuscatedScriptMatch[1];
  const unpackedScript = unpack(obfuscatedScript);
  const m3u8Match = unpackedScript.match(/"hls2"\s*:\s*"([^"]+)"/);
  const m3u8Url = m3u8Match ? m3u8Match[1] : null;
  return m3u8Url;
}

async function doodstreamExtractor(html, url = null) {
  console.log("DoodStream extractor called");
  console.log("DoodStream extractor URL: " + url);

  try {
    const streamDomainMatch = url && url.match(/https?:\/\/([^/]+)/);
    const streamDomain = streamDomainMatch ? streamDomainMatch[1] : null;

    const md5PathMatch = html.match(/'\/pass_md5\/(.*?)',/);
    if (!streamDomain || !md5PathMatch) throw new Error("DoodStream data not found");

    const md5Path = md5PathMatch[1];
    const token = md5Path.substring(md5Path.lastIndexOf("/") + 1);
    const expiryTimestamp = new Date().valueOf();
    const random = randomStr(10);

    const passRes = await soraFetch(`https://${streamDomain}/pass_md5/${md5Path}`, {
      headers: { Referer: url },
      method: "GET",
      encoding: "utf-8"
    });
    if (!passRes) throw new Error("Failed pass_md5 fetch");
    const responseData = await passRes.text();

    const videoUrl = `${responseData}${random}?token=${token}&expiry=${expiryTimestamp}`;
    console.log("DoodStream extractor video URL: " + videoUrl);
    return videoUrl;
  } catch (err) {
    console.log("DoodStream extractor error:", err);
    return null;
  }
}

async function filemoonExtractor(html, url = null) {
  try {
    let workingHtml = html;
    const iframeRegex = /<iframe[^>]+src="([^"]+)"[^>]*><\/iframe>/;
    const iframeMatch = (typeof workingHtml === "string") ? workingHtml.match(iframeRegex) : null;
    if (iframeMatch) {
      const iframeUrl = iframeMatch[1];
      const iframeRes = await soraFetch(iframeUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Referer": url
        },
        method: "GET",
        encoding: "utf-8"
      });
      if (!iframeRes) return null;
      workingHtml = await iframeRes.text();
    } else if (!iframeMatch && (typeof workingHtml === "string" && workingHtml.startsWith("http"))) {
      const resp = await soraFetch(workingHtml, { headers: { Referer: url }, method: "GET", encoding: "utf-8" });
      if (!resp) return null;
      workingHtml = await resp.text();
    }

    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let m;
    while ((m = scriptRegex.exec(workingHtml)) !== null) scripts.push(m[1]);
    const evalScript = scripts.find(s => /eval\(/.test(s) && /m3u8/.test(s));
    if (!evalScript) return null;
    const unpacked = unpack(evalScript);
    const m3u8Match = unpacked.match(/https?:\/\/[^\s]+master\.m3u8[^\s]*?(\?[^"]*)?/);
    if (m3u8Match) return m3u8Match[0];
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * @name vidmolyExtractor
 * @author Ibro
 */
async function vidmolyExtractor(html, url = null) {
  const regexSub = /<option value="([^"]+)"[^>]*>\s*SUB - Omega\s*<\/option>/;
  const regexFallback = /<option value="([^"]+)"[^>]*>\s*Omega\s*<\/option>/;
  const fallback =
    /<option value="([^"]+)"[^>]*>\s*SUB v2 - Omega\s*<\/option>/;

  let match =
    html.match(regexSub) || html.match(regexFallback) || html.match(fallback);
  if (match) {
    const decodedHtml = atob(match[1]);
    const iframeMatch = decodedHtml.match(/<iframe\s+src="([^"]+)"/);

    if (!iframeMatch) {
      console.log("Vidmoly extractor: No iframe match found");
      return null;
    }

    const streamUrl = iframeMatch[1].startsWith("//")
      ? "https:" + iframeMatch[1]
      : iframeMatch[1];

    const responseTwo = await soraFetch(streamUrl);
    const htmlTwo = await responseTwo.text();

    const m3u8Match = htmlTwo.match(/sources:\s*\[\{file:"([^"]+\.m3u8)"/);
    return m3u8Match ? m3u8Match[1] : null;
  } else {
    console.log("Vidmoly extractor: No match found, using fallback");
    const sourcesRegex = /sources:\s*\[\{file:"(https?:\/\/[^"]+)"\}/;
    const sourcesMatch = html.match(sourcesRegex);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;

    return sourcesString;
  }
}

async function vkvideoExtractor(embedUrl) {
    console.log(embedUrl);
    const headers = {
        "Referer": "https://vk.com/"
    };

    try {
        const response = await soraFetch(embedUrl, {
            method: "GET",
            headers,
            encoding: 'windows-1251'
        });

        const html = await response.text();
        console.log(html);

        const hlsMatch = html.match(/"hls"\s*:\s*"([^"]+)"/);
        if (!hlsMatch || !hlsMatch[1]) {
            throw new Error("HLS stream not found in VK embed");
        }

        const videoSrc = hlsMatch[1].replace(/\\\//g, "/");

        return {
            url: videoSrc,
            headers: headers
        };
    } catch (error) {
        console.log("vkExtractor error: " + error.message);
        return null;
    }
}

async function uqloadExtractor(embedUrl) {
    const headers = { Referer: embedUrl, Origin: "https://uqload.net" };
    const res = await soraFetch(embedUrl, { headers });
    const htmlText = await res.text();
    const match = htmlText.match(/sources:\s*\[\s*"([^"]+\.mp4)"\s*\]/);
    return { url: match ? match[1] : "", headers };
}

async function mp4Extractor(embedUrl) {
    const headers = { Referer: "https://mp4upload.com" };
    const res = await soraFetch(embedUrl, { headers });
    const htmlText = await res.text();
    const streamUrl = extractMp4Script(htmlText);
    return { url: streamUrl, headers };
}

function extractMp4Script(htmlText) {
    const scripts = extractScriptTags(htmlText);
    const srcScript = scripts.find(script => script.includes("player.src"));
    return srcScript
        ? srcScript.split(".src(")[1].split(")")[0].split("src:")[1].split('"')[1]
        : "";
}

function extractScriptTags(html) {
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        scripts.push(match[1]);
    }
    return scripts;
}

function normalizeVkUrl(url) {
  if (!url) return "";
  return url
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

// (async () => {
//     try {
//         const results = await searchResults('Monster');
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