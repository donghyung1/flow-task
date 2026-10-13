"""CLI: ``flow-tarsk-purge [--days N]``."""

import argparse
import asyncio

from flow_tarsk.db.session import get_engine, get_sessionmaker
from flow_tarsk.services.purge import purge_deleted


async def _run(days: int) -> int:
    async with get_sessionmaker()() as session:
        count = await purge_deleted(session, days)
    await get_engine().dispose()
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Permanently delete soft-deleted tasks.")
    parser.add_argument("--days", type=int, default=30, help="retention in days (default 30)")
    args = parser.parse_args()
    print(f"purged {asyncio.run(_run(args.days))} task(s)")
