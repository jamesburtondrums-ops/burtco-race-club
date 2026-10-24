import json
from pathlib import Path
import pytest
from v3.market_review import fractional_decimal,market_name,compare_probability
from v3.form_review import history_key,early_style,comment_flags


def test_fractional_integer_prices_are_not_decimal():
    assert fractional_decimal('7')==8
    assert fractional_decimal('7/2')==4.5
    assert fractional_decimal('100/ 30')==pytest.approx(13/3)
    assert fractional_decimal('SP') is None


def test_nonrunner_historical_prices_are_excluded_from_active_field():
    assert market_name('Big Tribe (7)(N/R)')==('BIGTRIBE',True)
    assert market_name('Kody B (11) NR')==('KODYB',True)
    assert market_name('Prosperitas (12)')==('PROSPERITAS',False)


def test_gap_calculation_does_not_change_probability():
    p=.17
    good=compare_probability(p,[('Book','8')],{'a':.16,'b':.18})
    poor=compare_probability(p,[('Book','3')],{'a':.16,'b':.18})
    assert good['frozen_model_probability']==poor['frozen_model_probability']==p
    assert good['break_even_probability']==pytest.approx(1/9)
    assert good['both_components_above_break_even']
    assert poor['model_gap_percentage_points']<0


def test_reused_archive_race_ids_cannot_merge_different_fields():
    a={'date':'2026-04-12','course':'Newmarket','off':'14:00','race_id':'123'}
    b=dict(a,date='2026-05-15')
    c=dict(a,course='York')
    assert len({history_key(a),history_key(b),history_key(c)})==3


def test_equipment_prefix_does_not_hide_early_position():
    assert early_style('Wore red hood to post, held up in rear, led last')=='held_up'
    assert early_style('Mounted in chute, wore hood to post, tracked leader')=='prominent'
    assert 'interference_or_blocked' in comment_flags('Held up, short of room, stayed on')


def test_full_study_has_all_runners_without_altering_frozen_predictions():
    p=Path('v3/public/study.json')
    if not p.exists():pytest.skip('No published study')
    d=json.loads(p.read_text());base=json.loads(Path('v3/public/raceday.json').read_text())
    original={h['horse_id']:h['win_probability'] for r in base['races'] for h in r['ranking']}
    assert d['races_reviewed']==31 and d['runners_reviewed']==281
    assert d['matched_prior_starts']==4798
    assert d['field_matched_markets']==31
    assert not d['market_features_used_for_ability'] and not d['frozen_predictions_changed']
    count=0
    for r in d['races']:
        assert r['market_field_match']
        assert sum(h['win_probability'] for h in r['runners'])==pytest.approx(1)
        for h in r['runners']:
            count+=1
            assert h['win_probability']==original[h['horse_id']]
            assert all(x['date']<d['date'] for x in h['full_history'])
            assert h['career_matched_starts']==len(h['full_history'])
            for x in h['last_six']:
                c=x['opposition_context']
                if c:assert c['date']==x['date'] and c['field_size']==c['advertised_starters']
    assert count==281
    cases={x['horse'] for x in d['reviewed_cases']}
    assert len(cases)==4 and 'Ancient State (IRE)' in cases
