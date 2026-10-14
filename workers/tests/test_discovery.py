from prospect_workers.enrich.discovery import parse_results, pick_website

SEARXNG_PAYLOAD = {
    "results": [
        {"url": "https://www.pagesjaunes.fr/pros/60228245"},
        {"url": "https://www.instagram.com/lescedresdeparis"},
        {"url": "https://www.lescedresdeparis.fr/menu"},
        {"url": "ftp://weird"},
        {"url": "https://other-shop.com/"},
    ],
    "unresponsive_engines": [["brave", "too many requests"]],
}


def test_parse_results_keeps_http_urls_in_order():
    urls = parse_results(SEARXNG_PAYLOAD)
    assert urls[0] == "https://www.pagesjaunes.fr/pros/60228245"
    assert "ftp://weird" not in urls
    assert len(urls) == 4


def test_parse_results_handles_empty_payload():
    assert parse_results({}) == []


def test_pick_website_skips_directories_and_requires_name_in_domain():
    urls = parse_results(SEARXNG_PAYLOAD)
    assert pick_website("Les cèdres de Paris - SAS", urls) == "https://www.lescedresdeparis.fr/"


def test_pick_website_returns_none_when_only_directories():
    urls = ["https://www.pagesjaunes.fr/pros/1", "https://www.yelp.fr/biz/cedres", "https://www.facebook.com/cedres"]
    assert pick_website("Les Cèdres", urls) is None


def test_pick_website_rejects_unrelated_domain():
    assert pick_website("Boulangerie Lumen", ["https://www.boulangerie-paris.fr/"]) is None


def test_pick_website_rejects_real_false_positives():
    # observed on real data: shared word in the domain is not proof of ownership
    assert pick_website("CC Family", ["https://www.thesocialitefamily.com/"]) is None
    assert pick_website("VIGIE", ["https://www.vigiecard.com/"]) is None
    assert pick_website("Les cèdres de Paris - SAS", ["https://www.lescedresduliban.com/"]) is None


def test_pick_website_accepts_close_domain_variants():
    assert pick_website("LE COMPTOIR GENERAL", ["https://lecomptoirgeneral.com/"]) == "https://lecomptoirgeneral.com/"
    assert pick_website("OGOUSTO PARIS IX", ["https://www.ogousto-paris.fr/"]) == "https://www.ogousto-paris.fr/"
    assert pick_website("SAS BOULANGERIE LUMEN", ["https://lumen.fr/"]) == "https://lumen.fr/"


def test_owns_site_by_siren_or_address():
    from prospect_workers.enrich.discovery import owns_site
    company = {"siren": "130879166", "postal_code": "75008", "address": "29 RUE TRONCHET 75008 PARIS"}
    assert owns_site(["<p>SIREN : 130 879 166</p>"], company)
    assert owns_site(["<p>Retrouvez-nous au 29, rue Tronchet - 75008 Paris</p>"], company)
    # same city, other address: a homonym business
    assert not owns_site(["<p>12 rue de la Paix 75002 Paris</p>"], company)
    assert not owns_site(["<p>Le Cèdre, restaurant libanais à Paris</p>"], company)
