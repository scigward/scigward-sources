//Mocking fetchv2 if needed.
async function fetchv2(url, headers) {
  return fetch(url, { headers });
}

//test code.
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

//or
(async () => {
    const results = await searchResults('Cowboy Bebop');
    console.log('RESULTS:', results);

    const parsedResults = JSON.parse(results);
    const target = parsedResults[1]; // Index 1 is safe

    const details = await extractDetails(target.href);
    console.log('DETAILS:', details);

    const eps = await extractEpisodes(target.href);
    console.log('EPISODES:', eps);

    const parsedEpisodes = JSON.parse(eps);
    if (parsedEpisodes.length > 0) {
        const streamUrl = await extractStreamUrl(parsedEpisodes[0].href);
        console.log('STREAMURL:', streamUrl);
    } else {
        console.log('No episodes found.');
    }
})();

//Put all this at the top of your main .JS file.
