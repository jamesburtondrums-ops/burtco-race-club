"""Chronological development of price-independent formula challengers.

The retired final period is not loaded, scored or optimised. All scores here
are explicitly development evidence; a future period is reserved separately.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import pickle
import numpy as np
import pandas as pd
from .models import AbilityModel, normalise
from .metrics import metrics, paired_bootstrap
from .governance import assert_unopened_period


def file_hash(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        while block:=f.read(4*1024*1024):h.update(block)
    return h.hexdigest()


def prefixes(name):
    return {'original_ensemble':('base__',), 'typed_boosted':('typed__',),
            'context_boosted':('typed__','form__'), 'pace_boosted':('typed__','pace__'),
            'context_ensemble':('typed__','form__','pace__')}[name]


def fit_all(frame, protocol):
    models={}
    for name in protocol['candidates']:
        cols=sorted(c for c in frame if c.startswith(prefixes(name)))
        architecture='ensemble' if name.endswith('ensemble') else 'boosted_small'
        model=AbilityModel(architecture,cols,protocol['seed']).fit(frame)
        models[name]=model
        print(f'Fitted {name}: {frame.race_id.nunique():,} races, {len(cols)} features',flush=True)
    return models


def odds_diagnostics(frame, probability):
    f=frame[['race_id','horse','won','position','sp']].copy()
    f['p']=probability
    f=f.sort_values(['race_id','p','horse'],ascending=[True,False,True],kind='stable')
    f['rank']=f.groupby('race_id',sort=False).cumcount()+1
    result={}
    for label,mask in [('up_to_2_to_1',f.sp<=3),('over_2_to_1_to_6_to_1',f.sp.between(3,7,inclusive='right')),
                       ('over_6_to_1_to_12_to_1',f.sp.between(7,13,inclusive='right')),('over_12_to_1',f.sp>13)]:
        g=f[mask]
        leaders=g[g['rank']==1]
        top3=g[g['rank']<=3]
        result[label]={'runners':len(g),'actual_winners':int(g.won.sum()),'expected_winners':float(g.p.sum()),
            'winners_ranked_first':int(((g.won==1)&(g['rank']==1)).sum()),
            'winners_in_model_top3':int(((g.won==1)&(g['rank']<=3)).sum()),
            'top_ranked_picks':len(leaders),'top_ranked_wins':int(leaders.won.sum()),
            'top3_ranked_runners':len(top3),'top3_ranked_finishing_top3':int(top3.position.between(1,3).sum())}
    return result


def develop(root, protocol):
    root=Path(root)
    assert_unopened_period(protocol)
    if (root/'candidate.pkl').exists() or (root/'formula-development.json').exists():
        raise ValueError('Development already completed; version a new protocol instead of overwriting')
    if datetime.now(timezone.utc).date().isoformat()>=protocol['final_start']:
        raise ValueError('Future holdout has started before configuration freeze; reserve a later period')
    d=pd.read_pickle(root/'development.pkl')
    if d.date.max()>protocol['validation_end']:
        raise ValueError('Development data crosses its fixed boundary')
    oof={n:[] for n in protocol['candidates']}
    oof_frames,folds=[],[]
    for train_end,start,end in protocol['folds']:
        train=d[d.date<=train_end]
        valid=d[d.date.between(start,end)]
        if train.race_id.nunique()<1000 or valid.race_id.nunique()<100:
            raise ValueError('Insufficient chronological fold')
        fits=fit_all(train,protocol)
        fold={'training_end':train_end,'validation_start':start,'validation_end':end,'models':{}}
        for name,model in fits.items():
            p=model.predict(valid)
            oof[name].append(p)
            fold['models'][name]=metrics(valid,p)
        oof_frames.append(valid)
        folds.append(fold)
        print(f'Completed chronological fold {start} to {end}',flush=True)
    calibration=pd.concat(oof_frames,ignore_index=True)
    temperatures,trials={},{}
    for name in protocol['candidates']:
        raw=np.concatenate(oof[name])
        tests={str(t):metrics(calibration,normalise(raw,calibration.race_id,t))['log_loss']
               for t in protocol['temperature_grid']}
        temperatures[name]=float(min(tests,key=tests.get))
        trials[name]=tests
    train=d[d.date<=protocol['training_end']]
    valid=d[d.date.between('2024-01-08',protocol['validation_end'])].reset_index(drop=True)
    fits=fit_all(train,protocol)
    predictions={n:m.predict(valid,temperatures[n]) for n,m in fits.items()}
    scores={n:metrics(valid,p) for n,p in predictions.items()}
    baseline=scores['original_ensemble']
    fold_support={n:sum(fold['models'][n]['log_loss']<fold['models']['original_ensemble']['log_loss'] for fold in folds)
                  for n in protocol['candidates'] if n!='original_ensemble'}
    eligible=[n for n,s in scores.items() if n!='original_ensemble'
              and s['log_loss']<baseline['log_loss'] and s['top_one']>=baseline['top_one']
              and s['brier']<=baseline['brier'] and fold_support[n]>=2]
    chosen=min(eligible,key=lambda n:(scores[n]['log_loss'],-scores[n]['top_one'])) if eligible else 'original_ensemble'
    print(json.dumps({'selected':chosen,'later_validation':{n:{k:s[k] for k in ('races','top_one','log_loss','brier')} for n,s in scores.items()}}),flush=True)
    # Freeze validation predictions before any comparative reporting. No test data is present.
    frozen=valid[['race_id','date','horse','code']].copy()
    for n,p in predictions.items():frozen[n]=p
    frozen.to_csv(root/'development-frozen-predictions.csv',index=False)
    comparison={n:paired_bootstrap(valid,p,predictions['original_ensemble'],seed=protocol['seed'],repetitions=2000)
                for n,p in predictions.items() if n!='original_ensemble'}
    odds={n:odds_diagnostics(valid,p) for n,p in predictions.items()}
    final_model=AbilityModel('ensemble' if chosen.endswith('ensemble') else 'boosted_small',
                            sorted(c for c in d if c.startswith(prefixes(chosen))),protocol['seed']).fit(d)
    artifact={'model':final_model,'temperature':temperatures[chosen], 'features':final_model.columns,
              'training_end':str(d.date.max()),'protocol':protocol,'candidate':chosen,
              'status':'DEVELOPMENT_CHALLENGER_NOT_INDEPENDENTLY_VALIDATED',
              'history_class':'v3.formula_features.FormulaHistory'}
    with (root/'candidate.pkl').open('wb') as f:pickle.dump(artifact,f,protocol=pickle.HIGHEST_PROTOCOL)
    report={'created_at':datetime.now(timezone.utc).isoformat(),'status':artifact['status'],
        'protocol':protocol,'source_hash':file_hash(root/'raw/raceform.download'),
        'model_hash':file_hash(root/'candidate.pkl'),'prepared_data_hash':file_hash(root/'development.pkl'),
        'validation_predictions_hash':file_hash(root/'development-frozen-predictions.csv'),
        'environment':{p:importlib.metadata.version(p) for p in ('numpy','pandas','scikit-learn','scipy')},
        'training_races':int(d.race_id.nunique()),'training_end':str(d.date.max()),
        'folds':folds,'calibration_trials':trials,'temperatures':temperatures,
        'later_development_validation':scores,'earlier_folds_with_lower_log_loss':fold_support,
        'development_day_bootstrap':comparison,
        'odds_band_diagnostics':odds,'selected':chosen,'candidate_passed_development_gate':chosen!='original_ensemble',
        'retired_final_period_reopened':False,'future_final_evaluated':False,
        'production_action':'RETAIN_ORIGINAL','independent_improvement_demonstrated':False,
        'limitations':['Development periods were previously studied. They are not a new independent holdout.',
            'Prior achieved ratings and current handicap marks lack certified historical version timestamps.',
            'Starter fields are complete but historical declaration/non-runner timing is unavailable.',
            'Odds diagnostics use result SP after prediction; no early-price betting profitability is inferred.',
            'A long-priced winner is not automatically a predictable winner; comments are descriptive evidence.']}
    (root/'formula-development.json').write_text(json.dumps(report,indent=2,allow_nan=False))
    sources=['formula_features.py','formula_data.py','formula_prepare.py','formula_train.py','models.py']
    seal={'created_at':report['created_at'],'protocol_sha256':hashlib.sha256(json.dumps(protocol,sort_keys=True).encode()).hexdigest(),
          'source_hashes':{p:file_hash(Path(__file__).parent/p) for p in sources},
          'model_hash':report['model_hash'],'candidate':chosen,'temperature':temperatures[chosen],
          'future_final_period':[protocol['final_start'],protocol['final_end']],
          'final_labels_accessed':False,'development_report_only':True}
    (root/'formula-frozen-config.json').write_text(json.dumps(seal,indent=2))
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--workspace',default='v3/workspace-formula')
    p.add_argument('--protocol',default='v3/formula-protocol.json')
    a=p.parse_args()
    develop(a.workspace,json.loads(Path(a.protocol).read_text()))
