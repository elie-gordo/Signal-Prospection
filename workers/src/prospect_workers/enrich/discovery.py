"""Find a company's real website through the local SearXNG meta search engine."""
import re
import time
from difflib import SequenceMatcher
from urllib.parse import urlparse

import httpx

from .. import db
from ..config import USER_AGENT, Config
from .contacts import contact_links
from .recherche_entreprises import _ascii, name_tokens

SEARCH_DELAY_S = 1.5  # spread load over the upstream engines
MIN_SIMILARITY = 0.8  # domain label vs compact company name
MIN_NAME_CHARS = 4
MAX_CANDIDATES = 3  # each candidate costs up to 3 page fetches for ownership verification

DIRECTORY_DOMAINS = (
    "pagesjaunes.", "yelp.", "facebook.", "instagram.", "linkedin.", "tiktok.", "youtube.", "twitter.", "x.com",
    "pinterest.", "tripadvisor.", "thefork.", "lafourchette.", "google.", "societe.com", "pappers.", "verif.com",
    "infogreffe.", "annuaire-entreprises.", "manageo.", "kompass.", "cylex", "hoodspot.", "118712.", "mappy.",
    "justacote.", "ubereats.", "deliveroo.", "just-eat.", "doctolib.", "planity.", "treatwell.", "wikipedia.",
    "leboncoin.", "indeed.", "welcometothejungle.", "lefigaro.", "bodacc.", "legalstart.", "petitfute.",
    "restaurantguru.", "sortiraparis.", "uneboulangerie.", "boulangeriespatisseries.", "data.gouv.", "infonet.",
    "corporama.", "score3.", "entreprise.", "annuaire",
)

# sector / place words that appear in many unrelated domains, so they cannot prove ownership
GENERIC_TOKENS = {
    "boulangerie", "patisserie", "restaurant", "resto", "cafe", "bar", "brasserie", "bistrot", "traiteur", "pizza",
    "salon", "coiffure", "coiffeur", "institut", "beaute", "spa", "onglerie", "barber", "barbier", "fitness",
    "sport", "studio", "club", "boutique", "shop", "store", "epicerie", "cave", "fleuriste", "pharmacie",
    "plomberie", "plombier", "electricite", "renovation", "batiment", "travaux", "cabinet", "kine", "osteo",
    "paris", "france", "groupe", "holding", "services", "service", "conseil", "international", "maison",
    "atelier", "garage", "auto", "gastronomie", "food", "market", "consulting", "company", "les", "des", "and",
}


def parse_results(payload: dict) -> list[str]:
    return [r["url"] for r in payload.get("results") or [] if str(r.get("url", "")).startswith("http")]


def distinctive_tokens(name: str) -> list[str]:
    return [t for t in name_tokens(name) if len(t) >= 3 and t not in GENERIC_TOKENS]


def name_variants(name: str) -> list[str]:
    """Compact forms a domain could take: full name, and name without generic words."""
    variants = ["".join(name_tokens(name)), "".join(distinctive_tokens(name))]
    return [v for v in dict.fromkeys(variants) if len(v) >= MIN_NAME_CHARS]


def candidate_websites(name: str, urls: list[str]) -> list[str]:
    """Non-directory results whose domain closely matches the whole company name, in result order.

    Containing one word of the name is not enough ("vigie" -> vigiecard.com, "cedres" -> lescedresduliban.com).
    """
    if not distinctive_tokens(name):
        return []
    variants = name_variants(name)
    roots = []
    for url in urls:
        host = urlparse(url).netloc.lower().removeprefix("www.")
        if not host or any(d in host for d in DIRECTORY_DOMAINS):
            continue
        label = re.sub(r"[^a-z0-9]", "", _ascii(host.rsplit(".", 1)[0]))
        if any(SequenceMatcher(None, label, v).ratio() >= MIN_SIMILARITY for v in variants):
            roots.append(f"{urlparse(url).scheme}://{urlparse(url).netloc}/")
    return list(dict.fromkeys(roots))


def pick_website(name: str, urls: list[str]) -> str | None:
    return next(iter(candidate_websites(name, urls)), None)


STREET_WORDS = {"rue", "avenue", "av", "bd", "boulevard", "place", "chemin", "allee", "impasse", "quai", "route",
                "cours", "passage", "villa", "square", "rond", "point", "bis", "ter", "les", "des", "del"}


def _street_token(address: str | None, postal_code: str | None) -> str | None:
    words = re.findall(r"[a-z]+", _ascii(address or ""))
    city_words = set(re.findall(r"[a-z]+", _ascii((address or "").split(postal_code or "\0")[-1]))) if postal_code else set()
    candidates = [w for w in words if len(w) >= 4 and w not in STREET_WORDS and w not in city_words]
    return max(candidates, key=len) if candidates else None


def owns_site(pages: list[str], company: dict) -> bool:
    """A site belongs to the company only if it shows its SIREN, or its postal code and street name."""
    text = _ascii(" ".join(pages))
    siren = re.sub(r"\D", "", company.get("siren") or "")
    if len(siren) == 9 and re.search(r"(?<!\d)" + r"[\s.]?".join(siren) + r"(?!\d)", text):
        return True
    postal, street = company.get("postal_code"), _street_token(company.get("address"), company.get("postal_code"))
    return bool(postal and street and postal in text and street in text)


def fetch_site_pages(url: str, client: httpx.Client) -> list[str]:
    resp = client.get(url)
    resp.raise_for_status()
    pages = [resp.text]
    for link in contact_links(resp.text, str(resp.url)):
        try:
            pages.append(client.get(link).text)
        except httpx.HTTPError:
            continue
    return pages


def search(query: str, client: httpx.Client, searxng_url: str) -> list[str] | None:
    """Returns result URLs, or None when every upstream engine is failing (rate limited)."""
    resp = client.get(f"{searxng_url}/search", params={"q": query, "format": "json", "language": "fr-FR"})
    resp.raise_for_status()
    payload = resp.json()
    urls = parse_results(payload)
    if not urls and payload.get("unresponsive_engines"):
        return None
    return urls


def first_owned_site(candidates: list[str], company: dict, client: httpx.Client) -> str | None:
    for url in candidates[:MAX_CANDIDATES]:
        try:
            if owns_site(fetch_site_pages(url, client), company):
                return url
        except httpx.HTTPError:
            continue
    return None


def _is_target(naf_code: str | None, cfg: Config) -> bool:
    naf = (naf_code or "").replace(".", "")
    return any(naf.startswith(p) for p in cfg.naf_prefixes) and not any(
        naf.startswith(p) for p in cfg.excluded_naf_prefixes
    )


def discover(cfg: Config, limit: int = 300) -> tuple[int, int]:
    """Search websites for target-sector companies with none yet. Returns (searched, found)."""
    searched = found = 0
    with db.connect(cfg.database_url) as conn, httpx.Client(
        timeout=15, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as client:
        rows = conn.execute(
            """
            SELECT id, name, city, naf_code, siren, postal_code, address FROM companies
            WHERE enriched_at IS NOT NULL AND website IS NULL AND discovered_at IS NULL
            ORDER BY founded_on DESC NULLS LAST
            """
        ).fetchall()
        for row in [r for r in rows if _is_target(r["naf_code"], cfg)][:limit]:
            if "," in row["name"]:  # individual entrepreneurs: name search is too ambiguous
                conn.execute("UPDATE companies SET discovered_at = now() WHERE id = %s", (row["id"],))
                conn.commit()
                continue
            query = " ".join(name_tokens(row["name"])) + (f" {row['city']}" if row["city"] else "")
            try:
                urls = search(query, client, cfg.searxng_url)
            except httpx.HTTPError as exc:
                print(f"  search failed for {row['name']!r}: {exc!r}")
                continue
            if urls is None:
                print("  all search engines are failing, stopping discovery for this run")
                break
            website = first_owned_site(candidate_websites(row["name"], urls), row, client)
            conn.execute(
                """UPDATE companies SET discovered_at = now(), updated_at = now(),
                     website = COALESCE(website, %(w)s::text),
                     website_source = CASE WHEN website IS NULL AND %(w)s::text IS NOT NULL THEN 'search'
                                           ELSE website_source END
                   WHERE id = %(id)s""",
                {"w": website, "id": row["id"]},
            )
            conn.commit()
            searched += 1
            found += website is not None
            time.sleep(SEARCH_DELAY_S)
    return searched, found
