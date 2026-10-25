"""Dated whole-field research using factual cards; challenger probabilities stay separate."""
import argparse,json,math,pickle,re
from collections import defaultdict,deque,Counter
from datetime import date,datetime,timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
from .data import token,number,weight,discipline,distance,position,category
from .daily_archive import base_name
from .tomorrow import same_person,safe
from .formula_identity import resolve_rows
from .formula_features import comment_facts,code
from .formula_train import file_hash
from .form_review import history_key
from .records import Ledger


def rp_name(s):
    return base_name(re.sub(r'(?:IRE|GER|GB|FR|USA|SAF|AUS|NZ)$','',s).strip())


def race_kind(title):
    title=title.lower()
    if 'chase' in title or re.search(r'\bbeg\s+sch\b',title):return 'Chase'
    if 'hurdle' in title or re.search(r'\bh.?dle?\b',title):return 'Hurdle'
    return 'NH Flat'


def person(history,kind,name):
    candidates=[k for role,k in history.totals if role==kind and not str(k).startswith('__CARD__') and same_person(name,k)]
    full=[k for k in candidates if all(len(v)>1 for v in k.split()[:-1])]
    if len(full)!=1:return token(name),[token(name)]
    aliases=[k for k in candidates if same_person(k,full[0])]
    key='__CARD__'+token(name)
    history.totals[(kind,key)]=[sum(history.totals[(kind,k)][j] for k in aliases) for j in (0,1)]
    history.events[(kind,key)]=deque(sorted([e for k in aliases for e in history.events[(kind,k)]],key=lambda e:e[0]))
    return key,aliases


def run(folder,day,original_root=Path('v3/workspace'),challenger_root=Path('v3/workspace-formula')):
    folder=Path(folder)
    cards=[json.loads(p.read_text()) for p in (folder/'cards').glob('*-complete.json')]
    rp={p.name[3:-5]:json.loads(p.read_text()) for p in (folder/'cards').glob('rp-*.json')}
    career=json.loads((folder/'career-form-today-local.json').read_text())
    context=json.loads((folder/'prior-field-context.json').read_text())
    original_root=Path(original_root)
    with (original_root/'model.pkl').open('rb') as f:artifact=pickle.load(f)
    with (original_root/'history-latest.pkl').open('rb') as f:history=pickle.load(f)
    challenger_root=Path(challenger_root)
    with (challenger_root/'candidate.pkl').open('rb') as f:challenger=pickle.load(f)
    with (challenger_root/'history-live.pkl').open('rb') as f:shadow_history=pickle.load(f)
    index=defaultdict(list)
    for key in list(history.horses):index[base_name(key)].append(key)
    model_hash=file_hash(original_root/'model.pkl')
    shadow_hash=file_hash(challenger_root/'candidate.pkl')
    races=[];unmatched=[]
    for card in cards:
        slug=card['course'].lower().replace(' ','-')
        ratings=rp[slug]
        if len(ratings['race_ids'])!=len(card['races']):raise ValueError('Race count conflict: '+slug)
        for j,race in enumerate(card['races']):
            rid=ratings['race_ids'][j]
            rr={rp_name(row[0]):dict(zip(ratings['fields'],row)) for row in ratings['rows'] if row[2]==rid}
            keys={base_name(h['horse']) for h in race['rows']}
            if keys!=set(rr):raise ValueError('Declared field conflict '+slug+' '+race['time']+': '+str(keys^set(rr)))
            title=race['title'].lower()
            kind=race_kind(title)
            going=('Soft to Heavy' if kind=='Chase' else 'Soft') if card['course']=='Galway' else card['going']
            off=datetime.combine(day,datetime.strptime(race['time'],'%H:%M').time(),ZoneInfo('Europe/London'))
            if datetime.now(timezone.utc)>=off:raise ValueError('Race already started; cannot create pre-race forecast')
            current,evidence,withdrawn=[],[],[]
            for h in race['rows']:
                r=rr[base_name(h['horse'])]
                if r['nonrunner']:
                    withdrawn.append(h['horse']);continue
                name=h['horse']+(' ('+h['origin']+')' if h['origin'] else '')
                key=token(name);past=career.get(base_name(h['horse']),[])
                permitted={(x['date'],token(x['course'])) for x in past}
                aliases=[a for a in index.get(base_name(h['horse']),[]) if not re.search(r'\([A-Z]{2,3}\)$',a) or a.endswith('('+h['origin']+')')]
                events=[];seen=set()
                for alias in aliases:
                    for e in history.horses[alias]:
                        signature=(str(e['day']),e['course'],e['trip'],e['performance'],str(e['mark']))
                        if (str(e['day']),e['course']) in permitted and signature not in seen:
                            events.append(dict(e));seen.add(signature)
                history.horses[key]=deque(sorted(events,key=lambda e:e['day'])[-40:],maxlen=40)
                trainer=re.sub(r'\d+%$','',re.sub(r'^\d+','',r['trainer'] or h['trainer'] or '')).strip()
                jockey=re.sub(r'\(\d+\)','',re.sub(r'^\d+','',r['jockey'] or h['jockey'] or '')).strip()
                claims=re.search(r'\((\d+)\)',r['jockey'] or '')
                claim=int(claims[1]) if claims else h['claim']
                gross=r['weight'] or h['weight'];net=weight(gross)-claim
                gear=''.join({'ts':'t','cp':'p','hd':'h','bl':'b','vs':'v','es':'e'}[x] for x in re.findall(r'ts|cp|hd|bl|vs|es',h['gear_text']))
                tr,ta=person(history,'trainer',trainer);jo,ja=person(history,'jockey',jockey)
                pair=(tr,jo)
                if tr.startswith('__CARD__') or jo.startswith('__CARD__'):
                    history.totals[('pair',pair)]=[sum(history.totals[('pair',(t,x))][i] for t in ta for x in ja) for i in (0,1)]
                for event in history.horses[key]:
                    if event['jockey'] in ja:event['jockey']=jo
                row={'horse':key,'trainer':tr,'jockey':jo,'sire':past[-1].get('sire','') if past else '',
                    'course':card['course'],'type':kind,'race_name':race['title'],'class':race['class'],
                    'going':going,'dist':race['distance'].replace('.',''),'or':r['or'] if r['or'] is not None else '',
                    'age':h['age'],'sex':r['sex'] or '','wgt':f'{int(net)//14}-{int(net)%14}','hg':gear,'draw':''}
                current.append(row)
                evidence.append({'card':h,'rp':r,'past':past,'trainer':trainer,'jockey':jockey,'claim':claim,'gross':gross})
            frame=history.race(current,day)
            race_id=str(day)+'|'+slug+'|'+race['time']+'|live-research-2'
            frame['race_id']=race_id;frame['horse']=[r['horse'] for r in current];frame['code']=discipline(current[0])
            p=artifact['model'].predict(frame,artifact['temperature'])
            shadow_rows=[]
            for row,ev in zip(current,evidence):
                s=dict(row,trainer=ev['trainer'],jockey=ev['jockey']);shadow_rows.append(s)
            resolved,alias_log=resolve_rows(shadow_history,shadow_rows,day)
            sf=shadow_history.race(resolved,day);sf['race_id']=race_id;sf['code']=discipline(current[0]);sf['field_size']=len(sf)
            sp=challenger['model'].predict(sf,challenger['temperature'])
            ranking=[]
            for i,ev in enumerate(evidence):
                h,r,past=ev['card'],ev['rp'],ev['past']
                same=[x for x in past if code(x)==code(current[i])]
                wins=[x for x in same if position(x['pos'])==1 and 'handicap' in x['race_name'].lower()]
                lastwin=wins[-1] if wins else None
                latest=past[-1] if past else None
                archive_days=(day-date.fromisoformat(latest['date'])).days if latest else None
                stale=r['days_since_run'] is not None and archive_days!=r['days_since_run']
                flags=[]
                if not same:flags.append('No matched prior starts in this exact racing discipline; unmeasured ability')
                if len(same)<3:flags.append('Limited evidence in this exact discipline')
                if stale:flags.append('Live last-run timing does not agree with archive; fresh form review required')
                if r['days_since_run'] is not None and r['days_since_run']>=90:flags.append('Long absence; fitness uncertain')
                if lastwin and r['or'] is not None and math.isfinite(number(lastwin['or'])) and r['or']>number(lastwin['or']):flags.append(f"{r['or']-number(lastwin['or']):g}lb above last winning handicap mark in this discipline")
                if r['days_since_run'] is not None and r['days_since_run']<=7:flags.append('Quick return; recovery needs consideration')
                relevant_going=[x for x in same if category(x['going'])==category(going)]
                relevant_trip=[x for x in same if abs(distance(x['dist'])-distance(current[i]['dist']))<=.5]
                if not relevant_going:flags.append('No matched starts in the current going category')
                if not relevant_trip:flags.append('No matched start within half a furlong of this trip')
                last6=[]
                for x in past[-6:]:
                    facts=comment_facts(x['comment'])
                    last6.append({'date':x['date'],'course':x['course'],'type':x['type'],'class':x['class'],
                        'distance':x['dist'],'going':x['going'],'position':x['pos'],'starters':int(number(x['ran'])),
                        'beaten_lengths':safe(number(x['ovr_btn'])),'or':safe(number(x['or'])),
                        'rpr':safe(number(x['rpr'])),'ts':safe(number(x['ts'])),'style':facts.pop('style'),
                        'comment_flags':[k for k,v in facts.items() if v], 'opposition':context.get(history_key(x))})
                keytrainer=current[i]['trainer'];t_events=[e for e in history.events[('trainer',keytrainer)] if 0<(day-e[0]).days<=14]
                ranking.append({'horse':current[i]['horse'],'display_name':h['horse'],'horse_id':h['horse_id'],
                    'win_probability':float(p[i]),'shadow_challenger_probability':float(sp[i]),'fair_decimal_odds':float(1/p[i]),
                    'or':r['or'],'rpr':r['rpr'],'ts':r['ts'],'weight':ev['gross'],'claim':ev['claim'],
                    'trainer':ev['trainer'],'jockey':ev['jockey'],'days_since_run':r['days_since_run'],
                    'archive_days_since_run':archive_days,'fresh_form_required':stale,'sex':r['sex'],'sire':current[i]['sire'],
                    'matched_career_starts':len(past),'matched_exact_discipline_starts':len(same),
                    'going_starts':len(relevant_going),'going_wins':sum(position(x['pos'])==1 for x in relevant_going),
                    'trip_starts':len(relevant_trip),'trip_wins':sum(position(x['pos'])==1 for x in relevant_trip),
                    'last_handicap_win':{k:lastwin[k] for k in ('date','course','dist','going','class','or','ran')} if lastwin else None,
                    'trainer14':{'wins':sum(e[1] for e in t_events),'runs':len(t_events),'missing_coverage':not bool(t_events)},
                    'risks':flags,'last_six':last6})
            ranking.sort(key=lambda h:(-h['win_probability'],h['horse']))
            for k,h in enumerate(ranking,1):h['rank']=k
            races.append({'race_id':race_id,'course':card['course'],'time':race['time'],'off_at':off.isoformat(),
                'title':race['title'],'distance':race['distance'],'type':kind,'class':race['class'],'going':going,
                'source_url':race['url'],'observed_at':card['observed_at'],'ratings_source_url':ratings['url'],
                'ratings_observed_at':ratings['observed_at'],'declared_runner_count':len(ranking),
                'original_declarations':len(race['rows']),'withdrawn':withdrawn,'ranking':ranking,
                'model_hash':model_hash,'shadow_model_hash':shadow_hash,'source_publication_timestamp':None,
                'source_availability_verified_by_observation':True,'identity_resolutions':alias_log,
                'feature_vectors':safe(frame.drop(columns=['race_id','horse','code']).to_dict(orient='records')),
                'shadow_feature_vectors':safe(sf.drop(columns=['race_id','code']).to_dict(orient='records'))})
    races.sort(key=lambda r:r['time'])
    ledger=Ledger(folder/'prospective-predictions.sqlite')
    for race in races:
        now=datetime.now(timezone.utc)
        if now>=datetime.fromisoformat(race['off_at']):raise ValueError('Cutoff expired before immutable recording')
        race['recorded_at']=now.isoformat()
        race['record_hash']=ledger.append('prediction',race['race_id'],race)
    assert ledger.verify()
    out={'date':str(day),'created_at':datetime.now(timezone.utc).isoformat(),'races':races,
        'race_count':len(races),'runner_count':sum(len(r['ranking']) for r in races),
        'original_declarations':sum(r['original_declarations'] for r in races),
        'nonrunner_count':sum(len(r['withdrawn']) for r in races),'frozen':True,
        'model_status':artifact['status'],'model_hash':model_hash,'shadow_model_hash':shadow_hash,
        'history_through':str(history.last_day),'production_model_changed':False,
        'abandoned':['Aintree: high winds'],'selection_status':'FULL_FIELD_FORECASTS_FROZEN_MANUAL_SELECTION_REVIEW_PENDING',
        'probability_notice':'Earlier experimental v3 probabilities; not proof of betting value. Candidate A is a separate shadow comparison and has not been promoted.',
        'limitations':['Form archive ends22October; live last-run timing disagreements are flagged.',
            'Published source timestamps are unavailable; actual pre-race observation times are retained.',
            'Current card RPR/TS are factual review evidence, not added probability bonuses.',
            'Pace and race-comment classifications are inferred; unknown evidence is not poor ability.',
            'No current prices or favourite status enter model ability inputs. No stakes placed.'],
        'selections':[]}
    (folder/'frozen-predictions.json').write_text(json.dumps({'verified':True,'events':ledger.rows()},indent=2,allow_nan=False))
    (folder/'full-field-research.json').write_text(json.dumps(safe(out),indent=2,allow_nan=False))
    print(json.dumps({'races':len(races),'active_runners':out['runner_count'],'nonrunners':out['nonrunner_count'],
        'with_stale_form':sum(h['fresh_form_required'] for r in races for h in r['ranking']),
        'model_unchanged':True,'frozen':True}),flush=True)
    return out


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--date',required=True);p.add_argument('--folder',required=True)
    p.add_argument('--runtime',default='v3/workspace');p.add_argument('--challenger-runtime',default='v3/workspace-formula')
    a=p.parse_args();run(a.folder,date.fromisoformat(a.date),a.runtime,a.challenger_runtime)
