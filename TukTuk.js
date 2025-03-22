const TukTukCinema = {
    id: "tuktukcinema",
    name: "TukTukCinema",
    icon: "🌐",
    description: "Provider for tuktukcinma.com",
    version: "1.0.0",
    domains: ["tuktukcinma.com"],
    baseUrl: "https://www.tuktukcinma.com",

    // Search function
    async search(query) {
        const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const document = parser.parseFromString(html, "text/html");

        let results = [];
        document.querySelectorAll(".gridlove-box a").forEach(element => {
            let title = element.querySelector(".entry-title")?.textContent.trim() || "";
            let url = element.href;
            let image = element.querySelector("img")?.src || "";
            results.push({ title, url, image });
        });

        return results;
    },

    // Fetch latest movies
    async latest(page = 1) {
        const url = `${this.baseUrl}/category/movies/page/${page}/`;
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const document = parser.parseFromString(html, "text/html");

        let latestMovies = [];
        document.querySelectorAll(".gridlove-box a").forEach(element => {
            let title = element.querySelector(".entry-title")?.textContent.trim() || "";
            let url = element.href;
            let image = element.querySelector("img")?.src || "";
            latestMovies.push({ title, url, image });
        });

        return latestMovies;
    },

    // Fetch movie details
    async detail(url) {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const document = parser.parseFromString(html, "text/html");

        let title = document.querySelector(".entry-title")?.textContent.trim() || "Unknown";
        let image = document.querySelector(".entry-thumb img")?.src || "";
        let description = document.querySelector(".entry-content p")?.textContent.trim() || "No description available";
        let genres = [...document.querySelectorAll(".post-cats a")].map(el => el.textContent.trim());

        return { title, image, description, genres };
    },

    // Extract streaming links
    async getStreams(url) {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const document = parser.parseFromString(html, "text/html");

        let streamLinks = [];
        document.querySelectorAll("iframe").forEach(iframe => {
            let link = iframe.src;
            if (link) {
                streamLinks.push({ url: link, quality: "HD" });
            }
        });

        return streamLinks;
    }
};

export default TukTukCinema;
