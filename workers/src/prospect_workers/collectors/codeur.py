import html as htmllib
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from typing import Any

import httpx
from selectolax.lexbor import LexborHTMLParser as HTMLParser

from .. import db
from ..config import USER_AGENT, Config

RSS_URL = "https://www.codeur.com/projects.rss"
_AMOUNT = re.compile(r"\d[\d\s  ]*")
_META = re.compile(r"Budget\s*:\s*(?P<budget>.*?)\s*-\s*Cat[ée]gories\s*:\s*(?P<cats>.*)", re.S)


def _amounts(text: str) -> list[int]:
    return [int(re.sub(r"\D", "", m)) for m in _AMOUNT.findall(text)]


def parse_budget(text: str) -> tuple[int | None, int | None]:
    t = text.lower()
    nums = _amounts(t)
    if not nums:
        return None, None
    if t.startswith("moins"):
        return None, nums[0]
    if t.startswith("plus"):
        return nums[0], None
    if len(nums) >= 2:
        return nums[0], nums[1]
    return nums[0], nums[0]


def parse_item(item: ET.Element) -> dict[str, Any]:
    html = item.findtext("description") or ""
    paragraphs = [p.text(strip=True) for p in HTMLParser(html).css("p")]
    meta = _META.search(paragraphs[0]) if paragraphs else None
    budget_min, budget_max = parse_budget(meta["budget"]) if meta else (None, None)
    categories = [c.strip() for c in meta["cats"].split(",")] if meta else []
    summary = next((p for p in paragraphs[1:] if p and not p.startswith("http")), "")
    pub = item.findtext("pubDate")
    return {
        "source": "codeur",
        "external_id": (item.findtext("guid") or "").strip(),
        "signal": "project_posted",
        # the feed double-escapes entities ("&amp;#39;")
        "title": htmllib.unescape((item.findtext("title") or "").strip()),
        "description": htmllib.unescape(summary.rstrip(" …").strip()) or None,
        "url": item.findtext("link"),
        "budget_min": budget_min,
        "budget_max": budget_max,
        "published_at": parsedate_to_datetime(pub) if pub else None,
        "raw": {"categories": categories, "budget_label": meta["budget"] if meta else None},
    }


def parse_feed(xml_text: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    return [parse_item(i) for i in root.iter("item")]


def matches(lead: dict[str, Any], keywords: list[str]) -> bool:
    haystack = " ".join(
        [lead["title"], lead.get("description") or "", " ".join(lead["raw"]["categories"])]
    ).lower()
    return any(re.search(rf"(?<![\w-]){re.escape(k.lower())}(?![\w-])", haystack) for k in keywords)


def collect(cfg: Config) -> tuple[int, int]:
    fetched = inserted = 0
    with db.connect(cfg.database_url) as conn:
        run_id = db.start_run(conn, "codeur")
        conn.commit()
        error = None
        try:
            resp = httpx.get(RSS_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
            resp.raise_for_status()
            leads = parse_feed(resp.text)
            fetched = len(leads)
            for lead in leads:
                if lead["external_id"] and matches(lead, cfg.codeur_keywords):
                    inserted += db.upsert_lead(conn, lead)
            conn.commit()
        except Exception as exc:  # recorded in collector_runs, then re-raised
            conn.rollback()
            error = repr(exc)
            raise
        finally:
            db.finish_run(conn, run_id, fetched, inserted, error)
            conn.commit()
    return fetched, inserted
