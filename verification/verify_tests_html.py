import os
from playwright.sync_api import sync_playwright

def verify_system_health(page):
    # Mock google.script.run
    page.add_init_script("""
        window.google = {
            script: {
                run: {
                    withSuccessHandler: function(successCallback) {
                        this.successCallback = successCallback;
                        return this;
                    },
                    withFailureHandler: function(failureCallback) {
                        this.failureCallback = failureCallback;
                        return this;
                    },
                    getSystemHealth: function() {
                        console.log("Mock getSystemHealth called");
                        setTimeout(() => {
                            if (this.successCallback) {
                                this.successCallback({
                                    overall: 'FAIL',
                                    checks: [
                                        { name: 'Critical Sheet Access', status: 'PASS', message: 'Found all sheets' },
                                        { name: 'API Connection', status: 'FAIL', message: 'Timeout 500ms' },
                                        { name: 'Unit Test: Name Key', status: 'PASS', message: 'Logic verified' }
                                    ]
                                });
                            }
                        }, 500);
                    }
                }
            }
        };
    """)

    # Load file
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/tests.html")

    # Verify Loading
    page.wait_for_selector("#loading")
    print("Loading state verified")

    # Verify Results
    page.wait_for_selector("#results", state="visible")
    print("Results state verified")

    # Take screenshot
    page.screenshot(path="verification/tests_html_screenshot.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_system_health(page)
        finally:
            browser.close()
