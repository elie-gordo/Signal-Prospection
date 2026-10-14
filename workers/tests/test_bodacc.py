import json

from prospect_workers.collectors.bodacc import map_record

RECORD = {
    "id": "A202601971003",
    "dateparution": "2026-10-14",
    "familleavis": "creation",
    "numerodepartement": "75",
    "tribunal": "Greffe du Tribunal des Activités Economiques de Paris",
    "commercant": "Augelon, Sylvain",
    "ville": "Paris",
    "registre": ["539894626", "539 894 626"],
    "cp": "75002",
    "listeetablissements": json.dumps({"etablissement": {
        "origineFonds": "Création d'un fonds de commerce",
        "qualiteEtablissement": "Etablissement principal",
        "activite": "Coursier à vélo : livraison de colis"}}),
    "acte": json.dumps({"dateImmatriculation": "2026-10-05", "dateCommencementActivite": "2026-10-04"}),
    "url_complete": "https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A202601971003",
}


def test_map_record():
    company, lead = map_record(RECORD)
    assert company == {"siren": "539894626", "name": "Augelon, Sylvain",
                       "activity": "Coursier à vélo : livraison de colis",
                       "postal_code": "75002", "city": "Paris", "department": "75"}
    assert lead["external_id"] == "A202601971003"
    assert lead["signal"] == "new_company"
    assert lead["published_at"] == "2026-10-14"
    assert lead["raw"]["date_immatriculation"] == "2026-10-05"


def test_map_record_handles_list_of_establishments():
    rec = {**RECORD, "listeetablissements": {"etablissement": [{"activite": "Boulangerie"}]}}
    company, _ = map_record(rec)
    assert company["activity"] == "Boulangerie"


def test_map_record_without_siren_is_skipped():
    assert map_record({**RECORD, "registre": None}) is None
