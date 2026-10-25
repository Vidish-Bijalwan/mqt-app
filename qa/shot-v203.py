"""Screenshot QA for mqt-app v2.0.3 web export at 390px width.

Fresh page load per screen (browser back does not move the RN stack
on web): Home -> SupportChat via the chat card, Home -> first package
detail via its card, Home -> Account tab for the updates section.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8903"
OUT = "/home/hatch/workspace/mqt-app-v203-work/qa/shots-v203"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})

        # --- Chat ---
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{OUT}/01-home.png")
        page.get_by_text("MQT Support — instant answers").click(timeout=15000)
        page.wait_for_timeout(2000)
        page.get_by_text("I answer instantly", exact=False).first.wait_for(timeout=15000)
        page.screenshot(path=f"{OUT}/02-chat.png")
        print("chat shot ok")

        # --- Detail: first package card on Home ---
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        card = page.locator('[aria-label="12 Jyotirlinga Tour Package"]')
        card.first.click(timeout=15000)
        page.wait_for_timeout(2500)
        txt = page.evaluate("() => document.body.innerText.slice(0, 900)")
        print("--- detail text ---\n" + txt)
        page.get_by_text("Start booking request", exact=False).first.wait_for(timeout=15000)
        page.screenshot(path=f"{OUT}/03-detail-first-paint.png")
        print("detail shot ok")

        # --- Account: Check for updates ---
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        page.get_by_text("Account", exact=True).last.click(timeout=15000)
        page.wait_for_timeout(2000)
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)
        page.get_by_text("Check for updates", exact=False).first.wait_for(timeout=15000)
        page.screenshot(path=f"{OUT}/04-account-updates.png")
        print("account shot ok")
        browser.close()

if __name__ == "__main__":
    main()
