"""Future full-field forecasts from a frozen challenger and prior-only history."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import pickle
import re
from zoneinfo import ZoneInfo
from .data import eligible, discipline
from .formula_data import days
from .formula_features import code
from .formula_identity import resolve_rows
from .formula_train import file_hash
from .records import Ledger, validate_snapshot


def refresh_history(root, as_of):
    root=Path(root)
    if as_of>=datetime.now(timezone.utc).date().isoformat():
        raise ValueError('Archive history refresh is limited to completed earlier days')
    with (root/'history-development.pkl').open('rb') as f:history=pickle.load(f)
    for day,races in days(root/'raw/raceform.download',as_of):
        if day<=history.last_day:continue
        updates=[]
        for rows in races.values():
            countries=re.findall(r'\(([A-Z]{2,3})\)',rows[0].get('course',''))
            if any(c not in ('IRE','AW') for c in countries) or eligible(rows):continue
            updates.extend(rows)
        history.incorporate(updates,day)
    with (root/'history-live.pkl').open('wb') as f:pickle.dump(history,f,protocol=pickle.HIGHEST_PROTOCOL)
    report={'history_through':str(history.last_day),'model_retrained':False,'past_period_scored':False,
            'policy':'Completed previous days update form only; model parameters and calibration remain fixed.'}
    (root/'history-live.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report),flush=True)
    return report


def predict(root,snapshot,history_name='history-live.pkl'):
    root=Path(root)
    cutoff,off=validate_snapshot(snapshot)
    seal=json.loads((root/'formula-frozen-config.json').read_text())
    if file_hash(root/'candidate.pkl')!=seal['model_hash']:
        raise ValueError('Frozen challenger artifact changed')
    for name,expected in seal['source_hashes'].items():
        if file_hash(Path(__file__).parent/name)!=expected:
            raise ValueError('Frozen feature/model software changed: '+name)
    with (root/'candidate.pkl').open('rb') as f:artifact=pickle.load(f)
    with (root/history_name).open('rb') as f:history=pickle.load(f)
    day=off.astimezone(ZoneInfo('Europe/London')).date()
    if history.last_day>=day or artifact['training_end']>=str(day):
        raise ValueError('History or fitted parameters include the target day')
    if len({code(r) for r in snapshot['runners']})!=1:
        raise ValueError('All runners must belong to the same exact racing discipline')
    resolved,aliases=resolve_rows(history,snapshot['runners'],day)
    f=history.race(resolved,day)
    f['race_id']=snapshot['race_id']
    f['code']=discipline(snapshot['runners'][0])
    f['field_size']=len(f)
    probabilities=artifact['model'].predict(f,artifact['temperature'])
    rows=[{'horse':r['horse'],'win_probability':float(p),'fair_decimal_odds':float(1/p)}
          for r,p in zip(snapshot['runners'],probabilities)]
    rows.sort(key=lambda r:(-r['win_probability'],r['horse']))
    for rank,r in enumerate(rows,1):r['rank']=rank
    payload={'race_id':snapshot['race_id'],'off_at':snapshot['off_at'],'cutoff':snapshot['cutoff'],
        'recorded_at':datetime.now(timezone.utc).isoformat(),'snapshot':snapshot,'ranking':rows,
        'model_hash':seal['model_hash'],'candidate':artifact['candidate'],
        'history_through':str(history.last_day),'model_training_end':artifact['training_end'],
        'identity_resolutions':aliases,
        'status':'FROZEN_EXPERIMENTAL_CHALLENGER_FORECAST','price_used_as_feature':False,
        'independently_validated':False}
    validate_snapshot(snapshot)  # Check real clock again after inference.
    ledger=Ledger(root/'prospective-predictions.sqlite')
    record_hash=ledger.append('prediction',snapshot['race_id'],payload)
    ledger.verify()
    return {'record_hash':record_hash,'forecast':payload}


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--workspace',default='v3/workspace-formula')
    p.add_argument('--input')
    p.add_argument('--output')
    p.add_argument('--refresh-history-through')
    a=p.parse_args()
    if a.refresh_history_through:refresh_history(a.workspace,a.refresh_history_through)
    elif a.input and a.output:
        result=predict(a.workspace,json.loads(Path(a.input).read_text()))
        Path(a.output).write_text(json.dumps(result,indent=2,allow_nan=False))
    else:p.error('Supply --refresh-history-through or both --input and --output')
