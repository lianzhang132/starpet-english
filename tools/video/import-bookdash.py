"""Import openly licensed illustrations from Book Dash's public reader.

Only an explicit reviewed list is fetched. Original bytes and provenance stay in
output/bookdash-sources; the APK contains rendered films and their credits.
"""
import concurrent.futures
import hashlib
import html
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "output" / "bookdash-sources"
BOOKS = ("come-back-cat", "a-house-for-mouse", "fifi-and-teddy",
         "little-goat", "sleepy-mr-sloth", "hippo-wants-to-dance")


def fetch(url):
    if not url.startswith("https://bookdash.org/"):
        raise ValueError("Only the reviewed publisher is allowed")
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "StarPetEnglish-content-review/1.0"})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read(16 * 1024 * 1024 + 1)
                if len(data) > 16 * 1024 * 1024:
                    raise ValueError("Source unexpectedly large")
                return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for slug in BOOKS:
        folder = DEST / slug
        folder.mkdir(exist_ok=True)
        page_url = f"https://bookdash.org/books/{slug}/"
        page_file = folder / "publisher.html"
        if not page_file.exists():
            page_file.write_bytes(fetch(page_url))
        page = page_file.read_text(encoding="utf-8")
        reader = page.split('id="read-book"', 1)[1].split("</main>", 1)[0]
        urls = list(dict.fromkeys(html.unescape(url) for url in re.findall(
            r'href="(https://bookdash\.org/wp-content/uploads/[^"<>]+\.(?:jpg|png))"', reader)))
        if not 10 <= len(urls) <= 22:
            raise ValueError(f"Review reader changes for {slug}: {len(urls)} images")
        def image(item):
            index, url = item
            target = folder / f"{index:02d}{Path(url).suffix}"
            if not target.exists():
                data = fetch(url)
                if not (data.startswith(b"\xff\xd8") or data.startswith(b"\x89PNG")):
                    raise ValueError("Unexpected image format")
                target.write_bytes(data)
            return {"index": index, "url": url, "file": target.name,
                    "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            images = list(pool.map(image, enumerate(urls)))
        creators_html = page.split("Created by", 1)[1].split("</section>", 1)[0]
        creators = [re.sub(r'<[^>]+>', '', x).strip() for x in re.findall(
            r'<h3[^>]*>(.*?)</h3>', creators_html, re.S)]
        creators = [x for x in creators if re.search(r'\((Writer|Illustrator|Designer|Editor)\)$', x)]
        if not creators or any('(' not in x or len(x.split('(')[0].strip()) < 3 for x in creators):
            raise ValueError(f"Creator credits need review: {slug}")
        manifest = {"publisher": "Book Dash", "page": page_url, "license": "CC BY 4.0",
                    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
                    "reusePolicy": "https://bookdash.org/re-using-the-book-dash-content/",
                    "creators": [html.unescape(x) for x in creators], "images": images}
        (folder / "provenance.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"book": slug, "images": len(images), "creators": manifest["creators"]}), flush=True)
    # Keep the full publisher policy with the reviewed source material.
    (DEST / "reuse-policy.html").write_bytes(fetch("https://bookdash.org/re-using-the-book-dash-content/"))


if __name__ == "__main__":
    main()
