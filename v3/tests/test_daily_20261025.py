"""Prospective integrity checks: fields, cutoff, prices, audit and race-code corrections."""
import json,hashlib
from pathlib import Path
from datetime import datetime
import pytest
from v3.daily_run import race_kind
from v3.records import canonical

def test_abbreviated_irish_race_types():
 assert race_kind('Gerry Coyne Memorial Irish EBF Beg Sch 4-y-o plus')=='Chase'
 assert race_kind('Bet With Tote On Racing & Sports Mdn Hdl 4-y-o')=='Hurdle'
 assert race_kind('Tom Dempsey (F) (Pr-Am) INH Flat Race 4-y-o')=='NH Flat'

def test_complete_todays_fields_prices_and_pre_race_cutoffs():
 p=json.loads(Path('v3/public/today.json').read_text())
 assert (p['race_count'],p['runner_count'],p['nonrunner_count'])==(23,194,19)
 assert p['history_through']<p['date']
 assert len(p['selections'])==3
 assert not p['production_model_changed']
 for r in p['races']:
  assert 'live-research-2' in r['race_id']
  assert len(r['ranking'])+len(r['withdrawn'])==r['original_declarations']
  assert len({h['horse'] for h in r['ranking']})==len(r['ranking'])
  assert r['market_field_matches']
  for k in ['recorded_at','observed_at','ratings_observed_at','market_observed_at']:
   assert datetime.fromisoformat(r[k].replace('Z','+00:00'))<datetime.fromisoformat(r['off_at'])
  for key in ['win_probability','shadow_challenger_probability']:
   assert sum(h[key] for h in r['ranking'])==pytest.approx(1)
  for h in r['ranking']:
   assert 0<h['win_probability']<1
   assert h['best_observed_quote']['decimal']>1
   assert all(x['date']<p['date'] for x in h['last_six'])
   assert not {'result','finish','won'}&set(h)
 for s in p['selections']:
  assert not s['stake_placed']
  assert s['quote']['decimal']>=s['minimum_decimal']>=2
  r=next(r for r in p['races'] if r['race_id']==s['race_id'])
  assert s['forecast_hash']==r['record_hash']
  assert datetime.fromisoformat(s['recorded_at'])<datetime.fromisoformat(r['off_at'])
 assert next(r for r in p['races'] if r['course']=='Galway' and r['time']=='12:32')['going']=='Soft to Heavy'
 assert next(r for r in p['races'] if r['course']=='Wexford' and r['time']=='15:40')['type']=='Hurdle'

def test_exported_audit_retains_superseded_forecasts_without_rewriting():
 audit=json.loads(Path('v3/research/2026-10-25/frozen-predictions.json').read_text())
 previous='0'*64
 for row in audit['events']:
  expected=hashlib.sha256(canonical([row['kind'],row['race_id'],row['recorded_at'],canonical(row['payload']),previous]).encode()).hexdigest()
  assert row['previous_hash']==previous
  assert row['event_hash']==expected
  previous=expected
 assert sum(r['kind']=='prediction' for r in audit['events'])==46
 assert sum(r['kind']=='selection' for r in audit['events'])==3
 assert sum(r['kind']=='correction' for r in audit['events'])==1
