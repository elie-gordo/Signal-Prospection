from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


@contextmanager
def connect(url: str) -> Iterator[psycopg.Connection]:
    with psycopg.connect(url, row_factory=dict_row) as conn:
        yield conn


def upsert_company(conn: psycopg.Connection, c: dict[str, Any]) -> int:
    row = conn.execute(
        """
        INSERT INTO companies (siren, name, activity, postal_code, city, department)
        VALUES (%(siren)s, %(name)s, %(activity)s, %(postal_code)s, %(city)s, %(department)s)
        ON CONFLICT (siren) DO UPDATE SET
          activity = COALESCE(companies.activity, EXCLUDED.activity),
          updated_at = now()
        RETURNING id
        """,
        c,
    ).fetchone()
    return row["id"]


def upsert_lead(conn: psycopg.Connection, lead: dict[str, Any]) -> bool:
    """Returns True when a new row was inserted. Never overwrites status/notes."""
    params = {
        "budget_min": None,
        "budget_max": None,
        "company_id": None,
        "description": None,
        "url": None,
        "published_at": None,
        **lead,
        "raw": Jsonb(lead.get("raw")),
    }
    row = conn.execute(
        """
        INSERT INTO leads (source, external_id, signal, title, description, url,
                           budget_min, budget_max, company_id, published_at, raw)
        VALUES (%(source)s, %(external_id)s, %(signal)s, %(title)s, %(description)s, %(url)s,
                %(budget_min)s, %(budget_max)s, %(company_id)s, %(published_at)s, %(raw)s)
        ON CONFLICT (source, external_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          url = EXCLUDED.url,
          budget_min = EXCLUDED.budget_min,
          budget_max = EXCLUDED.budget_max,
          company_id = COALESCE(EXCLUDED.company_id, leads.company_id),
          raw = EXCLUDED.raw,
          updated_at = now()
        RETURNING (xmax = 0) AS inserted
        """,
        params,
    ).fetchone()
    return bool(row["inserted"])


def start_run(conn: psycopg.Connection, source: str) -> int:
    return conn.execute(
        "INSERT INTO collector_runs (source) VALUES (%s) RETURNING id", (source,)
    ).fetchone()["id"]


def finish_run(conn: psycopg.Connection, run_id: int, fetched: int, inserted: int, error: str | None) -> None:
    conn.execute(
        """UPDATE collector_runs SET finished_at = now(), fetched = %s, inserted = %s, error = %s
           WHERE id = %s""",
        (fetched, inserted, error, run_id),
    )

