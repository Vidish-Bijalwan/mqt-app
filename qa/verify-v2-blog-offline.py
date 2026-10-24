"""Verification for the MQT app v2 blog/offline batch (items 93-100, 151-160).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19007 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v2-blog-offline/ and prints a per-shot
report of page errors + horizontal overflow. Nothing is submitted:
no enquiry, chat message, callback or payment is sent; the queued-
enquiry retry button and WhatsApp/share buttons are never clicked.
The QA menu screen + its stack wiring are TEMPORARY (reverted after
this run); the seeded localStorage data below is test-only and is
never shipped (fixture blocks are verbatim site content from
qa/article-fixture.json).

Run: python3 qa/verify-v2-blog-offline.py
"""
import json
import os

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19007"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v2-blog-offline")
os.makedirs(OUT, exist_ok=True)
REPORT = []

FIXTURE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "article-fixture.json")))
SAVED_SLUG = "kedarnath-yatra-2027-complete-travel-guide"
SAVED_TITLE = "Kedarnath Yatra 2027 Complete Travel Guide"

SEED_JS = """
() => {
  const saved = [{
    slug: %s, title: %s, excerpt: 'Planning the Kedarnath Yatra 2027.',
    coverImage: '', category: 'Pilgrimage', publishedAt: '2026-10-20T00:00:00.000Z',
    bodyKind: 'blocks', blocks: %s, bodyMd: '', savedAt: new Date().toISOString()
  }];
  localStorage.setItem('@mqt/blog-saved-articles', JSON.stringify(saved));
  localStorage.setItem('@mqt/blog-bookmarks', JSON.stringify([{slug: %s, title: %s}]));
  localStorage.setItem('@mqt/blog-history', JSON.stringify([{slug: %s, title: %s, viewedAt: new Date().toISOString()}]));
  localStorage.setItem('@mqt/blog-followed-categories', JSON.stringify(['Pilgrimage']));
  localStorage.setItem('@mqt/error-log', JSON.stringify([
    {id: 'err-seed-1', source: 'blog-article', message: 'No live or saved body for test-slug', timestamp: new Date().toISOString()}
  ]));
  localStorage.setItem('@mqt/trip-kits', JSON.stringify([{
    ref: 'MQT-TEST-1', slug: 'kedarnath-test', packageName: 'Kedarnath Yatra Test',
    date: new Date().toISOString(), itinerarySummary: 'Duration: 5 Days / 4 Nights\\nRoute: Haridwar to Kedarnath',
    contacts: [], savedAt: new Date().toISOString()
  }]));
  localStorage.setItem('@mqt/enquiry-queue', JSON.stringify([{
    id: 'q-seed-1', input: {name: 'Test User', phone: '9876543210', packageName: 'Kedarnath Yatra Test'},
    formRenderedAt: Date.now(), queuedAt: new Date().toISOString(), attempts: 0, lastError: ''
  }]));
}
""" % (
    json.dumps(SAVED_SLUG), json.dumps(SAVED_TITLE),
    json.dumps(FIXTURE["blocks"]),
    json.dumps(SAVED_SLUG), json.dumps(SAVED_TITLE),
    json.dumps(SAVED_SLUG), json.dumps(SAVED_TITLE),
)


def report(name, page):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > window.innerWidth + 1"
    )
    errs = page._errors
    REPORT.append((name, errs, overflow))
    print(f"{name}: page_errors={len(errs)} overflow={overflow} {errs[:2]}")


def attach(page):
    page._errors = []
    page.on("pageerror", lambda e: page._errors.append(str(e)[:200]))
    page.on("console", lambda m: (
        page._errors.append(m.text[:200]) if m.type == "error" else None
    ))


def click_text(page, text, timeout=15000):
    page.get_by_text(text, exact=True).last.click(timeout=timeout)
    page.wait_for_timeout(1200)


def goto_menu(page):
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)


def shot(page, name, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(OUT, f"{name}-{width}.png"), full_page=True)
    report(f"{name}-{width}", page)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (390, 1440):
            ctx = browser.new_context(viewport={"width": width, "height": 900})
            # SEED_JS is a function expression: invoke it on every page load.
            ctx.add_init_script(f"({SEED_JS})()")
            page = ctx.new_page()
            attach(page)

            # QA menu
            goto_menu(page)
            shot(page, "qa-menu", width)

            # Blog feed + sections
            click_text(page, "Blog")
            shot(page, "blog", width)
            click_text(page, "Saved offline")
            shot(page, "blog-saved", width)
            click_text(page, "Videos")
            shot(page, "blog-videos", width)
            click_text(page, "Guides")
            shot(page, "blog-guides", width)
            # Hub detail inline (Pilgrimage card from bundled catalogue)
            try:
                click_text(page, "Pilgrimage")
                shot(page, "blog-hub-detail", width)
            except Exception as e:
                print(f"blog-hub-detail skipped: {e}")

            # Blog search-draft restore (156/157): type, reload to menu,
            # re-enter Blog, input value must persist.
            goto_menu(page)
            click_text(page, "Blog")
            box = page.get_by_placeholder("Search blog posts…")
            box.fill("kedarnath")
            page.wait_for_timeout(800)
            goto_menu(page)
            click_text(page, "Blog")
            restored = page.get_by_placeholder("Search blog posts…").input_value()
            print(f"search-draft-restored-{width}: {restored!r}")
            shot(page, "blog-search-restored", width)

            # Standalone new screens via QA menu
            for label, name in [
                ("Blog library", "library"),
                ("Video guides", "video-guides"),
                ("Destination hubs", "hubs-list"),
                ("Trip kit: MQT-TEST-1", "tripkit"),
                ("Offline diagnostics", "diagnostics"),
                ("Blog article (saved copy)", "article-saved"),
            ]:
                goto_menu(page)
                click_text(page, label)
                if name == "article-saved":
                    banner = page.get_by_text("saved offline copy", exact=False).count()
                    print(f"article-saved-offline-banner-{width}: {banner}")
                if name == "hubs-list":
                    click_text(page, "Pilgrimage")
                    shot(page, "hub-detail", width)
                    continue
                shot(page, name, width)
            ctx.close()
        browser.close()
    print("DONE. Shots in", OUT)


if __name__ == "__main__":
    main()
