import json
import pickle
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from .data import discipline
from .experiment import file_digest
from .metrics import metrics
from .records import Ledger, timestamp, validate_snapshot


def predict(root, snapshot):
    root = Path(root)
    cutoff, off = validate_snapshot(snapshot)
    with (root / 'model.pkl').open('rb') as handle:
        artifact = pickle.load(handle)
    with (root / 'history-latest.pkl').open('rb') as handle:
        history = pickle.load(handle)
    day = cutoff.date()
    if history.last_day and history.last_day >= day:
        raise ValueError('History contains results on or beyond the prediction day')
    if artifact['training_end'] >= str(day):
        raise ValueError('Model training period overlaps prediction day')
    rows = snapshot['runners']
    frame = history.race(rows, day)
    frame['race_id'] = str(snapshot['race_id'])
    frame['horse'] = [r['horse'] for r in rows]
    frame['code'] = discipline(rows[0])
    p = artifact['model'].predict(frame, artifact['temperature'])
    quotes = {q['horse']: float(q['decimal_odds']) for q in snapshot.get('market', [])}
    ranking = [{'horse': r['horse'], 'win_probability': float(p[i]),
                'early_decimal_odds': quotes.get(r['horse']),
                'estimated_value_edge': float(p[i]*quotes[r['horse']]-1) if r['horse'] in quotes else None,
                'recent_form_improvement': float(frame.improvement.iloc[i]) if np.isfinite(frame.improvement.iloc[i]) else None,
                'prior_same_code_starts': int(frame.prior_starts.iloc[i])} for i, r in enumerate(rows)]
    ranking.sort(key=lambda r: (-r['win_probability'], r['horse']))
    payload = {'race_id': str(snapshot['race_id']), 'cutoff': snapshot['cutoff'], 'off_at': snapshot['off_at'],
               'source_snapshot': snapshot, 'model_hash': file_digest(root / 'model.pkl'),
               'model_name': artifact['model'].name, 'model_training_end': artifact['training_end'],
               'history_as_of': str(history.last_day), 'model_status': artifact['status'],
               'calibration': 'Temperature selected using chronological development folds; prospective calibration unproven.',
               'predicted_winner': ranking[0]['horse'], 'strongest_opposition': [r['horse'] for r in ranking[1:4]],
               'ranking': ranking}
    # Recheck the real clock after inference before committing a forecast.
    if datetime.now(timezone.utc) > cutoff:
        raise ValueError('Prediction cutoff elapsed during inference; nothing recorded')
    ledger = Ledger(root / 'predictions.sqlite')
    payload['record_hash'] = ledger.append('prediction', payload['race_id'], payload)
    return payload


def record_result(root, result):
    root = Path(root)
    ledger = Ledger(root / 'predictions.sqlite')
    predictions = [r['payload'] for r in ledger.rows('prediction') if r['race_id'] == str(result['race_id'])]
    if len(predictions) != 1:
        raise ValueError('Exactly one frozen prediction required before result attachment')
    prediction = predictions[0]
    now = datetime.now(timezone.utc)
    observed, published = timestamp(result['observed_at']), timestamp(result['published_at'])
    if not timestamp(prediction['off_at']) < published <= observed <= now:
        raise ValueError('Result publication must follow the off and precede observation time')
    if not result.get('source_url', '').startswith('https://') or result.get('status') != 'OFFICIAL':
        raise ValueError('Official result and HTTPS source URL required')
    finishes = result['finishes']
    if set(finishes) != {r['horse'] for r in prediction['ranking']}:
        raise ValueError('Result field differs from frozen field; record a new race version for late changes')
    positions = list(finishes.values())
    if any(not isinstance(p, int) or p < 0 for p in positions) or positions.count(1) != 1:
        raise ValueError('Require one official winner; 0 denotes a non-finisher')
    return {'record_hash': ledger.append('result', str(result['race_id']), result)}


def score_records(root):
    import pandas as pd
    ledger = Ledger(Path(root) / 'predictions.sqlite')
    ledger.verify()
    predictions = {r['race_id']: r['payload'] for r in ledger.rows('prediction')}
    frame, probabilities = [], []
    for row in ledger.rows('result'):
        prediction = predictions[row['race_id']]
        for runner in prediction['ranking']:
            pos = row['payload']['finishes'][runner['horse']]
            frame.append({'race_id': row['race_id'], 'date': prediction['off_at'][:10], 'horse': runner['horse'],
                          'won': int(pos == 1), 'position': pos, 'code': discipline(prediction['source_snapshot']['runners'][0]),
                          'field_size': len(prediction['ranking'])})
            probabilities.append(runner['win_probability'])
    return metrics(pd.DataFrame(frame), probabilities) if frame else {'races': 0, 'status': 'Awaiting official results'}
