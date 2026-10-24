"""v1.3 verification: detail sections + booking flow (web export).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19007 (python3 -m http.server in dist/).
Writes screenshots to qa/shots-v13-booking/ and prints a per-shot
report of page errors + horizontal overflow. NOTHING is submitted:
the booking flow is walked to the review step only (pre-submit state),
exactly as prior batches verified. No enquiry, payment or WhatsApp
message is sent — the WhatsApp buttons are never clicked.

Run: python3 qa/verify-v13-booking.py
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19007"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v13-booking")
os.makedirs(OUT, exist_ok=True)

FIRST_TITLE = "Assam Meghalaya Arunachal Pradesh Tour"
REPORT = []


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


def click_text(page, text, timeout=20000):
    page.get_by_text(text, exact=True).last.click(timeout=timeout)
    page.wait_for_timeout(900)


def click_card(page, title, timeout=20000):
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


def wait_text(page, text, timeout=25000):
    page.get_by_text(text).first.wait_for(timeout=timeout)


def shot(page, name, w):
    page.screenshot(path=os.path.join(OUT, f"{name}-{w}.png"))
    report(f"{name}-{w}", page)


def full_shot(page, name, w):
    page.screenshot(path=os.path.join(OUT, f"{name}-{w}.png"), full_page=True)
    report(f"{name}-{w}", page)


def fill_placeholder(page, placeholder, value):
    page.get_by_placeholder(placeholder).first.fill(value)
    page.wait_for_timeout(200)


def main_flow(page, w):
    page.set_viewport_size({"width": w, "height": 900})
    attach(page)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_text(page, "Blog")
    page.wait_for_timeout(3000)

    click_tab(page, "Packages")
    wait_text(page, FIRST_TITLE)
    click_card(page, FIRST_TITLE)
    wait_text(page, "Start booking request")
    # Detail: top + full page (all sections).
    shot(page, "detail-top", w)
    full_shot(page, "detail-full", w)

    # Booking flow, step by step (pre-submit only).
    click_text(page, "Start booking request")
    wait_text(page, "Step 1 of 6: Dates")
    shot(page, "booking-dates", w)
    fill_placeholder(page, "YYYY-MM-DD", "2026-12-15")
    click_text(page, "Continue")
    wait_text(page, "Step 2 of 6: Travelers")
    shot(page, "booking-travelers", w)
    fill_placeholder(page, "Full name (required)", "Test Traveler")
    fill_placeholder(page, "Age (optional)", "30")
    click_text(page, "Add traveler")
    page.wait_for_timeout(500)
    click_text(page, "Continue")
    wait_text(page, "Step 3 of 6: Rooms")
    shot(page, "booking-rooms", w)
    click_text(page, "Continue")
    wait_text(page, "Step 4 of 6: Add-ons")
    shot(page, "booking-addons", w)
    click_text(page, "Extra nights (request)")
    click_text(page, "Ask the team to hold this price for 24 hours (request, not a guarantee)")
    click_text(page, "Continue")
    wait_text(page, "Step 5 of 6: Contact")
    shot(page, "booking-contact", w)
    fill_placeholder(page, "Full name", "Test Booker")
    fill_placeholder(page, "Phone number", "9876543210")
    click_text(page, "Continue")
    wait_text(page, "Step 6 of 6: Review")
    shot(page, "booking-review", w)
    full_shot(page, "booking-review-full", w)

    # Draft resume: reload is not used (would lose nav state); instead
    # verify the draft key exists in localStorage from this session.
    keys = page.evaluate(
        "Object.keys(localStorage).filter(k => k.includes('booking-draft'))"
    )
    print(f"draft keys in localStorage: {keys}")
    assert keys, "booking draft was not persisted to AsyncStorage"


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

    bad = [r for r in REPORT if r[1] or r[2]]
    print(f"\n{len(REPORT)} shots; {len(bad)} with errors/overflow:")
    for name, errs, overflow in bad:
        print(f"  {name}: errors={errs} overflow={overflow}")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
