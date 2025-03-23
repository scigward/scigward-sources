const TukTukCinema = {
    id: "tuktukcinema",
    name: "TukTukCinema",
    version: "1.1.0",
    icon: "https://raw.githubusercontent.com/scigward/TukTukScraper/refs/heads/main/tuktuk.png",
    baseUrl: "https://www.tuktukcinma.com",
    searchUrl: "https://www.tuktukcinma.com/?s={query}",

    async search(query) {
        const url = this.searchUrl.replace("{query}", encodeURIComponent(query));
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const results = [];
        const elements = doc.querySelectorAll(".result-item");

        elements.forEach(el => {
            const titleEl = el.querySelector(".title a");
            const imageEl = el.querySelector("img");

            results.push({
                title: titleEl.textContent.trim(),
                url: titleEl.href,
                image: imageEl ? imageEl.src : null
            });
        });

        return results;
    },

    async getMovie(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const title = doc.querySelector("h1.entry-title").textContent.trim();
        const image = doc.querySelector(".poster img")?.src;

        const episodes = [];
        doc.querySelectorAll(".episodios a").forEach(ep => {
            episodes.push({
                title: ep.textContent.trim(),
                url: ep.href
            });
        });

        return {
            title: title,
            image: image,
            episodes: episodes
        };
    },

    async getVideo(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const iframe = doc.querySelector("iframe");
        return {
            url: iframe ? iframe.src : null
        };
    }
};

// Ensure it's accessible if needed
globalThis.TukTukCinema = TukTukCinema;
