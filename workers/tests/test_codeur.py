import pytest

from prospect_workers.collectors.codeur import matches, parse_budget, parse_feed

FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Tous les projets</title>
<item>
  <title>Boutique Shopify pour marque de bijoux</title>
  <link>https://www.codeur.com/projects/491300-boutique-shopify</link>
  <pubDate>Wed, 14 Oct 2026 14:24:11 +0200</pubDate>
  <guid>491300</guid>
  <description type="html"><![CDATA[<p>Budget : 1 000 € à 10 000 € - Catégories : Site E-commerce, Shopify</p> <p> Je cherche un freelance pour créer ma boutique en ligne … </p> <p> <a href="https://www.codeur.com/projects/491300">Voir le projet</a></p>]]></description>
</item>
<item>
  <title>Logo pour association</title>
  <link>https://www.codeur.com/projects/491301-logo</link>
  <pubDate>Wed, 14 Oct 2026 13:00:00 +0200</pubDate>
  <guid>491301</guid>
  <description type="html"><![CDATA[<p>Budget : Moins de 500 € - Catégories : Logo, Charte graphique</p> <p> Création d'un logo simple … </p>]]></description>
</item>
</channel></rss>"""


@pytest.mark.parametrize("label,expected", [
    ("1 000 € à 10 000 €", (1000, 10000)),
    ("500 € à 1 000 €", (500, 1000)),
    ("Moins de 500 €", (None, 500)),
    ("Plus de 10 000 €", (10000, None)),
    ("À définir", (None, None)),
])
def test_parse_budget(label, expected):
    assert parse_budget(label) == expected


def test_parse_feed_extracts_fields():
    first, second = parse_feed(FEED)
    assert first["external_id"] == "491300"
    assert first["budget_min"] == 1000 and first["budget_max"] == 10000
    assert first["raw"]["categories"] == ["Site E-commerce", "Shopify"]
    assert first["description"] == "Je cherche un freelance pour créer ma boutique en ligne"
    assert first["published_at"].isoformat() == "2026-10-14T14:24:11+02:00"
    assert second["budget_max"] == 500


def test_html_entities_in_title_are_decoded():
    feed = FEED.replace("Boutique Shopify pour marque de bijoux", "Création d&amp;#39;une boutique Shopify")
    first, _ = parse_feed(feed)
    assert first["title"] == "Création d'une boutique Shopify"


def test_keyword_filter():
    first, second = parse_feed(FEED)
    kws = ["shopify", "site", "ia"]
    assert matches(first, kws)
    assert not matches(second, kws)
