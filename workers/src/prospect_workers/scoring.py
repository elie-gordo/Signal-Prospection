import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from . import db
from .config import Config

WEB_KEYWORDS = ["site", "site web", "web", "wordpress", "shopify", "e-commerce", "ecommerce",
                "boutique", "landing", "react", "next", "front-end", "full-stack"]
AUTOMATION_KEYWORDS = ["automatisation", "automation", "n8n", "ia", "intelligence artificielle",
                       "chatbot", "api", "scraping", "make", "zapier", "gpt"]
# creative / marketing gigs that match "ia" or "site" but are not dev work
OFF_SCOPE_KEYWORDS = ["film", "vidéo", "video", "montage", "animation 2d", "animation 3d", "logo", "graphiste",
                      "illustration", "traduction", "rédaction", "redaction", "community manager",
                      "google ads", "photographe", "voix off", "téléphone rose", "telephone rose"]
EXISTING_COMPANY_DAYS = 365


def _has_any(text: str, words: list[str]) -> bool:
    return any(re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", text) for w in words)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _project_rules(lead: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    reasons = [{"label": "Projet publié (besoin exprimé)", "points": 40}]
    text = " ".join(
        [lead.get("title") or "", lead.get("description") or "",
         " ".join((lead.get("raw") or {}).get("categories") or [])]
    ).lower()
    if _has_any(text, WEB_KEYWORDS):
        reasons.append({"label": "Besoin web / e-commerce", "points": 15})
    if _has_any(text, AUTOMATION_KEYWORDS):
        reasons.append({"label": "Besoin automatisation / IA", "points": 20})
    if _has_any(text, OFF_SCOPE_KEYWORDS):
        reasons.append({"label": "Hors cœur de métier", "points": -40})
    budget = lead.get("budget_max") or lead.get("budget_min") or 0
    if budget >= 5000:
        reasons.append({"label": f"Budget élevé (jusqu'à {budget} €)", "points": 20})
    elif budget >= 1000:
        reasons.append({"label": f"Budget correct (jusqu'à {budget} €)", "points": 10})
    published = lead.get("published_at")
    if published:
        age = now - _aware(published)
        if age < timedelta(hours=24):
            reasons.append({"label": "Publié il y a moins de 24 h", "points": 10})
        elif age > timedelta(days=7):
            reasons.append({"label": "Publié il y a plus de 7 jours", "points": -15})
    return reasons


def _company_rules(company: dict[str, Any] | None, audit: dict[str, Any] | None,
                   naf_prefixes: list[str], excluded_prefixes: list[str], today: date) -> list[dict[str, Any]]:
    reasons = [{"label": "Nouvelle activité immatriculée", "points": 25}]
    if not company:
        return reasons
    naf = (company.get("naf_code") or "").replace(".", "")
    if naf and any(naf.startswith(p) for p in excluded_prefixes):
        reasons.append({"label": f"Hors cible (NAF {company['naf_code']})", "points": -40})
    elif naf and any(naf.startswith(p) for p in naf_prefixes):
        reasons.append({"label": f"Secteur cible (NAF {company['naf_code']})", "points": 20})
    # website absence is only meaningful once a web search actually looked for one
    if company.get("discovered_at") and not company.get("website"):
        reasons.append({"label": "Aucun site web trouvé", "points": 25})
    elif company.get("website") and audit:
        if audit["score"] < 50:
            reasons.append({"label": f"Site faible (audit {audit['score']}/100)", "points": 20})
        elif audit["score"] < 75:
            reasons.append({"label": f"Site perfectible (audit {audit['score']}/100)", "points": 10})
    if company.get("email") or company.get("phone"):
        reasons.append({"label": "Contactable (email ou téléphone)", "points": 10})
    founded = company.get("founded_on")
    if founded and (today - founded).days <= 30:
        reasons.append({"label": "Créée il y a moins de 30 jours", "points": 10})
    elif founded and (today - founded).days > EXISTING_COMPANY_DAYS:
        reasons.append({"label": f"Entreprise existante (créée en {founded.year})", "points": -10})
    if "," in (company.get("name") or ""):
        reasons.append({"label": "Entrepreneur individuel", "points": -5})
    return reasons


def score_lead(lead: dict[str, Any], company: dict[str, Any] | None, audit: dict[str, Any] | None,
               now: datetime, naf_prefixes: list[str] | None = None,
               excluded_prefixes: list[str] | None = None) -> tuple[int, list[dict[str, Any]]]:
    now = _aware(now)
    if lead["signal"] == "project_posted":
        reasons = _project_rules(lead, now)
    elif lead["signal"] == "new_company":
        reasons = _company_rules(company, audit, naf_prefixes or [], excluded_prefixes or [], now.date())
    else:
        reasons = []
    total = max(0, min(100, sum(r["points"] for r in reasons)))
    return total, reasons


def rescore(cfg: Config) -> int:
    now = datetime.now(timezone.utc)
    with db.connect(cfg.database_url) as conn:
        rows = conn.execute(
            """
            SELECT l.id, l.signal, l.title, l.description, l.budget_min, l.budget_max, l.published_at, l.raw,
                   to_jsonb(c) AS company,
                   (SELECT to_jsonb(a) FROM site_audits a WHERE a.company_id = c.id
                    ORDER BY a.checked_at DESC LIMIT 1) AS audit
            FROM leads l LEFT JOIN companies c ON c.id = l.company_id
            WHERE l.status IN ('new', 'qualified')
            """
        ).fetchall()
        for row in rows:
            company = row["company"]
            if company and company.get("founded_on"):
                company["founded_on"] = date.fromisoformat(company["founded_on"])
            score, reasons = score_lead(row, company, row["audit"], now, cfg.naf_prefixes, cfg.excluded_naf_prefixes)
            conn.execute(
                "UPDATE leads SET score = %s, score_reasons = %s, updated_at = now() WHERE id = %s",
                (score, db.Jsonb(reasons), row["id"]),
            )
        conn.commit()
    return len(rows)
