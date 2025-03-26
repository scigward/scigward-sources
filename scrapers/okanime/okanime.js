function fetchSearchResult(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const animeList = [];

    doc.querySelectorAll('.anime-card').forEach((card) => {
      const title = card.querySelector('.anime-card-title')?.textContent.trim();
      const imageUrl = card.querySelector('.anime-card-poster img')?.getAttribute('src');
      const link = card.querySelector('a')?.getAttribute('href');

      if (title && imageUrl && link) {
        animeList.push({
          title,
          imageUrl,
          link,
        });
      }
    });

    return animeList;
  } catch (error) {
    console.error('Error parsing search results:', error);
    return []; // Return an empty array in case of error
  }
}

async function fetchAnimeDetails(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.querySelector('.video-title')?.textContent.trim();
    const imageUrl = doc.querySelector('img[src*="/uploads/anime/cover/"]')?.getAttribute('src');
    const airdate = doc.querySelector('a[href*="aired_year"] small:nth-child(2)')?.textContent.trim();
    const description = doc.querySelector('.review-content p')?.textContent.trim();
    const genres = [...doc.querySelectorAll('.review-content a.subtitle')].map(el => el.textContent.trim());

    const episodes = [];
    doc.querySelectorAll('#episodes .item').forEach(episodeElement => {
      const episodeLink = episodeElement.querySelector('a')?.getAttribute('href');
      const episodeTitle = episodeElement.querySelector('.video-subtitle')?.textContent.trim();
      if (episodeLink && episodeTitle) {
        episodes.push({
          episodeLink,
          episodeTitle,
        });
      }
    });

    const streams = [];
    doc.querySelectorAll('iframe[src*="mp4upload.com"]').forEach(iframe => {
        const streamUrl = iframe.getAttribute('src');
        if(streamUrl){
            streams.push(streamUrl);
        }
    });

    return {
      title,
      imageUrl,
      airdate,
      description,
      genres,
      episodes,
      streams
    };
  } catch (error) {
    console.error('Error parsing anime details:', error);
    return null;
  }
}

// Example usage:
async function main(query, episodeNumber) {
    try{
        const searchUrl = `https://okanime.tv/search?search=${encodeURIComponent(query)}`;
        const searchResponse = await fetch(searchUrl);
        if(!searchResponse.ok){
            throw new Error(`Failed to fetch search results. Status: ${searchResponse.status}`);
        }
        const searchHtml = await searchResponse.text();
        const searchResults = fetchSearchResult(searchHtml);

        if (searchResults && searchResults.length > 0) {
            const firstResult = searchResults[0];
            console.log("Search Result:");
            console.log(firstResult);

            const animeDetailsResponse = await fetch(firstResult.link);
            if(!animeDetailsResponse.ok){
                throw new Error(`Failed to fetch anime details. Status: ${animeDetailsResponse.status}`);
            }
            const animeDetailsHtml = await animeDetailsResponse.text();
            const animeDetails = await fetchAnimeDetails(animeDetailsHtml);

            if(animeDetails){
                console.log("Anime Details:");
                console.log(JSON.stringify(animeDetails, null, 2));

                if(animeDetails.episodes && animeDetails.episodes.length > 0 && episodeNumber){
                    const episode = animeDetails.episodes.find(ep => ep.episodeTitle.includes(`الحلقة${episodeNumber}`));
                    if(episode){
                        const episodeDetailsResponse = await fetch(episode.episodeLink);
                        if(!episodeDetailsResponse.ok){
                            throw new Error(`Failed to fetch episode details. Status: ${episodeDetailsResponse.status}`);
                        }
                        const episodeDetailsHtml = await episodeDetailsResponse.text();
                        const episodeDetails = await fetchAnimeDetails(episodeDetailsHtml);
                        if(episodeDetails){
                            console.log("Episode Streams:");
                            console.log(JSON.stringify(episodeDetails.streams, null, 2));
                        } else {
                            console.log("No streams found for the episode.");
                        }
                    } else {
                        console.log(`Episode ${episodeNumber} not found.`);
                    }
                } else {
                    console.log("No episodes or episode number provided.");
                }
            } else {
                console.log("Failed to get anime details.");
            }
        } else {
            console.log("No search results found.");
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    }
}
