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
