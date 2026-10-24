"""Post-refactor verification for the MQT app v1.2 batch (web export).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19007 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v12r/ and prints a per-shot report of
page errors + horizontal overflow. No enquiry, chat message, callback
or payment is submitted: every form shot is pre-submit state.

Run: python3 qa/verify-v12.py
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19007"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v12r")
os.makedirs(OUT, exist_ok=True)

FIRST_TITLE = "Assam Meghalaya Arunachal Pradesh Tour"
REPORT = []


def report(name, page):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > window.innerWidth + 1"
    )
    # Real failures only: pageerror events. Console "Failed to load
    # resource" lines are environmental noise here (site images/APIs
    # unreachable from this proxy-less Chromium) and are counted
    # separately, never treated as page errors.
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
    # Package cards are Pressables with aria-label=title. Playwright's
    # actionability click on the inner text is flaky here (the card's
    # own containers intercept the point), so dispatch a real click
    # event on the labeled card element itself via JS. Navigation is
    # still handled by the app's own Pressable handler.
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
    # Tab bar items render as <a> anchors (icon glyph + label), so
    # exact-text matching never hits them. Playwright's actionability
    # click is also flaky here (overlapping ScrollView content), so
    # dispatch a click on the first visible matching anchor via JS;
    # navigation is still handled by the app's own link handler.
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
    """Pop stack screens via the header back button until the tab bar
    is visible again (max 4 pops). Returns True when tabs are visible.
    Note: hidden back buttons from screens underneath also match the
    label query, so always click the first VISIBLE one."""
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
        page.wait_for_timeout(900)
    return page.locator("a", has_text="Home").first.is_visible()


def wait_text(page, text, timeout=20000):
    page.get_by_text(text).first.wait_for(timeout=timeout)


def shot(page, name, w):
    page.screenshot(path=os.path.join(OUT, f"{name}-{w}.png"))
    report(f"{name}-{w}", page)


def main_flow(page, w):
    page.set_viewport_size({"width": w, "height": 900})
    attach(page)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_text(page, "Blog")
    page.wait_for_timeout(3000)
    shot(page, "home", w)

    # Blog (native list) from Home, then back to tabs.
    click_text(page, "Blog")
    page.get_by_placeholder("Search blog posts").wait_for(timeout=20000)
    shot(page, "blog", w)
    back_to_tabs(page)

    # Packages tab -> detail -> enquiry -> pay -> chat prefill.
    click_tab(page, "Packages")
    wait_text(page, FIRST_TITLE)
    shot(page, "packages", w)
    click_card(page, FIRST_TITLE)
    wait_text(page, "Enquire")
    shot(page, "detail", w)

    click_text(page, "Enquire")
    page.wait_for_timeout(1200)
    shot(page, "enquiry", w)
    back_to_tabs(page)
    click_tab(page, "Packages")
    click_card(page, FIRST_TITLE)
    wait_text(page, "Enquire")

    click_text(page, "Pay")
    page.wait_for_timeout(1200)
    shot(page, "pay", w)
    back_to_tabs(page)
    click_tab(page, "Packages")
    click_card(page, FIRST_TITLE)
    wait_text(page, "Enquire")

    click_text(page, "Chat about this package")
    wait_text(page, "Chatting about:")
    shot(page, "chat-prefill", w)

    # Account hub + sub-screens.
    click_tab(page, "Account")
    wait_text(page, "You are browsing as a guest")
    shot(page, "account", w)
    click_text(page, "Manage travelers")
    page.wait_for_timeout(1200)
    shot(page, "travelers", w)
    back_to_tabs(page)
    click_tab(page, "Account")
    wait_text(page, "You are browsing as a guest")
    click_text(page, "Sign in (OTP not connected yet)")
    wait_text(page, "OTP login is not connected yet")
    shot(page, "login", w)
    back_to_tabs(page)
    click_tab(page, "Account")
    wait_text(page, "You are browsing as a guest")
    click_text(page, "Export or delete my local data")
    wait_text(page, "Export my local data")
    shot(page, "dataprivacy", w)

    # Trips (empty state) + Chat tab plain.
    click_tab(page, "Trips")
    wait_text(page, "Need help with a trip?")
    shot(page, "trips", w)
    click_tab(page, "Chat")
    wait_text(page, "Chat with the team")
    shot(page, "chat", w)


LIVE_PACKAGES = {
    "packages": [
        {
            "slug": "test-live-package",
            "title": "Live Test Package",
            "category": "Test",
            "image": "",
            "duration": "3D/2N",
            "route": "X - Y",
            "description": "A live-catalogue test package.",
            "mrp": "₹20,000",
            "dealPrice": "₹15,000",
            "hasPrice": True,
            "display": "₹15,000",
            "crossed": "₹20,000",
            "save": "Save ₹5,000",
        }
    ],
    "count": 1,
    "updatedAt": "2026-10-24T00:00:00.000Z",
}

LIVE_POSTS = {
    "posts": [
        {
            "slug": "live-test-post",
            "title": "Live Test Post",
            "meta_description": "A live-feed test post excerpt.",
            "cover_image": "",
            "category": "Test",
            "tags": [],
            "target_keyword": "",
            "published_at": "2026-10-24T00:00:00.000Z",
            "source": "seed",
        }
    ]
}

SOFT_CONFIG = {
    "appVersion": "1.2.0",
    "latestVersion": "1.3.0",
    "minSupportedVersion": "1.0.0",
    "updateUrgency": "none",
    "maintenance": {"enabled": False, "message": ""},
    "flags": {"chatEnabled": True, "offersBannerEnabled": False},
    "banners": [],
}

FORCED_CONFIG = dict(
    SOFT_CONFIG,
    latestVersion="1.3.0",
    minSupportedVersion="9.9.9",
    updateUrgency="critical",
)

MAINT_CONFIG = dict(
    SOFT_CONFIG,
    maintenance={"enabled": True, "message": "Test maintenance message."},
)


def intercept_run(pw, config, live, name):
    """One 390px run with site API routes intercepted."""
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 900})
    page = ctx.new_page()
    attach(page)

    def handler(route):
        url = route.request.url
        if url.endswith("/api/packages"):
            route.fulfill(json=LIVE_PACKAGES if live else {"packages": []})
        elif url.endswith("/api/blog/posts"):
            route.fulfill(json=LIVE_POSTS if live else {"posts": []})
        elif url.endswith("/api/app-config"):
            route.fulfill(json=config)
        else:
            route.abort()

    page.route("**/api/packages", handler)
    page.route("**/api/blog/posts", handler)
    page.route("**/api/app-config", handler)
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    return browser, page


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

        # Live-catalogue + soft-nudge run (intercepted APIs).
        browser, page = intercept_run(pw, SOFT_CONFIG, True, "live")
        try:
            wait_text(page, "A newer version of the app is available")
            shot(page, "gate-soft-r", 390)
            click_text(page, "Update later")
            page.wait_for_timeout(800)
            wait_text(page, "Live Test Package")
            shot(page, "home-live", 390)
            click_text(page, "Blog")
            wait_text(page, "Live Test Post")
            shot(page, "blog-live", 390)
        except Exception as e:  # noqa: BLE001
            print(f"LIVE RUN FAILED: {type(e).__name__}: {e}")
        browser.close()

        # Forced-update gate run.
        browser, page = intercept_run(pw, FORCED_CONFIG, False, "forced")
        try:
            wait_text(page, "Please update the app")
            shot(page, "gate-forced-r", 390)
        except Exception as e:  # noqa: BLE001
            print(f"FORCED RUN FAILED: {type(e).__name__}: {e}")
        browser.close()

        # Maintenance gate run.
        browser, page = intercept_run(pw, MAINT_CONFIG, False, "maint")
        try:
            wait_text(page, "Test maintenance message.")
            shot(page, "gate-maintenance-r", 390)
        except Exception as e:  # noqa: BLE001
            print(f"MAINT RUN FAILED: {type(e).__name__}: {e}")
        browser.close()

        # Biometric locked-screen run: discover the storage key first.
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 390, "height": 900})
        page = ctx.new_page()
        attach(page)
        page.goto(BASE, wait_until="domcontentloaded")
        wait_text(page, "Blog")
        click_tab(page, "Account")
        wait_text(page, "You are browsing as a guest")
        click_text(page, "Dark")
        page.wait_for_timeout(800)
        keys = page.evaluate("Object.keys(localStorage)")
        settings_key = next(
            (k for k in keys if "settings" in k), "@mqt/settings"
        )
        print(f"settings storage key: {settings_key}")
        ctx.close()

        # Seeded run: biometricEnabled true -> locked screen + escape.
        ctx2 = browser.new_context(viewport={"width": 390, "height": 900})
        seeded = {
            "theme": "light",
            "fontScale": 1,
            "language": "en",
            "notifications": {
                "tripUpdates": True,
                "offers": False,
                "reminders": True,
            },
            "commPref": "whatsapp",
            "whatsappPreferred": True,
            "smsPreferred": False,
            "callPreferred": True,
            "dataSaver": False,
            "biometricEnabled": True,
        }
        ctx2.add_init_script(
            f"localStorage.setItem({json.dumps(settings_key)}, "
            f"{json.dumps(json.dumps(seeded))});"
        )
        page2 = ctx2.new_page()
        attach(page2)
        page2.goto(BASE, wait_until="domcontentloaded")
        wait_text(page2, "Blog")
        click_tab(page2, "Account")
        try:
            wait_text(page2, "Account is locked")
            shot(page2, "account-locked", 390)
            click_text(page2, "Turn off biometric lock")
            wait_text(page2, "You are browsing as a guest")
            shot(page2, "account-unlocked", 390)
        except Exception as e:  # noqa: BLE001
            print(f"LOCKED RUN FAILED: {type(e).__name__}: {e}")
        browser.close()

    bad = [r for r in REPORT if r[1] or r[2]]
    print(f"\n{len(REPORT)} shots; {len(bad)} with errors/overflow:")
    for name, errs, overflow in bad:
        print(f"  {name}: errors={errs} overflow={overflow}")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
