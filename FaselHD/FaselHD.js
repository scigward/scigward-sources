async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://www.faselhds.center/?s=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];

        const itemRegex = /<div class="col-xl-2 col-lg-2 col-md-3 col-sm-3">\s*<div class="postDiv[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]+)"/g;
        let match;

        while ((match = itemRegex.exec(responseText)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = decodeHTMLEntities(match[3].trim());
            results.push({ title, href, image });
        }

        console.log(results);
        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error in searchResults:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    const results = [];
  
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descriptionMatch = html.match(/<div class="singleDesc">\s*<p>([\s\S]*?)<\/p>/i);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';

        const airdateMatch = html.match(/<i class="far fa-calendar-alt"><\/i>\s*موعد الصدور : (\d{4})/i);
        const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

        const aliasContainerMatch = html.match(/<i class="far fa-folders"><\/i>\s*تصنيف المسلسل : ([\s\S]*?)<\/span>/i);
        const aliases = [];

        if (aliasContainerMatch && aliasContainerMatch[1]) {
            const aliasText = aliasContainerMatch[1];
            const aliasMatches = [...aliasText.matchAll(/>([^<]+)</g)];
            aliasMatches.forEach(match => {
                aliases.push(decodeHTMLEntities(match[1].trim()));
            });
        }

        results.push({
            description: description,
            aliases: aliases.length ? aliases.join(', ') : 'N/A',
            airdate: airdate
        });

        return JSON.stringify(results);

    } catch (error) {
        console.error('Error extracting details:', error);
        return JSON.stringify([{
            description: 'N/A',
            aliases: 'N/A',
            airdate: 'N/A'
        }]);
    }
}

async function extractEpisodes(url) {
  try {
    const BaseUrl = 'https://faselhds.center';
    const pageResponse = await fetchv2(url);
    const html = typeof pageResponse === 'object' ? await pageResponse.text() : pageResponse;

    const episodes = [];

    if (
      url.includes('/movies/') ||
      url.includes('/anime-movies/') ||
      url.includes('/asian-movies/') ||
      url.includes('/dubbed-movies/')
    ) {
      episodes.push({ number: 1, href: url });
      return JSON.stringify(episodes);
    }

    const seasonRegex = /<div\s+class="seasonDiv[^"]*"\s+onclick="window\.location\.href\s*=\s*'\/\?p=(\d+)'"/g;
    const seasonUrls = [];
    let match;
    while ((match = seasonRegex.exec(html)) !== null) {
      const postId = match[1];
      const fullUrl = `${BaseUrl}/?p=${postId}`;
      seasonUrls.push(fullUrl);
    }

    const episodeRegex = /<a href="([^"]+)"[^>]*>\s*الحلقة\s+(\d+)\s*<\/a>/g;

    if (seasonUrls.length === 0) {
      for (const match of html.matchAll(episodeRegex)) {
        episodes.push({
          number: parseInt(match[2]),
          href: match[1],
        });
      }
    } else {
      const seasonResponses = await Promise.all(
        seasonUrls.map(url => fetchv2(url))
      );

      const seasonHtmls = await Promise.all(
        seasonResponses.map(res => typeof res === 'object' ? res.text() : res)
      );

      for (const seasonHtml of seasonHtmls) {
        for (const match of seasonHtml.matchAll(episodeRegex)) {
          episodes.push({
            number: parseInt(match[2]),
            href: match[1],
          });
        }
      }
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.error("extractEpisodes failed:", error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  const response = await fetchv2(url);
  const html = await response.text();

  const serverMatch = html.match(
    /<li[^>]*onclick="player_iframe\.location\.href\s*=\s*'([^']+)'[^>]*>\s*<a[^>]*>\s*<i[^>]*><\/i>\s*سيرفر المشاهدة #01\s*<\/a>/
  );
  if (!serverMatch) throw new Error("Server link not found");
  
  const embedResponse = await fetchv2(serverMatch[1]);
  const streamUrls = extractM3U8Urls(await embedResponse.text());
  if (!streamUrls.length) throw new Error("No streams found");
  
  console.log('Found streams:', streamUrls);
  return streamUrls[0];
}

function extractM3U8Urls(html) {
  const offsetMatch = html.match(/parseInt\(atob\([^)]+\)\[[^\]]+\]\(\/\\D\/g,''\)\)\s*-\s*(\d+)\)/);
  if (!offsetMatch) return [];
  const offset = parseInt(offsetMatch[1], 10);
  console.log('Found offset:', offset);

  const arrayMatch = html.match(/var\s+hide_my_HTML_\w+\s*=\s*((?:'[^']*'(?:\s*\+\s*'[^']*')*\s*);)/);
  console.log('Array match found:', !!arrayMatch);
  if (!arrayMatch) return [];
  
  let decoded = '';
  const segments = arrayMatch[1]
    .replace(/'|\s/g, '')
    .replace(/\++/g, '')
    .split('.')
    .filter(Boolean);

  for (const seg of segments) {
    try {
      const padded = seg + '='.repeat((4 - seg.length % 4) % 4);
      const num = parseInt(atob(padded).replace(/\D/g, ''), 10);
      if (!isNaN(num)) decoded += String.fromCharCode(num - offset);
    } catch {}
  }

  const urls = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8\b/gi) || [];
  return [...new Set(urls)];
}

function decodeHTMLEntities(text) {
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

    const entities = {
        '&quot;': '"',
        '&amp;': '&',
        '&apos;': "'",
        '&lt;': '<',
        '&gt;': '>'
    };

    for (const entity in entities) {
        text = text.replace(new RegExp(entity, 'g'), entities[entity]);
    }

    return text;
}
