async function fetchv2(url, headers = {}, method = "GET", body = null) {
  return fetch(url, {
    method,
    headers,
    body
  });
}

(async () => {
    try {
        const results = await searchResults('Case closed');
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
    const results = [];
    try {
        const response = await fetchv2("https://api3.devcorp.me/vod/search?page=1&keyword=" + encodeURIComponent(keyword.toLowerCase()));
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedData = await decryptedResponse.json();
        console.log(JSON.stringify(decryptedData));
        if (decryptedData.status === 200 && Array.isArray(decryptedData.result)) {
            for (const item of decryptedData.result) {
                results.push({
                    title: item.title || "Unknown",
                    image: item.image || "",
                    href: item.id
                });
            }
        }
        console.log(results);
        return JSON.stringify(results);
    } catch (err) {
        console.error(err);
        return JSON.stringify([{ title: "Error", image: "Error", href: "Error" }]);
    }
}

async function extractDetails(ID) {
    try {
        const response = await fetchv2("https://api3.devcorp.me/web/vod/" + ID + "/detail");
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedText = await decryptedResponse.text();
        const decryptedData = JSON.parse(decryptedText);

        const result = decryptedData.result;

        return JSON.stringify([{
            description: result.description || "N/A",
            aliases: Array.isArray(result.otherTitles) ? result.otherTitles.join(", ") : "N/A",
            airdate: result.year || "N/A"
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}

async function extractEpisodes(ID) {
    const results = [];
    try {
        const response = await fetchv2("https://api3.devcorp.me/web/vod/" + ID + "/detail");
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedText = await decryptedResponse.text();
        const decryptedData = JSON.parse(decryptedText);

        const episodes = decryptedData.result.episodes || [];

        for (const ep of episodes) {
            results.push({
                href: ep.id,
                number: parseInt(ep.episode, 10)
            });
        }

        return JSON.stringify(results.reverse());
    } catch (err) {
        return JSON.stringify([{ href: "Error", number: "Error" }]);
    }
}

async function extractStreamUrl(href) {
    try {
        const parts = href.split("-episode-");
        const id = parts[0];
        const episodeNumber = parts[1];

        const response = await fetchv2("https://api3.devcorp.me/web/vod/" + id + "/episode/" + episodeNumber);
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedText = await decryptedResponse.text();
        const decryptedData = JSON.parse(decryptedText);

        const sources = decryptedData.result.sources;
        const tracks = decryptedData.result.track;

        const stream = sources.find(s => s.url.includes(".mp4") || s.url.includes(".m3u8"));
        const subtitles = Array.isArray(tracks)
            ? tracks.map(t => ({
                name: t.name || "Unknown",
                file: t.file || ""
            }))
            : [];

        return JSON.stringify({
            streams: [{
                title: "Default",
                streamUrl: stream ? stream.url : "https://error.org/",
                headers: stream ? stream.headers : {}
            }],
            subtitles
        });
    } catch (err) {
        return JSON.stringify({
            streams: [{
                title: "Error",
                streamUrl: "https://error.org/",
                headers: {}
            }],
            subtitles: []
        });
    }
}