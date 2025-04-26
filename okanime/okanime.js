function searchResults(html) {
    const results = [];

    const itemRegex = /<div class="col-6 col-sm-4 col-lg-3 col-xl-2dot4[^"]*">([\s\S]*?)(?=<div class="col-6|$)/g;
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
        const hrefMatch = itemHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*anime-details[^"]*">/);
        const imgMatch = itemHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        const titleMatch = itemHtml.match(/<h3>([^<]+)<\/h3>/);

        const href = hrefMatch ? hrefMatch[1].trim() : '';
        const image = imgMatch ? imgMatch[1].trim() : '';
        const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

        if (href && image && title) {
            results.push({ title, href, image });
        }
    });

    return results;
}

function extractDetails(html) {
  const details = [];

  const descriptionMatch = html.match(
   /<div class="review-content">\s*<p>(.*?)<\/p>\s*<\/div>/s
  );
  let description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : "";

  const airdateMatch = html.match(/<div class="full-list-info">\s*<small>\s* سنة بداية العرض \s*<\/small>\s*<small>\s*(\d{4})\s*<\/small>\s*<\/div>/);
  let airdate = airdateMatch ? airdateMatch[1].trim() : "";

  const genres = [];
  const aliasesMatch = html.match(
    /<div class="review-author-info">([\s\S]*?)<\/div>/
  );
  const inner = aliasesMatch ? aliasesMatch[1] : "";

  const anchorRe = /<a[^>]*class="subtitle mr-1 mt-2 "[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = anchorRe.exec(inner)) !== null) {
    genres.push(m[1].trim());
  }

  if (description && airdate) {
    details.push({
      description: description,
      aliases: genres.join(", "),
      airdate: airdate,
    });
  }

  console.log(details);
  return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>\s*الحلقة\s*(\d+)\s*<\/a>/gi;
    const plainTextRegex = /<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/gi;

    let matches;

    if ((matches = html.match(htmlRegex))) {
        matches.forEach(link => {
            const hrefMatch = link.match(/href="([^"]+)"/);
            const numberMatch = link.match(/<a[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/);
            if (hrefMatch && numberMatch) {
                const href = hrefMatch[1];
                const number = numberMatch[1];
                episodes.push({
                    href: href,
                    number: number
                });
            }
        });
    } 
    else if ((matches = html.match(plainTextRegex))) {
        matches.forEach(match => {
            const numberMatch = match.match(/\d+/);
            if (numberMatch) {
                episodes.push({
                    href: null, 
                    number: numberMatch[0]
                });
            }
        });
    }

    console.log(episodes);
    return episodes;
}

async function extractStreamUrl(url) {
    const streams = [];

    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const containerMatch = html.match(
            /<div class="filter-links-container overflow-auto" id="streamlinks">([\s\S]*?)<\/div>/
        );

        if (!containerMatch) {
            console.log("No stream links container found");
            return JSON.stringify({ streams });
        }

        const containerHtml = containerMatch[1];

        const mp4uploadMatches = [...containerHtml.matchAll(/<a[^>]*data-src="([^"]*mp4upload\.com[^"]*)"[^>]*>.*?<\/a>/g)];
        const fourSharedMatches = [...containerHtml.matchAll(/<a[^>]*data-src="([^"]*4shared\.com[^"]*)"[^>]*>.*?<\/a>/g)];

        for (const match of mp4uploadMatches) {
            const mp4uploadUrl = match[1];
            try {
                const mp4Response = await fetchv2(mp4uploadUrl);
                const mp4Html = await mp4Response.text();

                const mp4FileMatch = mp4Html.match(/src:\s*"(https:\/\/[^"]+\.mp4)"/);

                if (mp4FileMatch) {
                    streams.push("mp4upload", mp4FileMatch[1]);
                }
            } catch (e) {
                console.log("Error fetching mp4upload:", mp4uploadUrl);
            }
        }

        for (const match of fourSharedMatches) {
            const fourSharedUrl = match[1];
            try {
                const fourResponse = await fetchv2(fourSharedUrl);
                const fourHtml = await fourResponse.text();

                const fourFileMatch = fourHtml.match(/<source src="([^"]+\.mp4)"/);

                if (fourFileMatch) {
                    streams.push("4shared", fourFileMatch[1]);
                }
            } catch (e) {
                console.log("Error fetching 4shared:", fourSharedUrl);
            }
        }

    } catch (error) {
        console.log("Error fetching episode page:", url);
    }

    return JSON.stringify({ streams });
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
