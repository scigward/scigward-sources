async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await soraFetch(`https://www.arabanime.net/api/search?q=${encodedKeyword}`, {
            headers: {
                'Referer': 'https://www.arabanime.net/',
                'authority': 'www.arabanime.net',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            method: 'GET'
        });

        const json = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if (!json.SearchResaults || !Array.isArray(json.SearchResaults)) {
            throw new Error('Invalid response format');
        }

        const results = json.SearchResaults.map(base64 => {
            try {
                const decoded = atob(base64);
                const anime = JSON.parse(decoded);

                return {
                    title: decodeHTMLEntities(anime.anime_name),
                    image: anime.anime_cover_image_url,
                    href: anime.info_url
                };
            } catch (e) {
                console.warn('Skipping invalid entry:', e);
                return null;
            }
        }).filter(Boolean);

        return JSON.stringify(results);
    } catch (error) {
        console.error('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    const results = [];

    try {
        const res = await soraFetch(url);
        const html = await res.text();

        const base64Match = html.match(/<div id='data' class='d-none'>([\s\S]*?)<\/div>/);
        if (!base64Match) {
            throw new Error("data div not found");
        }

        const decodedJsonStr = atob(base64Match[1]);

        const airdateMatch = decodedJsonStr.match(/"anime_release_date"\s*:\s*"([^"]*)"/);
        const airdate = airdateMatch ? airdateMatch[1] : "N/A";

        const descriptionMatch = decodedJsonStr.match(/"anime_description"\s*:\s*"([^"]*)"/);
        let description = descriptionMatch ? descriptionMatch[1] : "N/A";

        if (description !== "N/A") {
            description = JSON.parse(`"${description}"`);
            description = decodeHTMLEntities(description);
        }

        results.push({
            description: description,
            aliases: "",
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
  try {
    const res = await soraFetch(url);
    const html = await res.text();

    const base64Match = html.match(/<div id='data' class='d-none'>([\s\S]*?)<\/div>/);
    if (!base64Match) {
      throw new Error("data div not found");
    }

    const decodedJsonStr = atob(base64Match[1]);

    const episodeRegex = /"episode_number":(\d+),"info-src":"(https:\\\/\\\/[^"]+)"/g;

    const episodes = [];
    let match;

    while ((match = episodeRegex.exec(decodedJsonStr)) !== null) {
      episodes.push({
        href: match[2].replace(/\\\//g, "/"),
        number: Number(match[1])
      });
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.error("extractEpisodes failed:", error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  const result = { streams: [] };

  try {
    const htmlRes = await soraFetch(url);
    const html = await htmlRes.text();

    const base64Match = html.match(/<div id=['"]datawatch['"][^>]*>([^<]+)<\/div>/);
    if (!base64Match) throw new Error('datawatch base64 not found');

    const decodedJson = atob(base64Match[1]);

    const streamServersMatch = decodedJson.match(/"stream_servers":\s*\[(.*?)\]/);
    if (!streamServersMatch) throw new Error('stream_servers array not found');

    const firstUrlMatch = streamServersMatch[1].match(/"([^"]+)"/);
    if (!firstUrlMatch) throw new Error('No URL found in stream_servers array');

    let multiUrl = atob(firstUrlMatch[1]);

    const pageRes = await soraFetch(multiUrl);
    const pageHtml = await pageRes.text();

    const regex = /<option[^>]+data-src="([^"]+)"[^>]*value="([01]) server">/g;
    const serverLinks = {};
    let match;

    while ((match = regex.exec(pageHtml)) !== null) {
      const base64 = match[1];
      const serverId = match[2];
      try {
        serverLinks[serverId] = atob(base64);
      } catch (e) {
        console.warn(`Invalid base64 for server ${serverId}`);
      }
    }

    for (const [id, url] of Object.entries(serverLinks)) {
      const res = await soraFetch(url);
      const html = await res.text();

      const sourceRegex = /<source[^>]+src="([^"]+)"[^>]+label="([^"]+)"/g;
      let sourceMatch;

      while ((sourceMatch = sourceRegex.exec(html)) !== null) {
        const stream = sourceMatch[1];
        const title = `Server ${id} - ${sourceMatch[2]}`;
        result.streams.push({
          title,
          streamUrl: stream,
          headers: null,
          subtitles: null
        });
      }
    }
  } catch (err) {
    console.error('Error extracting stream URLs:', err);
  }

  return result;
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

//Made by @xibrox
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
