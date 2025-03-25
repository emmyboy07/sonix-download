import os
import time
from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

app = Flask(__name__)
PORT = int(os.environ.get("PORT", 5000))

BASE_URL = "https://netupserver.com/film/"

# Configure Chrome options
chrome_options = Options()
chrome_options.add_argument("--headless")  # Run Chrome in headless mode
chrome_options.add_argument("--no-sandbox")  # Required for running on Render
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--disable-setuid-sandbox")
chrome_options.add_argument("--blink-settings=imagesEnabled=false")  # ✅ Block images for speed
chrome_options.add_argument("--disable-blink-features=AutomationControlled")  # ✅ Prevent detection
chrome_options.add_argument("--log-level=3")  # ✅ Reduce logging output

# Start the WebDriver
service = Service(ChromeDriverManager().install())
browser = webdriver.Chrome(service=service, options=chrome_options)


def get_movie_options(year, title):
    """Scrape movie download options + subtitles (.srt) using Selenium"""
    try:
        browser.get(f"{BASE_URL}{year}/")
        browser.implicitly_wait(3)  # ✅ Use implicit wait instead of sleep

        # Get all movie links efficiently
        movie_links = browser.find_elements(By.TAG_NAME, "a")
        movies = {link.text.strip().lower().replace(" ", ""): link.get_attribute("href") for link in movie_links}

        # Find the correct movie
        formatted_title = title.replace(" ", "").lower()
        found_movie = movies.get(formatted_title)

        if not found_movie:
            return None

        # Visit the movie page
        browser.get(found_movie)
        browser.implicitly_wait(3)

        # Get available download links (movies + subtitles)
        movie_options = {}
        subtitle_links = []
        download_links = browser.find_elements(By.TAG_NAME, "a")
        for link in download_links:
            href = link.get_attribute("href")
            if href:
                if href.endswith(".mp4"):  # ✅ Movie file
                    if "480p" in href:
                        movie_options["480p"] = href
                    elif "720p" in href:
                        movie_options["720p"] = href
                    elif "1080p" in href:
                        movie_options["1080p"] = href
                    elif "4K" in href:
                        movie_options["4K"] = href
                elif href.endswith(".srt"):  # ✅ Subtitle file
                    subtitle_links.append(href)

        return {
            "movie_name": title,
            "available_options": movie_options,
            "subtitles": subtitle_links if subtitle_links else "No subtitles found"
        }

    except Exception as e:
        return {"error": str(e)}


@app.route("/check_movie", methods=["GET"])
def check_movie():
    """API to check for available movie resolutions + subtitles"""
    year = request.args.get("year")
    title = request.args.get("title")

    if not year or not title:
        return jsonify({"error": "Missing title or year"}), 400

    movie_data = get_movie_options(year, title)

    if not movie_data:
        return jsonify({"error": "Download unavailable"}), 404

    return jsonify(movie_data)


@app.route("/get_movie_link", methods=["GET"])
def get_movie_link():
    """API to get the final movie + subtitle link"""
    year = request.args.get("year")
    title = request.args.get("title")
    resolution = request.args.get("resolution")

    if not year or not title or not resolution:
        return jsonify({"error": "Missing title, year, or resolution"}), 400

    movie_data = get_movie_options(year, title)

    if not movie_data or resolution not in movie_data["available_options"]:
        return jsonify({"error": "Resolution not available"}), 400

    return jsonify({
        "movie_link": movie_data["available_options"][resolution],
        "subtitles": movie_data["subtitles"]
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
