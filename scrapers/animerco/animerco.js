function searchResults(html) {
    const results = [];
    try {
        const itemRegex = /<div class="block b_content">[\s\S]*?<\/div><\/div><\/div>/g;
        const items = html.match(itemRegex) || [];

        items.forEach(itemHtml => {
            const titleRegex = /<a href="[^"]+" title="([^"]+)"/;
            const titleMatch = itemHtml.match(titleRegex);
            const title = titleMatch ? titleMatch[1].trim() : '';
            const href = titleMatch ? titleMatch[1].trim() : '';

            if (title && href) {
                results.push({ title, href });
            }
        });
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
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
        const iframeUrl = iframeMatch ? iframeMatch[1] : null;

        if (!iframeUrl) {
            console.warn("No iframe found in HTML.");
            return null;
        }

        console.log("Found iframe URL:", iframeUrl);

        return iframeUrl;

    } catch (error) {
        console.error("Error extracting mp4upload URL:", error);
        return null;
    }
}
