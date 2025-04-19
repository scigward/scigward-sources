function searchResults(html) {
    try {
        const results = [];
        const containerRegex = /<div class="page-content">[\s\S]*?<div class="container">[\s\S]*?<div class="row">([\s\S]*?)<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/;
        const containerMatch = html.match(containerRegex);

        if (containerMatch && containerMatch[1]) {
            const itemRegex = /<a href="([^"]+)" class="image lazyactive dbdone" data-src="([^"]+)" title="([^"]+)"/g;
            let match;

            while ((match = itemRegex.exec(containerMatch[1])) !== null) {
                const href = match[1];
                const image = match[2];
                const title = match[3];
                results.push({ title, href, image });
            }
        }
        return JSON.stringify(results);
    } catch (error) {
        console.error("searchResults error:", error);
        return JSON.stringify([]);
    }
}

function extractDetails(html) {
    try {
        const details = {};
        const descriptionMatch = html.match(/<div class="content">[\s\S]*?<p>([^<]+)<\/p>[\s\S]*?<\/div>/);
        details.description = descriptionMatch ? descriptionMatch[1].trim() : '';

        const genresMatch = html.match(/<div class="genres">([\s\S]*?)<\/div>/);
        let aliases = [];
        if (genresMatch && genresMatch[1]) {
            const genreRegex = /<a[^>]*class="badge yellow-soft">([^<]+)<\/a>/g;
            let genreMatch;
            while ((genreMatch = genreRegex.exec(genresMatch[1])) !== null) {
                aliases.push(genreMatch[1].trim());
            }
        }
        details.aliases = aliases;

        return JSON.stringify(details);
    } catch (error) {
        console.error("extractDetails error:", error);
        return JSON.stringify({});
    }
}

function extractEpisodes(html, titleUrl) {
    try {
        const episodes = [];
        const episodeListRegex = /<ul class="episodes-lists"[^>]*>([\s\S]*?)<\/ul>/;
        const episodeListMatch = html.match(episodeListRegex);

        if (episodeListMatch && episodeListMatch[1]) {
            const episodeItemRegex = /<li data-number="(\d+)">.*?<a href="([^"]+)" class="read-btn"/g;
            let episodeItemMatch;

            while ((episodeItemMatch = episodeItemRegex.exec(episodeListMatch[1])) !== null) {
                const number = episodeItemMatch[1];
                const href = episodeItemMatch[2];
                episodes.push({ href, number });
            }
            episodes.reverse();
        }
        return JSON.stringify(episodes);
    } catch (error) {
        console.error("extractEpisodes error:", error);
        return JSON.stringify([]);
    }
}

function extractStreamUrl(html) {
    try {
        let streamUrl = null;

        const mp4UploadMatch = html.match(/<iframe[^>]*src="([^"]*mp4upload\.com\/embed-[^"]*\.html[^"]*)"/);
        if (mp4UploadMatch) {
            streamUrl = mp4UploadMatch[1];
        }

        if (!streamUrl) {
            const yourUploadMatch = html.match(/<iframe src="([^"]*yourupload\.com\/embed\/[^"]*)"/);
            if (yourUploadMatch) {
                streamUrl = yourUploadMatch[1];
            }
        }

        if (!streamUrl) {
            console.warn("No supported video source iframe found in HTML.");
            return JSON.stringify(null);
        }

        console.log("Found video source iframe URL:", streamUrl);
        return JSON.stringify(streamUrl);
    } catch (error) {
        console.error("extractStreamUrl error:", error);
        return JSON.stringify(null);
    }
}
