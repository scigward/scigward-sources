function searchResults(html) {
    const results = [];
    try {
        const itemRegex = /<div class="block b_content">[\s\S]*?<\/div><\/div><\/div>/g;
        const items = html.match(itemRegex) || [];

        items.forEach(itemHtml => {
            const titleRegex = /<a href="[^"]+" title="([^"]+)"/;
            const titleMatch = itemHtml.match(titleRegex);
            const title = titleMatch ? titleMatch[1].trim() : '';

            const hrefRegex = /<a href="([^"]+)"/;
            const hrefMatch = itemHtml.match(hrefRegex);
            const href = hrefMatch ? hrefMatch[1].trim() : '';

            const imgRegex = /<img src="([^"]+)"/;
            const imgMatch = itemHtml.match(imgRegex);
            const image = imgMatch ? imgMatch[1].trim() : '';

            if (title && href && image) {
                results.push({ title, image, href });
            }
        });
    } catch (error) {
        return [];
    }
    return results;
}

function extractDetails(html) {
    try {
        const descriptionMatch = html.match(/<meta name="description" content="([^"]+)"/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';

        const aliasesMatch = html.match(/<span class="alternatives">([^<]+)<\/span>/);
        const aliases = aliasesMatch ? aliasesMatch[1].trim() : 'N/A';

        const seasonRegex = /Season-(1|\d+)|الموسم-(1|\d+)|الموسم-(1|\d+)/i;
        const seasonMatch = html.match(seasonRegex);
        const season = seasonMatch ? seasonMatch[0] : '';

        const yearRegex = /<div class="textd">Year:<\/div>\s*<div class="textc">([^<]+)<\/div>/;
        const yearMatch = html.match(yearRegex);
        const year = yearMatch ? yearMatch[1].trim() : '';

        const airdate = `${year} ${season}`.trim();

        if (description) {
            return { description, aliases, airdate };
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

function extractEpisodes(html) {
    const episodes = [];
    try {
        const episodeRegex = /<a class="infovan" href="([^"]+)">[\s\S]*?<div class="centerv">(\d+)<\/div>/g;
        const episodeMatches = html.match(episodeRegex) || [];

        episodeMatches.forEach(match => {
            const href = match.match(/href="([^"]+)"/)[1].trim();
            const number = match.match(/<div class="centerv">(\d+)<\/div>/)[1].trim();
            episodes.push({ href, number });
        });
        episodes.reverse();
    } catch (error) {
        return [];
    }
    return episodes;
}

async function extractStreamUrl(html) {
    try {
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
        const iframeUrl = iframeMatch ? iframeMatch[1] : null;

        if (!iframeUrl) {
            return null;
        }

        const response = await fetch(iframeUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} for ${iframeUrl}`);
        }
        const text = await response.text();

        const videoUrlMatch = text.match(/file:\s*"([^"]+)"/);
        const videoUrl = videoUrlMatch ? videoUrlMatch[1] : null;

        return videoUrl;
    } catch (error) {
        return null;
    }
}
