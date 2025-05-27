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

        if (
            url.includes('/movies/') ||
            url.includes('/anime-movies/') ||
            url.includes('/asian-movies/')
        ) {
            episodes.push({ number: 1, href: url });
            return JSON.stringify(episodes);
        }

        const seasonUrls = [];

        const seasonListMatch = html.match(
            /<div class="form-row" id="seasonList">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
        );

        if (seasonListMatch) {
            const seasonListHtml = seasonListMatch[1];

            const seasonBlockRegex = /<div class="col-xl-2 col-lg-3 col-md-6">([\s\S]*?)<\/div>\s*<\/div>/gi;

            for (const seasonMatch of seasonListHtml.matchAll(seasonBlockRegex)) {
                const block = seasonMatch[1];
                const pMatch = block.match(/onclick="window\.location\.href = '(\?p=\d+)'/);
                if (pMatch) {
                    const seasonUrl = `${url}${pMatch[1]}`;
                    console.log("Season URL:", seasonUrl);
                    seasonUrls.push(seasonUrl);
                }
            }
        }

        if (seasonUrls.length === 0) {
            const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
            for (const match of html.matchAll(episodeRegex)) {
                episodes.push({
                    number: parseInt(match[2]),
                    href: match[1],
                });
            }
        } else {
            for (const seasonUrl of seasonUrls) {
                const seasonResponse = await fetchv2(seasonUrl);
                const seasonHtml = typeof seasonResponse === 'object' ? await seasonResponse.text() : await seasonResponse;

                const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة (\d+)\s*<\/a>/g;
                for (const match of seasonHtml.matchAll(episodeRegex)) {
                    episodes.push({
                        number: parseInt(match[2]),
                        href: match[1],
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
    /<li[^>]*onclick="player_iframe\.location\.href\s*=\s*'([^']+)'[^>]*>\s*<a[^>]*>\s*<i[^>]*><\/i>\s*سيرفر المشاهدة #01\s*<\/a>/
  );
  if (!serverMatch) throw new Error("Server #01 not found.");
  const embedUrl = serverMatch[1];

  const embedResponse = await fetchv2(embedUrl);
  const embedHtml = await embedResponse.text();

  const streamUrl = await m3u8deobfuscator(embedHtml);
  if (!streamUrl) throw new Error("Stream URL not found.");
  return streamUrl;
}

/**
 * Deobfuscates Fasel-style scripts and extracts the .m3u8 streaming URL.
 * @param {string} html - Full HTML content of the embedded player page.
 * @returns {string|null} - Extracted .m3u8 URL or null if not found.
 */
function m3u8deobfuscator(html) {
  try {
    // Step 1: Match ALL <script> tags
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [...html.matchAll(scriptRegex)];

    if (!scripts.length) {
      console.error("No <script> blocks found in HTML.");
      return null;
    }

    // Step 2: Find the one that contains `var K = '...'`
    const targetScript = scripts.find(s => /var\s+K\s*=\s*'[^']+'\s*\.split\(""\)/.test(s[1]));
    if (!targetScript) {
      console.error("No script found with 'var K = ...'");
      return null;
    }

    const scriptContent = targetScript[1];

    // Step 3: Extract the obfuscated string from var K
    const encodedMatch = scriptContent.match(/var\s+K\s*=\s*'([^']+)'\s*\.split\(""\)/);
    if (!encodedMatch || !encodedMatch[1]) {
      console.error("Failed to extract the obfuscated string from `var K`.");
      return null;
    }

    const encoded = 'ChmaorrCfozdgenziMrattShzzyrtarnedpoomrzPteonSitfreidnzgtzcseljibcOezzerlebpalraucgeizfznfoocrzEwaocdhnziaWptpnleytzngoectzzdclriehaCtdenTeepxptaNzoldmetzhRzeegvEoxmpezraztdolbizhXCGtIs=rzicfozn>ceamtazr(fdio/c<u>m"eennto)nz:gyzaclaplslizdl"o=ceallySttso r"akgneazl_bd:attuaozbsae"t=Ictresm zegmeatrIftie<mzzLrMeTmHorveenIntiezmezdcolNeeanrozldcezcdoadeehUzReIdCooNmtpnoenreanptzzebnionndzzybatlopasziedvzaellzyJtSsOzNezmDaartfeizzAtrnreamyuzcPordozmyidsoebzzpeatrasteSIyndtazenrazvtipgiartcoSrtzneenrcroudcezUeRmIazNUgianTty8BAsrtrnaeymzesleEttTeigmzedoIuytBztsneetmIenltEetrevgazlSzNAtrnreamyeBluEfeftearezrcclzetanreTmigmaeroFuttnzecmluecaorDIenttaeerrvcazltznMeevsEshacgteaCphsaindnzelllzABrrootacdeclaesStyCrheaunqnzerloztecnecloedSeyUrReIuCqozmrpeonneetnstizLTtynpeevEErervoormzeErvzernetnzeEtrsrioLrtznIemvaEgdedzaszetsnseimoenlSEteotraaegrec';

    // Step 4: Deobfuscate by swapping every character pair
    let swapped = '';
    for (let i = 0; i < encoded.length; i += 2) {
      if (i + 1 < encoded.length) {
        swapped += encoded[i + 1] + encoded[i]; // swap
      } else {
        swapped += encoded[i]; // odd-length: keep last char
      }
    }

    // Step 5: Split on 'z' and search for .m3u8
    const parts = swapped.split('z');
    if (!parts.length) {
      console.error("Decoded string didn't split into parts using 'z'.");
      return null;
    }

    const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8/;
    for (const part of parts) {
      const match = part.match(m3u8Regex);
      if (match) {
        console.log("Extracted .m3u8 URL:", match[0]);
        return match[0];
      }
    }

    console.warn(".m3u8 URL not found after deobfuscation.");
    return null;
  } catch (err) {
    console.error("Unexpected error in deobfuscation:", err);
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

function btoa(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input);
    let output = '';

    for (let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || (map = '=', i % 1);
        output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) {
            throw new Error("btoa failed: The string contains characters outside of the Latin1 range.");
        }
        block = (block << 8) | charCode;
    }

    return output;
}

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}
