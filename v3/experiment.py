"""Development and final evaluation are separate commands with an exclusive one-use seal."""
import hashlib
import json
import os
import pickle
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
import numpy as np
import pandas as pd
from .metrics import metrics, paired_bootstrap
from .models import AbilityModel, META, normalise


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def file_digest(path):
    hasher = hashlib.sha256()
    with Path(path).open('rb') as handle:
        while block := handle.read(4 * 1024 * 1024):
            hasher.update(block)
    return hasher.hexdigest()


def source_digest():
    return digest({p.name: hashlib.sha256(p.read_text(encoding='utf-8').encode()).hexdigest()
                   for p in sorted(Path(__file__).parent.glob('*.py'))})


def save(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False), encoding='utf-8')


def fit_candidates(frame, columns, protocol):
    fitted = {}
    for name in protocol['candidates']:
        model = AbilityModel(name, columns, protocol['seed'])
        if name == 'ensemble':
            model.models = {key: fitted[key] for key in ('race_softmax', 'boosted_small')}
        else:
            model.fit(frame)
        fitted[name] = model
        print(f'Fitted {name} on {frame.race_id.nunique():,} races', flush=True)
    return fitted


def develop(root, protocol):
    root = Path(root)
    if (root / 'final-use.json').exists():
        raise ValueError('Final period has been opened. Retire it and reserve new data before further development.')
    data = pd.read_pickle(root / 'development.pkl')
    if (data.date > protocol['validation_end']).any():
        raise ValueError('Development dataset crosses its permitted boundary')
    columns = sorted(set(data.columns) - META)
    oof = {name: [] for name in protocol['candidates']}
    oof_frames, folds = [], []
    for train_end, start, end in protocol['folds']:
        train = data[data.date <= train_end]
        validation = data[data.date.between(start, end)]
        if train.race_id.nunique() < 1000 or validation.race_id.nunique() < 100:
            continue
        fitted = fit_candidates(train, columns, protocol)
        result = {'train_end': train_end, 'validation_start': start, 'validation_end': end, 'models': {}}
        for name, model in fitted.items():
            p = model.predict(validation)
            oof[name].append(p)
            result['models'][name] = metrics(validation, p)
        oof_frames.append(validation)
        folds.append(result)
        print(f'Completed walk-forward period {start} / {end}', flush=True)
    if len(folds) < 2:
        raise ValueError('At least two chronological development folds are required')
    calibration_frame = pd.concat(oof_frames, ignore_index=True)
    temperatures, calibration_trials = {}, {}
    for name in protocol['candidates']:
        raw = np.concatenate(oof[name])
        trials = {str(t): metrics(calibration_frame, normalise(raw, calibration_frame.race_id, t))['log_loss']
                  for t in protocol['temperature_grid']}
        best = min(trials, key=trials.get)
        temperatures[name] = float(best)
        calibration_trials[name] = trials
    training = data[data.date <= protocol['training_end']]
    validation_start = str(datetime.fromisoformat(protocol['training_end']).date() + timedelta(days=protocol['embargo_days']+1))
    validation = data[data.date.between(validation_start, protocol['validation_end'])]
    fitted = fit_candidates(training, columns, protocol)
    results = {name: metrics(validation, m.predict(validation, temperatures[name])) for name, m in fitted.items()}
    # Fixed rule: probability quality is primary; top-one breaks an exact tie.
    selected = min(results, key=lambda k: (results[k]['log_loss'], -results[k]['top_one']))
    # Formulate factor hypotheses only on development validation, before touching final results.
    blocks = {'ratings_handicap': ['rating', 'mark_', 'below_last_win', 'class_drop'],
              'connections': ['trainer', 'jockey', 'sire'],
              'recent_form': ['finish', 'improvement', 'win_rate5', 'top3_rate5', 'days_since'],
              'suitability': ['course_', 'distance_win', 'going_win', 'cd_top3'],
              'draw_weight': ['draw', 'weight']}
    importance = {}
    rng = np.random.default_rng(protocol['seed'])
    groups = list(validation.groupby('race_id').indices.values())
    for label, patterns in blocks.items():
        modified = validation.copy()
        permutation = np.arange(len(modified))
        for indices in groups:
            permutation[indices] = rng.permutation(indices)
        for column in columns:
            if any(pattern in column for pattern in patterns):
                modified[column] = validation[column].to_numpy()[permutation]
        score = metrics(modified, fitted[selected].predict(modified, temperatures[selected]))['log_loss']
        importance[label] = {'validation_log_loss_increase_when_shuffled_within_race': score-results[selected]['log_loss']}
    model = AbilityModel(selected, columns, protocol['seed']).fit(data)
    artifact = {'model': model, 'temperature': temperatures[selected], 'features': columns,
                'training_end': str(data.date.max()), 'protocol': protocol,
                'status': 'EXPERIMENTAL_ARCHIVE_TRAINED', 'source': json.loads((root / 'raw/manifest.json').read_text())}
    model_path = root / 'model.pkl'
    with model_path.open('wb') as output:
        pickle.dump(artifact, output)
    validation_report = {'protocol': protocol, 'feature_columns': columns, 'folds': folds,
                         'calibration_temperatures': temperatures, 'calibration_trials': calibration_trials,
                         'selection_validation': results, 'selected': selected,
                         'selection_rule': 'Minimum later-validation race log loss; top-one breaks exact ties.',
                         'selected_temperature': temperatures[selected],
                         'development_factor_hypotheses': importance,
                         'training_diagnostic': metrics(training, fitted[selected].predict(training, temperatures[selected])),
                         'validation_uniform': metrics(validation, 1 / validation.field_size.to_numpy()),
                         'training_races': int(data.race_id.nunique()), 'training_end': artifact['training_end']}
    save(root / 'development-report.json', validation_report)
    seal = freeze_configuration(root, protocol)
    print(json.dumps({'selected': selected, 'validation': results[selected], 'frozen': seal['model_hash']}), flush=True)


def freeze_configuration(root, protocol):
    import importlib.metadata
    root = Path(root)
    if (root / 'final-use.json').exists():
        raise ValueError('Cannot freeze or revise a model against an already opened final period')
    with (root / 'model.pkl').open('rb') as handle:
        artifact = pickle.load(handle)
    if artifact['protocol'] != protocol:
        raise ValueError('Trained model protocol differs from requested final protocol')
    seal = {'created_at': datetime.now(timezone.utc).isoformat(), 'protocol_hash': digest(protocol),
            'code_hash': source_digest(), 'model_hash': file_digest(root / 'model.pkl'),
            'final_data_hash': file_digest(root / 'sealed-final.pkl'),
            'dataset_hash': artifact['source']['sha256'], 'selected': artifact['model'].name,
            'temperature': artifact['temperature'], 'features': artifact['features'],
            'environment': {p: importlib.metadata.version(p) for p in ('numpy','pandas','scikit-learn','scipy','joblib','threadpoolctl')},
            'evaluation_period': [protocol['final_start'], protocol['final_end']],
            'primary_endpoint': 'paired top-one and race log-loss improvement on every eligible race',
            'no_further_tuning_on_final': True}
    save(root / 'frozen-config.json', seal)
    return seal


def final_evaluate(root, protocol):
    from .governance import assert_unopened_period
    assert_unopened_period(protocol)
    root = Path(root)
    seal = json.loads((root / 'frozen-config.json').read_text())
    if seal['protocol_hash'] != digest(protocol) or seal['code_hash'] != source_digest():
        raise ValueError('Protocol or software changed after freezing; final evaluation refused')
    if seal['model_hash'] != file_digest(root / 'model.pkl'):
        raise ValueError('Frozen model hash mismatch')
    if seal.get('final_data_hash') and seal['final_data_hash'] != file_digest(root / 'sealed-final.pkl'):
        raise ValueError('Reserved data changed after configuration was frozen')
    # Atomic create occurs BEFORE labels are opened. A failed run consumes the period conservatively.
    with (root / 'final-use.json').open('x', encoding='utf-8') as output:
        json.dump({'opened_at': datetime.now(timezone.utc).isoformat(), 'model_hash': seal['model_hash'],
                   'period': seal['evaluation_period'], 'status': 'OPENED_RETIRED_FOR_FURTHER_TUNING'}, output, indent=2)
    data = pd.read_pickle(root / 'sealed-final.pkl')
    data = data[data.date.between(protocol['final_start'], protocol['final_end'])].reset_index(drop=True)
    if data.race_id.nunique() < protocol['minimum_final_races']:
        raise ValueError('Final sample smaller than preregistered minimum; no predictive claim')
    with (root / 'model.pkl').open('rb') as handle:
        artifact = pickle.load(handle)
    if (datetime.fromisoformat(protocol['final_start']) - datetime.fromisoformat(artifact['training_end'])).days <= protocol['embargo_days']:
        raise ValueError('Insufficient embargo between development and final period')
    p = artifact['model'].predict(data, artifact['temperature'])
    # Freeze the complete probability table before calculating outcome metrics.
    forecasts = data[['race_id', 'date', 'horse', 'code']].copy()
    forecasts['probability'] = p
    forecasts.to_csv(root / 'final-frozen-predictions.csv', index=False)
    uniform = 1 / data.field_size.to_numpy()
    result = {'status': 'FINAL_ARCHIVE_EVALUATION_COMPLETED_PROVISIONAL', 'selected': seal['selected'],
              'period': seal['evaluation_period'], 'candidate': metrics(data, p),
              'uniform': metrics(data, uniform), 'versus_uniform': paired_bootstrap(data, p, uniform, protocol['seed']),
              'frozen_model_hash': seal['model_hash'], 'frozen_prediction_hash': file_digest(root / 'final-frozen-predictions.csv'),
              'original_model': {'available': False, 'reason': 'No frozen original forecasts for the identical historical races.'},
              'early_price_roi': None, 'early_price_drawdown': None,
              'early_price_reason': 'No timestamped early bookmaker quotes; SP returns are not early-price returns.'}
    complete_market = data.groupby('race_id').sp.transform(lambda x: x.notna().all() and (x > 1).all())
    market = data[complete_market].copy()
    if len(market):
        implied = normalise(1 / market.sp.to_numpy(), market.race_id)
        mp = p[complete_market.to_numpy()]
        result['retrospective_sp_baseline'] = metrics(market, implied)
        result['versus_retrospective_sp'] = paired_bootstrap(market, mp, implied, protocol['seed'])
        result['sp_comparison_label'] = 'Retrospective reference at starting price; unavailable at the configured pre-race cutoff.'
    blockers = ['Archive has no pre-race snapshot timestamps or versioned ratings.',
                'Archive supplies complete starter fields; earlier declared fields and non-runner timing are unverified.',
                'No complete, timestamped pre-race bookmaker baseline or executable early prices.',
                'No identical-race frozen original probability forecasts.']
    comparison = result.get('versus_retrospective_sp', {})
    if not comparison or comparison['accuracy_gain']['ci95'][0] <= 0 or comparison['log_loss_gain']['ci95'][0] <= 0:
        blockers.append('No demonstrated paired accuracy and probability-error improvement over the SP reference.')
    result['promotion'] = {'allowed': False, 'decision': 'RETAIN_ORIGINAL', 'blockers': blockers}
    save(root / 'final-report.json', result)
    print(json.dumps({k: result[k] for k in ('status', 'selected', 'candidate', 'promotion')}), flush=True)
