import re
import time
from datetime import date
from typing import Any

import httpx
from selectolax.lexbor import LexborHTMLParser as HTMLParser

from .. import db
from ..config import USER_AGENT, Config

TIMEOUT_S = 10
SLOW_MS = 3000
VERY_SLOW_MS = 6000
HEAVY_KB = 3000
STALE_YEARS = 2
_COPYRIGHT = re.compile(r"(?:©|&copy;|copyright)[^0-9]{0,20}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?", re.I)

CMS_MARKERS = [
    ("wordpress", re.compile(r"wp-content|wp-includes", re.I)),
    ("shopify", re.compile(r"cdn\.shopify\.com|Shopify\.theme", re.I)),
    ("wix", re.compile(r"wixstatic\.com|_wixCIDX|wix\.com", re.I)),
    ("squarespace", re.compile(r"squarespace\.com|static1\.squarespace", re.I)),
    ("webflow", re.compile(r"webflow\.(?:com|io)|data-wf-page", re.I)),
    ("prestashop", re.compile(r"prestashop", re.I)),
    ("jimdo", re.compile(r"jimdo", re.I)),
]


def _issue(code: str, label: str, penalty: int) -> dict[str, Any]:
    return {"code": code, "label": label, "penalty": penalty}


def detect_cms(html: str, tree: HTMLParser) -> str | None:
    gen = tree.css_first('meta[name="generator"]')
    content = (gen.attributes.get("content") or "").lower() if gen else ""
    for name, pattern in CMS_MARKERS:
        if name in content or pattern.search(html):
            return name
    return content.split(" ")[0] or None


def copyright_year(html: str) -> int | None:
    years = [int(y) for m in _COPYRIGHT.finditer(html) for y in m.groups() if y]
    return max(years) if years else None


def unreachable(url: str, status: int | None) -> dict[str, Any]:
    return {
        "url": url, "reachable": False, "status_code": status, "https": url.startswith("https"),
        "load_ms": None, "page_weight_kb": None, "has_viewport": None, "cms": None,
        "copyright_year": None, "title": None, "score": 0,
        "issues": [_issue("unreachable", "Site inaccessible" + (f" (HTTP {status})" if status else ""), 100)],
    }


def analyze(html: str, url: str, status: int, elapsed_ms: int, final_url: str, today: date | None = None) -> dict[str, Any]:
    if status >= 400:
        return unreachable(url, status)
    today = today or date.today()
    tree = HTMLParser(html)
    https = final_url.startswith("https://")
    weight_kb = len(html.encode("utf-8")) // 1024
    has_viewport = tree.css_first('meta[name="viewport"]') is not None
    title_node = tree.css_first("title")
    title = title_node.text(strip=True) if title_node else None
    year = copyright_year(html)

    issues = []
    if not https:
        issues.append(_issue("no_https", "Pas de HTTPS", 25))
    if elapsed_ms >= VERY_SLOW_MS:
        issues.append(_issue("very_slow", f"Chargement très lent ({elapsed_ms / 1000:.1f} s)", 25))
    elif elapsed_ms >= SLOW_MS:
        issues.append(_issue("slow", f"Chargement lent ({elapsed_ms / 1000:.1f} s)", 15))
    if not has_viewport:
        issues.append(_issue("no_viewport", "Pas responsive (meta viewport absente)", 25))
    if year and today.year - year >= STALE_YEARS:
        issues.append(_issue("stale_copyright", f"Copyright figé en {year}", 10))
    if not title:
        issues.append(_issue("no_title", "Balise title manquante", 5))
    if weight_kb >= HEAVY_KB:
        issues.append(_issue("heavy", f"Page HTML lourde ({weight_kb} Ko)", 10))
    cms = detect_cms(html, tree)
    if cms in ("wix", "jimdo"):
        issues.append(_issue("site_builder", f"Site construit avec {cms.capitalize()}", 5))

    return {
        "url": url, "reachable": True, "status_code": status, "https": https,
        "load_ms": elapsed_ms, "page_weight_kb": weight_kb, "has_viewport": has_viewport,
        "cms": cms, "copyright_year": year, "title": title[:300] if title else None,
        "score": max(0, 100 - sum(i["penalty"] for i in issues)), "issues": issues,
    }


def fetch_and_analyze(url: str, client: httpx.Client) -> dict[str, Any]:
    start = time.perf_counter()
    try:
        resp = client.get(url)
    except httpx.HTTPError:
        return unreachable(url, None)
    elapsed = int((time.perf_counter() - start) * 1000)
    return analyze(resp.text, url, resp.status_code, elapsed, str(resp.url))


def audit(cfg: Config, limit: int = 50) -> int:
    done = 0
    with db.connect(cfg.database_url) as conn, httpx.Client(
        timeout=TIMEOUT_S, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as client:
        rows = conn.execute(
            """
            SELECT c.id, c.website FROM companies c
            WHERE c.website IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM site_audits a WHERE a.company_id = c.id AND a.checked_at > now() - interval '30 days')
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
        for row in rows:
            result = fetch_and_analyze(row["website"], client)
            conn.execute(
                """
                INSERT INTO site_audits (company_id, url, reachable, status_code, https, load_ms, page_weight_kb,
                                         has_viewport, cms, copyright_year, title, score, issues)
                VALUES (%(company_id)s, %(url)s, %(reachable)s, %(status_code)s, %(https)s, %(load_ms)s,
                        %(page_weight_kb)s, %(has_viewport)s, %(cms)s, %(copyright_year)s, %(title)s,
                        %(score)s, %(issues)s)
                """,
                {**result, "issues": db.Jsonb(result["issues"]), "company_id": row["id"]},
            )
            conn.commit()
            done += 1
    return done
