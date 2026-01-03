
from playwright.sync_api import sync_playwright
import os
import time

def test_frontend():
    html_file = os.path.abspath("tests.html")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Mock google.script.run
        page.add_init_script("""
            window.google = {
                script: {
                    run: {
                        withSuccessHandler: function(callback) {
                            this._successHandler = callback;
                            return this;
                        },
                        withFailureHandler: function(callback) {
                            this._failureHandler = callback;
                            return this;
                        },
                        getSystemHealth: function() {
                            setTimeout(() => {
                                if (this._successHandler) {
                                    this._successHandler({
                                        sheets: [
                                            {name: "Admin Settings", status: "PASS", message: "Exists"},
                                            {name: "Missing Sheet", status: "FAIL", message: "Missing"}
                                        ],
                                        config: [
                                            {name: "SNAPSHOT_METRICS_CONFIG", status: "PASS", message: "Found 23 metrics"}
                                        ],
                                        logic: [
                                            {name: "generateNameKey Logic", status: "PASS", message: "Correctly parsed"}
                                        ]
                                    });
                                }
                            }, 500);
                        }
                    }
                }
            };
        """)

        page.goto(f"file://{html_file}")

        # Wait for results
        page.wait_for_selector("#report", state="visible")

        # Screenshot
        page.screenshot(path="verification/verification.png")
        browser.close()

if __name__ == "__main__":
    test_frontend()
