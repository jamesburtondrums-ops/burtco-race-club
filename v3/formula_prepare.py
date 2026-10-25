"""Prepare development rows only; never open the retired final period."""
import argparse
from collections import Counter
import json
from pathlib import Path
import pickle
import re
import pandas as pd
from .data import eligible, discipline, position, odds, selected
from .formula_data import days
from .formula_features import FormulaHistory


def prepare(root, protocol):
    root = Path(root)
    if (root/'development.pkl').exists():
        raise ValueError('Prepared data already exists; refusing accidental overwrite')
    history, frames, excluded = FormulaHistory(), [], Counter()
    for day, races in days(root/'raw/raceform.download', protocol['validation_end']):
        updates = []
        for rid, rows in races.items():
            countries = re.findall(r'\(([A-Z]{2,3})\)', rows[0].get('course', ''))
            if any(c not in ('IRE', 'AW') for c in countries):
                excluded['outside_gb_ire'] += 1
                continue
            error = eligible(rows)
            if error:
                excluded[error] += 1
                continue
            updates.extend(rows)
            if str(day) < protocol['learning_start'] or not selected(rows[0]['race_id'], protocol['development_sample_modulus']):
                continue
            f = history.race(rows, day)
            f['race_id'], f['date'] = str(day)+'|'+rid, str(day)
            f['horse'] = [r['horse'] for r in rows]
            f['code'] = discipline(rows[0])
            f['won'] = [int(position(r.get('pos')) == 1) for r in rows]
            f['position'] = [position(r.get('pos')) for r in rows]
            f['sp'] = [odds(r.get('sp')) for r in rows]
            f['field_size'] = len(rows)
            frames.append(f)
        # Current-day comments/margins/outcomes enter history only after every prediction.
        history.incorporate(updates, day)
        if day.month == 1 and day.day == 1:
            print(f'Replayed through {day}; {len(frames):,} development races', flush=True)
    data = pd.concat(frames, ignore_index=True)
    data.to_pickle(root/'development.pkl')
    with (root/'history-development.pkl').open('wb') as f:
        pickle.dump(history, f, protocol=pickle.HIGHEST_PROTOCOL)
    coverage = {c:float(data[c].notna().mean()) for c in data if c.startswith(('form__','pace__'))}
    report = {'races':len(frames), 'runners':len(data), 'feature_columns':len([c for c in data if '__' in c]),
              'history_through':str(history.last_day), 'excluded':dict(excluded), 'feature_coverage':coverage,
              'retired_period_scored':False, 'current_race_outcomes_are_features':False,
              'source_point_in_time_verified':False}
    (root/'preparation.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='feature_coverage'}), flush=True)
    return report


if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--workspace', default='v3/workspace-formula')
    p.add_argument('--protocol', default='v3/formula-protocol.json')
    a=p.parse_args()
    prepare(a.workspace, json.loads(Path(a.protocol).read_text()))
