"""Regression checks for cross-device continuation and prospective integrity."""
import json
import pickle
from datetime import date, timedelta
import pandas as pd
import pytest
from v3.features import History
from v3.governance import assert_unopened_period
from v3.records import Ledger, validate_snapshot
from v3.report import report_bundle
from v3.tests.test_integrity import rows, snapshot


def test_retirement_survives_a_new_workspace(tmp_path):
    from v3.experiment import final_evaluate
    with pytest.raises(ValueError, match='retired'):
        final_evaluate(tmp_path, {'final_start': '2026-06-04', 'final_end': '2026-09-30'})
    assert not (tmp_path / 'final-use.json').exists()


def test_retirement_checks_partial_overlap_and_allows_new_period():
    with pytest.raises(ValueError, match='retired'):
        assert_unopened_period({'final_start': '2026-09-30', 'final_end': '2026-10-01'})
    with pytest.raises(ValueError, match='retired'):
        assert_unopened_period({'final_start': '2026-10-24', 'final_end': '2026-12-31'})
    assert_unopened_period({'final_start': '2026-10-26', 'final_end': '2027-01-31'})
    with pytest.raises(ValueError, match='retired'):
        assert_unopened_period({'final_start': '2026-10-01', 'final_end': '2026-10-22',
                                'retired_test_periods': ['2026-10-01/2026-10-22']})


def test_predicting_distant_future_does_not_change_nearer_forecasts():
    history = History()
    day = date(2026, 1, 1)
    history.incorporate(rows(), day)
    before = history.race(rows(), day + timedelta(days=2))
    history.race(rows(), day + timedelta(days=100))
    after = history.race(rows(), day + timedelta(days=2))
    pd.testing.assert_frame_equal(before, after)


def test_snapshot_rejects_mixed_races_and_ambiguous_quotes():
    now, card = snapshot()
    card['runners'][1]['course'] = 'Ascot'
    with pytest.raises(ValueError, match='Inconsistent racecard'):
        validate_snapshot(card, now)
    now, card = snapshot()
    quote = {'horse': 'Alpha', 'decimal_odds': 4, 'observed_at': card['observed_at']}
    card['market'] = [quote, quote]
    with pytest.raises(ValueError, match='Duplicate market'):
        validate_snapshot(card, now)


def test_clean_checkout_dashboard_retains_recorded_experiment(tmp_path):
    report = report_bundle(tmp_path)
    assert report['final']['candidate']['races'] == 4785
    assert report['report_origin'] == 'COMMITTED_PREVIOUS_EXPERIMENT_NOT_A_NEW_EVALUATION'
    assert report['runtime']['status'] == 'MODEL_NOT_INSTALLED'
    assert report['runtime']['historical_report_applies_to_runtime'] is False


def test_history_waits_for_all_frozen_races_on_a_day(tmp_path):
    from v3.cli import advance_history
    history = History()
    history.incorporate(rows(), date(2026, 1, 1))
    with (tmp_path / 'history-latest.pkl').open('wb') as out:
        pickle.dump(history, out)
    ledger = Ledger(tmp_path / 'predictions.sqlite')
    for rid, stamp in [('a', '2026-01-02'), ('b', '2026-01-02'), ('c', '2026-01-03')]:
        ledger.append('prediction', rid, {'off_at': stamp + 'T12:00:00+00:00',
                      'source_snapshot': {'runners': rows()}, 'ranking': rows()})
    result = {'finishes': {'Alpha': 1, 'Beta': 2, 'Gamma': 3}}
    ledger.append('result', 'a', result)
    ledger.append('result', 'c', result)
    status = advance_history(tmp_path)
    assert status['completed_days_added'] == 0
    assert status['history_as_of'] == '2026-01-01'
    ledger.append('result', 'b', result)
    status = advance_history(tmp_path)
    assert status['completed_days_added'] == 2
    assert status['history_as_of'] == '2026-01-03'


def test_runtime_refuses_to_overwrite_existing_model(tmp_path):
    from v3.runtime import rebuild_runtime
    (tmp_path / 'model.pkl').write_bytes(b'preserve-me')
    with pytest.raises(ValueError, match='already exists'):
        rebuild_runtime(tmp_path)
    assert (tmp_path / 'model.pkl').read_bytes() == b'preserve-me'


def test_replaced_source_cannot_silently_reuse_old_chronological_index(tmp_path):
    from v3.data import archive_days
    raw = tmp_path / 'source.csv'
    raw.write_text('date,race_id,horse\n2026-01-01,a,Alpha\n')
    assert list(archive_days(raw))[0][1]['a'][0]['horse'] == 'Alpha'
    raw.write_text('date,race_id,horse\n2026-01-02,b,Beta-longer\n')
    output = list(archive_days(raw))
    assert str(output[0][0]) == '2026-01-02'
    assert output[0][1]['b'][0]['horse'] == 'Beta-longer'

