import re
import time
import unicodedata
from typing import Any

import httpx
from selectolax.lexbor import LexborHTMLParser as HTMLParser

from .. import db
from ..config import USER_AGENT, Config

API = "https://recherche-entreprises.api.gouv.fr/search"
RATE_DELAY_S = 0.15
GUESS_TIMEOUT_S = 5
LEGAL_FORMS = {"sas", "sasu", "sarl", "eurl", "sa", "sci", "snc", "selarl", "scop", "ei", "eirl"}


def map_result(r: dict[str, Any]) -> dict[str, Any]:
    siege = r.get("siege") or {}
    director = None
    for d in r.get("dirigeants") or []:
        if d.get("denomination"):
            director = d["denomination"]
        else:
            director = " ".join(filter(None, [d.get("prenoms"), d.get("nom")])).title() or None
        if director:
            break
    return {
        "naf_code": r.get("activite_principale") or siege.get("activite_principale"),
        "address": siege.get("adresse"),
        "postal_code": siege.get("code_postal"),
        "city": siege.get("libelle_commune"),
        "department": siege.get("departement"),
        "founded_on": r.get("date_creation"),
        "employee_range": r.get("tranche_effectif_salarie"),
        "director_name": director,
    }


STOPWORDS = {"les", "des", "and", "the", "aux", "pour", "chez", "sur", "par", "une", "groupe", "france", "societe"}


def _ascii(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def name_tokens(name: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", _ascii(name)) if t not in LEGAL_FORMS]


def significant_tokens(name: str) -> list[str]:
    return [t for t in name_tokens(name) if len(t) > 2 and t not in STOPWORDS]


def slug_candidates(name: str) -> list[str]:
    tokens = name_tokens(name)
    if not tokens:
        return []
    slugs = dict.fromkeys(["".join(tokens), "-".join(tokens)])
    return [f"https://{s}.{tld}" for s in slugs for tld in ("fr", "com")]


MIN_DISTINCTIVE_CHARS = 7  # shorter names ("Alba", "Deben") collide with unrelated domains


def is_guessable(name: str) -> bool:
    if "," in name or re.match(r"\s*sci\b", _ascii(name)):
        return False  # individuals and real-estate holdings
    return sum(len(t) for t in significant_tokens(name)) >= MIN_DISTINCTIVE_CHARS


def page_matches(html: str, name: str) -> bool:
    """Every significant token of the company name must appear in the page title or og:site_name."""
    tokens = significant_tokens(name)
    if not tokens:
        return False
    tree = HTMLParser(html)
    title = tree.css_first("title")
    site_name = tree.css_first('meta[property="og:site_name"]')
    label = _ascii(" ".join(filter(None, [
        title.text() if title else "",
        site_name.attributes.get("content") if site_name else "",
    ])))
    return all(re.search(rf"\b{re.escape(t)}", label) for t in tokens)


def guess_website(name: str, client: httpx.Client) -> str | None:
    if not is_guessable(name):
        return None
    for url in slug_candidates(name):
        try:
            resp = client.get(url)
        except httpx.HTTPError:
            continue
        if resp.status_code == 200 and page_matches(resp.text, name):
            return str(resp.url)
    return None


def enrich(cfg: Config, limit: int = 5000) -> int:
    done = 0
    with db.connect(cfg.database_url) as conn, httpx.Client(timeout=20) as api, httpx.Client(
        timeout=GUESS_TIMEOUT_S, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as web:
        rows = conn.execute(
            "SELECT id, siren, name, website FROM companies WHERE siren IS NOT NULL AND enriched_at IS NULL LIMIT %s",
            (limit,),
        ).fetchall()
        for row in rows:
            data: dict[str, Any] = {}
            try:
                resp = api.get(API, params={"q": row["siren"], "per_page": 1})
                resp.raise_for_status()
                results = resp.json().get("results") or []
                if results and results[0].get("siren") == row["siren"]:
                    data = map_result(results[0])
            except httpx.HTTPError as exc:
                print(f"  enrich {row['siren']} failed: {exc!r}")
                time.sleep(RATE_DELAY_S)
                continue
            # websites are found later by `discover` (search + ownership proof), never guessed here
            website = row["website"]
            conn.execute(
                """
                UPDATE companies SET
                  naf_code = COALESCE(%(naf_code)s, naf_code),
                  address = COALESCE(%(address)s, address),
                  postal_code = COALESCE(%(postal_code)s, postal_code),
                  city = COALESCE(%(city)s, city),
                  department = COALESCE(%(department)s, department),
                  founded_on = COALESCE(%(founded_on)s, founded_on),
                  employee_range = COALESCE(%(employee_range)s, employee_range),
                  director_name = COALESCE(%(director_name)s, director_name),
                  website = %(website)s::text,
                  website_source = CASE WHEN website IS NULL AND %(website)s::text IS NOT NULL THEN 'guessed'
                                        ELSE website_source END,
                  enriched_at = now(), updated_at = now()
                WHERE id = %(id)s
                """,
                {
                    **{k: None for k in ("naf_code", "address", "postal_code", "city", "department",
                                         "founded_on", "employee_range", "director_name")},
                    **data,
                    "website": website,
                    "id": row["id"],
                },
            )
            conn.commit()
            done += 1
            time.sleep(RATE_DELAY_S)
    return done
