"""Restore an operational candidate without reopening or rescoring the retired test.

The architecture and temperature are copied from the recorded DEVELOPMENT decision.
The regenerated artifact is a different fitted instance, never assigned the old test score.
"""
import json
import pickle
import re
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
from .data import archive_days, discipline, eligible, position, selected
from .experiment import file_digest, save
from .features import History
from .models import AbilityModel


def rebuild_runtime(root, report_path=None):
    root = Path(root)
    if (root / 'model.pkl').exists():
        raise ValueError('Runtime model already exists; refusing to replace it')
    report_path = Path(report_path) if report_path else Path(__file__).with_name('reports') / 'summary.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    decision, frozen = report['development'], report['frozen']
    protocol = decision['protocol']
    source_path = root / 'raw/raceform.download'
    source = json.loads((root / 'raw/manifest.json').read_text(encoding='utf-8'))
    # This command reproduces one recorded dataset, not a new development experiment.
    if source['sha256'] != frozen['dataset_hash'] or file_digest(source_path) != source['sha256']:
        raise ValueError('Source differs from recorded experiment; start a governed new cycle instead')
    history, development = History(), []
    today = datetime.now(timezone.utc).date()
    for day, races in archive_days(source_path):
        if day >= today:
            break
        stamp = str(day)
        updates = []
        for rid, rows in races.items():
            countries = re.findall(r'\(([A-Z]{2,3})\)', rows[0].get('course', ''))
            if any(c not in ('IRE', 'AW') for c in countries) or eligible(rows):
                continue
            if (protocol['learning_start'] <= stamp <= protocol['validation_end']
                    and selected(rid, protocol['development_sample_modulus'])):
                frame = history.race(rows, day)
                frame['race_id'] = stamp + '|' + rid
                frame['date'] = stamp
                frame['horse'] = [r['horse'] for r in rows]
                frame['code'] = discipline(rows[0])
                frame['won'] = [int(position(r.get('pos')) == 1) for r in rows]
                development.append(frame)
            updates.extend(rows)
        history.incorporate(updates, day)
        if day.day == 1 and day.month == 1:
            print(f'Restored history through {stamp}', flush=True)
    if not development:
        raise ValueError('No development races available')
    frame = pd.concat(development, ignore_index=True)
    if frame.race_id.nunique() != decision['training_races']:
        raise ValueError('Development race count differs from recorded experiment')
    model = AbilityModel(decision['selected'], frozen['features'], protocol['seed']).fit(frame)
    artifact = {'model': model, 'temperature': decision['selected_temperature'], 'features': frozen['features'],
                'training_end': str(frame.date.max()), 'protocol': protocol,
                'status': 'REBUILT_EXPERIMENTAL_NOT_INDEPENDENTLY_EVALUATED', 'source': source}
    # Complete both expensive objects before publishing either of them.
    for filename, value in [('model.pkl', artifact), ('history-latest.pkl', history)]:
        temporary = root / (filename + '.partial')
        with temporary.open('wb') as output:
            pickle.dump(value, output, protocol=pickle.HIGHEST_PROTOCOL)
    for filename in ('model.pkl', 'history-latest.pkl'):
        (root / (filename + '.partial')).replace(root / filename)
    metadata = {'status': artifact['status'], 'created_at': datetime.now(timezone.utc).isoformat(),
                'selected_from': 'Recorded development validation decision; no model comparison rerun.',
                'model_hash': file_digest(root / 'model.pkl'), 'history_hash': file_digest(root / 'history-latest.pkl'),
                'original_evaluated_model_hash': frozen['model_hash'],
                'historical_report_applies_to_runtime': False,
                'development_races': int(frame.race_id.nunique()), 'training_end': artifact['training_end'],
                'history_as_of': str(history.last_day), 'final_period_reopened': False,
                'promotion': 'RETAIN_ORIGINAL', 'source_hash': source['sha256']}
    save(root / 'runtime-rebuild.json', metadata)
    print(json.dumps(metadata), flush=True)
    return metadata
