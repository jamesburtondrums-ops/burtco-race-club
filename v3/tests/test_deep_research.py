import json
from pathlib import Path
from copy import deepcopy
import pytest
from v3.deep_research import DAY, matched_prior, marks, runner_evidence, same_discipline


def row(**kw):
    r=dict(date='2026-01-01',horse='Example (GB)',age='4',race_id='1',race_name='Example Handicap',course='Southwell (AW)',type='Flat',going='Standard',dist='6f',pos='1',ran='10',**{'or':'65','rpr':'70','ts':'60','class':'Class 6'},ovr_btn='0',hg='',jockey='A Rider',trainer='A Trainer',comment='Held up in rear, led late')
    return dict(r,**kw)


def test_identity_and_future_results_are_rejected():
    h={'horse':'Example (GB)','age':4}
    records=[row(),row(date='2026-10-24'),row(age='9'),row(horse='Example (IRE)')]
    assert len(matched_prior(h,records))==1


def test_handicap_marks_do_not_use_nonhandicap_win():
    x=marks([row(),row(date='2026-02-01',race_name='Classified Stakes',**{'or':'40'})],60)
    assert x['below_last_win_lb']==5
    assert x['last_winning_handicap']['date']=='2026-01-01'


def test_handicap_evidence_separates_surface_and_jump_discipline():
    assert same_discipline(row(),{'title':'Sprint Handicap','course':'Southwell'})
    assert not same_discipline(row(course='Doncaster',going='Heavy'),{'title':'Sprint Handicap','course':'Southwell'})
    assert not same_discipline(row(type='Hurdle',course='Kelso',going='Good'),{'title':'Handicap Chase','course':'Kelso'})


def test_prices_cannot_change_research_evidence():
    horse={'horse':'Example (GB)','age':4,'or':60,'days_since_run':296}
    race={'title':'Sprint Handicap','course':'Southwell','going':'Standard','distance':'6f'}
    original=runner_evidence(horse,race,[row(sp='100/1')],None)
    altered=runner_evidence(dict(horse,price='1/10'),dict(race,price='1/10'),[row(sp='1/10')],None)
    assert original==altered
    assert original['handicap']['below_last_win_lb']==5
    assert original['pace']['style']=='held_up'


def test_full_fresh_field_and_evening_preservation():
    p=Path('v3/public/raceday.json')
    if not p.exists():pytest.skip('No published race-day artifact')
    d=json.loads(p.read_text());old=json.loads(Path('v3/public/tomorrow.json').read_text())
    assert d['runner_count']==281 and d['nonrunner_count']==20
    assert old['runner_count']==300 and old['nonrunner_count']==1
    assert d['model_hash']==old['model_hash']
    assert len(d['races'])==31
    assert len(d['selections'])==5
    assert d['research']['independent_of_prices']
    old_ids={r['race_id'] for r in old['races']}
    for r in d['races']:
        assert r['race_id'] not in old_ids
        assert sum(h['win_probability'] for h in r['ranking'])==pytest.approx(1)
        assert len(r['ranking'])+len(r['withdrawn'])==r['original_declarations']
        assert all('research' in h for h in r['ranking'])
    assert all('Coup De Coeur' not in x['horse'] for x in d['selections'])
    assert sum(len(r['ranking']) for r in d['races'])==281
    assert d['research']['runners_with_pre_race_rpr']==245


def test_known_placement_and_rating_conflict_are_exposed():
    p=Path('v3/public/raceday.json')
    if not p.exists():pytest.skip('No published race-day artifact')
    d=json.loads(p.read_text());horses={h['display_name']:h for r in d['races'] for h in r['ranking']}
    e=horses['Prosperitas']['research']
    assert e['suitability']['going']['wins']==2
    assert e['suitability']['going']['starts']==2
    assert e['handicap']['below_last_win_lb']==-4
    assert len(e['placement']['matching_season_wins'])==1
    assert not e['placement']['intent_confirmed']
    assert horses['Almaty Star']['research']['handicap']['below_last_win_lb']==5
    ash=horses['Ashdown Forest']['research']['current_card_ratings']
    assert ash['rpr_field_rank']==6  # joint-lowest: two runners tie on 110



def test_research_refresh_does_not_duplicate_shortlist_or_change_predictions():
    from v3.deep_research import enrich, rating_index
    p=Path('v3/public/raceday.json')
    if not p.exists():pytest.skip('No published race-day artifact')
    d=json.loads(p.read_text())
    before=[(r['record_hash'],[(h['horse'],h['win_probability']) for h in r['ranking']]) for r in d['races']]
    after=enrich(deepcopy(d),rating_index()[2])
    assert len(after['selections'])==5
    assert len(after['limitations'])==len(set(after['limitations']))
    assert before==[(r['record_hash'],[(h['horse'],h['win_probability']) for h in r['ranking']]) for r in after['races']]
