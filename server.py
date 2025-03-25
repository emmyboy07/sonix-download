import os
import time
import subprocess  # ✅ Used to install Chrome
from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

app = Flask(__name__)
PORT = int(os.environ.get("PORT", 5000))

BASE_URL = "https://netupserver.com/film/"

# ✅ Install Chrome on Render (Only runs once)
CHROME_BINARY = "/opt/render/project/.local/bin/google-chrome"
if not os.path.exists(CHROME_BINARY):
    subprocess.run("wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb", shell=True)
    subprocess.run("sudo apt update && sudo apt install -y ./google-chrome-stable_current_amd64.deb", shell=True)

# ✅ Configure Chrome options
chrome_options = Options()
chrome_options.binary_location = CHROME_BINARY  # ✅ Tell Selenium where Chrome is installed
chrome_options.add_argument("--headless")  # ✅ Run in headless mode
chrome_options.add_argument("--no-sandbox")  # ✅ Required for Render
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--disable-setuid-sandbox")
chrome_options.add_argument("--blink-settings=imagesEnabled=false")  # ✅ Block images for speed
chrome_options.add_argument("--log-level=3")  # ✅ Reduce logging output

# ✅ Start Selenium WebDriver
service = Service(ChromeDriverManager().install())
browser = webdriver.Chrome(service=service, options=chrome_options)
