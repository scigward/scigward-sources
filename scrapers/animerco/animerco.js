function searchResults(html) {
    const results = [];
    try {
        const itemRegex = /<div class="block b_content">[\s\S]*?<\/div><\/div><\/div>/g;
        const items = html.match(itemRegex) || [];

        items.forEach(itemHtml => {
            const titleRegex = /<a href="([^"]+)" title="([^"]+)"/;
            const titleMatch = itemHtml.match(titleRegex);
            const title = titleMatch ? titleMatch[1].trim() : '';
            const href = titleMatch ? titleMatch[1].trim() : '';

            const imgRegex = /<img src="([^"]+)"/;
            const imgMatch = itemHtml.match(imgRegex);
            const image = imgMatch ? imgMatch[1].trim() : '';

            if (title && href && image) {
                results.push({ title, href, image });
            }
        });
    } catch (error) {
        console.error("searchResults error:", error);
        return [];
    }
    return results;
}

async function extractEpisodes(html, titleUrl) { // Removed 'type' parameter
    try {
        const episodes = [];
        //  Updated regex to handle different episode URL formats
        const episodeRegex = /<a class="infovan" href="([^"]+\/\d+-?[^"]+)">[\s\S]*?<div class="centerv">(\d+)<\/div>/g;
        const episodeMatches = html.match(episodeRegex) || [];

        episodeMatches.forEach(match => {
            const href = match.match(/href="([^"]+)"/)[1].trim();
            const number = match.match(/<div class="centerv">(\d+)<\/div>/)[1].trim();
            episodes.push({ href, number });
        });
        episodes.reverse();
        return episodes;
    } catch (error) {
        console.error("extractEpisodes error:", error);
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
        let iframeUrl = null;

        // Try to find mp4upload iframe
        const mp4UploadMatch = html.match(/<iframe[^>]*src="([^"]*mp4upload\.com[^"]*)"/);
        if (mp4UploadMatch) {
            iframeUrl = mp4UploadMatch[1];
        }

        // If no mp4upload, try to find yourupload embed URL
        if (!iframeUrl) {
            const yourUploadMatch = html.match(/<iframe src="([^"]*yourupload\.com\/embed\/[^"]*)"/);
            if (yourUploadMatch) {
                iframeUrl = yourUploadMatch[1];
            }
        }

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
