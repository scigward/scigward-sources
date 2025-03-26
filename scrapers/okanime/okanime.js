function searchResults(html) {
    const results = [];

    // Example: Regex to extract anime titles
    const titleRegex = /<span class="video-title">([^<]+)<\/span>/g;
    let titleMatch;
    while ((titleMatch = titleRegex.exec(html)) !== null) {
        results.push({
            title: titleMatch[1]
        });
    }

    // Example: Regex to extract image sources
    const imageRegex = /src="([^"]+\.webp)"/g;
    let imageMatch;
    results.forEach((result, index) => {
        imageMatch = imageRegex.exec(html);
        if (imageMatch) {
            result.imageSrc = imageMatch[1];
        }
    });

    // Example: Regex to extract airdate
    const airdateRegex = /<a href="\/search\?aired_year_from=\d+&amp;aired_year_to=\d+">[\s\S]*?<small>(\d{4})<\/small>/g;
    let airdateMatch;
    results.forEach((result, index) => {
        airdateMatch = airdateRegex.exec(html);
        if (airdateMatch) {
            result.airdate = airdateMatch[1];
        }
    });

    // Example: Regex to extract genres
    const genresRegex = /<a class="subtitle" href="[^"]+">([^<]+)<\/a>/g;
    let genreMatch;
    results.forEach((result, index) => {
        result.genres = [];
        while ((genreMatch = genresRegex.exec(html)) !== null) {
            result.genres.push(genreMatch[1]);
        }
    });

    // Example: Regex to extract descriptions
    const descriptionRegex = /<div class="review-content">[\s\S]*?<p>(.*?)<\/p>/g;
    let descriptionMatch;
    results.forEach((result, index) => {
        descriptionMatch = descriptionRegex.exec(html);
        if (descriptionMatch) {
            result.description = descriptionMatch[1];
        }
    });

    return results;
}
