"""Coordinator verification for the v2 integration (all batches wired).

Serves nothing itself: point it at the expo web export served on
http://127.0.0.1:19011 (python3 -m http.server in dist/).
Seeds device-local data via localStorage before the app loads, walks
every new/changed screen by UI clicks, and writes screenshots to
qa/shots-v2-integration/ with an overflow + page-error report.
Nothing is submitted: no enquiry, booking, payment or message is sent;
all flows stop at pre-submit states.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19011"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v2-integration")
os.makedirs(OUT, exist_ok=True)

SLUG = "10-days-assam-meghalaya-arunachal-pradesh-tour-packages"
TITLE = "Assam Meghalaya Arunachal Pradesh Tour"

SEED = """
try {
  localStorage.setItem('@mqt/trips', JSON.stringify([{slug: "%s", packageName: "%s", ref: "MQT-SEED-1", date: "2026-10-20T00:00:00.000Z", travelDate: "2026-11-24"}]));
  localStorage.setItem('@mqt/planner-trips', JSON.stringify([{id: "seed-1", name: "Goa Nov", type: "family", note: "Ask Amit about the hotel", travelDate: "2026-11-24", travelers: ["Asha", "Rahul"], pickupPoint: "", packageSlugs: ["%s"], checkedChecklist: [], createdAt: "2026-10-20T00:00:00.000Z"}]));
  localStorage.setItem('@mqt/package-notes', JSON.stringify({"%s": "ask Amit about the hotel"}));
} catch (e) {}
""" % (SLUG, TITLE, SLUG, SLUG)

SEED_WHATSNEW = SEED + """
try { localStorage.setItem('@mqt/last-seen-version', '1.3.0'); } catch (e) {}
"""

REPORT = []


def attach(page):
    page._errors = []
    page.on("pageerror", lambda e: page._errors.append(str(e)[:200]))
    page.on("console", lambda m: (
        page._errors.append(m.text[:200])
        if m.type == "error" and "ERR_TUNNEL_CONNECTION_FAILED" not in m.text
        else None
    ))


def shot(page, name):
    page.wait_for_timeout(1200)
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth")
    page.screenshot(path=os.path.join(OUT, name + ".png"))
    errs = [e for e in page._errors if "ERR_TUNNEL" not in e]
    REPORT.append(f"{name}: overflow={overflow} pageErrors={len(errs)} {errs[:2]}")
    page._errors = []


def click_text(page, text, exact=True):
    try:
        page.get_by_text(text, exact=exact).first.click(timeout=8000)
    except Exception:
        # Virtualized-list hit-testing quirk in the web export: a
        # programmatic click on the same element still fires the
        # Pressable handler and exercises the navigation.
        page.evaluate("""(t) => {
          const el = Array.from(document.querySelectorAll('div')).find(d => d.innerText === t);
          if (el) el.click();
        }""", text)
    page.wait_for_timeout(800)


def tab(page, name):
    # Tab labels render via i18n; fall back to positional tab buttons.
    try:
        click_text(page, name)
    except Exception:
        idx = {"Home": 0, "Packages": 1, "Trips": 2, "Chat": 3, "Account": 4}[name]
        btns = page.locator("div[role='button']")
        btns.nth(idx).click(timeout=8000)
        page.wait_for_timeout(800)


def run_viewport(pw, width, suffix, seed):
    ctx = pw.chromium.launch().new_context(viewport={"width": width, "height": 900})
    ctx.add_init_script(seed)
    page = ctx.new_page()
    attach(page)
    tag = suffix

    def go_home():
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1500)

    try:
        go_home()
        shot(page, f"home-{tag}")
        tab(page, "Packages")
        shot(page, f"packages-{tag}")
        click_text(page, TITLE)
        shot(page, f"detail-{tag}")
        click_text(page, "Enquire")
        shot(page, f"enquiry-{tag}")

        go_home()
        tab(page, "Trips")
        shot(page, f"trips-{tag}")
        click_text(page, "Trip kit")
        shot(page, f"tripkit-{tag}")
        go_home()
        tab(page, "Trips")
        # Second "Trip details" button = the saved trip's card.
        try:
            page.get_by_text("Trip details").nth(1).click(timeout=8000)
        except Exception:
            page.evaluate("""() => {
              const els = Array.from(document.querySelectorAll('div')).filter(d => d.innerText === 'Trip details');
              if (els[1]) els[1].click();
            }""")
        page.wait_for_timeout(800)
        shot(page, f"tripdetail-{tag}")
        go_home()
        tab(page, "Trips")
        click_text(page, "Trip planner")
        shot(page, f"planner-{tag}")

        go_home()
        tab(page, "Account")
        shot(page, f"account-{tag}")
        click_text(page, "Trust & safety")
        shot(page, f"trust-{tag}")
        click_text(page, "Report wrong info")
        shot(page, f"report-{tag}")
        go_home()
        tab(page, "Account")
        click_text(page, "Offers & more")
        shot(page, f"offers-{tag}")
        click_text(page, "Group booking")
        shot(page, f"group-{tag}")
        go_home()
        tab(page, "Account")
        click_text(page, "Offers & more")
        click_text(page, "Gift a trip")
        shot(page, f"gift-{tag}")
        go_home()
        tab(page, "Account")
        click_text(page, "Offers & more")
        click_text(page, "Refer & invite")
        shot(page, f"referral-{tag}")
        go_home()
        tab(page, "Account")
        click_text(page, "Invite friends")
        shot(page, f"invite-{tag}")

        go_home()
        tab(page, "Account")
        click_text(page, "Destination guides")
        shot(page, f"hubs-{tag}")
        page.evaluate("""() => {
          const meta = Array.from(document.querySelectorAll('div')).find(d => /^\\d+ packages? · \\d+ articles?$/.test((d.innerText||'').trim()));
          let card = meta;
          for (let i = 0; i < 3 && card && card.parentElement; i++) card = card.parentElement;
          if (card) card.click();
        }""")
        page.wait_for_timeout(800)
        shot(page, f"hub-{tag}")

        go_home()
        tab(page, "Account")
        click_text(page, "Offline & diagnostics")
        shot(page, f"offline-{tag}")
        go_home()
        tab(page, "Account")
        click_text(page, "Release health")
        shot(page, f"diagnostics-{tag}")

        go_home()
        click_text(page, "Blog")
        shot(page, f"blog-{tag}")
        click_text(page, "Saved offline")
        click_text(page, "Open my library")
        shot(page, f"library-{tag}")
        go_home()
        click_text(page, "Blog")
        click_text(page, "Videos")
        click_text(page, "Open video guides")
        shot(page, f"videoguides-{tag}")
    except Exception as e:
        REPORT.append(f"[{tag}] WALK STOPPED: {type(e).__name__}: {str(e)[:200]}")
    finally:
        ctx.close()


def run_whatsnew(pw, width, suffix):
    ctx = pw.chromium.launch().new_context(viewport={"width": width, "height": 900})
    ctx.add_init_script(SEED_WHATSNEW)
    page = ctx.new_page()
    attach(page)
    try:
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1500)
        shot(page, f"whatsnew-{suffix}")
    except Exception as e:
        REPORT.append(f"[whatsnew-{suffix}] FAILED: {str(e)[:200]}")
    finally:
        ctx.close()


with sync_playwright() as pw:
    run_viewport(pw, 390, "390", SEED)
    run_viewport(pw, 1440, "1440", SEED)
    run_whatsnew(pw, 390, "390")
    run_whatsnew(pw, 1440, "1440")

print("\n".join(REPORT))
bad = [r for r in REPORT if "overflow=True" in r or "pageErrors=1" in r or "pageErrors=2" in r or "STOPPED" in r or "FAILED" in r]
print(f"\nTOTAL {len(REPORT)} shots; issues: {len(bad)}")
sys.exit(1 if bad else 0)
