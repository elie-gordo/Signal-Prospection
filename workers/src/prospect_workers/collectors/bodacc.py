import json
from datetime import date, timedelta
from typing import Any, Iterator

import httpx

from .. import db
from ..config import Config

API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records"
PAGE_SIZE = 100
MAX_OFFSET = 9900  # opendatasoft hard limit is offset+limit <= 10000


def _as_obj(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return value


def _first(value: Any) -> Any:
    return value[0] if isinstance(value, list) and value else value


def map_record(rec: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]] | None:
    registre = rec.get("registre") or []
    siren = str(_first(registre) or "").replace(" ", "") or None
    if not siren:
        return None

    etab = _first((_as_obj(rec.get("listeetablissements")) or {}).get("etablissement")) or {}
    acte = _as_obj(rec.get("acte")) or {}
    activity = etab.get("activite")
    name = (rec.get("commercant") or "").strip() or siren

    company = {
        "siren": siren,
        "name": name,
        "activity": activity,
        "postal_code": rec.get("cp"),
        "city": rec.get("ville"),
        "department": rec.get("numerodepartement"),
    }
    lead = {
        "source": "bodacc",
        "external_id": rec["id"],
        "signal": "new_company",
        "title": name,
        "description": activity,
        "url": rec.get("url_complete"),
        "published_at": rec.get("dateparution"),
        "raw": {
            "tribunal": rec.get("tribunal"),
            "date_immatriculation": acte.get("dateImmatriculation"),
            "date_commencement": acte.get("dateCommencementActivite"),
            "origine_fonds": etab.get("origineFonds"),
        },
    }
    return company, lead


def fetch(departments: list[str], days: int, client: httpx.Client) -> Iterator[dict[str, Any]]:
    since = (date.today() - timedelta(days=days)).isoformat()
    depts = ", ".join(f'"{d}"' for d in departments)
    where = f'familleavis="creation" and numerodepartement in ({depts}) and dateparution >= date\'{since}\''
    offset = 0
    while offset <= MAX_OFFSET:
        resp = client.get(
            API,
            params={"where": where, "limit": PAGE_SIZE, "offset": offset, "order_by": "dateparution desc"},
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        yield from results
        if len(results) < PAGE_SIZE:
            return
        offset += PAGE_SIZE


def collect(cfg: Config, days: int, departments: list[str] | None = None) -> tuple[int, int]:
    depts = departments or cfg.departments
    fetched = inserted = 0
    with db.connect(cfg.database_url) as conn, httpx.Client(timeout=30) as client:
        run_id = db.start_run(conn, "bodacc")
        conn.commit()
        error = None
        try:
            for rec in fetch(depts, days, client):
                fetched += 1
                mapped = map_record(rec)
                if not mapped:
                    continue
                company, lead = mapped
                lead["company_id"] = db.upsert_company(conn, company)
                inserted += db.upsert_lead(conn, lead)
            conn.commit()
        except Exception as exc:  # recorded in collector_runs, then re-raised
            conn.rollback()
            error = repr(exc)
            raise
        finally:
            db.finish_run(conn, run_id, fetched, inserted, error)
            conn.commit()
    return fetched, inserted
