class Unbaser {
    constructor(base) {
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[base] ||
                this.ALPHABET[62].substr(0, base);
        }
        if (2 <= base && base <= 36) {
            this.unbase = (value) => parseInt(value, base);
        }
        else {
            try {
                [...this.ALPHABET[base]].forEach((cipher, index) => {
                    this.dictionary[cipher] = index;
                });
            }
            catch (er) {
                throw Error("Unsupported base encoding.");
            }
            this.unbase = this._dictunbaser;
        }
    }
    _dictunbaser(value) {
        let ret = 0;
        [...value].reverse().forEach((cipher, index) => {
            ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
        });
        return ret;
    }
}

function detect(source) {
    return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

function unpack(source) {
    let { payload, symtab, radix, count } = _filterargs(source);
    if (count != symtab.length) {
        throw Error("Malformed p.a.c.k.e.r. symtab.");
    }
    let unbase;
    try {
        unbase = new Unbaser(radix);
    }
    catch (e) {
        throw Error("Unknown p.a.c.k.e.r. encoding.");
    }
    function lookup(match) {
        const word = match;
        let word2;
        if (radix == 1) {
            word2 = symtab[parseInt(word)];
        }
        else {
            word2 = symtab[unbase.unbase(word)];
        }
        return word2 || word;
    }
    source = payload.replace(/\b\w+\b/g, lookup);
    return _replacestrings(source);
    function _filterargs(source) {
        const juicers = [
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
        ];
        for (const juicer of juicers) {
            const args = juicer.exec(source);
            if (args) {
                let a = args;
                if (a[2] == "[]") {
                }
                try {
                    return {
                        payload: a[1],
                        symtab: a[4].split("|"),
                        radix: parseInt(a[2]),
                        count: parseInt(a[3]),
                    };
                }
                catch (ValueError) {
                    throw Error("Corrupted p.a.c.k.e.r. data.");
                }
            }
        }
        throw Error("Could not make sense of p.a.c.k.e.r. data (unexpected code structure)");
    }
    function _replacestrings(source) {
        return source;
    }
}

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

function deobfuscateIfNeeded(html) {
    if (detect(html)) {
        try {
            return unpack(html);
        } catch (error) {
            return html;
        }
    }
    return html;
}
