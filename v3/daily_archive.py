"""Collect prior-only factual form for a declared future field; never ingest tips."""
import csv
import io
import json
import re
import unicodedata
import zipfile
from collections import defaultdict
from pathlib import Path


def base_name(value):
    value = re.sub(r'\s*\([A-Z]{2,3}\)\s*$', '', str(value), flags=re.I)
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Z0-9]', '', value.upper())


def extract(directory, source):
    directory, source = Path(directory), Path(source)
    targets = set()
    for path in directory.glob('*.json'):
        card = json.loads(path.read_text())
        if 'races' in card:
            targets.update(base_name(row[0]) for race in card['races'] for row in race['rows'])
    records = defaultdict(list)
    archive = zipfile.ZipFile(source) if zipfile.is_zipfile(source) else None
    stream = io.TextIOWrapper(archive.open(next(n for n in archive.namelist() if n.endswith('raceform.csv')))) if archive else source.open(newline='')
    with stream:
        reader = csv.DictReader(stream)
        for row in reader:
            key = base_name(row['horse'])
            if key in targets and row['date'] < '2026-10-24':
                records[key].append(row)
    for key in records:
        records[key] = sorted(records[key], key=lambda r: (r['date'], r['race_id']))[-40:]
    output = directory / 'prior-form.json'
    output.write_text(json.dumps({'source': 'Delta Romeo archive; source hash in v3/workspace/raw/manifest.json',
                                  'cutoff': '2026-10-24', 'form': dict(records)}))
    print(json.dumps({'target_names': len(targets), 'with_archive_form': len(records),
                      'prior_runs': sum(map(len, records.values()))}), flush=True)


if __name__ == '__main__':
    extract('v3/research/2026-10-24', 'v3/workspace/raw/raceform.download')
