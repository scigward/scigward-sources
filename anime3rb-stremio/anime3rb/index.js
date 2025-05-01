const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const builder = new addonBuilder({
    id: 'anime3rb',
    version: '1.0.0',
    name: 'Anime3rb Scraper',
    description: 'Scrapes anime content with arabic subtitles from anime3rb.com',
    resources: ['stream', 'meta', 'catalog'],
    types: ['anime'],
    idPrefixes: ['anime3rb']
});

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'"
    };
    return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, match => entities[match]);
}

// Catalog search function
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    try {
        if (extra && extra.search) {
            // Handle search requests
            const searchQuery = extra.search.replace(/\s+/g, '+');
            const response = await axios.get(`https://anime3rb.com/search?q=${searchQuery}`);
            const results = searchResults(response.data);
            
            const metas = results.map(item => ({
                id: `anime3rb:${item.href.split('/titles/')[1]}`,
                type: 'series',
                name: item.title,
                poster: item.image,
                posterShape: 'regular',
                banner: item.image
            }));
            
            return { metas };
        } else {
            // Handle regular catalog requests (popular/top etc)
            const response = await axios.get('https://anime3rb.com/');
            const results = searchResults(response.data);
            
            const metas = results.map(item => ({
                id: `anime3rb:${item.href.split('/titles/')[1]}`,
                type: 'series',
                name: item.title,
                poster: item.image,
                posterShape: 'regular',
                banner: item.image
            }));
            
            return { metas };
        }
    } catch (error) {
        console.error('Catalog error:', error);
        return { metas: [] };
    }
});

// Metadata handler
builder.defineMetaHandler(async ({ type, id }) => {
    if (!id.startsWith('anime3rb:')) return null;
    
    try {
        const animeSlug = id.replace('anime3rb:', '');
        const response = await axios.get(`https://anime3rb.com/titles/${animeSlug}`);
        const details = extractDetails(response.data);
        
        if (details.length === 0) return null;
        
        // Extract episodes
        const episodes = extractEpisodes(response.data);
        const videos = episodes.map(ep => ({
            id: `anime3rb:${animeSlug}:${ep.number}`,
            title: `Episode ${ep.number}`,
            released: new Date(details[0].airdate).toISOString()
        }));
        
        const meta = {
            id: id,
            type: 'series',
            name: animeSlug.split('-').join(' '),
            description: details[0].description,
            releaseInfo: details[0].airdate,
            genres: details[0].aliases.split(', '),
            poster: `https://anime3rb.com/titles/${animeSlug}/poster.jpg`,
            posterShape: 'regular',
            background: `https://anime3rb.com/titles/${animeSlug}/background.jpg`,
            videos: videos
        };
        
        return { meta };
    } catch (error) {
        console.error('Meta error:', error);
        return null;
    }
});

// Stream handler
builder.defineStreamHandler(async ({ type, id }) => {
    if (!id.startsWith('anime3rb:')) return null;
    
    try {
        const parts = id.split(':');
        const animeSlug = parts[1];
        const episodeNum = parts[2] || '1';
        
        const response = await axios.get(`https://anime3rb.com/episode/${animeSlug}/${episodeNum}`);
        const streamUrl = await extractStreamUrl(response.data);
        
        if (!streamUrl) return null;
        
        const streams = JSON.parse(streamUrl).streams;
        const streamResults = [];
        
        for (let i = 0; i < streams.length; i += 2) {
            streamResults.push({
                title: `${streams[i]} Quality`,
                url: streams[i+1],
                behaviorHints: {
                    notWebReady: true
                }
            });
        }
        
        return { streams: streamResults };
    } catch (error) {
        console.error('Stream error:', error);
        return null;
    }
});

// The regex-based functions from your original code (updated for new URL structure)
function searchResults(html) {
    const results = [];

    const titleRegex = /<h2[^>]*>(.*?)<\/h2>/;
    const hrefRegex = /<a\s+href="([^"]+)"\s*[^>]*>/;
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/;

    const itemRegex = /<div class="my-2 w-64[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
       const titleMatch = itemHtml.match(titleRegex);
       const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

       const hrefMatch = itemHtml.match(hrefRegex);
       const href = hrefMatch ? hrefMatch[1].trim() : '';

       const imgMatch = itemHtml.match(imgRegex);
       const imageUrl = imgMatch ? imgMatch[1].trim() : '';

       if (title && href && href.includes('/titles/')) {
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

  const containerMatch = html.match(/<div class="py-4 flex flex-col gap-2">\s*((?:<p class="sm:text-\[1\.04rem\] leading-loose text-justify">[\s\S]*?<\/p>\s*)+)<\/div>/);

  let description = "";
  if (containerMatch) {
    const pBlock = containerMatch[1];

    const pRegex = /<p class="sm:text-\[1\.04rem\] leading-loose text-justify">([\s\S]*?)<\/p>/g;
    const matches = [...pBlock.matchAll(pRegex)]
      .map(m => m[1].trim())
      .filter(text => text.length > 0); 

    description = decodeHTMLEntities(matches.join("\n\n")); 
  }

  const airdateMatch = html.match(/<td[^>]*title="([^"]+)">[^<]+<\/td>/);
  let airdate = airdateMatch ? airdateMatch[1].trim() : "";

  const genres = [];
  const aliasesMatch = html.match(
    /<div\s+class="flex flex-wrap gap-2 lg:gap-4 text-sm sm:text-\[\.94rem\] -mt-2 mb-4">([\s\S]*?)<\/div>/
  );
  const inner = aliasesMatch ? aliasesMatch[1] : "";

  const anchorRe = /<a[^>]*class="btn btn-md btn-plain !p-0"[^>]*>([^<]+)<\/a>/g;
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

function extractEpisodes(html) {
    const episodes = [];
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>[\s\S]*?الحلقة\s+(\d+)[\s\S]*?<\/a>/gi;
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
        const sourceMatch = html.match(/data-video-source="([^"]+)"/);
        let embedUrl = sourceMatch?.[1]?.replace(/&amp;/g, '&');
        if (!embedUrl) return null;
    
        const cinemaMatch = html.match(/url\.searchParams\.append\(\s*['"]cinema['"]\s*,\s*(\d+)\s*\)/);
        const lastMatch = html.match(/url\.searchParams\.append\(\s*['"]last['"]\s*,\s*(\d+)\s*\)/);
        const cinemaNum = cinemaMatch ? cinemaMatch[1] : undefined;
        const lastNum = lastMatch ? lastMatch[1] : undefined;
    
        if (cinemaNum) embedUrl += `&cinema=${cinemaNum}`;
        if (lastNum) embedUrl += `&last=${lastNum}`;
        embedUrl += `&next-image=undefined`;
    
        console.log('Full embed URL:', embedUrl);
    
        const response = await axios.get(embedUrl);
        const data = response.data;
        console.log('Embed page HTML:', data);

        const qualities = extractQualities(data);

        const epMatch = html.match(/<title>[^<]*الحلقة\s*(\d+)[^<]*<\/title>/);
        const currentEp = epMatch ? Number(epMatch[1]) : null;
    
        let nextEpNum, nextDuration, nextSubtitle;
        if (currentEp !== null) {
            const episodeRegex = new RegExp(
                `<a[^>]+href="[^"]+/episode/[^/]+/(\\d+)"[\\s\\S]*?` +
                `<span[^>]*>([^<]+)<\\/span>[\\s\\S]*?` +
                `<p[^>]*>([^<]+)<\\/p>`,
                'g'
            );
            let m;
            while ((m = episodeRegex.exec(html)) !== null) {
                const num = Number(m[1]);
                if (num > currentEp) {
                    nextEpNum = num;
                    nextDuration = m[2].trim();
                    nextSubtitle = m[3].trim();
                    break;
                }
            }
        }

        if (nextEpNum != null) {
            embedUrl += `&next-title=${encodeURIComponent(nextDuration)}`;
            embedUrl += `&next-sub-title=${encodeURIComponent(nextSubtitle)}`;
        }

        const result = {
            streams: qualities,
        }
    
        console.log(JSON.stringify(result));
        return JSON.stringify(result);
    } catch (err) {
        console.error(err);
        return null;
    }
}
  
function extractQualities(html) {
    const match = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];
    
    const raw = match[1];
    const regex = /\{\s*src:\s*'([^']+)'\s*[^}]*label:\s*'([^']*)'/g;
    const list = [];
    let m;

    while ((m = regex.exec(raw)) !== null) {
        list.push(m[2], m[1]);
    }
    
    return list;
}

module.exports = builder.getInterface();