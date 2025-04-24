async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://web.animerco.org/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        console.log("[HTML] searchResults HTML:\n", responseText); // LOG SEARCH PAGE

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

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const responseText = await response.text();

        console.log("[HTML] extractDetails HTML:\n", responseText); // LOG DETAILS PAGE

        const details = [];

        if (url.includes('/movies/')) {
            const descriptionMatch = responseText.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
            const description = descriptionMatch 
                ? decodeHTMLEntities(descriptionMatch[1].trim()) 
                : 'N/A';

            const airdateMatch = responseText.match(/<li>\s*بداية العرض:\s*<span>\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>/);
            const airdate = airdateMatch ? airdateMatch[1].trim() : 'Unknown';

            const genres = [];
            const aliasesMatch = responseText.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
            const inner = aliasesMatch ? aliasesMatch[1] : '';
            const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
            let m;
            while ((m = anchorRe.exec(inner)) !== null) {
                genres.push(decodeHTMLEntities(m[1].trim()));
            }

            details.push({
                description,
                aliases: genres.join(', '),
                airdate: `Released: ${airdate}`
            });

        } else if (url.includes('/animes/')) {
            const descriptionMatch = responseText.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
            const description = descriptionMatch 
                ? decodeHTMLEntities(descriptionMatch[1].trim()) 
                : 'N/A';

            const airdateMatch = responseText.match(/<li>\s*بداية العرض:\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>/);
            const airdate = airdateMatch ? airdateMatch[1].trim() : 'Unknown';

            const genres = [];
            const aliasesMatch = responseText.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
            const inner = aliasesMatch ? aliasesMatch[1] : '';
            const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
            let m;
            while ((m = anchorRe.exec(inner)) !== null) {
                genres.push(decodeHTMLEntities(m[1].trim()));
            }

            details.push({
                description,
                aliases: genres.join(', '),
                airdate: `Aired: ${airdate}`
            });

        } else {
            throw new Error("URL does not match known anime or movie paths.");
        }

        return JSON.stringify(details);

    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Aliases: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const pageResponse = await fetchv2(url);
        const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

        console.log("[HTML] extractEpisodes Main Page HTML:\n", html); // LOG MAIN ANIME PAGE

        const episodes = [];

        if (url.includes('/movies/')) {
            episodes.push({
                number: 1,
                url: url
            });
            return JSON.stringify(episodes);
        }

        const seasonUrlRegex = /<li\s+data-number='[^']*'>\s*<a\s+href='([^']+)'/g;
        const seasonUrls = [...html.matchAll(seasonUrlRegex)].map(match => match[1]);

        for (const seasonUrl of seasonUrls) {
            const seasonResponse = await fetchv2(seasonUrl);
            const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

            console.log(`[HTML] Season Page HTML for ${seasonUrl}:\n`, seasonHtml); // LOG EACH SEASON

            const episodeRegex = /data-number='(\d+)'[\s\S]*?href='([^']+)'/g;
            for (const match of seasonHtml.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[1]),
                    url: match[2]
                });
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": url,
        "X-Requested-With": "XMLHttpRequest"
    };

    const htmlResponse = await fetchv2(url);
    const html = await htmlResponse.text();

    // Regex to extract data from all <a> server buttons
    const serverRegex = /<a[^>]+data-type=['"]([^'"]+)['"][^>]+data-post=['"](\d+)['"][^>]+data-nume=['"](\d+)['"][^>]*>(?:.|\n)*?<span class='server'>([^<]+)<\/span>/g;

    let match;
    const preferredNames = ["mp4upload", "yourupload"];
    const preferred = [];
    const fallback = [];

    while ((match = serverRegex.exec(html)) !== null) {
        const [_, type, post, nume, server] = match;
        const entry = { type, post, nume, server: server.toLowerCase() };
        if (preferredNames.includes(entry.server)) {
            preferred.push(entry);
        } else {
            fallback.push(entry);
        }
    }

    const allServers = [...preferred, ...fallback];

    for (const { type, post, nume } of allServers) {
        const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;

        try {
            const response = await fetchv2(
                "https://web.animerco.org/wp-admin/admin-ajax.php",
                headers,
                "POST",
                body
            );
            const json = await response.json();

            if (json && json.embed_url) {
                return json.embed_url;
            }

        } catch (err) {
            // Move on silently
            continue;
        }
    }

    throw new Error("No working stream URL found from any server.");
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
