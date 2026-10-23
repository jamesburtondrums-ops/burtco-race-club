"""Download a public archive, retaining the exact source, bytes and licence metadata."""
import hashlib
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATASET = 'deltaromeo/horse-racing-results-ukireland-2015-2025'
API = 'https://www.kaggle.com/api/v1/datasets/'


def acquire(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    def read(url):
        with urllib.request.urlopen(url, timeout=90) as response:
            return json.load(response)
    listing = read(API + 'list/' + DATASET)
    metadata = read(API + 'view/' + DATASET)
    (root / 'source-metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    (root / 'source-files.json').write_text(json.dumps(listing, indent=2), encoding='utf-8')
    source = next(f for f in listing['datasetFiles'] if f['name'].endswith('/raceform.csv'))
    url = API + 'download/' + DATASET + '/' + urllib.parse.quote(source['name'], safe='')
    dest = root / 'raceform.download'
    if not dest.exists():
        temporary = dest.with_suffix('.partial')
        digest = hashlib.sha256()
        with urllib.request.urlopen(url, timeout=300) as response, temporary.open('wb') as output:
            total = 0
            while block := response.read(4 * 1024 * 1024):
                output.write(block)
                digest.update(block)
                total += len(block)
                if total % (64 * 1024 * 1024) < len(block):
                    print(f'Downloaded {total // (1024 * 1024)} MiB', flush=True)
        temporary.rename(dest)
    else:
        digest = hashlib.sha256()
        with dest.open('rb') as handle:
            while block := handle.read(4 * 1024 * 1024):
                digest.update(block)
    manifest = {'dataset': DATASET, 'url': url, 'member': source['name'],
                'downloaded_at': datetime.now(timezone.utc).isoformat(),
                'sha256': digest.hexdigest(), 'bytes': dest.stat().st_size,
                'source_entry': source,
                'timing_status': 'RETROSPECTIVE_ARCHIVE_NO_POINT_IN_TIME_VERSIONS',
                'licence': metadata.get('licenseName') or metadata.get('licenses') or metadata.get('license')}
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'download': str(dest), 'manifest': manifest}), flush=True)


if __name__ == '__main__':
    import sys
    acquire(sys.argv[1] if len(sys.argv) > 1 else 'v3/workspace/raw')
