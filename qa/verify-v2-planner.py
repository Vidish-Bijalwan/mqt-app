"""Verification for the v2 Planner + My Trips batch (items 81-90, 181-190).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19009 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v2-planner/ and prints a per-shot
report of page errors + horizontal overflow. Nothing is submitted:
no enquiry, booking, payment or message is sent; the walked flow
stops at pre-submit states (planner creation is device-local only,
TripDetail buttons are not pressed past their screens).

TEMPORARY navigation wiring (Planner/TripDetail routes in App.tsx +
types.ts, plus a temporary initialRouteName) must be in place for
this script to reach those screens, and reverted afterwards per
qa/v2-routes-planner.md. NOTE: the Trips tab is currently not
reachable through the Home screen in this web export (the parallel
HomeScreen work renders no tab bar text in the export), so the
TripsScreen shot uses its own temporary initial route instead —
see verify-v2-trips.py.

Run: python3 qa/verify-v2-planner.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19009"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v2-planner")
os.makedirs(OUT, exist_ok=True)
REPORT = []


def attach(page):
    page._errors = []
    page.on("pageerror", lambda e: page._errors.append(str(e)[:200]))
    page.on("console", lambda m: (
        page._errors.append(m.text[:200])
        if m.type == "error" else None
    ))


def shot(page, name):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > window.innerWidth + 1"
    )
    errs = list(page._errors)
    page._errors.clear()
    REPORT.append((name, errs, overflow))
    print(f"{name}: page_errors={len(errs)} overflow={overflow} {errs[:2]}")
    page.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)


def click_text(page, text, timeout=20000):
    page.get_by_text(text, exact=True).last.click(timeout=timeout)
    page.wait_for_timeout(1000)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, suffix in [(390, "390"), (1440, "1440")]:
            page = browser.new_page(
                viewport={"width": width, "height": 844})
            attach(page)
            page.goto(BASE, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1500)
            shot(page, f"planner-empty-{suffix}")
            # Create a plan (device-local only) and add a package.
            page.get_by_placeholder(
                "Trip name, e.g. Goa Nov").fill("Goa Nov")
            click_text(page, "Create trip plan")
            page.get_by_placeholder(
                "Search packages by destination or name").fill("goa")
            page.wait_for_timeout(800)
            page.get_by_text("Add", exact=True).first.click(timeout=20000)
            page.wait_for_timeout(800)
            shot(page, f"planner-with-plan-{suffix}")
            click_text(page, "Open trip details")
            shot(page, f"tripdetail-{suffix}")
            page.close()
        browser.close()
    failed = [r for r in REPORT if r[1] or r[2]]
    print(f"TOTAL shots={len(REPORT)} failed={len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
