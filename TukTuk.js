const baseUrl = "https://www.tuktukcinma.com";

async function search(query) {
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`🔍 Searching for: ${query}`);
    console.log(`🔗 Search URL: ${searchUrl}`);

    try {
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

        if (items.length === 0) {
            console.log("⚠️ No results found. The HTML structure might have changed.");
        }

        items.forEach((item, index) => {
            console.log(`🔹 Processing result ${index + 1}...`);

            const titleElement = item.querySelector(".title");
            const linkElement = item.querySelector("a");
            const imageElement = item.querySelector("img");

            if (!titleElement || !linkElement) {
                console.log(`❗ Missing title or link for result ${index + 1}`);
                return;
            }

            const title = titleElement.textContent.trim();
            const link = linkElement.href;
            const image = imageElement ? imageElement.src : null;

            console.log(`📌 Result ${index + 1}:`);
            console.log(`   🏷 Title: ${title}`);
            console.log(`   🔗 Link: ${link}`);
            console.log(`   🖼 Image: ${image}`);

            results.push({ title, link, image });
        });

        return results;
    } catch (error) {
        console.error("🚨 Error during search:", error);
        return [];
    }
}

(async () => {
    const query = "One Piece"; // Change this for testing
    console.log("🔄 Starting search test...");
    const results = await search(query);
    console.log("✅ Search completed.");
    console.log(results);
})();
