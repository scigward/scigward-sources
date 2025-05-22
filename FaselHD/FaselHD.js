async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.faselhds.center/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];

        const itemRegex = /<div class="col-xl-2 col-lg-2 col-md-3 col-sm-3">[\s\S]*?<a href="([^"]+)"[^>]*data-src="([^"]+)"[^>]*alt="([^"]+)"[\s\S]*?<\/div>/g;
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
    const results = [];
  
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descriptionMatch = html.match(/<div class="singleDesc">\s*<p>([\s\S]*?)<\/p>/i);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';

        const airdateMatch = html.match(/<i class="far fa-calendar-alt"><\/i>\s*موعد الصدور : (\d{4})/i);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

        const aliasContainerMatch = html.match(/<i class="far fa-folders"><\/i>\s*تصنيف المسلسل : ([\s\S]*?)<\/span>/i);
        const aliases = [];

        if (aliasContainerMatch && aliasContainerMatch[1]) {
            const aliasText = aliasContainerMatch[1];
            const aliasMatches = [...aliasText.matchAll(/>([^<]+)</g)];
            aliasMatches.forEach(match => {
                aliases.push(decodeHTMLEntities(match[1].trim()));
            });
        }

        results.push({
            description: description,
            aliases: aliases.length ? aliases.join(', ') : 'N/A',
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
        const pageResponse = await fetchv2(url);
        const html = typeof pageResponse === 'object' ? await pageResponse.text() : await pageResponse;

        const episodes = [];

        // Handle movie pages
        if (url.includes('/movies/')) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        // Find all season URLs
        const seasonUrlRegex = /<div class="seasonDiv[^>]*onclick="window\.location\.href = '(\?p=\d+)'/g;
        const seasonUrls = [...html.matchAll(seasonUrlRegex)].map(match => {
            return `${url.split('?')[0]}${match[1]}`;
        });

        // If no seasons found, check for episodes directly
        if (seasonUrls.length === 0) {
            const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
            for (const match of html.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[2]),
                    href: match[1]
                });
            }
        } else {
            // Process each season
            for (const seasonUrl of seasonUrls) {
                const seasonResponse = await fetchv2(seasonUrl);
                const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

                const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
                for (const match of seasonHtml.matchAll(episodeRegex)) {
                    episodes.push({
                        number: parseInt(match[2]),
                        href: match[1]
                    });
                }
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error("extractEpisodes failed:", error);
        return JSON.stringify([]);
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
