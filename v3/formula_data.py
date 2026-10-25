"""Separate archive index retaining earlier-race margins and comments for challengers."""
import argparse
import csv
from datetime import date
import hashlib
import json
from pathlib import Path
import sqlite3

FIELDS = {'date', 'course', 'race_id', 'off', 'race_name', 'type', 'class', 'dist', 'going',
          'ran', 'pos', 'draw', 'ovr_btn', 'horse', 'age', 'sex', 'wgt', 'hg', 'sp',
          'jockey', 'trainer', 'or', 'rpr', 'ts', 'sire', 'comment'}


def index_archive(source):
    source = Path(source)
    target = source.with_suffix('.formula.sqlite')
    identity = {'size': source.stat().st_size, 'mtime_ns': source.stat().st_mtime_ns}
    if target.exists():
        db = sqlite3.connect(target)
        try:
            if json.loads(db.execute('SELECT identity FROM metadata').fetchone()[0]) == identity:
                return db
        except (sqlite3.DatabaseError, TypeError):
            pass
        db.close()
        raise ValueError('Existing formula index has a different source; use a separate workspace')
    db = sqlite3.connect(target)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE source(day TEXT,rid TEXT,seq INTEGER PRIMARY KEY,payload TEXT)')
    db.execute('CREATE TABLE metadata(identity TEXT)')
    batch, total, regressions, previous = [], 0, 0, None
    with source.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            day = str(date.fromisoformat(row['date'][:10]))
            regressions += int(previous is not None and day < previous)
            previous = day
            # Reused provider IDs cannot merge separate dates, courses or off times.
            rid = '|'.join([row['race_id'], row['course'], row['off']])
            batch.append((day, rid, total, json.dumps({k:v for k,v in row.items() if k in FIELDS}, separators=(',', ':'))))
            total += 1
            if len(batch) == 20000:
                db.executemany('INSERT INTO source VALUES(?,?,?,?)', batch)
                db.commit()
                batch.clear()
            if total % 250000 == 0:
                print(f'Indexed {total:,} archive runners', flush=True)
    if batch:
        db.executemany('INSERT INTO source VALUES(?,?,?,?)', batch)
    db.execute('CREATE INDEX chronology ON source(day,rid,seq)')
    db.execute('INSERT INTO metadata VALUES(?)', (json.dumps(identity),))
    db.commit()
    source.with_suffix('.formula-index.json').write_text(json.dumps({'rows': total,
        'date_regressions': regressions, 'source_unchanged': True,
        'outcome_policy': 'Earlier completed days only; current-race outcomes are never feature inputs.'}, indent=2))
    print(f'Chronological challenger index complete: {total:,} runners', flush=True)
    return db


def days(source, end):
    db = index_archive(source)
    day, races = None, {}
    try:
        for stamp, rid, payload in db.execute('SELECT day,rid,payload FROM source WHERE day<=? ORDER BY day,rid,seq', (end,)):
            current = date.fromisoformat(stamp)
            if day is not None and current != day:
                yield day, races
                races = {}
            day = current
            races.setdefault(rid, []).append(json.loads(payload))
        if day is not None:
            yield day, races
    finally:
        db.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('source')
    a = p.parse_args()
    index_archive(a.source).close()
