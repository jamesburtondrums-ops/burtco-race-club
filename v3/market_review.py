"""Compare fixed independent predictions with observed bookmaker grid quotes.

A positive arithmetic discrepancy is NOT independently established betting value.
"""
import json,math,hashlib,re
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from .daily_archive import base_name
from .form_review import form_dossiers
from .tomorrow import DIRECTORY,safe


def market_name(value):
    text=str(value).strip()
    nonrunner=bool(re.search(r'(?:\(|\s)N/?R\)?\s*$', text, re.I))
    if nonrunner:
        text=re.sub(r'\s*\(?N/?R\)?\s*$', '', text, flags=re.I).strip()
    text=re.sub(r'\s*\(\d+\)\s*$', '', text).strip()
    return base_name(text),nonrunner


def fractional_decimal(value):
    text=str(value).replace(' ','').strip().lower()
    if text in ('evens','evs'):return 2.
    if '/' in text:
        a,b=text.split('/')
        return 1+float(a)/float(b) if float(b)>0 else None
    if text.isdigit():return 1+float(text)  # Oddschecker uses fractional integers: 3 means 3/1.
    return None


def compare_probability(p,quotes,components):
    clean=[]
    for book,text in quotes:
        try:v=fractional_decimal(text)
        except (ValueError,ZeroDivisionError):v=None
        if v is not None and math.isfinite(v) and v>1:clean.append({'bookmaker':book,'fractional':text,'decimal':v})
    if not clean:return None
    best=max(clean,key=lambda q:q['decimal'])
    lower=min(components.values()) if components else None
    return {'best_quote':best,'quote_count':len(clean),'break_even_probability':1/best['decimal'],
        'frozen_model_probability':p,'model_gap_percentage_points':100*(p-1/best['decimal']),
        'model_fair_decimal':1/p,'model_expected_return':p*best['decimal']-1,
        'components':components,'component_spread_percentage_points':100*(max(components.values())-min(components.values())) if components else None,
        'both_components_above_break_even':lower>1/best['decimal'] if lower is not None else None,
        'lower_component_expected_return':lower*best['decimal']-1 if lower is not None else None,
        'interpretation':'Arithmetic comparison using unvalidated experimental probabilities; neither an uncertainty interval nor proof of a real market edge.'}


def build_study():
    data=json.loads(Path('v3/public/raceday.json').read_text())
    career=json.loads((DIRECTORY/'career-form.json').read_text());context=json.loads((DIRECTORY/'form-context.json').read_text())
    dossiers=form_dossiers(data,career,context);di={(h['race_id'],h['horse']):h for h in dossiers}
    sources=json.loads((DIRECTORY/'market-grid.json').read_text());mi={(s['course'],s['time']):s for s in sources}
    components=json.loads((DIRECTORY/'component-probabilities.json').read_text())
    races=[]
    for r in data['races']:
        source=mi.get((r['course'],r['time']));expected={base_name(h['display_name']) for h in r['ranking']}
        quoted={market_name(h['horse'])[0] for h in source.get('rows',[]) if h['quotes'] and not market_name(h['horse'])[1]} if source else set()
        field_ok=expected==quoted
        byname={market_name(h['horse'])[0]:h for h in source.get('rows',[]) if not market_name(h['horse'])[1]} if source else {}
        baseline=None
        for book in ['bet365','Skybet','William Hill']:
            qs={k:dict(byname.get(k,{}).get('quotes',[])).get(book) for k in expected}
            if all(qs.values()):
                probs={k:1/fractional_decimal(v) for k,v in qs.items()};total=sum(probs.values())
                baseline={'bookmaker':book,'overround':total,'normalised_probabilities':{k:v/total for k,v in probs.items()},'field_warning':not field_ok};break
        horses=[]
        for h in r['ranking']:
            key=base_name(h['display_name']);d=di[(r['race_id'],h['horse'])]
            cv=components.get(r['race_id'],{}).get(key,{})
            market=compare_probability(h['win_probability'],byname.get(key,{}).get('quotes',[]),cv)
            if market:
                market.update({'observed_at':source['observed_at'],'source_url':source['url'],'source':'Oddschecker bookmaker grid; quote publication time unavailable','field_matches_frozen_declarations':field_ok,
                    'source_extra_quoted_horses':sorted(quoted-expected),'source_missing_horses':sorted(expected-quoted),
                    'bookmaker_normalised_probability':baseline['normalised_probabilities'][key] if baseline else None,
                    'baseline_bookmaker':baseline['bookmaker'] if baseline else None,'baseline_overround':baseline['overround'] if baseline else None})
                if not field_ok:status='FIELD_CONFLICT_RECHECK_REQUIRED'
                elif d['evidence_coverage']=='limited':status='LIMITED_FORM_NO_CONFIDENT_EDGE'
                elif market['model_gap_percentage_points']<=0:status='PRICE_BELOW_MODEL_REQUIREMENT'
                elif not market['both_components_above_break_even']:status='MODEL_DISAGREEMENT_REVIEW'
                else:status='MODEL_INDICATED_GAP_UNVALIDATED'
                market['status']=status
            d.update({'course':r['course'],'time':r['time'],'display_name':h['display_name'],'model_rank':h['rank'],'win_probability':h['win_probability'],'market':market})
            horses.append(d)
        races.append({'race_id':r['race_id'],'course':r['course'],'time':r['time'],'off_at':r['off_at'],'market_field_match':field_ok,'runners':horses})
    output={'created_at':datetime.now(timezone.utc).isoformat(),'date':data['date'],'races':races,'races_reviewed':len(races),'runners_reviewed':len(dossiers),
        'matched_prior_starts':sum(h['career_matched_starts'] for h in dossiers),'historical_races_reconstructed':len(context),
        'model_hash':data['model_hash'],'frozen_predictions_changed':False,'market_features_used_for_ability':False,
        'model_probability_notice':'Win probability is not confidence in the research. Evidence coverage and model disagreement are separate diagnostics. No independently demonstrated accuracy improvement is claimed.',
        'price_notice':'Observed aggregator quotes, not confirmed executable offers. Field conflicts can mean stale pre-withdrawal prices or Rule 4 changes. Such races are blocked from the reviewed value list.',
        'nonrunner_quote_policy':'Rows explicitly marked NR are excluded even when the grid retains historical prices.',
        'data_notice':'Historical archive stops on 22 October. Career coverage is incomplete, including some overseas starts. Subsequent form uses only outcomes dated before 24 October.',
        'reviewed_rejections':json.loads((DIRECTORY/'reviewed-rejections.json').read_text()),
        'field_matched_markets':sum(r['market_field_match'] for r in races),'reviewed_cases':json.loads((DIRECTORY/'reviewed-cases.json').read_text())}
    Path('v3/public/study.json').write_text(json.dumps(safe(output),separators=(',',':'),allow_nan=False))
    print(json.dumps({'races':len(races),'runners':len(dossiers),'field_matched_markets':output['field_matched_markets']}))
    for r in races:
        for h in r['runners']:
            m=h['market']
            if m and m['status']=='MODEL_INDICATED_GAP_UNVALIDATED':
                print(r['course'],r['time'],h['display_name'],h['evidence_coverage'],round(h['win_probability']*100,1),m['best_quote']['fractional'],round(m['model_gap_percentage_points'],1),{k:round(v*100,1) for k,v in m['components'].items()},h['research_findings'])
    return output

if __name__=='__main__':build_study()
