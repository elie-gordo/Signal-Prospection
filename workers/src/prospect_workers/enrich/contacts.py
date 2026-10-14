"""Extract public business contact details (email, phone) from a company's own website."""
import re
from collections.abc import Iterable
from urllib.parse import unquote, urljoin, urlparse

import httpx
from selectolax.lexbor import LexborHTMLParser as HTMLParser

from .. import db
from ..config import USER_AGENT, Config

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}")
# must not touch other digits/letters: avoids matches inside SIREN, EUID, order numbers...
_PHONE = re.compile(r"(?<![\w.+])(?:(?:\+|00)33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)")
_CONTACT_HINT = re.compile(r"contact|mentions|legal|a-propos|about|nous-trouver", re.I)
NOISE_EMAIL = ("sentry", "wixpress", "example.", "domain.", "email.com", "yourdomain", "@2x", "godaddy")
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")
MAX_EXTRA_PAGES = 2


def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("0033"):
        digits = "0" + digits[4:]
    elif digits.startswith("33") and len(digits) == 11:
        digits = "0" + digits[2:]
    if len(digits) != 10 or not digits.startswith("0") or digits[1] == "0":
        return None
    return " ".join(digits[i:i + 2] for i in range(0, 10, 2))


def _clean_email(raw: str) -> str | None:
    email = unquote(raw).split("?")[0].strip().lower()
    if not _EMAIL.fullmatch(email) or email.endswith(IMAGE_EXT) or any(n in email for n in NOISE_EMAIL):
        return None
    return email


def _dedupe(items: Iterable[str | None]) -> list[str]:
    return list(dict.fromkeys(i for i in items if i))


def extract_contacts(html: str) -> tuple[list[str], list[str]]:
    """Emails and phones, explicit mailto:/tel: links first, then visible text."""
    tree = HTMLParser(html)
    for node in tree.css("script, style, noscript"):
        node.decompose()
    hrefs = [a.attributes.get("href") or "" for a in tree.css("a[href]")]
    text = tree.body.text(separator=" ") if tree.body else ""

    emails = _dedupe([_clean_email(h[7:]) for h in hrefs if h.lower().startswith("mailto:")]
                     + [_clean_email(m) for m in _EMAIL.findall(text)])
    phones = _dedupe([normalize_phone(h[4:]) for h in hrefs if h.lower().startswith("tel:")]
                     + [normalize_phone(m) for m in _PHONE.findall(text)])
    return emails, phones


def contact_links(html: str, base_url: str) -> list[str]:
    host = urlparse(base_url).netloc
    links = []
    for a in HTMLParser(html).css("a[href]"):
        href = a.attributes.get("href") or ""
        url = urljoin(base_url, href).split("#")[0]
        if urlparse(url).netloc == host and (_CONTACT_HINT.search(href) or _CONTACT_HINT.search(a.text())):
            links.append(url)
    return _dedupe(links)[:MAX_EXTRA_PAGES]


def best_email(emails: list[str], website: str) -> str | None:
    domain = urlparse(website).netloc.lower().removeprefix("www.")
    same_domain = [e for e in emails if e.endswith("@" + domain)]
    return (same_domain or emails or [None])[0]


def find_contacts(website: str, client: httpx.Client) -> tuple[str | None, str | None]:
    resp = client.get(website)
    resp.raise_for_status()
    emails, phones = extract_contacts(resp.text)
    for url in contact_links(resp.text, str(resp.url)):
        if emails and phones:
            break
        try:
            page = client.get(url)
        except httpx.HTTPError:
            continue
        more_emails, more_phones = extract_contacts(page.text)
        emails, phones = _dedupe(emails + more_emails), _dedupe(phones + more_phones)
    return best_email(emails, website), (phones or [None])[0]


def collect_contacts(cfg: Config, limit: int = 300) -> tuple[int, int]:
    """Returns (sites checked, companies with at least one contact)."""
    checked = with_contact = 0
    with db.connect(cfg.database_url) as conn, httpx.Client(
        timeout=10, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as client:
        rows = conn.execute(
            "SELECT id, website FROM companies WHERE website IS NOT NULL AND contacts_checked_at IS NULL LIMIT %s",
            (limit,),
        ).fetchall()
        for row in rows:
            try:
                email, phone = find_contacts(row["website"], client)
            except httpx.HTTPError:
                email = phone = None
            conn.execute(
                """UPDATE companies SET contacts_checked_at = now(), updated_at = now(),
                     email = COALESCE(email, %s), phone = COALESCE(phone, %s) WHERE id = %s""",
                (email, phone, row["id"]),
            )
            conn.commit()
            checked += 1
            with_contact += bool(email or phone)
    return checked, with_contact
