"""Strict race grouping and parsers. Outcome fields never enter feature dictionaries."""
import csv
import hashlib
import io
import math
import re
import json
import sqlite3
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path


def number(value):
    try:
        result = float(str(value).replace(',', '').strip())
        return result if math.isfinite(result) else float('nan')
    except (ValueError, TypeError):
        return float('nan')


def position(value):
    match = re.fullmatch(r'(\d+)(?:st|nd|rd|th|=)?', str(value).strip(), re.I)
    return int(match[1]) if match else 0


def distance(value):
    text = str(value).lower()
    miles = re.search(r'(\d+(?:\.\d+)?)m', text)
    furlongs = re.search(r'(\d+(?:\.\d+)?)\s*([¼½¾]?)f', text)
    yards = re.search(r'(\d+)y', text)
    if miles or furlongs or yards:
        return (8 * float(miles[1]) if miles else 0) + (float(furlongs[1]) + {'': 0, '¼': .25, '½': .5, '¾': .75}[furlongs[2]] if furlongs else 0) + (float(yards[1]) / 220 if yards else 0)
    return float('nan')


def weight(value):
    match = re.fullmatch(r'(\d+)[-:](\d+)', str(value).strip())
    return 14 * int(match[1]) + int(match[2]) if match else number(value)


def odds(value):
    text = str(value).strip().lower()
    if text in ('evs', 'evens', 'even'):
        return 2.
    match = re.search(r'(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)', text)
    if match and float(match[2]) > 0:
        return 1 + float(match[1]) / float(match[2])
    val = number(text)
    return val if val > 1 else float('nan')


def discipline(row):
    kind = row.get('type', '').lower()
    if any(s in kind for s in ('chase', 'hurdle', 'nh flat', 'national hunt', 'bumper')):
        return 'jumps'
    return 'aw' if 'aw' in row.get('course', '').lower() or any(x in row.get('going', '').lower() for x in ('standard', 'fast', 'slow')) else 'turf'


def category(value):
    text = str(value).lower()
    for i, match in enumerate(('heavy', 'soft', 'yielding', 'good', 'firm', 'standard', 'slow', 'fast')):
        if match in text:
            return i
    return -1


def token(value):
    return re.sub(r'\s+', ' ', str(value or '').strip()).upper()


def selected(race_id, modulus):
    return int(hashlib.sha256(str(race_id).encode()).hexdigest()[:8], 16) % modulus == 0


def ordered_source(path):
    """Disk-backed chronological ordering; retain raw bytes and report original inversions."""
    path = Path(path)
    index = path.with_suffix('.ordered.sqlite')
    if index.exists():
        db = sqlite3.connect(index)
        valid = db.execute('SELECT complete FROM metadata').fetchone()
        if valid and valid[0] == 1:
            return db
        db.close()
        index.unlink()
    db = sqlite3.connect(index)
    db.execute('CREATE TABLE metadata(complete INTEGER)')
    db.execute('INSERT INTO metadata VALUES(0)')
    db.execute('CREATE TABLE source(seq INTEGER PRIMARY KEY, day TEXT, rid TEXT, payload TEXT)')
    archive = zipfile.ZipFile(path) if zipfile.is_zipfile(path) else None
    if archive:
        member = next(n for n in archive.namelist() if n.endswith('raceform.csv'))
        handle = io.TextIOWrapper(archive.open(member), encoding='utf-8-sig')
    else:
        handle = open(path, encoding='utf-8-sig', newline='')
    try:
        reader = csv.DictReader(handle)
        reader.fieldnames = [k.strip().lower() for k in reader.fieldnames]
        previous, inversions, total, batch = None, 0, 0, []
        allowed = {'date','race_id','horse','trainer','jockey','sire','course','type','race_name','class','going','dist',
                   'or','age','sex','wgt','hg','draw','ran','pos','sp'}
        for row in reader:
            current = str(date.fromisoformat(row['date'][:10]))
            inversions += int(previous is not None and current < previous)
            previous = current
            total += 1
            payload = {k:v for k,v in row.items() if k in allowed}
            batch.append((current, row['race_id'], json.dumps(payload, separators=(',', ':'))))
            if len(batch) >= 10000:
                db.executemany('INSERT INTO source(day,rid,payload) VALUES(?,?,?)', batch)
                db.commit()
                batch = []
        if batch:
            db.executemany('INSERT INTO source(day,rid,payload) VALUES(?,?,?)', batch)
        db.execute('CREATE INDEX chronological ON source(day,rid,seq)')
        db.execute('UPDATE metadata SET complete=1')
        db.commit()
        audit = {'raw_rows': total, 'original_date_regressions': inversions,
                 'replay_order': 'date, race ID, original row sequence; all results delayed until next day',
                 'raw_source_preserved': True, 'outcome_features_excluded_from_index': ['rpr','ts','comment','time','btn','ovr_btn']}
        path.with_suffix('.ordering.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
        print(json.dumps({'chronological_index': audit}), flush=True)
    finally:
        handle.close()
        if archive:
            archive.close()
    return db


def archive_days(path):
    """Keep every same-day race together, even when the source CSV is unordered."""
    db = ordered_source(path)
    day, races = None, {}
    try:
        for stamp, rid, payload in db.execute('SELECT day,rid,payload FROM source ORDER BY day,rid,seq'):
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


def eligible(rows):
    """Result archive contains starters, not certified declared fields. Require complete starters."""
    if len(rows) < 2:
        return 'fewer_than_two_starters'
    if len({token(r['horse']) for r in rows}) != len(rows):
        return 'duplicate_horse'
    if len({r.get('course') for r in rows}) != 1 or len({r.get('race_name') for r in rows}) != 1:
        return 'conflicting_race_identity'
    sizes = {number(r.get('ran')) for r in rows}
    if sizes != {float(len(rows))}:
        return 'incomplete_starter_field'
    if sum(position(r.get('pos')) == 1 for r in rows) != 1:
        return 'no_single_official_winner'
    if len({discipline(r) for r in rows}) != 1:
        return 'inconsistent_discipline'
    return None
