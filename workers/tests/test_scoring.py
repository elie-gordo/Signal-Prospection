from datetime import date, datetime, timedelta, timezone

from prospect_workers.scoring import score_lead

NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
NAF = ["47", "56"]


def labels(reasons):
    return [r["label"] for r in reasons]


def test_project_with_automation_need_and_big_budget_scores_high():
    lead = {"signal": "project_posted", "title": "Automatisation n8n + site web",
            "description": "", "budget_min": 1000, "budget_max": 10000,
            "published_at": NOW - timedelta(hours=2), "raw": {"categories": []}}
    score, reasons = score_lead(lead, None, None, NOW)
    assert score == 100  # 40+15+20+20+10 = 105, clamped
    assert "Besoin automatisation / IA" in labels(reasons)


def test_old_small_project_is_penalised():
    lead = {"signal": "project_posted", "title": "Logo pour boulangerie", "description": "",
            "budget_min": None, "budget_max": 500, "published_at": NOW - timedelta(days=10),
            "raw": {"categories": ["Logo"]}}
    score, _ = score_lead(lead, None, None, NOW)
    assert score == 0  # 40 - 15 (old) - 40 (logo is off-scope), clamped


def test_ia_keyword_requires_word_boundary():
    lead = {"signal": "project_posted", "title": "Refonte média social", "description": "",
            "raw": {"categories": []}}
    _, reasons = score_lead(lead, None, None, NOW)
    assert "Besoin automatisation / IA" not in labels(reasons)


def test_new_company_in_target_sector_without_site():
    company = {"name": "BOULANGERIE DU PARC", "naf_code": "56.10A", "website": None,
               "founded_on": date(2026, 10, 1), "enriched_at": NOW, "discovered_at": NOW}
    score, reasons = score_lead({"signal": "new_company"}, company, None, NOW, NAF)
    assert score == 80  # 25+20+25+10
    assert "Aucun site web trouvé" in labels(reasons)


def test_unenriched_company_does_not_claim_missing_website():
    company = {"name": "BOULANGERIE DU PARC", "naf_code": None, "website": None,
               "founded_on": None, "enriched_at": None}
    score, reasons = score_lead({"signal": "new_company"}, company, None, NOW, NAF)
    assert "Aucun site web trouvé" not in labels(reasons)
    assert score == 25


def test_excluded_sector_is_pushed_down():
    company = {"name": "LIVRAISON EXPRESS", "naf_code": "53.20Z", "website": None,
               "founded_on": date(2026, 10, 1), "enriched_at": NOW, "discovered_at": NOW}
    score, reasons = score_lead({"signal": "new_company"}, company, None, NOW, NAF, ["5320"])
    assert any(r["label"].startswith("Hors cible") for r in reasons)
    assert score < 50


def test_existing_company_is_not_called_recently_created():
    company = {"name": "Augelon, Sylvain", "naf_code": "47.91B", "website": None,
               "founded_on": date(2012, 3, 1), "enriched_at": NOW, "discovered_at": NOW}
    score, reasons = score_lead({"signal": "new_company"}, company, None, NOW, NAF)
    assert "Créée il y a moins de 30 jours" not in labels(reasons)
    assert any(r["label"].startswith("Entreprise existante") for r in reasons)
    assert score == 55  # 25+20+25-10-5


def test_off_scope_project_is_penalised():
    lead = {"signal": "project_posted", "title": "Finalisation d'un film d'animation 2D réalisé avec l'IA",
            "description": "", "budget_min": 1000, "budget_max": 10000,
            "published_at": NOW - timedelta(hours=2), "raw": {"categories": []}}
    score, reasons = score_lead(lead, None, None, NOW)
    assert "Hors cœur de métier" in labels(reasons)
    assert score < 70


def test_new_company_with_weak_site_and_personal_name():
    company = {"name": "Dupont, Jean", "naf_code": "62.01Z", "website": "https://x.fr",
               "founded_on": date(2026, 1, 1), "enriched_at": NOW}
    score, _ = score_lead({"signal": "new_company"}, company, {"score": 40}, NOW, NAF)
    assert score == 40  # 25+20-5


def test_score_never_negative():
    lead = {"signal": "unknown"}
    assert score_lead(lead, None, None, NOW) == (0, [])


def test_missing_website_only_claimed_after_web_search():
    company = {"name": "BOULANGERIE DU PARC", "naf_code": "56.10A", "website": None,
               "founded_on": date(2026, 10, 1), "enriched_at": NOW, "discovered_at": None}
    _, reasons = score_lead({"signal": "new_company"}, company, None, NOW, NAF)
    assert "Aucun site web trouvé" not in labels(reasons)


def test_contactable_company_gets_bonus():
    company = {"name": "SALON NACRE", "naf_code": "96.02A", "website": "https://salon-nacre.example",
               "founded_on": date(2026, 10, 1), "enriched_at": NOW, "discovered_at": NOW,
               "email": "bonjour@salon-nacre.example", "phone": None}
    score, reasons = score_lead({"signal": "new_company"}, company, {"score": 90}, NOW, ["9602"])
    assert "Contactable (email ou téléphone)" in labels(reasons)
    assert score == 65  # 25+20+10+10
