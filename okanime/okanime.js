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
  const result = {
    streams: [],
  };
  const validHosts = ["mp4upload.com", "4shared.com"];

  try {
    console.log("extractStreamUrl called with HTML:", html); // Log the input HTML

    const containerMatch = html.match(
      /<div class="filter-links-container overflow-auto" id="streamlinks">([\s\S]*?)<\/div>/
    );
    console.log("containerMatch:", containerMatch); // Log the containerMatch result
    if (!containerMatch) {
      throw new Error("Stream links container not found.");
    }

    const containerHTML = containerMatch[1];
    console.log("containerHTML:", containerHTML); // Log the extracted container HTML

    // Regex for mp4upload links
    const mp4uploadRegex = /<a[^>]*data-src="([^"]*mp4upload\.com[^"]*)"[^>]*>.*?<\/a>/gi;
    const mp4uploadUrls = [];
    let mp4uploadMatch;
    while ((mp4uploadMatch = mp4uploadRegex.exec(containerHTML)) !== null) {
      console.log("mp4uploadMatch:", mp4uploadMatch); // Log each mp4uploadMatch
      mp4uploadUrls.push(mp4uploadMatch[1]);
    }
    console.log("mp4uploadUrls:", mp4uploadUrls); // Log all mp4uploadUrls

    // Regex for 4shared links
    const fourSharedRegex = /<a[^>]*data-src="([^"]*4shared\.com[^"]*)"[^>]*>.*?<\/a>/gi;
    const fourSharedUrls = [];
    let fourSharedMatch;
    while ((fourSharedMatch = fourSharedRegex.exec(containerHTML)) !== null) {
      console.log("fourSharedMatch:", fourSharedMatch); // Log each fourSharedMatch
      fourSharedUrls.push(fourSharedMatch[1]);
    }
    console.log("fourSharedUrls:", fourSharedUrls); // Log all fourSharedUrls

    let preferredMp4uploadUrl = null;
    let preferred4sharedUrl = null;

    if (mp4uploadUrls.length > 0) {
      for (const url of mp4uploadUrls) {
        console.log("Fetching mp4upload URL:", url); // Log the mp4upload URL being fetched
        try {
          const embeddedHtml = await fetch(url).then(res => res.text());
          console.log("embeddedHtml:", embeddedHtml); // Log the embedded HTML
          const mp4UrlMatch = embeddedHtml.match(/src: "(https:\/\/a1\.mp4upload\.com:\d+\/d\/[^"]*video\.mp4)"/);
          console.log("mp4UrlMatch:", mp4UrlMatch); // Log the mp4UrlMatch
          if (mp4UrlMatch) {
            preferredMp4uploadUrl = mp4UrlMatch[1];
            break;
          }
        } catch (error) {
          console.error("Error fetching or extracting mp4upload URL:", error);
        }
      }
      if (preferredMp4uploadUrl) result.streams.push("mp4upload", preferredMp4uploadUrl);
    }

    if (fourSharedUrls.length > 0) {
      for (const url of fourSharedUrls) {
        console.log("Fetching 4shared URL:", url); // Log the 4shared URL being fetched
        try {
          const fourSharedHtml = await fetch(url).then(res => res.text());
          console.log("fourSharedHtml:", fourSharedHtml); // Log the 4shared HTML
          const mp4UrlMatch = fourSharedHtml.match(/<\s*source\s+src="([^"]*preview\.mp4)"\s+type="video\/mp4">/);
          console.log("mp4UrlMatch:", mp4UrlMatch); // Log the mp4UrlMatch
          if (mp4UrlMatch) {
            preferred4sharedUrl = mp4UrlMatch[1];
            break; // Take the first match
          }
        } catch (error) {
          console.error("Error fetching or extracting 4shared URL:", error);
        }
      }
      if (preferred4sharedUrl) result.streams.push("4shared", preferred4sharedUrl);
    }

    console.log("Final result:", result); // Log the final result

    return JSON.stringify(result);

  } catch (error) {
    console.error("Error in extractStreamUrl:", error);
    return JSON.stringify({ streams: [] });
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
