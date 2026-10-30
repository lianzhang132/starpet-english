"""Consistent SQLite backups, including committed WAL data; no user data in logs."""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import tempfile
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path


def verify_backup(path: Path) -> None:
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as connection:
        result = connection.execute("PRAGMA quick_check").fetchall()
    if result != [("ok",)]:
        raise RuntimeError("backup_integrity_check_failed")


def create_backup(database: Path, destination: Path) -> Path:
    database = database.resolve(strict=True)
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    # mkstemp gives each run an exclusive path with private file permissions.
    fd, name = tempfile.mkstemp(prefix=f"starpet-{stamp}-", suffix=".partial", dir=destination)
    os.close(fd)
    partial = Path(name)
    try:
        with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)) as source:
            with closing(sqlite3.connect(partial)) as target:
                source.backup(target)
                target.execute("PRAGMA journal_mode=DELETE")
        verify_backup(partial)
        finished = partial.with_suffix(".db")
        partial.rename(finished)
        return finished
    except Exception:
        # Only remove the exclusive temporary file created by this invocation.
        partial.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, default=Path("/data/backups"))
    parser.add_argument("--verify", type=Path)
    args = parser.parse_args()
    if args.verify:
        verify_backup(args.verify)
        print(json.dumps({"verified": True, "backup": str(args.verify)}))
        return
    database = Path(os.getenv("STARPET_DATABASE", str(Path(__file__).resolve().parents[1] / "data/starpet.db")))
    backup = create_backup(database, args.destination)
    print(json.dumps({"verified": True, "backup": str(backup), "bytes": backup.stat().st_size}))


if __name__ == "__main__":
    main()
