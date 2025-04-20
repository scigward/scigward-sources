function searchResults(html) {
    const results = [];
    try {
        const itemRegex = /<div id="post-\d+" class="col-12[\s\S]*?<a href="([^"]+)" class="image lazyactive dbdone" data-src="([^"]+)" title="([^"]+)"/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = match[3].trim();
            results.push({ title, href, image });
        }
    } catch (error) {
        console.error("searchResults error:", error);
        return [];
    }
    return results;
}

async function extractEpisodes(html, type, titleUrl = null) {
    try {
        if (type === "seasons") {
            const seasonRegex = /Season-(1|\d+)|الموسم-(1|\d+)|الموسم-(1|\d+)/gi;
            const seasonMatches = html.match(seasonRegex) || [];
            const seasons = seasonMatches.map(match => match[0]);
            return seasons;
        } else if (type === "episodes") {
            if (!titleUrl) {
                throw new Error("titleUrl is required to extract episodes");
            }
            const episodes = [];
            const episodeRegex = /<a class="infovan" href="([^"]+)">[\s\S]*?<div class="centerv">(\d+)<\/div>/g;
            const episodeMatches = html.match(episodeRegex) || [];

            episodeMatches.forEach(match => {
                const href = match.match(/href="([^"]+)"/)[1].trim();
                const number = match.match(/<div class="centerv">(\d+)<\/div>/)[1].trim();
                episodes.push({ href, number });
            });
            episodes.reverse();
            return episodes;
        } else {
            throw new Error(`Invalid type: ${type}`);
        }
    } catch (error) {
        console.error(`extractEpisodes error (type: ${type}):`, error);
        return [];
    }
}

function extractDetails(html) {
    try {
        const descriptionMatch = html.match(/<meta name="description" content="([^"]+)"/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';

        const aliasesMatch = html.match(/<span class="alternatives">([^<]+)<\/span>/);
        const aliases = aliasesMatch ? aliasesMatch[1].trim() : 'N/A';

        const yearRegex = /<div class="textd">Year:<\/div>\s*<div class="textc">([^<]+)<\/div>/;
        const yearMatch = html.match(yearRegex);
        const year = yearMatch ? yearMatch[1].trim() : '';

        const airdate = `${year} `.trim();

        if (description) {
            return { description, aliases, airdate };
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

async function extractStreamUrl(html) {
    try {
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]*mp4upload\.com[^"]*)"/);
        const iframeUrl = iframeMatch ? iframeUrl[1] : null;

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
