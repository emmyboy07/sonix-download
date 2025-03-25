const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

let browser;

// Start Puppeteer browser instance
async function startBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: "new",  // Use Puppeteer's built-in Chromium
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu"
            ],
        });
    }
}

app.listen(PORT, async () => {
    await startBrowser();
    console.log(`✅ Server is running on http://127.0.0.1:${PORT}`);
});

// Get available download options
async function getMovieOptions(year, title) {
    await startBrowser();
    const page = await browser.newPage();

    try {
        // Block images & unnecessary resources for speed
        await page.setRequestInterception(true);
        page.on("request", (req) => {
            if (["image", "stylesheet", "font"].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Open the year folder
        const movieUrl = `${BASE_URL}${year}/`;
        await page.goto(movieUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("a");

        // Extract movie names & links
        const movieLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a"));
            return links.map(link => ({
                name: link.textContent.trim(),
                url: link.href
            }));
        });

        if (movieLinks.length === 0) {
            await page.close();
            return null;
        }

        // Handle space differences
        const formattedTitle = title.replace(/\s+/g, "").toLowerCase();
        const foundMovie = movieLinks.find(movie => 
            movie.name.replace(/\s+/g, "").toLowerCase() === formattedTitle
        );

        if (!foundMovie) {
            await page.close();
            return null;
        }

        // Open movie folder
        await page.goto(foundMovie.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("a");

        // Extract available resolutions
        const availableOptions = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a"));
            const movieOptions = {};

            links.forEach(link => {
                const href = link.href;
                if (href.endsWith(".mp4")) {
                    let resolution = "Unknown";
                    if (href.includes("480p")) resolution = "480p";
                    else if (href.includes("720p")) resolution = "720p";
                    else if (href.includes("1080p")) resolution = "1080p";
                    else if (href.includes("4K")) resolution = "4K";

                    movieOptions[resolution] = href;
                }
            });

            return movieOptions;
        });

        await page.close();
        return { movie_name: foundMovie.name, available_options: availableOptions };
    } catch (error) {
        await page.close();
        return { error: "An error occurred while fetching movie data" };
    }
}

// API to check for available movie resolutions
app.get("/check_movie", async (req, res) => {
    const { year, title } = req.query;

    if (!year || !title) {
        return res.status(400).json({ error: "Missing title or year" });
    }

    const movieData = await getMovieOptions(year, title);

    if (!movieData) {
        return res.status(404).json({ error: "Download unavailable" });
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

    if (!movieData) {
        return res.status(404).json({ error: "Download unavailable" });
    }

    if (!movieData.available_options[resolution]) {
        return res.status(400).json({ error: "Resolution not available" });
    }

    res.json({ movie_link: movieData.available_options[resolution] });
});

app.listen(PORT, async () => {
    await startBrowser();
    console.log(`✅ Server is running on port ${PORT}`);
});

