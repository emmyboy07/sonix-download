const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

const BASE_URL = "https://netupserver.com/film/";

// Custom User-Agent to bypass bot detection
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

// Ensure URLs are absolute
function ensureAbsoluteUrl(url, base) {
    if (!url.startsWith("http")) {
        return new URL(url, base).href;
    }
    return url;
}

// Fetch movie download options & subtitles
async function getMovieOptions(year, title) {
    try {
        const movieUrl = `${BASE_URL}${year}/`;
        const response = await axios.get(movieUrl, { headers: HEADERS });
        const $ = cheerio.load(response.data);

        let movieLinks = {};
        $("a").each((_, el) => {
            let name = $(el).text().trim().toLowerCase().replace(/\s+/g, "");
            let href = $(el).attr("href");
            if (href) {
                movieLinks[name] = ensureAbsoluteUrl(href, movieUrl);
            }
        });

        // Normalize movie title
        let formattedTitle = title.toLowerCase().replace(/\s+/g, "");
        let foundMovieUrl = movieLinks[formattedTitle];

        if (!foundMovieUrl) return { error: "Movie not found" };

        // Fetch the movie page
        const movieResponse = await axios.get(foundMovieUrl, { headers: HEADERS });
        const $$ = cheerio.load(movieResponse.data);

        let availableOptions = {};
        let subtitles = [];

        $$("a").each((_, el) => {
            let href = $$(el).attr("href");
            if (href) {
                href = ensureAbsoluteUrl(href, foundMovieUrl);
                if (href.endsWith(".mp4")) {
                    if (href.includes("480p")) availableOptions["480p"] = href;
                    else if (href.includes("720p")) availableOptions["720p"] = href;
                    else if (href.includes("1080p")) availableOptions["1080p"] = href;
                    else if (href.includes("4K")) availableOptions["4K"] = href;
                } else if (href.endsWith(".srt")) {
                    subtitles.push(href);
                }
            }
        });

        return {
            movie_name: title,
            available_options: availableOptions,
            subtitles: subtitles.length ? subtitles : "No subtitles found",
        };
    } catch (error) {
        return { error: "Failed to fetch movie data", details: error.message };
    }
}

// API to check for available movie resolutions
app.get("/check_movie", async (req, res) => {
    const { year, title } = req.query;

    if (!year || !title) {
        return res.status(400).json({ error: "Missing title or year" });
    }

    const movieData = await getMovieOptions(year, title);

    if (movieData.error) {
        return res.status(404).json(movieData);
    }

    res.json(movieData);
});

// API to get the final movie link
app.get("/get_movie_link", async (req, res) => {
    const { year, title, resolution } = req.query;

    if (!year || !title || !resolution) {
        return res.status(400).json({ error: "Missing title, year, or resolution" });
    }

    const movieData = await getMovieOptions(year, title);

    if (movieData.error) {
        return res.status(404).json(movieData);
    }

    if (!movieData.available_options[resolution]) {
        return res.status(400).json({ error: "Resolution not available" });
    }

    res.json({ movie_link: movieData.available_options[resolution] });
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://127.0.0.1:${PORT}`);
});
