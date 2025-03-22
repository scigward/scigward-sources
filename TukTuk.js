const TukTukCinema = {
    id: "tuktukcinema",
    name: "TukTukCinema",
    version: "1.0.1",
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
            const title = el.querySelector(".title a").textContent.trim();
            const link = el.querySelector(".title a").href;
            const image = el.querySelector("img").src;

            results.push({
                title: title,
                url: link,
                image: image
            });
        });

        return results;
    },

    async getMovie(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const title = doc.querySelector("h1.entry-title").textContent.trim();
        const image = doc.querySelector(".poster img").src;
        const videoFrame = doc.querySelector("iframe");

        return {
            title: title,
            image: image,
            video: videoFrame ? videoFrame.src : null
        };
    },

    async getEpisodes(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const episodes = [];
        const elements = doc.querySelectorAll(".episodes-list a");

        elements.forEach(el => {
            episodes.push({
                title: el.textContent.trim(),
                url: el.href
            });
        });

        return episodes;
    },

    async getVideo(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const iframe = doc.querySelector("iframe");
        return {
            url: iframe ? iframe.src : null
        };
    },

    // New method to get servers list
    async getServers(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const servers = [];
        const serverItems = doc.querySelectorAll(".watch--servers--list .server--item");

        serverItems.forEach(item => {
            const serverName = item.querySelector("span").textContent.trim();
            const serverLink = item.getAttribute("data-link");
            
            servers.push({
                name: serverName,
                link: serverLink
            });
        });

        return servers;
    }
};

export default TukTukCinema;
