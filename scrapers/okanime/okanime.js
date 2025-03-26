async function testSearch() {
    const searchUrl = "https://okanime.tv/search?search=One+Piece";

    console.log("Fetching search results...");

    try {
        const response = await fetchv2(searchUrl); // Fetch the page
        const html = await response.text(); // Get HTML as text
        
        console.log("Fetched HTML:", html.slice(0, 500)); // Print first 500 chars for debugging
    } catch (error) {
        console.error("Error fetching search results:", error);
    }
}

testSearch();
