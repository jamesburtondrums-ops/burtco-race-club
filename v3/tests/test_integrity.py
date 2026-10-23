"""Adversarial tests, using explicitly synthetic races only for software verification."""
import json
import pickle
import sqlite3
from datetime import date, datetime, timedelta, timezone
import numpy as np
import pandas as pd
import pytest
from v3.data import archive_days, distance, eligible, odds
from v3.features import History
from v3.metrics import metrics, paired_bootstrap
from v3.models import AbilityModel, normalise
from v3.records import Ledger, validate_snapshot


def rows():
    return [dict(horse=name, trainer='Yard', jockey='Rider', course='York', type='Flat', race_name='Handicap',
                 dist='1m2f', going='Good', ran='3', pos=str(i+1), age='4', sex='G', wgt='9-4',
                 **{'class': 'Class 4', 'or': str(70-i)}, hg='', draw=str(i+1), sire='Sire')
            for i, name in enumerate(('Alpha', 'Beta', 'Gamma'))]


def test_current_outcome_and_market_cannot_change_features():
    history = History()
    original = rows()
    a = history.race(original, date(2026, 1, 2))
    malicious = [dict(r, pos='1', sp='1/100', rpr='999', ts='999', time='10', comment='won easily', btn='0') for r in original]
    pd.testing.assert_frame_equal(a, history.race(malicious, date(2026, 1, 2)))


def test_same_day_and_future_results_are_refused():
    h = History()
    h.incorporate(rows(), date(2026, 1, 2))
    with pytest.raises(ValueError):
        h.race(rows(), date(2026, 1, 2))
    with pytest.raises(ValueError):
        h.race(rows(), date(2026, 1, 1))
    assert h.race(rows(), date(2026, 1, 3)).prior_starts.tolist() == [1, 1, 1]


def test_repeated_horse_and_jump_form_separation():
    h = History()
    h.incorporate(rows(), date(2026, 1, 1))
    jump = [dict(r, type='Hurdle') for r in rows()]
    assert h.race(jump, date(2026, 1, 2)).prior_starts.tolist() == [0, 0, 0]
    restored = pickle.loads(pickle.dumps(h))
    pd.testing.assert_frame_equal(h.race(rows(), date(2026, 1, 2)), restored.race(rows(), date(2026, 1, 2)))


def test_incomplete_fields_dead_heats_duplicates():
    assert eligible(rows()) is None
    assert eligible(rows()[:2]) == 'incomplete_starter_field'
    assert eligible([rows()[0], rows()[0], rows()[2]]) == 'duplicate_horse'
    tied = rows()
    tied[1]['pos'] = '1'
    assert eligible(tied) == 'no_single_official_winner'


def test_probability_metrics_are_race_balanced():
    f = pd.DataFrame({'race_id': ['a']*3+['b']*2, 'date': ['2026-01-01']*5,
                      'horse': ['A','B','C','A','B'], 'won': [1,0,0,0,1], 'position': [1,2,3,2,1],
                      'code': ['turf']*5, 'field_size': [3]*3+[2]*2})
    p = normalise([4, 1, 1, 1, 4], f.race_id)
    assert np.allclose(pd.Series(p).groupby(f.race_id).sum(), 1)
    m = metrics(f, p)
    assert m['top_one'] == 1
    assert m['log_loss'] == pytest.approx((-np.log(4/6)-np.log(4/5))/2)
    assert m['brier'] == pytest.approx(((1-4/6)**2+2*(1/6)**2+.2**2+.2**2)/2)
    assert paired_bootstrap(f, p, p, repetitions=20)['accuracy_gain']['ci95'] == [0,0]


def snapshot():
    now = datetime(2026, 10, 23, 8, tzinfo=timezone.utc)
    iso = lambda delta: (now+timedelta(minutes=delta)).isoformat()
    data = {'race_id': 'synthetic-test', 'cutoff': iso(10), 'off_at': iso(20), 'observed_at': iso(-1),
            'published_at': iso(-2), 'source_url': 'https://example.org/unit-test', 'declared_runner_count': 3,
            'runners': [{k:v for k,v in r.items() if k not in ('ran','pos')} for r in rows()]}
    return now, data


def test_snapshot_requires_actual_pre_race_clock_and_no_outcomes():
    now, data = snapshot()
    validate_snapshot(data, now)
    with pytest.raises(ValueError):
        validate_snapshot(data, now+timedelta(hours=1))
    data['runners'][0]['rpr'] = 100
    with pytest.raises(ValueError, match='outcome-bearing'):
        validate_snapshot(data, now)


def test_snapshot_rejects_incomplete_field_naive_time_and_future_quote():
    now, data = snapshot()
    data['declared_runner_count'] = 4
    with pytest.raises(ValueError, match='Complete'):
        validate_snapshot(data, now)
    data['declared_runner_count'] = 3
    data['observed_at'] = '2026-10-23T07:59:00'
    with pytest.raises(ValueError, match='timezone'):
        validate_snapshot(data, now)
    now, data = snapshot()
    data['market'] = [{'horse':'Alpha','decimal_odds':4,'observed_at':(now+timedelta(minutes=1)).isoformat()}]
    with pytest.raises(ValueError, match='future'):
        validate_snapshot(data, now)


def test_ledger_is_append_only_and_hash_verified(tmp_path):
    ledger = Ledger(tmp_path/'ledger.sqlite')
    ledger.append('prediction', 'a', {'winner':'Alpha'})
    ledger.append('result', 'a', {'winner':'Beta'})
    assert ledger.verify()
    for sql in ('UPDATE events SET payload=\'{}\'', 'DELETE FROM events'):
        with pytest.raises(sqlite3.IntegrityError):
            ledger.db.execute(sql)
        ledger.db.rollback()
    with pytest.raises(sqlite3.IntegrityError):
        ledger.append('prediction', 'a', {'winner':'Beta'})
    assert ledger.verify()


def test_learning_and_identity_exclusion():
    frame = []
    for race in range(120):
        for horse in range(3):
            frame.append({'race_id': str(race), 'code':'turf', 'ability':float(horse), 'won':int(horse==2)})
    f = pd.DataFrame(frame)
    model = AbilityModel('race_softmax', ['ability']).fit(f)
    p = model.predict(f)
    assert (p[2::3] > p[1::3]).all()
    # Permute outcomes after fit: prediction is unchanged.
    f.won = 1-f.won
    assert np.allclose(p, model.predict(f))


def test_parsers():
    assert distance('2m3½f') == 19.5
    assert odds('5/2F') == 3.5
    assert odds('Evens') == 2


def test_source_ordering_groups_all_same_day_results(tmp_path):
    raw = tmp_path / 'unordered.csv'
    raw.write_text('date,race_id,horse\n2026-01-02,b,B\n2026-01-01,a,A\n2026-01-02,b,C\n')
    days = list(archive_days(raw))
    assert [str(day) for day, _ in days] == ['2026-01-01', '2026-01-02']
    assert len(days[1][1]['b']) == 2
    assert json.loads(raw.with_suffix('.ordering.json').read_text())['original_date_regressions'] == 1


def test_final_is_one_use_and_blocks_further_development(tmp_path):
    from v3.experiment import develop, digest, file_digest, final_evaluate, save, source_digest
    frame = pd.DataFrame([{'race_id':str(r), 'date':'2026-02-01','horse':h,'won':int(i==1),
                           'position':2-i,'code':'turf','field_size':2,'sp':2.,'ability':float(i)}
                          for r in range(12) for i,h in enumerate(('A','B'))])
    model = AbilityModel('race_softmax', ['ability']).fit(frame)
    with (tmp_path/'model.pkl').open('wb') as f:
        pickle.dump({'model':model,'temperature':1.,'training_end':'2026-01-01'}, f)
    frame.to_pickle(tmp_path/'sealed-final.pkl')
    protocol = {'final_start':'2026-02-01','final_end':'2026-02-02','minimum_final_races':10,'embargo_days':7,'seed':1}
    save(tmp_path/'frozen-config.json', {'protocol_hash':digest(protocol),'code_hash':source_digest(),
                                       'model_hash':file_digest(tmp_path/'model.pkl'),
                                       'selected':'race_softmax','evaluation_period':['2026-02-01','2026-02-02']})
    final_evaluate(tmp_path, protocol)
    with pytest.raises(FileExistsError):
        final_evaluate(tmp_path, protocol)
    with pytest.raises(ValueError, match='Retire'):
        develop(tmp_path, protocol)


def test_final_refuses_changed_config_before_opening_labels(tmp_path):
    from v3.experiment import final_evaluate, save
    save(tmp_path/'frozen-config.json', {'protocol_hash':'tampered'})
    with pytest.raises(ValueError, match='changed'):
        final_evaluate(tmp_path, {})
    assert not (tmp_path/'final-use.json').exists()


def test_future_forecast_and_official_result_end_to_end(tmp_path, monkeypatch):
    import importlib
    prediction_module = importlib.import_module('v3.predict')
    now = datetime.now(timezone.utc)
    old_day = (now-timedelta(days=3)).date()
    h = History()
    h.incorporate(rows(), old_day)
    frame = h.race(rows(), (now+timedelta(days=1)).date())
    frame['race_id'], frame['code'], frame['won'] = 'unit', 'turf', [1,0,0]
    model = AbilityModel('race_softmax', ['official_rating']).fit(frame)
    with (tmp_path/'model.pkl').open('wb') as output:
        pickle.dump({'model':model,'temperature':1.,'training_end':str(old_day), 'status':'SYNTHETIC_SOFTWARE_TEST'}, output)
    with (tmp_path/'history-latest.pkl').open('wb') as output:
        pickle.dump(h, output)
    payload = snapshot()[1]
    payload.update(published_at=(now-timedelta(minutes=2)).isoformat(), observed_at=(now-timedelta(minutes=1)).isoformat(),
                   cutoff=(now+timedelta(minutes=10)).isoformat(), off_at=(now+timedelta(minutes=20)).isoformat())
    frozen = prediction_module.predict(tmp_path, payload)
    assert frozen['predicted_winner'] == 'Alpha'
    assert sum(r['win_probability'] for r in frozen['ranking']) == pytest.approx(1)
    class LaterClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return now+timedelta(hours=1)
    monkeypatch.setattr(prediction_module, 'datetime', LaterClock)
    result = {'race_id':payload['race_id'],'status':'OFFICIAL','source_url':'https://example.org/unit-test-result',
              'published_at':(now+timedelta(minutes=25)).isoformat(), 'observed_at':(now+timedelta(minutes=26)).isoformat(),
              'finishes':{'Alpha':1,'Beta':2,'Gamma':3}}
    prediction_module.record_result(tmp_path, result)
    assert prediction_module.score_records(tmp_path)['top_one'] == 1
    assert Ledger(tmp_path/'predictions.sqlite').verify()
