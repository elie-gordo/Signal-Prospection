from datetime import date

from prospect_workers.audit.site import analyze

TODAY = date(2026, 10, 14)

MODERN = """<html><head><title>Atelier Lumière</title>
<meta name="viewport" content="width=device-width"></head>
<body><footer>© 2026 Atelier Lumière</footer></body></html>"""

OLD = """<html><head><title>Plomberie Martin</title>
<meta name="generator" content="WordPress 4.9"></head>
<body><img src="/wp-content/uploads/logo.png"><p>Copyright 2015 - 2019 Plomberie Martin</p></body></html>"""


def codes(result):
    return [i["code"] for i in result["issues"]]


def test_modern_site_scores_full():
    r = analyze(MODERN, "https://atelier.fr", 200, 800, "https://atelier.fr/")
    assert r["score"] == 100
    assert r["has_viewport"] and r["https"]
    assert r["copyright_year"] == 2026


def test_old_site_collects_issues():
    r = analyze(OLD, "http://plomberie-martin.fr", 200, 4200, "http://plomberie-martin.fr/", TODAY)
    assert r["cms"] == "wordpress"
    assert r["copyright_year"] == 2019
    assert set(codes(r)) == {"no_https", "slow", "no_viewport", "stale_copyright"}
    assert r["score"] == 100 - 25 - 15 - 25 - 10
    assert "Chargement lent (4.2 s)" in [i["label"] for i in r["issues"]]


def test_http_error_marks_unreachable():
    r = analyze("", "https://dead.fr", 503, 100, "https://dead.fr")
    assert r["reachable"] is False and r["score"] == 0
