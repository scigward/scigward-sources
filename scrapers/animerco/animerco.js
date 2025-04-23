async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://web.animerco.org/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];
        const baseUrl = "https://web.animerco.org";

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
        console.error('[searchResults] Error:', error.message);
        return JSON.stringify([]);
    }
}
    
async function extractDetails(url) {
    try {
        const fetchUrl = `${url}`;
        const response = await fetchv2(fetchUrl);
        const responseText = await response.text();

        const details = [];

        const descriptionMatch = responseText.match(/<div class="content">\s*<p>(.*?)<\/p>\s*<\/div>/s);
        let description = descriptionMatch 
           ? decodeHTMLEntities(descriptionMatch[1].trim()) 
           : 'N/A';

        const airdateMatch = responseText.match(/<li>\s*بداية العرض:\s*<a [^>]*rel="tag"[^>]*>([^<]+)<\/a>\s*<\/li>/);
        let airdate = airdateMatch ? airdateMatch[1].trim() : '';

        const genres = [];

        const aliasesMatch = responseText.match(/<div\s+class="genres">([\s\S]*?)<\/div>/);
        let aliases = aliasesMatch ? aliasesMatch[1].trim() : '';
        const inner = aliasesMatch ? aliasesMatch[1] : '';

        // 2) find every <a>…</a> and grab the text content
        const anchorRe = /<a[^>]*>([^<]+)<\/a>/g;
        let m;
        while ((m = anchorRe.exec(inner)) !== null) {
            // m[1] is the text between the tags
            genres.push(decodeHTMLEntities(m[1].trim()));
        }

        if (description && airdate && aliases) {
            details.push({
                description: description,
                aliases: genres.join(', '),
                airdate: airdate
            });
        }

        return JSON.stringify(details);
    } catch (error) {
        console.log('Details error: ' + error);
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

        const season1Regex = /<ul class="episodes-lists">[\s\S]*?<li data-number='1'><a href='([^']+)'/;
        const season1Match = html.match(season1Regex);

        if (!season1Match || !season1Match[1]) {
            return JSON.stringify([]);
        }

        const season1Url = season1Match[1];
        const response = await fetch(season1Url);
        if (!response.ok) {
            return JSON.stringify([]);
        }
        const season1Html = typeof response === 'object' ? await response.text() : await response;

        const episodeRegex = /data-number='(\d+)'[\s\S]*?href='([\s\S]*?)'/g;
        const episodeMatches = Array.from(season1Html.matchAll(episodeRegex));

        const episodes = episodeMatches.map(match => ({
            number: parseInt(match[1]),
            url: match[2],
        }));

        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}
        
async function extractStreamUrl(html) {
    try {
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]*mp4upload\.com[^"]*)"/);
        const iframeUrl = iframeMatch ? iframeMatch[1] : null;

        if (!iframeUrl) {
            console.warn("No supported video source iframe found in HTML.");
            return null;
        }

        console.log("Found video source iframe URL:", iframeUrl);

        return iframeUrl;

    } catch (error) {
        console.error("Error extracting video source URL:", error);
        return null;
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
