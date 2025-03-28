searchResults(html) {
    const results = [];

    // Adapting regex patterns for animerco.org search results
    // Based on observed search results page structure
    const titleRegex = /<div class="title"[^>]*>(.*?)<\/div>/;
    const hrefRegex = /<a\s+href="([^"]+)"\s*[^>]*>/;
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/;
    
    // Item container pattern for animerco.org
    const itemRegex = /<div class="relative(.*?)<div class="title".*?<\/div>/gs;
    const items = html.match(itemRegex) || [];
    
    items.forEach((itemHtml) => {
       const titleMatch = itemHtml.match(titleRegex);
       const title = titleMatch ? titleMatch[1].trim() : '';
       
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

   // Adapting regex patterns for animerco.org anime details
   const descriptionMatch = html.match(/<p class="text">([\s\S]*?)<\/p>/);
   let description = descriptionMatch ? descriptionMatch[1].trim() : '';

   // For air date - animerco uses a different format
   const airdateMatch = html.match(/<span[^>]*>(\d{4})<\/span>/);
   let airdate = airdateMatch ? airdateMatch[1].trim() : '';

   if (description || airdate) {
       details.push({
           description: description,
           aliases: 'N/A',
           airdate: airdate
       });
   }
   console.log(details);
   return details;
}

function extractEpisodes(html) {
    const episodes = [];
    // Adapting the episodes regex pattern for animerco.org
    // Animerco uses a different URL structure and episode text format
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episodes\/[^"]*?)"[^>]*>[\s\S]*?الحلقة\s+(\d+)[\s\S]*?<\/a>/gi;
    const plainTextRegex = /الحلقة\s+(\d+)/g;

    let matches;

    if ((matches = html.match(htmlRegex))) {
        matches.forEach(link => {
            const hrefMatch = link.match(/href="([^"]+)"/);
            const numberMatch = link.match(/الحلقة\s+(\d+)/);
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

async function extractStreamUrl(html) {
    try {
        // Adapting the stream URL regex pattern for animerco.org
        // Animerco uses a different source attribute pattern
        const sourceMatch = html.match(/data-src="([^"]+)"/);
        const embedUrl = sourceMatch?.[1]?.replace(/&amp;/g, '&');
        if (!embedUrl) return null;

        // For MP4Upload, we want to directly return the embed URL instead of navigating to it
        if (embedUrl.includes('mp4upload.com')) {
            return embedUrl;
        }
        
        // For YourUpload, same approach
        if (embedUrl.includes('yourupload.com')) {
            return embedUrl;
        }
        
        // For other providers, we attempt to extract the direct video URL
        const response = await fetch(embedUrl);
        const data = await response;
        const videoUrl = data.match(/src:\s*'(https:\/\/[^']+\.mp4[^']*)'/)?.[1];
        console.log(videoUrl);
        return videoUrl || embedUrl; // Fall back to embed URL if no direct URL found
    } catch (error) {
        console.error('Error extracting stream URL:', error);
        return null;
    }
}
