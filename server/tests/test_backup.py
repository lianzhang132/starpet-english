import shutil
import sqlite3

import pytest

from app.backup import create_backup, verify_backup


def test_live_wal_backup_is_consistent_and_can_be_restored(tmp_path):
    database = tmp_path / "live.db"
    with sqlite3.connect(database) as live:
        live.execute("PRAGMA journal_mode=WAL")
        live.execute("CREATE TABLE learning(id INTEGER PRIMARY KEY, xp INTEGER)")
        live.execute("INSERT INTO learning VALUES (1, 60)")
        live.commit()
        backup = create_backup(database, tmp_path / "backups")
        live.execute("UPDATE learning SET xp = 90")
        live.commit()
        restored = tmp_path / "restored.db"
        shutil.copy2(backup, restored)
        verify_backup(restored)
        with sqlite3.connect(restored) as recovery:
            assert recovery.execute("SELECT xp FROM learning").fetchone()[0] == 60
        assert live.execute("SELECT xp FROM learning").fetchone()[0] == 90
    second = create_backup(database, tmp_path / "backups")
    assert second != backup and backup.is_file()
    assert not list((tmp_path / "backups").glob('*.partial'))


def test_missing_source_is_not_silently_created(tmp_path):
    database = tmp_path / "missing.db"
    with pytest.raises(FileNotFoundError):
        create_backup(database, tmp_path / "backups")
    assert not database.exists()
