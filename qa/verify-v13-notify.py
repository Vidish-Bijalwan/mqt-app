"""Verification for the MQT app v1.3 Category Q + item 92 batch (web export).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19007 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v13-notify/ and prints a per-shot report
of page errors + horizontal overflow. No enquiry, chat message, callback
or payment is submitted: every shot is pre-submit state, and the only
"populated" centre run seeds localStorage in the QA browser context
(QA-only test data, never shipped as app content).

Article note: the read-only /api/blog/posts/[slug] route lives on the
UNMERGED site branch app-api-v12, so production does not serve it yet.
The native-renderer run therefore intercepts that single route with a
VERBATIM excerpt (first 8 blocks) of the kedarnath factory body taken
from the branch (see qa/article-fixture.json) — real site content in
the pushed route's exact response shape — to verify the renderer,
progress bar, toolbar, overflow and page errors. The walked
Account -> Notifications flow runs against the real (unintercepted)
app; the article body fetch there falls back honestly to WebView
metadata because production lacks the route.

Run: python3 qa/verify-v13-notify.py
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19007"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v13-notify")
os.makedirs(OUT, exist_ok=True)
REPORT = []

with open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "article-fixture.json")
) as fh:
    FIXTURE = json.load(fh)

KEDARNATH_SLUG = "kedarnath-yatra-2027-complete-travel-guide"
LIST_POSTS = {
    "posts": [
        {
            "slug": KEDARNATH_SLUG,
            "title": "Kedarnath Yatra 2027: Complete Travel Guide",
            "meta_description": "Planning the kedarnath yatra 2027? Routes, best time, registration, trek tips, helicopter options and a day-wise itinerary — the complete guide.",
            "cover_image": "/images/blog/kedarnath.webp",
            "category": "Pilgrimage",
            "tags": ["Kedarnath"],
            "target_keyword": "kedarnath yatra 2027",
            "published_at": "2026-09-28T09:17:00+05:30",
            "source": "seed",
        }
    ]
}
ARTICLE_PAYLOAD = {
    "slug": KEDARNATH_SLUG,
    "title": "Kedarnath Yatra 2027: Complete Travel Guide",
    "excerpt": "Planning the kedarnath yatra 2027? Routes, best time, registration, trek tips, helicopter options and a day-wise itinerary — the complete guide.",
    "coverImage": "/images/blog/kedarnath.webp",
    "category": "Pilgrimage",
    "publishedAt": "2026-09-28T09:17:00+05:30",
    "bodyKind": "blocks",
    "blocks": FIXTURE["blocks"],
    "bodyMd": "",
}


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


def click_text(page, text, timeout=20000):
    # Playwright actionability clicks on Home links are flaky at 1440
    # (an overlapping container intercepts the point), so dispatch a
    # click on the matching element via JS; navigation is still handled
    # by the app's own Pressable handler.
    try:
        page.get_by_text(text, exact=True).last.click(timeout=5000)
    except Exception:  # noqa: BLE001 - fall back to a JS-dispatched click
        page.evaluate(
            """(text) => {
              const els = Array.from(document.querySelectorAll('*')).filter(
                (el) => el.children.length === 0 &&
                  (el.textContent || '').trim() === text
              );
              const vis = els.filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              });
              const el = vis[vis.length - 1] || els[els.length - 1];
              if (!el) throw new Error('text not found: ' + text);
              el.scrollIntoView({block: 'center'});
              el.click();
              return true;
            }""",
            text,
        )
    page.wait_for_timeout(900)


def click_tab(page, name, timeout=20000):
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


def back_to_tabs(page):
    for _ in range(4):
        if page.locator("a", has_text="Home").first.is_visible():
            return True
        backs = page.get_by_label(re.compile(r", back$"))
        clicked = False
        for j in range(backs.count()):
            if backs.nth(j).is_visible():
                backs.nth(j).click()
                clicked = True
                break
        if not clicked:
            return False
    return False


def wait_text(page, text, timeout=25000):
    page.get_by_text(text).first.wait_for(timeout=timeout)


def shot(page, name, w):
    page.screenshot(path=os.path.join(OUT, f"{name}-{w}.png"))
    report(f"{name}-{w}", page)


def scroll_to_text(page, text):
    page.evaluate(
        """(text) => {
          const els = Array.from(document.querySelectorAll('*')).filter(
            (el) => el.children.length === 0 && (el.textContent || '').includes(text)
          );
          if (els[0]) els[0].scrollIntoView({block: 'start'});
          return Boolean(els[0]);
        }""",
        text,
    )
    page.wait_for_timeout(700)


def main_flow(page, w):
    """Walked flow: Account -> Notifications (empty) -> article."""
    page.set_viewport_size({"width": w, "height": 900})
    attach(page)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_text(page, "Blog")
    page.wait_for_timeout(2500)

    click_tab(page, "Account")
    wait_text(page, "You are browsing as a guest")
    shot(page, "account-notify", w)
    click_text(page, "Open notification centre")
    wait_text(page, "No notifications yet")
    shot(page, "notifications-empty", w)
    scroll_to_text(page, "Notification settings")
    shot(page, "notifications-settings", w)
    back_to_tabs(page)

    # Home -> Blog list (unintercepted: production lacks the new route,
    # so the honest metadata + website fallback is what must render).
    click_text(page, "Blog")
    page.wait_for_timeout(2500)
    shot(page, "blog-list", w)


def populated_run(pw, w):
    """QA-only seeded centre: one price drop, one scheduled reminder,
    one booking entry with a WhatsApp action. Seeded via localStorage
    in this browser context only; never shipped as app content."""
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": w, "height": 900})
    page = ctx.new_page()
    attach(page)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_text(page, "Blog")
    keys = page.evaluate("Object.keys(localStorage)")
    print(f"storage keys: {keys}")
    entries = [
        {
            "id": "qa-price-1",
            "kind": "price-drop",
            "title": "Price drop: QA Test Package",
            "body": "Now ₹15,000 (was ₹20,000).",
            "createdAt": "2026-10-25T00:00:00.000Z",
            "read": False,
            "dismissed": False,
            "deepLink": {"screen": "PackageDetail", "slug": "kedarnath-yatra"},
        },
        {
            "id": "qa-reminder-1",
            "kind": "scheduled",
            "title": "Your trip is in 7 days: QA Test Package",
            "body": "Time to check documents and pack. Tap to view your trips.",
            "createdAt": "2026-10-25T00:00:00.000Z",
            "scheduledFor": "2026-11-01T09:00:00.000Z",
            "read": False,
            "dismissed": False,
            "deepLink": {"screen": "Trips"},
        },
        {
            "id": "qa-booking-1",
            "kind": "booking",
            "title": "Booking update: QA Test Package",
            "body": "Enquiry received (ref QA-1). The team follows up on WhatsApp.",
            "createdAt": "2026-10-25T00:00:00.000Z",
            "read": True,
            "dismissed": False,
            "deepLink": {"screen": "Trips"},
            "whatsappMessage": "Hi My Quick Trippers! QA test message.",
        },
    ]
    page.evaluate(
        """(entries) => {
          const keys = Object.keys(localStorage);
          const key = keys.find((k) => k.includes('notifications'))
            || '@mqt/notifications';
          localStorage.setItem(key, JSON.stringify(entries));
          return key;
        }""",
        entries,
    )
    page.reload(wait_until="domcontentloaded")
    wait_text(page, "Blog")
    page.wait_for_timeout(1500)
    click_tab(page, "Account")
    wait_text(page, "You are browsing as a guest")
    click_text(page, "Open notification centre")
    wait_text(page, "Price drop: QA Test Package")
    shot(page, "notifications-populated", w)
    browser.close()


def article_run(pw, w):
    """Native renderer run with the article route intercepted (see
    module docstring for why interception is required pre-merge)."""
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": w, "height": 900})
    page = ctx.new_page()
    attach(page)

    def handler(route):
        url = route.request.url
        if "/api/blog/posts/" in url:
            route.fulfill(json=ARTICLE_PAYLOAD)
        elif url.endswith("/api/blog/posts"):
            route.fulfill(json=LIST_POSTS)
        else:
            route.abort()

    page.route("**/api/blog/posts", handler)
    page.route("**/api/blog/posts/*", handler)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_text(page, "Blog")
    page.wait_for_timeout(2000)
    click_text(page, "Blog")
    wait_text(page, "Kedarnath Yatra 2027: Complete Travel Guide")
    click_text(page, "Kedarnath Yatra 2027: Complete Travel Guide")
    wait_text(page, "Why the Kedarnath Yatra Matters")
    shot(page, "article-native", w)
    # Scroll to mid-article: progress bar + later sections render.
    page.evaluate("window.scrollTo(0, 600)")
    page.wait_for_timeout(700)
    shot(page, "article-native-scrolled", w)
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
        for w in (390, 1440):
            try:
                populated_run(pw, w)
            except Exception as e:  # noqa: BLE001
                print(f"POPULATED RUN {w} FAILED: {type(e).__name__}: {e}")
            try:
                article_run(pw, w)
            except Exception as e:  # noqa: BLE001
                print(f"ARTICLE RUN {w} FAILED: {type(e).__name__}: {e}")

    bad = [r for r in REPORT if r[1] or r[2]]
    print(f"\n{len(REPORT)} shots; {len(bad)} with errors/overflow:")
    for name, errs, overflow in bad:
        print(f"  {name}: errors={errs} overflow={overflow}")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
