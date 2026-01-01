from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the HTML file directly
    filepath = os.path.abspath("index.html")
    page.goto(f"file://{filepath}")

    # Take a screenshot of the initial state
    page.screenshot(path="verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
