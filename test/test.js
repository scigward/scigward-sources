//Mocking fetchv2.
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

//Put all this at the top of your main .JS file.
