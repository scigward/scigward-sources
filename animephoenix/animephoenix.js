async function searchResults(keyword) {
  const results = [];
  try {
    const url =
      "https://anime-phoenix.com/?s=" +
      encodeURIComponent(keyword) +
      "&ajax_search=true";

    const response = await fetchv2(url);
    const html = await response.text();

    const cleanText = (s) =>
      String(s || "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const regex =
      /<div\s+class="common_card">[\s\S]*?<div\s+class="image-box[^"]*">[\s\S]*?<a(?=[^>]*\shref="([^"]+)")(?=[^>]*\bclass="[^"]*\bd-block\b")[^>]*>[\s\S]*?<img(?=[^>]*\ssrc="([^"]+)")(?=[^>]*\salt="([^"]*)")[^>]*>[\s\S]*?<div\s+class="css_prefix-detail-part">[\s\S]*?<h6[^>]*>[\s\S]*?<a(?=[^>]*\shref="([^"]+)")(?=[^>]*\bclass="[^"]*\bcolor-inherit\b")[^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const imageHref = match[1].trim();
      const imageSrc = match[2].trim();
      const imageAlt = cleanText(match[3]);
      const titleHref = match[4].trim();
      const titleText = cleanText(match[5]);

      results.push({
        title: titleText || imageAlt,
        image: imageSrc,
        href: titleHref || imageHref,
      });
    }

    return JSON.stringify(results);
  } catch (err) {
    return JSON.stringify([
      { title: "Error", image: "Error", href: "Error" },
    ]);
  }
}

async function extractDetails(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();

    const clean = (s) => (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

    const d = html.match(
      /<p[^>]*class="[^"]*\b(?:movie-description|tvshow-description)\b[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*\breadmore-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i
    );
    const description = d ? clean(d[1]) : "No description available";

    const y = html.match(
      /<ul[^>]*class="[^"]*\b(?:movie-metalist|tvshow-metalist)\b[^"]*"[\s\S]*?<span[^>]*class="[^"]*\bfw-medium\b[^"]*"[^>]*>\s*(\d{4})\s*<\/span>/i
    );
    const airdate = y ? y[1] : "Unknown";

    const block = html.match(
      /<ul[^>]*class="[^"]*\b(?:movie-geners|tvshow-geners)\b[^"]*"[\s\S]*?<\/ul>/i
    );

    const aliases = [];
    if (block) {
      const a = /<a[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = a.exec(block[0])) !== null) aliases.push(clean(m[1]));
    }

    return JSON.stringify({ description, aliases, airdate });
  } catch (error) {
    console.log("Details error:", error);
    return JSON.stringify({
      description: "Error loading description",
      aliases: [],
      airdate: "Unknown",
    });
  }
}

async function extractEpisodes(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();

    if (/\/movies\//i.test(url)) {
      const m = html.match(
        /<div[^>]*class="FJ-actions-wrapper"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*class="[^"]*\bFJ-action-btn\b[^"]*\bFJ-btn-primary\b[^"]*"[\s\S]*?<span>\s*إبدأ المشاهدة\s*<\/span>/i
      );
      return JSON.stringify(m ? [{ href: m[1].trim(), number: 1 }] : []);
    }

    const s = html.match(/<script[^>]*id="fj-episodes-script-js-extra"[^>]*>[\s\S]*?<\/script>/i);
    const src = s ? s[0] : html;

    const results = [];
    const regex = /"id"\s*:\s*(\d+)[\s\S]*?"permalink"\s*:\s*"([^"]+)"/g;

    let match;
    while ((match = regex.exec(src)) !== null) {
      results.push({
        href: match[2].replace(/\\\//g, "/").trim(),
        number: parseInt(match[1], 10)
      });
    }

    return JSON.stringify(results);
  } catch (error) {
    console.log("Fetch error:", error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();

    const decode = (s) =>
      (s || "")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

    const clean = (s) => (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

    const streams = [];
    const regex =
      /data-server="([^"]+)"[^>]*data-server-index="(\d+)"[\s\S]*?<span[^>]*class="[^"]*\bserver-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const dataServer = decode(match[1]);
      const idx = match[2];
      const label = clean(match[3]) || `Server ${idx}`;

      let obj;
      try {
        obj = JSON.parse(dataServer);
      } catch (e) {
        continue;
      }

      let streamUrl = obj.link || "";
      if (obj.type === "iframe") {
        const iframeSrc = (streamUrl.match(/src="([^"]+)"/i) || [])[1];
        streamUrl = iframeSrc || "";
      }

      streamUrl = (streamUrl || "").replace(/\\\//g, "/").trim();
      if (!streamUrl) continue;

      streams.push({ title: label, streamUrl, headers: {} });
    }

    return JSON.stringify({ streams });
  } catch (error) {
    console.log("Fetch error:", error);
    return JSON.stringify({ streams: [] });
  }
}
