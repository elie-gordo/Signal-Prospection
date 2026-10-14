import argparse
import sys
import time
from datetime import datetime, timedelta

from . import config, db, scoring
from .audit import site
from .collectors import bodacc, codeur
from .enrich import contacts, discovery, recherche_entreprises

SCHEMA_PATH = config.REPO_ROOT / "db" / "schema.sql"


def _csv(value: str | None) -> list[str] | None:
    return [v.strip() for v in value.split(",") if v.strip()] if value else None


def cmd_migrate(args: argparse.Namespace, cfg: config.Config) -> None:
    with db.connect(cfg.database_url) as conn:
        conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.commit()
    print("migrate: schema applied")


def cmd_collect(args: argparse.Namespace, cfg: config.Config) -> None:
    if args.source in ("bodacc", "all"):
        fetched, inserted = bodacc.collect(cfg, args.days, _csv(args.departments))
        print(f"bodacc: fetched={fetched} new={inserted}")
    if args.source in ("codeur", "all"):
        fetched, inserted = codeur.collect(cfg)
        print(f"codeur: fetched={fetched} new={inserted}")


def cmd_enrich(args: argparse.Namespace, cfg: config.Config) -> None:
    print(f"enrich: {recherche_entreprises.enrich(cfg, args.limit)} companies")


def cmd_discover(args: argparse.Namespace, cfg: config.Config) -> None:
    searched, found = discovery.discover(cfg, args.limit)
    print(f"discover: searched={searched} websites_found={found}")


def cmd_audit(args: argparse.Namespace, cfg: config.Config) -> None:
    print(f"audit: {site.audit(cfg, args.limit)} sites")


def cmd_contacts(args: argparse.Namespace, cfg: config.Config) -> None:
    checked, found = contacts.collect_contacts(cfg, args.limit)
    print(f"contacts: sites_checked={checked} with_contact={found}")


def cmd_score(args: argparse.Namespace, cfg: config.Config) -> None:
    print(f"score: {scoring.rescore(cfg)} leads")


def cmd_run(args: argparse.Namespace, cfg: config.Config) -> None:
    steps = (
        ("bodacc", lambda: print("bodacc: fetched=%d new=%d" % bodacc.collect(cfg, args.days, _csv(args.departments)))),
        ("codeur", lambda: print("codeur: fetched=%d new=%d" % codeur.collect(cfg))),
        ("enrich", lambda: cmd_enrich(argparse.Namespace(limit=5000), cfg)),
        ("discover", lambda: cmd_discover(argparse.Namespace(limit=args.search_limit), cfg)),
        ("audit", lambda: cmd_audit(argparse.Namespace(limit=500), cfg)),
        ("contacts", lambda: cmd_contacts(argparse.Namespace(limit=500), cfg)),
        ("score", lambda: cmd_score(args, cfg)),
    )
    for name, step in steps:
        try:
            step()
        except Exception as exc:  # one failing step must not block the rest of the pipeline
            print(f"{name}: FAILED {exc!r}", file=sys.stderr)


def _seconds_until(hh_mm: str, now: datetime) -> float:
    hour, minute = (int(x) for x in hh_mm.split(":"))
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def cmd_daemon(args: argparse.Namespace, cfg: config.Config) -> None:
    cmd_migrate(args, cfg)
    if args.now:
        cmd_run(args, cfg)
    while True:
        wait = _seconds_until(args.at, datetime.now())
        print(f"daemon: next run in {wait / 3600:.1f} h (at {args.at})", flush=True)
        time.sleep(wait)
        print(f"daemon: run started {datetime.now():%Y-%m-%d %H:%M}", flush=True)
        cmd_run(args, cfg)


def _add_run_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--days", type=int, default=2, help="BODACC lookback window")
    p.add_argument("--departments")
    p.add_argument("--search-limit", type=int, default=300, help="max web searches per run")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="prospect")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("migrate").set_defaults(fn=cmd_migrate)

    collect = sub.add_parser("collect")
    collect.add_argument("source", choices=["bodacc", "codeur", "all"])
    collect.add_argument("--days", type=int, default=7)
    collect.add_argument("--departments")
    collect.set_defaults(fn=cmd_collect)

    for name, fn, default in (("enrich", cmd_enrich, 5000), ("discover", cmd_discover, 300),
                              ("audit", cmd_audit, 500), ("contacts", cmd_contacts, 500)):
        p = sub.add_parser(name)
        p.add_argument("--limit", type=int, default=default)
        p.set_defaults(fn=fn)

    sub.add_parser("score").set_defaults(fn=cmd_score)

    run = sub.add_parser("run", help="full pipeline once")
    _add_run_args(run)
    run.set_defaults(fn=cmd_run)

    daemon = sub.add_parser("daemon", help="run the pipeline every day at a fixed time")
    _add_run_args(daemon)
    daemon.add_argument("--at", default="07:00", help="local time HH:MM")
    daemon.add_argument("--now", action="store_true", help="also run once at startup")
    daemon.set_defaults(fn=cmd_daemon)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.fn(args, config.load())


if __name__ == "__main__":
    main()
