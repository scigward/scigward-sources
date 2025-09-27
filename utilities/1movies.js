const BASE_URLS = ['https://jormungandr.ofchaos.com'];

async function areRequiredServersUp() {
    const anyOfRequired = BASE_URLS;

    try {
        let promises = [];

        for (let host of anyOfRequired) {
            promises.push(
                new Promise(async (resolve) => {
                    let response = await soraFetch(host, { method: 'HEAD' });
                    response.host = host;
                    return resolve(response);
                })
            );
        }

        return Promise.allSettled(promises).then((responses) => {
            let serversUp = [];

            for (let response of responses) {
                if (response?.status === 'fulfilled' && response?.value?.status === 200) {
                    serversUp.push(response?.value.host);
                }
            }

            if (serversUp.length <= 0) {
                // let message = 'Required source ' + response?.value?.host + ' is currently down.';
                // console.log(message);
                return { success: false, error: encodeURIComponent(message), searchTitle: `Error cannot access any server, server down. Please try again later.` };
            }

            return { success: true, error: null, searchTitle: null, availableHosts: serversUp };

        })

    } catch (error) {
        console.log('Server up check error: ' + error.message);
        return { success: false, error: encodeURIComponent('#Failed to access required servers'), searchTitle: 'Error cannot access any server, server down. Please try again later.' };
    }
}

(async () => {
    try {
        const results = await searchResults('Cowboy bebop');
        console.log('RESULTS:', results);

        const parsedResults = JSON.parse(results);
        
        if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
            console.error('No search results found');
            return;
        }

        const target = parsedResults[1] || parsedResults[0];
        
        if (!target || !target.href) {
            console.error('No valid target found in search results');
            return;
        }

        const details = await extractDetails(target.href);
        console.log('DETAILS:', details);

        const eps = await extractEpisodes(target.href);
        console.log('EPISODES:', eps);

        const parsedEpisodes = JSON.parse(eps);
        if (parsedEpisodes.length > 0) {
            const streamUrl = await extractStreamUrl(parsedEpisodes[0].href);
            console.log('STREAMURL:', streamUrl);
            
            if (streamUrl) {
                const streams = JSON.parse(streamUrl);
                console.log(`Found ${streams.streams?.length || 0} total streams`);
            }
        } else {
            console.log('No episodes found.');
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
})();

async function searchResults(keyword) {
    console.log('Running OfChaos Jormungandr v0.10.0+');
    console.log('Providers: An1me, AnimeDefenders, AnimePahe, AnimeParadise, AnimeZ, AniNow, AniWave, AniXL, FlugelAnime, KickAssAnime, Shizuru, TokyoInsider, VidNest, Zoro');
    console.log(`Known subtitle languages: Arabic, Chinese (Simplified), Chinese (Traditional), Croatian, Czech, Danish, Dutch, English, Filipino (Tagalog), Finnish, French, German, Greek, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Malay, Norwegian, Norwegian BokmÃ¥l, Polish, Portuguese (EU), Portuguese (BR), Romanian, Russian, Spanish (EU), Spanish (SA), Swedish, Thai, Turkish, Ukranian, Vietnamese`);
    console.log(`Known audio languages: Arabic, English, French, German, Greek, Hindi, Indonesian, Italian, Japanese, Korean, Portuguese (BR), Spanish (EU), Spanish (SA), Thai`);
    console.log(' ');
    console.log(`Specialized languages: Greek, Hindi, Kannada, Tamil, Telugu`);
    console.log(' ');
    console.log(`Mind that I cannot guarantee all languages and subtitles for all streams, this list is a best case scenario using Sakamoto Days episode 1 and Attack on Titan episode 1 as examples.`);
    console.log('Specialized language modules are only available insofar they have the show in their database.');

    const serversUp = await areRequiredServersUp();

    if (serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    const hostUrl = serversUp.availableHosts[0];
    const filters = {
        "isAdult": false
    };

    try {
        let searchResults = null;

        if(keyword.match(/\?[a-z]{2}$/)) {
            var languageCode = keyword.slice(-3).slice(1);
            keyword = keyword.slice(0, -3);
        }

        if (keyword.startsWith('!')) {
            const anilistResults = await Anilist.getLatest(filters);
            searchResults = anilistResults?.Page?.media ?? [];

        } else {
            const anilistResults = await Anilist.search(keyword, filters);
            searchResults = anilistResults?.Page?.media ?? [];
        }

        const results = searchResults.map(item => {
            const alternativeTitles = item.title.english + ',' + item.title.native;

            let episodeCount = (parseInt(item?.nextAiringEpisode?.episode) - 1)
            if (isNaN(episodeCount)) {
                episodeCount = item?.episodes ?? null;
            }

            const transferData = JSON.stringify({
                id: item.id,
                idMal: item.idMal,
                title: cleanTitle(item?.title?.romaji),
                titleEnglish: cleanTitle(item?.title?.english),
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
                host: hostUrl
            });

            return {
                title: item.title.romaji,
                image: item.coverImage.extraLarge ?? item.coverImage.large ?? '#',
                href: `${hostUrl}/api/anime/${item.id}/episodes|${transferData}`
            };
        });

        return JSON.stringify(results);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
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

    if (url.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

    try {
        let episodes = [];

        if (json.episodeCount == null || json.episodeCount == 0) {
            return JSON.stringify([]);
        }

        for (let i = 1; i < parseInt(json.episodeCount) + 1; i++) {
            const transferData = JSON.stringify({
                id: json.id,
                episode: i,
                languageCode: json.languageCode
            });

            episodes.push({
                href: `${json.host}/api/anime/episode|${transferData}`,
                number: i
            });
        }

        return JSON.stringify(episodes);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}


async function extractStreamUrl(objString) {
    const encodedDelimiter = '|';
    const [url, jsonString] = decodeURIComponent(objString).split(encodedDelimiter);

    try {
        var json = JSON.parse(jsonString || '{}');
    } catch (e) {
        console.log("Error parsing transferdata JSON: " + e.message);
        console.log("Now outputting jsonString for debugging:");
        console.log("--------------------------------------");
        console.log(jsonString);
        console.log("--------------------------------------");
        return null;
    }

    const providers = [
        "AniXL",
        "KickAssAnime",
        "Zoro", // Keep the MalSync triplets together
        "An1me",
        "AnimeDefenders",
        "AnimePahe",
        "AnimeParadise",
        "AniNow",
        "AniWave",
        "AnimeZ",
        // "FlugelAnime", // Site down
        "Shizuru",
        "TokyoInsider",
        "VidNest"
    ];

    try {
        const data = await getStreamsFromProviders(url, json, providers)
        if (data == null) return null;

        try {
            return JSON.stringify(data);
        } catch(e) {
            console.log("Error stringifying stream data JSON");
            console.log("Now outputting data value, unsure if it'll show up tho.. for debugging:");
            console.log("--------------------------------------");
            console.log(data);
            console.log("--------------------------------------");
            return null;
        }

    } catch (e) {
        console.log('Error extracting stream: ' + e.message);
        return null;
    }
}

async function getStreamsFromProviders(url, json, providers) {
    const promises = [];
    let i = 0;
    const subdividedProviders = [];
    const limit = 1; // After substantial testing, 1 works best with 2 as close second, 3 and up have significant performance drops

    for (let provider of providers) {
        const name = provider.toLowerCase();

        if (subdividedProviders[i] != null && subdividedProviders[i].length != 0 && subdividedProviders[i].length % limit === 0) {
            i++;
        }

        if (subdividedProviders[i] == null) {
            subdividedProviders[i] = [];
        }

        subdividedProviders[i].push(name);
    }

    for (let providerGroup of subdividedProviders) {
        promises.push(soraFetch(url, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: json.id,
                episode: json.episode,
                providers: providers,
                providerGroup: providerGroup,
                formatting: "sora"
            })
        }).then(res => {
            try {
                return res.json();
            } catch(e) {
                console.log("Error parsing data received from Jormungander to JSON: " + e.message);
                console.log("Now outputting response values if Sora has them:");
                console.log("--------------------------------------");
                console.log("Response status: " + res?.status ?? '');
                console.log("Response statusText: " + res?.statusText) ?? '';
                console.log("Response type: " + res?.type ?? '');
                console.log("Response Content-Type: " + res.headers?.['Content-Type'] ?? '');
                console.log("Response statusText: " + res?.headers?.['RateLimit'] ?? '');
                console.log("--------------------------------------");
                return null;
            }
        }).catch(e => {
            console.log("Error reading data received from Jormungander: " + e.message);
            return null;
        }));
    }

    const streamDatas = await Promise.allSettled(promises).then((results) => {
        return results.filter(entry => entry.status === 'fulfilled').map(entry => entry.value);
    })

    const data = streamDatas.reduce((acc, streamData) => {
        acc.streams = acc.streams.concat(streamData.streams);
        acc.subtitles = acc.subtitles.concat(streamData.subtitles);
        return acc;
    }, {
        streams: [],
        subtitles: []
    });

    data.subtitles = prioritizeSubtitle(
        removeDuplicatesFromStringArray(data.subtitles),
        json.languageCode
    );

    // normalize ALL subtitles to object shape { file, label } ===
    const guessLabelFrom = (s) => {
        const lower = (s || '').toLowerCase();
        // simple, safe heuristics (non-breaking)
        if (/\b(en|eng|english)\b/.test(lower)) return 'English';
        if (/\b(ar|ara|arabic)\b/.test(lower)) return 'Arabic';
        if (/\b(jp|jpn|ja|japanese)\b/.test(lower)) return 'Japanese';
        if (/\b(es|spa|spanish)\b/.test(lower)) return 'Spanish';
        if (/\b(pt|por|portuguese)\b/.test(lower)) return 'Portuguese';
        if (/\b(fr|fra|fre|french)\b/.test(lower)) return 'French';
        if (/\b(de|ger|german)\b/.test(lower)) return 'German';
        if (/\b(tr|tur|turkish)\b/.test(lower)) return 'Turkish';
        if (/\b(it|ita|italian)\b/.test(lower)) return 'Italian';
        if (/\b(ru|rus|russian)\b/.test(lower)) return 'Russian';
        if (/\b(zh|chi|chinese)\b/.test(lower)) return 'Chinese';
        if (/\b(ko|kor|korean)\b/.test(lower)) return 'Korean';
        return 'Unknown';
    };

    if (!Array.isArray(data.subtitles)) data.subtitles = [];
    data.subtitles = data.subtitles
        .map(s => {
            if (typeof s === 'string') {
                return { file: s, label: guessLabelFrom(s) };
            } else if (s && typeof s === 'object') {
                const file = s.file || s.url || s.src || s.href || '';
                const label = s.label || s.lang || s.language || guessLabelFrom(file);
                return file ? { file, label } : null;
            }
            return null;
        })
        .filter(Boolean);

    data.subtitles.push({ file: "https://cc.solarcdn.me/subs/3/subtitles/30ufH5vVdX4.vtt", label: "Sybau" });

    if (data.error) {
        console.log('Stream retrieval error: ' + data.error);
        throw new Error('No episode data found');
    }

    if (data.streams.length === 0) {
        console.log('No streams found for episode ' + json.episode);
        return null;
    }

    return data;
}

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

function getJormungandrMediaFormat(format) {
    switch (format) {
        case 'MOVIE':
        case 'ONE_SHOT':
        case 'MUSIC':
            return 'MOVIE'
        default:
            return 'TV';
    }
}

function removeDuplicatesFromStringArray(arr) {
    const seen = new Set();
    return arr.filter((el) => {
        const duplicate = seen.has(el);
        seen.add(el);
        return !duplicate;
    });
}

function cleanTitle(title) {
    if(title == null) return null;

    return title
        .replaceAll('â€™', "'");
}

// Anilist (not really) singleton
class Anilist {
    static async search(keyword, filters = {}) {
        const query = `query (
                $search: String,
                $page: Int,
                $perPage: Int,
                $sort: [MediaSort],
                $genre_in: [String],
                $tag_in: [String],
                $type: MediaType,
                $format: MediaFormat,
                $status: MediaStatus,
                $countryOfOrigin: CountryCode,
                $isAdult: Boolean,
                $season: MediaSeason,
                $startDate_like: String,
                $source: MediaSource,
                $averageScore_greater: Int,
                $averageScore_lesser: Int
            ) {
                Page(page: $page, perPage: $perPage) {
                media(
                    search: $search,
                    type: $type,
                    sort: $sort,
                    genre_in: $genre_in,
                    tag_in: $tag_in,
                    format: $format,
                    status: $status,
                    countryOfOrigin: $countryOfOrigin,
                    isAdult: $isAdult,
                    season: $season,
                    startDate_like: $startDate_like,
                    source: $source,
                    averageScore_greater: $averageScore_greater,
                    averageScore_lesser: $averageScore_lesser
                ) {
                    id
                    idMal
                    averageScore
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
                    popularity
                    coverImage {
                        color
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 50,
            "sort": [
                "SEARCH_MATCH",
                "TITLE_ENGLISH_DESC",
                "TITLE_ROMAJI_DESC"
            ],
            "search": keyword,
            "type": "ANIME",
            ...filters
        }

        // console.log(filters, variables);

        return Anilist.anilistFetch(query, variables);
    }

    static async lookup(filters) {
        const query = `query (
                $id: Int,
                $idMal: Int
            ) {
                Page(page: 1, perPage: 1) {
                media(
                    id: $id,
                    idMal: $idMal
                ) {
                    id
                    idMal
                    averageScore
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
                    popularity
                    coverImage {
                        color
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async getLatest(filters) {
        let page = 0;
        let hasNextPage = true;
        const perPage = 50;
        const currentDate = new Date();

        filters.seasonYear = currentDate.getFullYear();
        filters.season = Anilist.monthToSeason(currentDate.getMonth());

        const results = [];

        do {
            page++;

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
                        averageScore
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
                        popularity
                        coverImage {
                            color
                            large
                            extraLarge
                        }
                    }
                    pageInfo {
                        hasNextPage
                    }
                }
            }`;

            const variables = {
                "page": page,
                "perPage": perPage,
                "sort": [
                    "POPULARITY_DESC"
                ],
                "type": "ANIME",
                "status": "RELEASING",
                ...filters
            }

            const fetchResults = await Anilist.anilistFetch(query, variables);
            results.push(fetchResults);

            if(fetchResults?.Page?.pageInfo?.hasNextPage !== true) {
                hasNextPage = false;
            }

        } while(hasNextPage);

        const mergedObject = { Page: { media: []}};

        for(let page of results) {
            mergedObject.Page.media = mergedObject.Page.media.concat(page.Page.media);
        }

        return mergedObject;
    }

    static async anilistFetch(query, variables) {
        const url = 'https://graphql.anilist.co/';
        const extraTimeoutMs = 250;

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
                if (response.status === 429) {
                    console.info('=== RATE LIMIT EXCEEDED, SLEEPING AND RETRYING ===');
                    const retryTimeout = response.headers?.['Retry-After'];
                    const timeout = Math.ceil((parseInt(retryTimeout))) * 1000 + extraTimeoutMs;
                    await sleep(timeout);
                    return await AnilistFetch(query, variables);

                }

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
        if (dateObject.year == null) {
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


    // Yes it's stupid, but I kinda love it which is why I'm not optimizing this
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
        // Month is 0 indexed
        const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
        if(month == 11) return seasons[0];
        if(month <= 1) return seasons[0];
        if(month <= 4) return seasons[1];
        if(month <= 7) return seasons[2];
        return seasons[3];
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


function prioritizeSubtitle(subtitles, lang = 'en', containsString = null) {
    if(containsString) {
        const foundSubtitleIndex = subtitles.findIndex((subtitle) => subtitle.includes(containsString));
        if(foundSubtitleIndex == 0) return subtitles;
        if(foundSubtitleIndex > 0) {
            subtitles.unshift(subtitles.splice(foundSubtitleIndex, 1)[0]);
            return subtitles;
        }
    }

    if(lang.length != 2) {
        console.log('Invalid language, defaulting to English');
        return subtitles;
    }

    const iso639 = languageLookup(lang);
    if(iso639 == 'en') return subtitles;

    const foundSubtitleIndex = subtitles.findIndex((subtitle) => subtitle.toLowerCase().includes(`/${ iso639 }-`));
    if(foundSubtitleIndex == 0) return subtitles;
    if(foundSubtitleIndex > 0) {
        subtitles.unshift(subtitles.splice(foundSubtitleIndex, 1)[0]);
        return subtitles;
    }

}

function languageLookup(lang) {
    return [{
        "lookup": "en",
        "language": "english",
        "iso": "eng"
    },{
        "lookup": "ar",
        "language": "arabic",
        "iso": "ara"
    },{
        "lookup": "zh",
        "language": "chinese",
        "iso": "chi"
    },{
        "lookup": "hr",
        "language": "croatian",
        "iso": "hrv"
    },{
        "lookup": "cz",
        "language": "czech",
        "iso": "cze"
    },{
        "lookup": "dk",
        "language": "danish",
        "iso": "dan"
    },{
        "lookup": "nl",
        "language": "dutch",
        "iso": "dut"
    },{
        "lookup": "ph",
        "language": "filipino",
        "iso": "fil"
    },{
        "lookup": "fi",
        "language": "finish",
        "iso": "fin"
    },{
        "lookup": "fr",
        "language": "french",
        "iso": "fre"
    },{
        "lookup": "de",
        "language": "german",
        "iso": "ger"
    },{
        "lookup": "gr",
        "language": "greek",
        "iso": "gre"
    },{
        "lookup": "he",
        "language": "hebrew",
        "iso": "heb"
    },{
        "lookup": "in",
        "language": "hindi",
        "iso": "hin"
    },{
        "lookup": "hu",
        "language": "hungarian",
        "iso": "hun"
    },{
        "lookup": "id",
        "language": "indonesian",
        "iso": "ind"
    },{
        "lookup": "it",
        "language": "italian",
        "iso": "ita"
    },{
        "lookup": "jp",
        "language": "japanese",
        "iso": "jpn"
    },{
        "lookup": "kr",
        "language": "korean",
        "iso": "kor"
    },{
        "lookup": "my",
        "language": "malaysian",
        "iso": "may"
    },{
        "lookup": "no",
        "language": "norwegian bokmal",
        "iso": "nob"
    },{
        "lookup": "pl",
        "language": "polish",
        "iso": "pol"
    },{
        "lookup": "pt",
        "language": "portuguese",
        "iso": "por"
    },{
        "lookup": "ro",
        "language": "romanian",
        "iso": "rum"
    },{
        "lookup": "es",
        "language": "spanish",
        "iso": "spa"
    },{
        "lookup": "se",
        "language": "swedish",
        "iso": "swe"
    },{
        "lookup": "th",
        "language": "thai",
        "iso": "tha"
    },{
        "lookup": "tr",
        "language": "turkish",
        "iso": "tur"
    },{
        "lookup": "ua",
        "language": "Ukranian",
        "iso": "ukr"
    },{
        "lookup": "vn",
        "language": "Vietnamese",
        "iso": "vie"
    }].find(l => l.lookup == lang)?.iso ?? 'eng';
}