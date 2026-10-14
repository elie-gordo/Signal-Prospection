from prospect_workers.enrich.contacts import contact_links, extract_contacts, normalize_phone

HOME = """
<html><body>
<header><a href="/contact">Nous contacter</a> <a href="/mentions-legales">Mentions légales</a>
<a href="https://www.facebook.com/x">fb</a></header>
<p>Appelez-nous au 01.42.33.44.55 ou <a href="tel:+33612345678">mobile</a></p>
<a href="mailto:bonjour@lescedres.fr?subject=Hi">Écrire</a>
<img src="logo@2x.png"> contact: reservation@lescedres.fr
<script>Sentry.init({dsn:"https://abc@o123.ingest.sentry.io/1"})</script>
</body></html>
"""


def test_normalize_phone():
    assert normalize_phone("+33612345678") == "06 12 34 56 78"
    assert normalize_phone("01.42.33.44.55") == "01 42 33 44 55"
    assert normalize_phone("0033 1 42 33 44 55") == "01 42 33 44 55"
    assert normalize_phone("12345") is None


def test_extract_contacts_finds_mailto_text_and_phones_and_skips_noise():
    emails, phones = extract_contacts(HOME)
    assert emails[0] == "bonjour@lescedres.fr"  # mailto first
    assert "reservation@lescedres.fr" in emails
    assert not any("sentry" in e or e.endswith(".png") for e in emails)
    assert phones[0] == "06 12 34 56 78"  # tel: link first
    assert "01 42 33 44 55" in phones


def test_contact_links_same_site_only():
    links = contact_links(HOME, "https://www.lescedres.fr/")
    assert links == ["https://www.lescedres.fr/contact", "https://www.lescedres.fr/mentions-legales"]


def test_phone_not_extracted_from_registry_identifiers():
    html = "<html><body><p>RCS Paris 130 879 166 · SIREN : 130 879 166 · EUID : FR7501.130879166</p></body></html>"
    _, phones = extract_contacts(html)
    assert phones == []
