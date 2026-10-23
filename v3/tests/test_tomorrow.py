"""Checks against the real future declaration snapshot; no outcome labels used."""
import json
from pathlib import Path
import pytest
from v3.daily_archive import base_name
from v3.tomorrow import pace_style, same_person


def test_identity_and_early_pace_are_conservative():
    assert base_name("O'Moore Park (IRE)") == base_name('Omoore Park')
    assert same_person('H Cobden', 'Harry Cobden')
    assert not same_person('Harry Cobden', 'James Bowen')
    assert pace_style('Held up in rear, led last, won') == 'held_up'
    assert pace_style('Soon led, clear') == 'front'


def test_complete_fields_birth_year_and_nonrunner_exclusion():
    path = Path('v3/public/tomorrow.json')
    if not path.exists():
        pytest.skip('Published prospective snapshot is not included in this checkout')
    data = json.loads(path.read_text())
    assert data['race_count'] == 31
    assert data['runner_count'] == 300
    assert data['original_declarations'] == 301
    assert data['nonrunner_count'] == 1
    ids = []
    for race in data['races']:
        assert len(race['ranking']) + len(race['withdrawn']) == race['original_declarations']
        assert sum(r['win_probability'] for r in race['ranking']) == pytest.approx(1)
        assert all(0 < r['win_probability'] < 1 for r in race['ranking'])
        assert race['model_history_through'] < data['date']
        ids.extend(r['horse_id'] for r in race['ranking'])
    assert len(set(ids)) == 300
    assert [w['horse'] for r in data['races'] for w in r['withdrawn']] == ['Kody B (IRE)']
    national = next(h for r in data['races'] for h in r['ranking'] if h['display_name'] == 'National Anthem')
    assert national['age'] == 2
    assert national['matched_prior_starts'] == 0  # older same-name horse must never supply form
    assert national['last_three_published_runs'] == []
