function searchResults(html) {
    const results = [];

    const titleRegex = /<div class="anime-title">\s*<h4>\s*<a[^>]*>([^<]+)<\/a>/g;
    const hrefRegex = /<div class="anime-title">\s*<h4>\s*<a href="([^"]+)"/g;
    const imgRegex = /<div class="anime-image">\s*<img class="img-responsive"\s+src="([^"]+)"/g;

    const itemRegex = /<div class="col-6 col-sm-4 col-lg-3 col-xl-2dot4">\s*<div class="anime-card anime-hover">/g;
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
       const titleMatch = itemHtml.match(titleRegex);
       const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

       const hrefMatch = itemHtml.match(hrefRegex);
       const href = hrefMatch ? hrefMatch[1].trim() : '';

       const imgMatch = itemHtml.match(imgRegex);
       const imageUrl = imgMatch ? imgMatch[1].trim() : '';

       if (title && href) {
           results.push({
               title: title,
               image: imageUrl,
               href: href
           });
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
