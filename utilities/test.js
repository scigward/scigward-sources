//Mocking fetchv2 if needed.
async function fetchv2(url, headers) {
  return fetch(url, { headers });
}

(async () => {
    try {
        const results = await searchResults('One Piece');
        console.log('RESULTS:', results);

        const parsedResults = JSON.parse(results);
        
        if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
            console.error('No search results found');
            return;
        }

        const target = parsedResults[1] || parsedResults[0];
        
        if (!target || !target.href) {
            console.error('No valid target found in search results');
            return;
        }

        const details = await extractDetails(target.href);
        console.log('DETAILS:', details);

        const eps = await extractEpisodes(target.href);
        console.log('EPISODES:', eps);

        const parsedEpisodes = JSON.parse(eps);
        if (parsedEpisodes.length > 0) {
            const streamUrl = await extractStreamUrl(parsedEpisodes[0].href);
            console.log('STREAMURL:', streamUrl);
            
            if (streamUrl) {
                const streams = JSON.parse(streamUrl);
                console.log(`Found ${streams.streams?.length || 0} total streams`);
            }
        } else {
            console.log('No episodes found.');
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
})();


// Or
(async () => {
    const results = await searchResults('Cowboy Bebop');
    console.log('RESULTS:', results);
    
    const details = await extractDetails("TitlePageHref");
    console.log('DETAILS:', details);

    const eps = await extractEpisodes("TitlePageHref");
    console.log('EPISODES:', eps);

    const streamUrl = await extractStreamUrl("WatchHref");
    console.log('STREAMURL:', streamUrl);
})();

//Put all this at the top of your main .JS file.
