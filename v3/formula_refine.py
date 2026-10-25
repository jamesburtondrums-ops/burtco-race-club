"""Second recorded development cycle: deeper context and learned blend weights."""
import json
from datetime import datetime,timezone
from pathlib import Path
import pickle
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from .models import AbilityModel,normalise
from .metrics import metrics,paired_bootstrap
from .formula_train import file_hash,odds_diagnostics


class LearnedBlend:
    def __init__(self,models,weights):
        self.models=models
        self.weights=np.asarray(weights,dtype=float)
        self.columns=models[0].columns
        self.name='learned_context_blend'

    def predict(self,frame,temperature=1):
        p=sum(w*m.predict(frame) for w,m in zip(self.weights,self.models))
        return normalise(p,frame.race_id,temperature)


def learn_weights(probabilities,won):
    a=np.asarray(probabilities,dtype=float).T[np.asarray(won)==1]
    def objective(w):
        p=np.clip(a@w,1e-15,1)
        return -np.log(p).mean(),-(a/p[:,None]).mean(axis=0)
    result=minimize(objective,np.full(a.shape[1],1/a.shape[1]),jac=True,method='SLSQP',
                    bounds=[(0,1)]*a.shape[1],constraints={'type':'eq','fun':lambda w:w.sum()-1,
                    'jac':lambda w:np.ones_like(w)},options={'ftol':1e-10,'maxiter':200})
    if not result.success or not np.isfinite(result.fun):raise ValueError('Blend optimisation failed')
    return result.x/result.x.sum()


def run(root='v3/workspace-formula',destination='v3/workspace-formula-b'):
    root,dest=Path(root),Path(destination)
    protocol=json.loads(Path('v3/formula-refinement-protocol.json').read_text())
    base_protocol=json.loads(Path('v3/formula-protocol.json').read_text())
    if datetime.now(timezone.utc).date().isoformat()>=protocol['future_final_start']:
        raise ValueError('Future holdout started before configuration freeze')
    dest.mkdir(exist_ok=True)
    if (dest/'refinement-report.json').exists():raise ValueError('Do not overwrite a completed development cycle')
    d=pd.read_pickle(root/'development.pkl')
    if d.date.max()>base_protocol['validation_end']:raise ValueError('Development boundary exceeded')
    cols=sorted(c for c in d if c.startswith(('typed__','form__','pace__')))
    names=('race_softmax','boosted_small','boosted_deep')
    previous_p=[[],[],[]]
    previous_y=[]
    fold_frames,deep_oof,blend_oof,folds=[],[],[],[]
    for train_end,start,end in base_protocol['folds']:
        train=d[d.date<=train_end]
        valid=d[d.date.between(start,end)]
        fits=[AbilityModel(n,cols,base_protocol['seed']).fit(train) for n in names]
        raw=[m.predict(valid) for m in fits]
        # Current fold outcomes cannot influence its blend weights.
        weights=learn_weights([np.concatenate(x) for x in previous_p],np.concatenate(previous_y)) if previous_y else np.full(3,1/3)
        blend=normalise(sum(w*p for w,p in zip(weights,raw)),valid.race_id)
        folds.append({'start':start,'end':end,'blend_weights':weights.tolist(),
            'deep_context':metrics(valid,raw[2]),'learned_blend':metrics(valid,blend)})
        fold_frames.append(valid)
        deep_oof.append(raw[2]);blend_oof.append(blend)
        for bank,p in zip(previous_p,raw):bank.append(p)
        previous_y.append(valid.won.to_numpy())
        print(f'Refinement fold complete: {start} / {end}',flush=True)
    weights=learn_weights([np.concatenate(x) for x in previous_p],np.concatenate(previous_y))
    oof_frame=pd.concat(fold_frames,ignore_index=True)
    raw_final_blend=sum(w*np.concatenate(bank) for w,bank in zip(weights,previous_p))
    temperatures={}
    trials={}
    for name,p in [('deep_context',np.concatenate(deep_oof)),('learned_blend',raw_final_blend)]:
        trial={str(t):metrics(oof_frame,normalise(p,oof_frame.race_id,t))['log_loss'] for t in protocol['temperature_grid']}
        trials[name]=trial;temperatures[name]=float(min(trial,key=trial.get))
    train=d[d.date<=base_protocol['training_end']]
    valid=d[d.date.between('2024-01-08',base_protocol['validation_end'])].reset_index(drop=True)
    fits=[AbilityModel(n,cols,base_protocol['seed']).fit(train) for n in names]
    deep=fits[2]
    blend=LearnedBlend(fits,weights)
    predictions={'deep_context':deep.predict(valid,temperatures['deep_context']),
                 'learned_blend':blend.predict(valid,temperatures['learned_blend'])}
    old=pd.read_csv(root/'development-frozen-predictions.csv')
    if old[['race_id','horse']].to_records(index=False).tolist()!=valid[['race_id','horse']].to_records(index=False).tolist():
        raise ValueError('Parent validation prediction rows do not match')
    parent=json.loads((root/'formula-development.json').read_text())
    baseline=parent['later_development_validation']['original_ensemble']
    original=old.original_ensemble.to_numpy()
    scores={n:metrics(valid,p) for n,p in predictions.items()}
    odds={n:odds_diagnostics(valid,p) for n,p in predictions.items()}
    support={n:sum(f[n]['log_loss']<parent['folds'][i]['models']['original_ensemble']['log_loss'] for i,f in enumerate(folds)) for n in predictions}
    gates={n:dict(log_loss=s['log_loss']<baseline['log_loss'],top_one=s['top_one']>=baseline['top_one'],
        brier=s['brier']<=baseline['brier'],chronological_folds=support[n]>=2,
        longer_price_top_one=odds[n]['over_12_to_1']['winners_ranked_first']>=17,
        longer_price_top_three=odds[n]['over_12_to_1']['winners_in_model_top3']>=79) for n,s in scores.items()}
    eligible=[n for n,g in gates.items() if all(g.values())]
    chosen=min(eligible,key=lambda n:(scores[n]['log_loss'],-scores[n]['top_one'])) if eligible else None
    frozen=valid[['race_id','date','horse','code']].copy()
    for n,p in predictions.items():frozen[n]=p
    frozen.to_csv(dest/'development-frozen-predictions.csv',index=False)
    comparison={n:paired_bootstrap(valid,p,original,seed=base_protocol['seed'],repetitions=2000) for n,p in predictions.items()}
    report={'created_at':datetime.now(timezone.utc).isoformat(),'status':'SECOND_DEVELOPMENT_CYCLE_NOT_INDEPENDENT_TEST',
        'protocol':protocol,'parent_protocol':base_protocol,'training_races':int(d.race_id.nunique()),
        'validation_races':int(valid.race_id.nunique()),'selected':chosen,
        'component_order':names,'learned_weights':weights.tolist(),'temperatures':temperatures,
        'calibration_trials':trials,'chronological_folds':folds,'fold_support':support,'acceptance_gates':gates,
        'validation':scores,'odds_band_diagnostics':odds,'development_day_bootstrap':comparison,
        'retired_test_scored':False,'future_final_evaluated':False,'production_action':'RETAIN_ORIGINAL'}
    if chosen:
        fits=[AbilityModel(n,cols,base_protocol['seed']).fit(d) for n in names]
        model=fits[2] if chosen=='deep_context' else LearnedBlend(fits,weights)
        artifact={'model':model,'temperature':temperatures[chosen],'features':cols,'candidate':chosen,
                  'training_end':str(d.date.max()),'protocol':protocol,
                  'status':'DEVELOPMENT_CHALLENGER_NOT_INDEPENDENTLY_VALIDATED'}
        with (dest/'candidate.pkl').open('wb') as f:pickle.dump(artifact,f,protocol=pickle.HIGHEST_PROTOCOL)
        seal={'created_at':report['created_at'],'model_hash':file_hash(dest/'candidate.pkl'),
              'candidate':chosen,'source_hashes':{p:file_hash(Path('v3')/p) for p in
              ('formula_refine.py','formula_features.py','formula_data.py','formula_predict.py','formula_train.py',
               'data.py','features.py','models.py','records.py')},
              'future_final_period':[protocol['future_final_start'],protocol['future_final_end']],
              'final_labels_accessed':False}
        (dest/'formula-frozen-config.json').write_text(json.dumps(seal,indent=2))
        report['model_hash']=seal['model_hash']
    (dest/'refinement-report.json').write_text(json.dumps(report,indent=2,allow_nan=False))
    print(json.dumps({'selected':chosen,'weights':weights.tolist(),'scores':{n:{k:s[k] for k in ('top_one','log_loss','brier')} for n,s in scores.items()},'gates':gates}),flush=True)
    return report


if __name__=='__main__':run()
