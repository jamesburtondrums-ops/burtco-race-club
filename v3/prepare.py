import json
import pickle
from collections import Counter
from pathlib import Path
import pandas as pd
from .data import archive_days, discipline, eligible, odds, position, selected
from .features import History


def prepare(root, protocol):
    root = Path(root)
    state = History()
    dev, final = [], []
    reasons, codes = Counter(), Counter()
    first = last = None
    training_state_saved = False
    for day, races in archive_days(root / 'raw/raceform.download'):
        stamp = str(day)
        first = first or stamp
        last = stamp
        if stamp > protocol['final_end']:
            break
        if stamp > protocol['validation_end'] and not training_state_saved:
            with (root / 'history-development.pkl').open('wb') as output:
                pickle.dump(state, output)
            training_state_saved = True
        updates = []
        for rid, rows in races.items():
            # This archive also includes international racing; restrict the experiment to GB/IRE.
            import re
            countries = re.findall(r'\(([A-Z]{2,3})\)', rows[0].get('course', ''))
            if any(c not in ('IRE', 'AW') for c in countries):
                reasons['outside_gb_ire'] += 1
                continue
            error = eligible(rows)
            if error:
                reasons[error] += 1
                continue
            updates.extend(rows)
            if stamp < protocol['learning_start']:
                continue
            is_final = protocol['final_start'] <= stamp <= protocol['final_end']
            is_dev = stamp <= protocol['validation_end'] and selected(rid, protocol['development_sample_modulus'])
            if not (is_final or is_dev):
                continue
            features = state.race(rows, day)
            # Provider race IDs are reused on different dates in this archive.
            features['race_id'] = stamp + '|' + rid
            features['date'] = stamp
            features['horse'] = [r['horse'] for r in rows]
            features['code'] = discipline(rows[0])
            features['won'] = [int(position(r.get('pos')) == 1) for r in rows]
            features['position'] = [position(r.get('pos')) for r in rows]
            features['sp'] = [odds(r.get('sp')) for r in rows]
            (final if is_final else dev).append(features)
            codes[('final_' if is_final else 'development_') + discipline(rows[0])] += 1
        # Every race on this date is predicted before any result on this date is incorporated.
        state.incorporate(updates, day)
        if day.day == 1 and day.month == 1:
            print(f'Replayed through {stamp}; stored {len(dev)} development races', flush=True)
    if not training_state_saved:
        with (root / 'history-development.pkl').open('wb') as output:
            pickle.dump(state, output)
    if not dev:
        raise ValueError('No eligible development races')
    pd.concat(dev, ignore_index=True).to_pickle(root / 'development.pkl')
    if final:
        pd.concat(final, ignore_index=True).to_pickle(root / 'sealed-final.pkl')
    with (root / 'history-latest.pkl').open('wb') as output:
        pickle.dump(state, output)
    audit = {'first_source_day': first, 'last_processed_day': min(last, protocol['final_end']),
             'development_races': len(dev), 'reserved_final_races': len(final),
             'race_type_counts': dict(codes), 'excluded_races': dict(reasons),
             'all_features_use_results_from_earlier_days_only': True,
             'complete_starters_only': True, 'complete_declarations_verified': False,
             'source_timestamps_verified': False,
             'excluded_features': ['current_rpr', 'current_ts', 'current_sp', 'current_comment', 'current_finish_time', 'current_margin'],
             'missing_feature_families': ['verified pre-race performance figures', 'measured pace', 'track configuration',
                                          'sectionals', 'equipment publication times', 'pre-race odds', 'versioned ratings'],
             'original_model_comparison': 'No matching frozen probability forecasts in archive; 25% is not a scored baseline.'}
    (root / 'data-audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    print(json.dumps(audit), flush=True)
