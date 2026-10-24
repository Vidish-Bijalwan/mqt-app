"""Focused check for item 97: a genuinely new post in a followed
category creates exactly one in-app centre entry; nothing is pushed.
Seeds the blog-feed cache (the live fetch fails in this sandbox, so
the hook falls back to cache) with one new Pilgrimage post, follows
Pilgrimage, taps 'Check for new guides' on the Blog screen, then
reads the centre store from localStorage. Temporary; QA bundle in
/tmp/v2-dist (pre-retry-edit build, check logic unchanged).
"""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:19007"
SEED = """
() => {
  const posts = [{slug: 'test-new-guide-97', title: 'Test New Guide 97',
    excerpt: 'Seeded test post.', coverImage: '', category: 'Pilgrimage',
    publishedAt: '2026-10-25T00:00:00.000Z'}];
  localStorage.setItem('@mqt/blogposts', JSON.stringify({posts, cachedAt: Date.now()}));
  localStorage.setItem('@mqt/blog-followed-categories', JSON.stringify(['Pilgrimage']));
  localStorage.removeItem('@mqt/blog-seen-slugs');
  localStorage.removeItem('@mqt/notifications');
}
"""

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 900})
    ctx.add_init_script(f"({SEED})()")
    page = ctx.new_page()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.get_by_text("Blog", exact=True).last.click(timeout=15000)
    page.wait_for_timeout(1500)
    # The seeded cached post should render in the feed.
    feed_count = page.get_by_text("Test New Guide 97", exact=True).count()
    print("feed_post_visible:", feed_count)
    page.get_by_text("Check for new guides", exact=True).click(timeout=15000)
    page.wait_for_timeout(1500)
    result = page.get_by_text("new guide", exact=False).count()
    print("result_text_present:", result)
    entries = page.evaluate(
        "() => JSON.parse(localStorage.getItem('@mqt/notifications') || '[]')"
    )
    print("centre_entries:", json.dumps(entries, indent=1)[:800])
    print("centre_count:", len(entries))
    seen = page.evaluate(
        "() => JSON.parse(localStorage.getItem('@mqt/blog-seen-slugs') || '[]')"
    )
    print("seen_contains_new_slug:", "test-new-guide-97" in seen)
    browser.close()
