async function searchResults(query) {
  const encodeQuery = keyword => encodeURIComponent(keyword);
  const searchBaseUrl = "https://1movies.bz/browser?keyword=";
  const baseUrl = "https://1movies.bz";
  
  const posterHrefRegex = /href="([^"]*)" class="poster"/g;
  const titleRegex = /class="title" href="[^"]*">([^<]*)</g;
  const imageRegex = /data-src="([^"]*)"/g;
  
  const extractResultsFromHTML = (htmlText) => {
    const results = [];
    const posterMatches = [...htmlText.matchAll(posterHrefRegex)];
    const titleMatches = [...htmlText.matchAll(titleRegex)];
    const imageMatches = [...htmlText.matchAll(imageRegex)];
    
    const minLength = Math.min(posterMatches.length, titleMatches.length, imageMatches.length);
    
    for (let index = 0; index < minLength; index++) {
      const href = posterMatches[index][1];
      const fullHref = href.startsWith("http") ? href : baseUrl + href;
      
      const imageSrc = imageMatches[index][1];
      
      const title = titleMatches[index][1];
      const cleanTitle = decodeHtmlEntities(title);
      
      if (fullHref && imageSrc && cleanTitle) {
        results.push({
          href: fullHref,
          image: imageSrc,
          title: cleanTitle
        });
      }
    }
    return results;
  };
  
  try {
    const encodedQuery = encodeQuery(query);
    
    const urls = [
      `${searchBaseUrl}${encodedQuery}`,
      `${searchBaseUrl}${encodedQuery}&page=2`,
      `${searchBaseUrl}${encodedQuery}&page=3`
    ];
    
    const responses = await Promise.all(urls.map(url => fetchv2(url)));
    
    const htmlTexts = await Promise.all(responses.map(response => response.text()));
    
    const allResults = [];
    htmlTexts.forEach(htmlText => {
      const pageResults = extractResultsFromHTML(htmlText);
      allResults.push(...pageResults);
    });
    
    return JSON.stringify(allResults);
  } catch (error) {
    return JSON.stringify([{
      href: "",
      image: "",
      title: "Search failed: " + error.message
    }]);
  }
}

async function extractDetails(url) {
  try {
    const response = await fetchv2(url);
    const htmlText = await response.text();

    const descriptionMatch = (/<div class="description text-expand">([\s\S]*?)<\/div>/.exec(htmlText) || [])[1];
    const aliasesMatch = (/<small class="al-title text-expand">([\s\S]*?)<\/small>/.exec(htmlText) || [])[1];
    const airdateMatch = (/<li>Released:\s*<span[^>]*>(.*?)<\/span>/.exec(htmlText) || [])[1];

    return JSON.stringify([{
      description: descriptionMatch ? cleanHtmlSymbols(descriptionMatch) : "Not available",
      aliases: aliasesMatch ? cleanHtmlSymbols(aliasesMatch) : "Not aliases",
      airdate: airdateMatch ? cleanHtmlSymbols(airdateMatch) : "Not available"
    }]);
  } catch (error) {
    console.error("Error fetching details:" + error);
    return [{
      description: "Error loading description",
      aliases: "Not available",
      airdate: "Not available"
    }];
  }
}

async function extractEpisodes(movieUrl) {
    try {
        const response = await fetchv2(movieUrl);
        const htmlText = await response.text();
        const movieIDMatch = (htmlText.match(/<div class="detail-lower"[^>]*id="movie-rating"[^>]*data-id="([^"]+)"/) || [])[1];
        if (!movieIDMatch) {
            return [{
                error: "MovieID not found"
            }];
        }
        const movieData = [{ name: "MovieID", data: movieIDMatch }];
        const tokenResponse = await fetchv2(
            "https://ilovekai.simplepostrequest.workers.dev/ilovethighs",
            {},
            "POST",
            JSON.stringify(movieData)
        );
        const temp = await tokenResponse.json();
        const token = temp[0]?.data;
        const episodeListUrl = `https://1movies.bz/ajax/episodes/list?id=${movieIDMatch}&_=${token}`;
        const episodeListResponse = await fetchv2(episodeListUrl);
        const episodeListData = await episodeListResponse.json();
        const cleanedHtml = cleanJsonHtml(episodeListData.result);
        
        const episodeRegex = /<a[^>]+eid="([^"]+)"[^>]+num="([^"]+)"[^>]*>/g;
        const episodeMatches = [...cleanedHtml.matchAll(episodeRegex)];
        
        const episodeData = episodeMatches.map(([_, episodeToken, episodeNum]) => ({
            name: `Episode ${episodeNum}`,
            data: episodeToken
        }));
        
        console.log(JSON.stringify(episodeData));
        const batchResponse = await fetchv2(
            "https://ilovekai.simplepostrequest.workers.dev/ilovethighs",
            {},
            "POST",
            JSON.stringify(episodeData)
        );
        const batchResults = await batchResponse.json();
        
        const episodes = batchResults.map((result, index) => ({
            number: parseInt(episodeMatches[index][2], 10), 
            href: `https://1movies.bz/ajax/links/list?eid=${episodeMatches[index][1]}&_=${result.data}` 
        }));
        
        return JSON.stringify(episodes);
    } catch (err) {
        console.error("Error fetching episodes:" + err);
        return [{
            number: 1,
            href: "Error fetching episodes"
        }];
    }
}

async function extractStreamUrl(url) {
  try {
    const fetchUrl = `${url}`;
    const response = await fetchv2(fetchUrl);
    const responseData = await response.json();
    const cleanedHtml = cleanJsonHtml(responseData.result);
    
    const server1Regex = /<div class="server wnav-item"[^>]*data-lid="([^"]+)"[^>]*>\s*<span>Server 1<\/span>/;
    const server1Match = server1Regex.exec(cleanedHtml);
    
    if (!server1Match) {
      console.log("Server 1 not found");
      return "error";
    }
    
    const serverId = server1Match[1];
    
    const tokenRequestData = [{ name: "Server1", data: serverId }];
    
    const tokenBatchResponse = await fetchv2(
      "https://ilovekai.simplepostrequest.workers.dev/ilovethighs", 
      {}, 
      "POST", 
      JSON.stringify(tokenRequestData)
    );
    const tokenResults = await tokenBatchResponse.json();
    const token = tokenResults[0]?.data;
    
    if (!token) {
      console.log("Token not found");
      return "error";
    }
    
    const streamUrl = `https://1movies.bz/ajax/links/view?id=${serverId}&_=${token}`;
    const streamResponse = await fetchv2(streamUrl);
    const streamData = await streamResponse.json();
    
    if (!streamData.result) {
      console.log("Stream result not found");
      return "error";
    }
    
    const decryptRequestData = [{ name: "Server1", data: streamData.result }];
    
    const decryptBatchResponse = await fetchv2(
      "https://ilovekai.simplepostrequest.workers.dev/iloveboobs", 
      {}, 
      "POST", 
      JSON.stringify(decryptRequestData)
    );
    const decryptedResponse = await decryptBatchResponse.json();
    const decryptedUrl = decryptedResponse[0]?.data.url;

    const subListEncoded = decryptedUrl.split("sub.list=")[1]?.split("&")[0];
    const subListUrl = decodeURIComponent(subListEncoded);

    const subResponse = await fetchv2(subListUrl);
    const subtitles = await subResponse.json();

    const allSubtitles = (Array.isArray(subtitles) ? subtitles : [])
        .filter(s => s && s.file && s.label)
        .map(s => ({
        label: s.label,
        kind: s.kind || "captions",
        file: String(s.file).replace(/\\\//g, "/")
    }));

    if (!decryptedUrl) {
      console.log("Decryption failed");
      return "error";
    }
    
    const headers = {
      "Referer": "https://1movies.bz/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    };
    
    const mediaResponse = await fetchv2(decryptedUrl.replace("/e/", "/media/"), headers);
    const mediaJson = await mediaResponse.json();
    
    const result = mediaJson?.result;
    if (!result) {
      console.log("Media result not found");
      return "error";
    }
    
    const postData = {
      "text": result,
      "Useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    };
    
    const finalResponse = await fetchv2("https://ilovekai.simplepostrequest.workers.dev/ilovebush", {}, "POST", JSON.stringify(postData));
    const finalJson = await finalResponse.json();

    const m3u8Link = finalJson?.result?.sources?.[0]?.file;

    const returnValue = {
            stream: m3u8Link,
            subtitles: allSubtitles
    };
    console.log(JSON.stringify(returnValue));
    return JSON.stringify(returnValue);
  } catch (error) {
    console.log("Fetch error:"+ error);
    return "https://error.org";
  }
}

function cleanHtmlSymbols(string) {
  if (!string) {
    return "";
  }
  return string
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#[0-9]+;/g, "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanJsonHtml(jsonHtml) {
  if (!jsonHtml) {
    return "";
  }
  return jsonHtml
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

function decodeHtmlEntities(text) {
  if (!text) {
    return "";
  }
  return text
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}