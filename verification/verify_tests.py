import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Mock google.script.run
    mock_script = """
    window.google = {
      script: {
        run: {
          _success: null,
          _failure: null,
          withSuccessHandler: function(cb) { this._success = cb; return this; },
          withFailureHandler: function(cb) { this._failure = cb; return this; },
          getSystemHealth: function() {
            console.log("Mock getSystemHealth called");
            setTimeout(() => {
                if (this._success) {
                    console.log("Calling success handler for getSystemHealth");
                    this._success([
                        { name: 'Sheet Exists: Hub', status: 'PASSED', message: 'Found' },
                        { name: 'Sheet Exists: Missing', status: 'FAILED', message: 'Missing' }
                    ]);
                }
            }, 100);
          },
          runAllTests: function() {
            console.log("Mock runAllTests called");
            setTimeout(() => {
                if (this._success) {
                    console.log("Calling success handler for runAllTests");
                    this._success([
                        { name: 'generateNameKey', status: 'PASSED', message: 'All assertions passed' }
                    ]);
                }
            }, 100);
          }
        }
      }
    };
    """

    page.add_init_script(mock_script)

    # Load the file
    cwd = os.getcwd()
    file_path = os.path.join(cwd, 'tests.html')
    # Use file:// protocol
    page.goto(f'file://{file_path}')

    # Wait for results
    print("Waiting for results...")
    try:
        page.wait_for_selector('.status-item', timeout=5000)
        # Wait a bit more for both sections to appear
        page.wait_for_timeout(1000)
        print("Results found.")
    except Exception as e:
        print(f"Timeout waiting for results: {e}")

    page.screenshot(path='verification/tests_html.png')
    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
