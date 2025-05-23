async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.faselhds.center/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];

        const itemRegex = /<div class="col-xl-2 col-lg-2 col-md-3 col-sm-3">\s*<div class="postDiv[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]+)"/g;
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

        // Handle movie pages (both /movies/ and /anime-movies/)
        if (url.includes('/movies/') || url.includes('/anime-movies/')) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        // Find all season URLs within seasonList container
        const seasonListMatch = html.match(/<div class="form-row" id="seasonList">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
        const seasonUrls = [];

        if (seasonListMatch) {
            const seasonListHtml = seasonListMatch[1];
            const seasonDivRegex = /<div class="seasonDiv[^>]*onclick="window\.location\.href = '\?p=(\d+)'/g;
            
            for (const match of seasonListHtml.matchAll(seasonDivRegex)) {
                // Append /?p=VALUE directly to original URL
                seasonUrls.push(`${url}/?p=${match[1]}`);
            }
        }

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

async function extractStreamUrl(url) {
    const response = await fetchv2(url);
    const html = await response.text();

    const serverMatch = html.match(
        /<li[^>]*onclick="player_iframe\.location\.href\s*=\s*'([^']+)'[^>]*>\s*<a[^>]*>\s*<i[^>]*><\/i>\s*سيرفر المشاهدة #01\s*<\/a>/,
    );
    if (!serverMatch) throw new Error("Server #01 not found.");
    const embedUrl = serverMatch[1];

    const embedResponse = await fetchv2(embedUrl);
    const embedHtml = await embedResponse.text();

    const scriptMatch = embedHtml.match(
        /<script\s+type="text\/javascript"\s+language="Javascript">\s*(eval\(function\(p,a,c,k,e,(?:r|d)[\s\S]*?\})\s*<\/script>/,
    );
    if (!scriptMatch) throw new Error("Obfuscated script not found in embed.");

    const obfuscatedScript = scriptMatch[1];
    const unpackedScript = unpack(obfuscatedScript);

    const m3u8Match = unpackedScript.match(/file\s*:\s*"([^"]+\.master\.m3u8.*?)"/);
    if (!m3u8Match) throw new Error("No streamm URL found.");

    return m3u8Match[1];
}

////////////////////////////////////////////////////////////////////////////////////////
// DEOBFUSCATOR (Unpacker)
////////////////////////////////////////////////////////////////////////////////////////

class Unbaser {
    constructor(base) {
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[62].substr(0, base);
        }
        if (2 <= base && base <= 36) {
            this.unbase = (val) => parseInt(val, base);
        } else {
            [...this.ALPHABET[base]].forEach((ch, idx) => {
                this.dictionary[ch] = idx;
            });
            this.unbase = this._dictunbaser;
        }
    }

    _dictunbaser(val) {
        return [...val].reverse().reduce((acc, ch, i) => {
            return acc + Math.pow(this.base, i) * this.dictionary[ch];
        }, 0);
    }
}

function unpack(source) {
    let { payload, symtab, radix, count } = _filterargs(source);
    if (count !== symtab.length) throw new Error("Malformed p.a.c.k.e.r. symtab.");

    let unbase = new Unbaser(radix);

    function lookup(match) {
        const word = match;
        const value = radix === 1 ? symtab[parseInt(word)] : symtab[unbase.unbase(word)];
        return value || word;
    }

    return payload.replace(/\b\w+\b/g, lookup);
}

function _filterargs(source) {
    const juicers = [
        /}\(\s*'(.*)',\s*(\d+|\[\]),\s*(\d+),\s*'(.*)'\.split\('\|'\)/,
        /}\(\s*'(.*)',\s*(\d+|\[\]),\s*(\d+),\s*'(.*)'\.split\('\|'\),/,
    ];
    for (const re of juicers) {
        const match = re.exec(source);
        if (match) {
            return {
                payload: match[1],
                radix: parseInt(match[2]),
                count: parseInt(match[3]),
                symtab: match[4].split("|"),
            };
        }
    }
    throw new Error("Could not parse p.a.c.k.e.r. arguments.");
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
