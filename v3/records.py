"""Append-only SQLite records, including exact source snapshots and frozen forecasts."""
import hashlib
import json
import sqlite3
from datetime import datetime, timezone


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('All source and race timestamps must include an explicit timezone')
    return parsed.astimezone(timezone.utc)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


class Ledger:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, race_id TEXT NOT NULL, recorded_at TEXT NOT NULL, payload TEXT NOT NULL, previous_hash TEXT NOT NULL, event_hash TEXT NOT NULL UNIQUE, UNIQUE(kind, race_id))')
        self.db.execute("CREATE TRIGGER IF NOT EXISTS immutable_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'Records are immutable'); END")
        self.db.execute("CREATE TRIGGER IF NOT EXISTS immutable_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'Records are immutable'); END")
        self.db.commit()

    def append(self, kind, race_id, payload):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            previous = self.db.execute('SELECT event_hash FROM events ORDER BY id DESC LIMIT 1').fetchone()
            previous = previous[0] if previous else '0' * 64
            now = datetime.now(timezone.utc).isoformat()
            encoded = canonical(payload)
            event_hash = hashlib.sha256(canonical([kind, race_id, now, encoded, previous]).encode()).hexdigest()
            self.db.execute('INSERT INTO events(kind,race_id,recorded_at,payload,previous_hash,event_hash) VALUES(?,?,?,?,?,?)',
                            (kind, race_id, now, encoded, previous, event_hash))
            self.db.commit()
            return event_hash
        except Exception:
            self.db.rollback()
            raise

    def rows(self, kind=None):
        rows = self.db.execute('SELECT kind,race_id,recorded_at,payload,previous_hash,event_hash FROM events ORDER BY id').fetchall()
        return [dict(kind=k, race_id=r, recorded_at=t, payload=json.loads(p), previous_hash=h, event_hash=e)
                for k, r, t, p, h, e in rows if kind is None or k == kind]

    def verify(self):
        previous = '0' * 64
        for row in self.rows():
            encoded = canonical(row['payload'])
            expected = hashlib.sha256(canonical([row['kind'], row['race_id'], row['recorded_at'], encoded, previous]).encode()).hexdigest()
            if row['previous_hash'] != previous or row['event_hash'] != expected:
                raise ValueError('Ledger hash chain broken')
            previous = expected
        return True


def validate_snapshot(snapshot, now=None):
    now = now or datetime.now(timezone.utc)
    cutoff, off = timestamp(snapshot['cutoff']), timestamp(snapshot['off_at'])
    observed, published = timestamp(snapshot['observed_at']), timestamp(snapshot['published_at'])
    if not published <= observed <= now <= cutoff < off:
        raise ValueError('Require published <= observed <= now <= cutoff < off; retrospective prediction recording is refused')
    if not snapshot.get('source_url', '').startswith(('https://', 'http://')):
        raise ValueError('A source URL is required')
    rows = snapshot['runners']
    if len(rows) != snapshot['declared_runner_count'] or len(rows) < 2:
        raise ValueError('Complete declared field required')
    if len({r['horse'].strip().upper() for r in rows}) != len(rows):
        raise ValueError('Duplicate runner')
    # A count alone does not establish that all rows belong to the same race.
    from .data import discipline, token
    for key in ('course', 'type', 'race_name', 'class', 'going', 'dist'):
        if len({token(r.get(key)) for r in rows}) != 1:
            raise ValueError('Inconsistent racecard field: ' + key)
    if len({discipline(r) for r in rows}) != 1:
        raise ValueError('Inconsistent race discipline')
    allowed = {'horse', 'trainer', 'jockey', 'sire', 'course', 'type', 'race_name', 'class', 'going', 'dist',
               'or', 'age', 'sex', 'wgt', 'hg', 'draw'}
    for row in rows:
        extra = set(row) - allowed
        if extra:
            raise ValueError('Unapproved or outcome-bearing runner fields: ' + ', '.join(sorted(extra)))
        if not row.get('horse') or not row.get('course') or not row.get('type'):
            raise ValueError('Horse, course and race type are mandatory for every runner')
    quotes = snapshot.get('market', [])
    if len({q['horse'] for q in quotes}) != len(quotes):
        raise ValueError('Duplicate market quote; use one identified quote per runner')
    for quote in quotes:
        if quote['horse'] not in {r['horse'] for r in rows} or not 1 < float(quote['decimal_odds']) < 100000:
            raise ValueError('Invalid market quote')
        if timestamp(quote['observed_at']) > min(cutoff, now):
            raise ValueError('Market quote is after the prediction cutoff or in the future')
        if timestamp(quote['observed_at']) < published:
            raise ValueError('Quote must belong to the declared snapshot period')
    return cutoff, off
