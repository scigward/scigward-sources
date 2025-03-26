async function fetchAnimeDetails(animeUrl) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    const html = await fetchv2(animeUrl, headers);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extracting details
    const title = doc.querySelector('.anime-title')?.textContent.trim();

    // Fetch image URL (tries `data-src` first, then `src`)
    const imageUrl = doc.querySelector('.lazyautosizes')?.getAttribute('data-src') 
                  || doc.querySelector('.lazyautosizes')?.getAttribute('src');

    const description = doc.querySelector('.review-content p')?.textContent.trim();
    const releaseYear = doc.querySelector('.full-list-info a[href*="aired_year"] small:nth-child(2)')?.textContent.trim();
    const season = doc.querySelector('.full-list-info:nth-child(2) small:nth-child(2)')?.textContent.trim();
    const pgRating = doc.querySelector('.full-list-info:nth-child(3) small:nth-child(2)')?.textContent.trim();
    const episodeCount = doc.querySelector('.full-list-info:nth-child(4) small:nth-child(2)')?.textContent.trim();
    const genres = [...doc.querySelectorAll('.review-content a.subtitle')].map(el => el.textContent.trim()).join(', ');

    return {
        title,
        imageUrl,
        description,
        releaseYear,
        season,
        pgRating,
        episodeCount,
        genres
    };
}
