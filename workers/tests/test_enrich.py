from prospect_workers.enrich.recherche_entreprises import (
    is_guessable,
    map_result,
    page_matches,
    slug_candidates,
)


def test_generic_or_personal_names_are_not_guessed():
    assert not is_guessable("Alba")
    assert not is_guessable("SCI FLERS RESIDENCE")
    assert not is_guessable("Dupont, Jean")
    assert is_guessable("Voltarra Group SAS")
    assert is_guessable("RETIRO PATRIMOINE")


def test_slug_keeps_short_tokens_and_drops_legal_form():
    assert slug_candidates("LES ONGLES D'OR SAS") == [
        "https://lesonglesdor.fr", "https://lesonglesdor.com",
        "https://les-ongles-d-or.fr", "https://les-ongles-d-or.com",
    ]


def test_page_must_contain_every_significant_token_in_title():
    assert page_matches("<title>Les Ongles d'Or - Onglerie Paris</title>", "LES ONGLES D'OR")
    assert not page_matches("<title>Les Ongles - Blog beauté</title>", "LES ONGLES D'OR ATELIER")
    assert not page_matches("<title>Accueil</title><p>flow and son</p>", "FLOW & SON")


def test_map_result_picks_first_director():
    r = {"activite_principale": "56.10A", "date_creation": "2026-10-01", "tranche_effectif_salarie": "NN",
         "siege": {"adresse": "1 RUE X 75011 PARIS", "code_postal": "75011", "libelle_commune": "PARIS",
                   "departement": "75"},
         "dirigeants": [{"nom": "MARTIN", "prenoms": "JEANNE", "type_dirigeant": "personne physique"}]}
    out = map_result(r)
    assert out["director_name"] == "Jeanne Martin"
    assert out["naf_code"] == "56.10A" and out["city"] == "PARIS"
