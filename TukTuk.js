const baseUrl = "https://www.tuktukcinma.com";

async function search(query) {
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`🔍 Searching URL: ${searchUrl}`);

    const res = await fetch(searchUrl);
    console.log(`📡 Response Status: ${res.status}`);

    if (!res.ok) {
        console.log("❌ Failed to fetch search results.");
        return [];
    }

    const html = await res.text();
    console.log(`📜 HTML Length: ${html.length}`);

    const doc = new DOMParser().parseFromString(html, "text/html");

    const results = [];
    const items = doc.querySelectorAll(".result-item");
    console.log(`🛠 Found ${items.length} search results.`);

    items.forEach((item, index) => {
        const title = item.querySelector(".title")?.textContent.trim();
        const link = item.querySelector("a")?.href;
        const image = item.querySelector("img")?.src;

        console.log(`📌 Result ${index + 1}: ${title}, ${link}, ${image}`);

        if (title && link) {
            results.push({ title, link, image });
        }
    });

    return results;
}

async function getAnimeDetails(url) {
    console.log(`📥 Fetching anime details from: ${url}`);

    const res = await fetch(url);
    console.log(`📡 Response Status: ${res.status}`);

    if (!res.ok) {
        console.log("❌ Failed to fetch anime details.");
        return null;
    }

    const html = await res.text();
    console.log(`📜 HTML Length: ${html.length}`);

    const doc = new DOMParser().parseFromString(html, "text/html");

    const title = doc.querySelector("h1.entry-title")?.textContent.trim();
    const image = doc.querySelector(".anime-thumbnail img")?.src;
    const description = doc.querySelector(".entry-content p")?.textContent.trim();
    const episodes = [];

    const episodeElements = doc.querySelectorAll(".episodiotitle a");
    console.log(`📺 Found ${episodeElements.length} episodes.`);

    episodeElements.forEach((episode, index) => {
        const episodeTitle = episode.textContent.trim();
        const episodeLink = episode.href;
        console.log(`🎬 Episode ${index + 1}: ${episodeTitle}, ${episodeLink}`);

        episodes.push({ title: episodeTitle, link: episodeLink });
    });

    return { title, image, description, episodes };
}

async function getEpisodeVideo(url) {
    console.log(`📥 Fetching episode video from: ${url}`);

    const res = await fetch(url);
    console.log(`📡 Response Status: ${res.status}`);

    if (!res.ok) {
        console.log("❌ Failed to fetch episode video.");
        return null;
    }

    const html = await res.text();
    console.log(`📜 HTML Length: ${html.length}`);

    const doc = new DOMParser().parseFromString(html, "text/html");

    const videoIframe = doc.querySelector("iframe");
    const videoUrl = videoIframe ? videoIframe.src : null;

    console.log(`🎥 Video URL: ${videoUrl}`);

    return videoUrl;
}
