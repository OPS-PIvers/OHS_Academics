
from playwright.sync_api import Page, expect, sync_playwright
import os

def test_df_no_request_card(page: Page):
    # Get the absolute path to the mock file
    cwd = os.getcwd()
    file_path = f"file://{cwd}/verification/mock_index.html"

    # 1. Go to the mock page
    page.goto(file_path)

    # 2. Wait for the dashboard to load (mock timeout is 500ms)
    page.wait_for_timeout(1000)

    # 3. Check if the card exists and has the correct initial value
    card = page.locator("#kpi-df-no-request-card")
    expect(card).to_be_visible()

    # We mocked 5 students with isDFNoRequest=true
    count = page.locator("#df-no-request-count")
    expect(count).to_have_text("5")

    # Check label has date
    label = card.locator(".kpi-label")
    expect(label).to_contain_text("11/27/2025")

    # 4. Click the card to show the tooltip
    card.click()

    # 5. Verify the tooltip appears and contains Breakdown stats, NOT names
    tooltip = page.locator("#tooltip")
    expect(tooltip).to_be_visible()
    expect(tooltip).to_contain_text("Comparison Breakdowns")
    expect(tooltip).to_contain_text("Current Filter:")
    expect(tooltip).to_contain_text("School-Wide:")

    # Ensure NO student names are visible
    expect(tooltip).not_to_contain_text("Student 0")
    expect(tooltip).not_to_contain_text("John Doe")

    # 6. Screenshot
    page.screenshot(path="/home/jules/verification/df_card_verification_v2.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_df_no_request_card(page)
        finally:
            browser.close()
