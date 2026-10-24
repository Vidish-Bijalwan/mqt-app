"""Verification for the MQT app v2 Category U batch (admin/quality).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19007 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v2-admin/ and prints a per-shot
report of page errors + horizontal overflow. Nothing is submitted:
no enquiry, booking, payment or message is sent; the walked flow
only opens the new/changed screens via the TEMPORARY QaLauncher
route (reverted after screenshots).

Run: python3 qa/verify-v2-admin.py
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("V2_BASE", "http://127.0.0.1:19007")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v2-admin")
os.makedirs(OUT, exist_ok=True)

REPORT = []


def attach(page):
    # pageerror = real JS page errors (must be zero). Console
    # "Failed to load resource" lines are sandbox egress failures for
    # external images/site API calls (ERR_TUNNEL_CONNECTION_FAILED),
    # not app errors — counted separately as resource noise, like
    # prior batches' verify scripts.
    page._errors = []
    page._noise = []
    page.on("pageerror", lambda e: page._errors.append(str(e)[:200]))
    page.on("console", lambda m: (
        page._noise.append(m.text[:120])
        if m.type == "error"
        else None
    ))


def report(name, page):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > window.innerWidth + 1"
    )
    errs = page._errors
    REPORT.append((name, errs, overflow))
    print(f"{name}: page_errors={len(errs)} overflow={overflow} "
          f"resource_noise={len(page._noise)} {errs[:2]}")


def shot(page, name, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.wait_for_timeout(1200)
    page.screenshot(path=os.path.join(OUT, name), full_page=True)
    report(name, page)


def go_launcher(page):
    page.goto(BASE, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)


def open_screen(page, label):
    page.get_by_text(label, exact=True).click(timeout=15000)
    page.wait_for_timeout(1200)


def back(page):
    # Reload instead of history-back: RN-web history does not reliably
    # return to the launcher, but a fresh load always starts there.
    go_launcher(page)


def main():
    variant = sys.argv[1] if len(sys.argv) > 1 else "comfortable"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 900})
        attach(page)
        go_launcher(page)
        # WhatsNew (full changelog view).
        open_screen(page, "Open WhatsNew")
        shot(page, f"whatsnew-390.png", 390)
        shot(page, f"whatsnew-1440.png", 1440)
        back(page)
        # Diagnostics.
        open_screen(page, "Open Diagnostics")
        shot(page, f"diagnostics-390.png", 390)
        shot(page, f"diagnostics-1440.png", 1440)
        back(page)
        # Maintenance (owned screen, unchanged wiring, render check).
        open_screen(page, "Open Maintenance")
        shot(page, f"maintenance-390.png", 390)
        shot(page, f"maintenance-1440.png", 1440)
        back(page)
        # Home via Tabs (A/B density variant under test).
        open_screen(page, "Open Tabs (Home)")
        page.wait_for_timeout(2000)
        shot(page, f"home-{variant}-390.png", 390)
        shot(page, f"home-{variant}-1440.png", 1440)
        browser.close()
    failed = [r for r in REPORT if r[1] or r[2]]
    print(f"TOTAL shots={len(REPORT)} failed={len(failed)}")
    for name, errs, overflow in failed:
        print(f"FAIL {name}: errors={errs} overflow={overflow}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
