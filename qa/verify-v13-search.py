"""Verification for the MQT app v1.3 Category C batch (search & discovery).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19007 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v13-search/ and prints a per-shot
report of page errors + horizontal overflow. Nothing is submitted:
no enquiry, chat message, callback or payment is sent; the walked
flow stops at the package detail screen.

Run: python3 qa/verify-v13-search.py
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19007"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v13-search")
os.makedirs(OUT, exist_ok=True)

FIRST_TITLE = "Assam Meghalaya Arunachal Pradesh Tour"
AMARNATH_TITLE = "Amarnath Yatra by Helicopter from Pahalgam"
ASSAM_SLUG = "10-days-assam-meghalaya-arunachal-pradesh-tour-packages"
AMARNATH_SLUG = "amarnath-tour"
CHARDHAM_SLUG = "chardham-yatra-haridwar"
# Bundled package with an empty duration string, so its Compare
# Duration cell must render "Not listed" (every bundled package has a
# price via overrides, so price-"Not listed" cannot be seeded this way;
# that branch is the same ternary as the duration branch).
GUWAHATI_SLUG = "3-days-guwahati-tour-package"
REPORT = []


def report(name, page):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > window.innerWidth + 1"
    )
    errs = page._errors
    noise = page._noise
    REPORT.append((name, errs, overflow))
    print(f"{name}: page_errors={len(errs)} overflow={overflow} "
          f"resource_noise={len(noise)} {errs[:2]}")


def attach(page):
    page._errors = []
    page._noise = []
    page.on("pageerror", lambda e: page._errors.append(str(e)[:200]))
    page.on("console", lambda m: (
        page._noise.append(m.text[:120])
        if m.type == "error"
        else None
    ))


def click_text(page, text, timeout=15000):
    page.get_by_text(text, exact=True).last.click(timeout=timeout)
    page.wait_for_timeout(900)


def click_card(page, title, timeout=15000):
    page.evaluate(
        """(title) => {
          const el = document.querySelector(
            '[aria-label="' + title.replace(/"/g, '') + '"]'
          );
          if (!el) throw new Error('card not found: ' + title);
          el.scrollIntoView({block: 'center'});
          el.click();
          return true;
        }""",
        title,
    )
    page.wait_for_timeout(900)


def click_tab(page, name, timeout=15000):
    page.evaluate(
        """(name) => {
          const anchors = Array.from(document.querySelectorAll('a'));
          const match = anchors.filter((a) =>
            (a.innerText || '').includes(name)
          );
          const vis = match.filter((a) => {
            const r = a.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          const el = vis[0] || match[0];
          if (!el) throw new Error('tab not found: ' + name);
          el.click();
          return true;
        }""",
        name,
    )
    page.wait_for_timeout(900)


def wait_text(page, text, timeout=20000):
    page.get_by_text(text).first.wait_for(timeout=timeout)


def shot(page, name, w):
    page.screenshot(path=os.path.join(OUT, f"{name}-{w}.png"))
    report(f"{name}-{w}", page)


def search_input(page):
    """The visible, topmost search input. Stack/tab screens underneath
    stay mounted and laid out (same placeholder, non-empty rect), so
    .first/is_visible can resolve to a covered input — pick the input
    that is actually on top at its own centre point."""
    idx = page.evaluate(
        """() => {
          const inputs = Array.from(document.querySelectorAll('input'))
            .filter((e) => e.placeholder === 'Search packages or destinations…');
          for (let i = 0; i < inputs.length; i++) {
            const r = inputs[i].getBoundingClientRect();
            if (r.width === 0) continue;
            const top = document.elementFromPoint(
              r.x + r.width / 2, r.y + r.height / 2);
            if (top === inputs[i] || inputs[i].contains(top)) return i;
          }
          return 0;
        }"""
    )
    return page.get_by_placeholder(
        "Search packages or destinations…").nth(idx)


def main_flow(page, w):
    page.set_viewport_size({"width": w, "height": 900})
    attach(page)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_text(page, "Blog")
    page.wait_for_timeout(3000)

    # Packages tab, plain then filtered by inline search.
    click_tab(page, "Packages")
    wait_text(page, "Packages")
    page.wait_for_timeout(1500)
    shot(page, "packages", w)
    search_input(page).fill("Assam")
    page.wait_for_timeout(1200)
    wait_text(page, FIRST_TITLE)
    shot(page, "packages-filtered", w)

    # Advanced search -> Search screen.
    click_text(page, "Advanced search")
    wait_text(page, "Trips under ₹25,000")
    shot(page, "search", w)

    # Walked flow: search -> filter -> sort -> detail.
    search_input(page).fill("yatra")
    search_input(page).press("Enter")
    page.wait_for_timeout(1200)
    # Any result count proves the search applied; a specific card may
    # sit below the fold (virtualized list) until filtered/sorted.
    wait_text(page, "results")
    shot(page, "search-yatra", w)

    click_text(page, "Filters")
    wait_text(page, "Budget")
    shot(page, "search-filters", w)
    click_text(page, "Pilgrimage")
    click_text(page, "Title: A to Z")
    click_text(page, "Apply")
    page.wait_for_timeout(1200)
    wait_text(page, "All India Chardham Yatra Tour Package")
    shot(page, "search-filtered-sorted", w)

    click_card(page, "All India Chardham Yatra Tour Package")
    wait_text(page, "Enquire")
    shot(page, "detail-from-search", w)


SEEDED_STATE = {
    "query": "Assam",
    "filters": {"category": None, "budget": "all", "duration": "all"},
    "sort": "title-az",
}

SEEDED_SAVED = [
    {
        "id": "seed-1",
        "query": "yatra",
        "filters": {"category": None, "budget": "all", "duration": "all"},
        "sort": "price-asc",
        # Deliberately stale: the real current display for this slug is
        # '' (no price), so detection must flag exactly 1 change.
        "priceSnapshot": {AMARNATH_SLUG: "₹99,999"},
        "savedAt": "2026-10-24T00:00:00.000Z",
    }
]


def seeded_flow(pw):
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 900})
    ctx.add_init_script(
        "localStorage.setItem('@mqt/search-state', %s);"
        "localStorage.setItem('@mqt/wishlist', %s);"
        "localStorage.setItem('@mqt/wishlist-prices', %s);"
        "localStorage.setItem('@mqt/saved-searches', %s);"
        "localStorage.setItem('@mqt/compare', %s);"
        % (
            json.dumps(json.dumps(SEEDED_STATE)),
            json.dumps(json.dumps([ASSAM_SLUG, CHARDHAM_SLUG])),
            json.dumps(json.dumps({})),
            json.dumps(json.dumps(SEEDED_SAVED)),
            json.dumps(json.dumps([ASSAM_SLUG, GUWAHATI_SLUG])),
        )
    )
    page = ctx.new_page()
    attach(page)
    try:
        page.goto(BASE, wait_until="domcontentloaded")
        wait_text(page, "Blog")
        page.wait_for_timeout(3000)
    except Exception as e:  # noqa: BLE001
        print(f"SEEDED FLOW FAILED: {type(e).__name__}: {e}")
        browser.close()
        return
    try:
        # Persisted state restored on the Packages tab.
        click_tab(page, "Packages")
        wait_text(page, "Packages")
        page.wait_for_timeout(1500)
        value = search_input(page).input_value()
        print(f"restored search input value: {value!r}")
        assert value == "Assam", f"expected restored query 'Assam', got {value!r}"
        shot(page, "packages-restored", 390)

        # Search screen shows wishlist + saved search + price-change note.
        click_text(page, "Advanced search")
        wait_text(page, "Wishlist (2)")
        wait_text(page, "Price changed on 1 package since saved")
        shot(page, "search-seeded", 390)

        # Compare screen: two columns, with "Not listed" in the
        # Duration row for the empty-duration package.
        # ("Not listed" occurs only on Compare; the package title also
        # exists on the Search screen underneath, so .first would pick
        # the hidden copy — assert title presence via DOM text instead.)
        click_text(page, "Compare (2/3)")
        wait_text(page, "Compare packages")
        page.wait_for_timeout(1000)
        wait_text(page, "Not listed")
        assert FIRST_TITLE in page.evaluate(
            "document.body.innerText"
        ), "compare table missing first package title"
        shot(page, "compare", 390)
    except Exception as e:  # noqa: BLE001
        print(f"SEEDED FLOW FAILED: {type(e).__name__}: {e}")
    browser.close()


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for w in (390, 1440):
            ctx = browser.new_context(viewport={"width": w, "height": 900})
            page = ctx.new_page()
            try:
                main_flow(page, w)
            except Exception as e:  # noqa: BLE001 - report and continue
                print(f"MAIN FLOW {w} FAILED: {type(e).__name__}: {e}")
            ctx.close()
        browser.close()
        seeded_flow(pw)

    bad = [r for r in REPORT if r[1] or r[2]]
    print(f"\n{len(REPORT)} shots; {len(bad)} with errors/overflow:")
    for name, errs, overflow in bad:
        print(f"  {name}: errors={errs} overflow={overflow}")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
