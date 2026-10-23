"""Repository-level retirement survives deletion or recreation of a local workspace."""
import json
from datetime import date
from pathlib import Path


def assert_unopened_period(protocol, registry_path=None):
    if not {'final_start', 'final_end'} <= set(protocol):
        raise ValueError('Protocol changed or incomplete: final period boundaries are required')
    start, end = date.fromisoformat(protocol['final_start']), date.fromisoformat(protocol['final_end'])
    if start > end:
        raise ValueError('Final period starts after it ends')
    path = Path(registry_path) if registry_path else Path(__file__).with_name('evaluation-registry.json')
    registry = json.loads(path.read_text(encoding='utf-8'))
    retired = list(registry['retired_periods'])
    for span in protocol.get('retired_test_periods', []):
        left, right = span.split('/')
        retired.append({'start': left, 'end': right})
    for period in retired:
        if start <= date.fromisoformat(period['end']) and end >= date.fromisoformat(period['start']):
            raise ValueError('Final period overlaps a previously evaluated, retired period: '
                             + period['start'] + ' / ' + period['end']
                             + '. Reserve genuinely later unseen races; a new workspace cannot reset this restriction.')
