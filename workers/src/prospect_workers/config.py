import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def _csv(name: str, default: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


@dataclass(frozen=True)
class Config:
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL", "postgresql://prospect:prospect@localhost:5433/prospect"
        )
    )
    searxng_url: str = field(default_factory=lambda: os.getenv("SEARXNG_URL", "http://localhost:8888"))
    departments: list[str] = field(default_factory=lambda: _csv("TARGET_DEPARTMENTS", "75"))
    naf_prefixes: list[str] = field(
        default_factory=lambda: _csv("TARGET_NAF_PREFIXES", "56,9602,9604,9313,47,43,8690")
    )
    # couriers, VTC, real estate, holdings, head offices, unknown
    excluded_naf_prefixes: list[str] = field(
        default_factory=lambda: _csv("EXCLUDED_NAF_PREFIXES", "5320,4932,4939,6820,6832,6420,7010,4791,4799,0000")
    )
    codeur_keywords: list[str] = field(
        default_factory=lambda: _csv(
            "CODEUR_KEYWORDS",
            "site,web,wordpress,shopify,e-commerce,ecommerce,boutique,landing,react,next,"
            "automatisation,n8n,ia,chatbot,api,scraping",
        )
    )


def load() -> Config:
    return Config()
