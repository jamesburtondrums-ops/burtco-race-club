"""Timestamped runner evidence. New diagnostics never alter frozen learned weights.

No price, current-race result, tip or presumed trainer intent enters this analysis.
"""
import csv
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from .daily_archive import base_name
from .data import category, discipline, distance, number, position, token
from .tomorrow import DAY, DIRECTORY, build, pace_style, safe, same_person
from .records import Ledger

TAG = 'raceday-research-1'


def num(x):
    v = number(x)
    return v if math.isfinite(v) else None


def rp_base(name):
    # RP appends origin without whitespace. Match a declared base only after removing it.
    return base_name(re.sub(r'(?:IRE|FR|GB|USA|GER|JPN|AUS|NZ|SAF|ITY)$', '', name))


def matched_prior(horse, records):
    born = DAY.year - horse['age']
    origin = re.search(r'\(([A-Z]{2,3})\)$', horse['horse'])
    answer = []
    for r in records:
        if r['date'] >= str(DAY):
            continue
        age = num(r.get('age'))
        other = re.search(r'\(([A-Z]{2,3})\)$', token(r['horse']))
        if age is None or date.fromisoformat(r['date']).year - int(age) != born:
            continue
        if origin and other and origin[1] != other[1]:
            continue
        answer.append(r)
    return sorted(answer, key=lambda r: (r['date'], r['race_id']))


def same_discipline(r, race):
    title = race['title'].lower()
    typ = 'chase' if 'chase' in title else 'hurdle' if 'hurdle' in title else 'nh flat' if any(x in title for x in ('nh flat', 'national hunt flat')) else 'flat'
    return token(r['type']) == token(typ) and discipline(r) == ('aw' if race['course'] == 'Southwell' else 'turf' if typ == 'flat' else 'jumps')


def stats(rows):
    n = len(rows)
    w = sum(position(r['pos']) == 1 for r in rows)
    p = sum(0 < position(r['pos']) <= 3 for r in rows)
    return {'starts': n, 'wins': w, 'top3': p, 'win_rate': w/n if n else None}


def summary_run(r):
    return {k:r.get(k) for k in ('date','course','dist','going','type','class','pos','ran','or','rpr','ts','ovr_btn','hg','jockey','trainer')}


def marks(rows, current):
    handicaps = [r for r in rows if 'handicap' in r['race_name'].lower() and num(r['or']) is not None]
    wins = [r for r in handicaps if position(r['pos']) == 1]
    last = wins[-1] if wins else None
    recent_wins = [r for r in wins if (DAY-date.fromisoformat(r['date'])).days <= 730]
    highest = max(recent_wins, key=lambda r:number(r['or'])) if recent_wins else None
    peak = max((number(r['or']) for r in handicaps if (DAY-date.fromisoformat(r['date'])).days <=365), default=None)
    return {'current':current, 'last_winning_handicap':summary_run(last) if last else None,
            'highest_winning_handicap_730d':summary_run(highest) if highest else None,
            'below_last_win_lb':num(last['or'])-current if last and current is not None else None,
            'below_highest_win_730d_lb':num(highest['or'])-current if highest and current is not None else None,
            'below_peak_mark_365d_lb':peak-current if peak is not None and current is not None else None,
            'recent_handicap_marks':[{'date':r['date'],'or':num(r['or'])} for r in handicaps[-5:]],
            'scope':'Same discipline and surface; published marks are not adjusted for claims. Highest win restricted to 730 days.'}


def runner_evidence(horse, race, records, ratings):
    all_past = matched_prior(horse, records)
    past = [r for r in all_past if same_discipline(r,race)]
    trip = distance(race['distance'].replace('.',''))
    tol = .5 if race['course'] in ('Southwell','Doncaster') else 1.
    trip_runs = [r for r in past if abs(distance(r['dist'])-trip)<=tol]
    course = [r for r in past if base_name(r['course'].replace(' (AW)',''))==base_name(race['course'])]
    going = [r for r in past if category(r['going'])==category(race['going'])]
    cd = [r for r in course if abs(distance(r['dist'])-trip)<=tol]
    exact = [r for r in cd if category(r['going'])==category(race['going'])]
    handicap = 'handicap' in race['title'].lower()
    m = marks(past,num(horse['or']))
    figures = [r for r in past if (DAY-date.fromisoformat(r['date'])).days <=365 and num(r['rpr']) is not None]
    comparable = [r for r in figures if abs(distance(r['dist'])-trip)<=tol]
    best = max(comparable,key=lambda r:number(r['rpr'])) if comparable else None
    pace = Counter(pace_style(r['comment']) for r in past[-5:])
    known = sum(v for k,v in pace.items() if k!='unknown')
    style = max((k for k in pace if k!='unknown'),key=lambda k:pace[k],default='unknown')
    seasonal = [r for r in exact if position(r['pos'])==1 and 300<=(DAY-date.fromisoformat(r['date'])).days<=430]
    recent_away = bool(past) and not any(r in exact for r in past[-3:])
    angles, cautions = [], []
    if handicap and m['below_last_win_lb'] is not None:
        v=m['below_last_win_lb']
        if v>=0: angles.append(f'{v:g}lb below/equal to last winning handicap mark in this discipline/surface')
        else: cautions.append(f'{-v:g}lb above last winning handicap mark in this discipline/surface')
    if seasonal:
        angles.append('Returns to course, trip and going category of a win 300–430 days ago; observable placement evidence')
    elif exact and stats(exact)['wins']:
        angles.append(f'{stats(exact)["wins"]}/{len(exact)} wins under matching course/trip/going categories')
    if m['last_winning_handicap'] and (DAY-date.fromisoformat(m['last_winning_handicap']['date'])).days>730:
        cautions.append('Last winning handicap mark is more than two years old; weak evidence of present ability')
    if not past: cautions.append('No matched archive starts in this discipline and surface; improvement and debut uncertainty are substantial')
    if len(going)<3: cautions.append(f'Going evidence limited to {len(going)} comparable starts')
    if len(trip_runs)<3: cautions.append(f'Trip evidence limited to {len(trip_runs)} comparable starts')
    if past and horse['days_since_run'] is not None:
        archived_days=(DAY-date.fromisoformat(all_past[-1]['date'])).days
        if archived_days!=horse['days_since_run']: cautions.append(f'Archive latest run {archived_days} days ago conflicts with evening card {horse["days_since_run"]}; latest form incomplete')
    if m['below_peak_mark_365d_lb'] is not None and m['below_peak_mark_365d_lb']>=7:
        angles.append(f'{m["below_peak_mark_365d_lb"]:g}lb below 365-day peak mark; decline remains an alternative explanation')
    if ratings and ratings['days'] is not None and ratings['days']!=horse['days_since_run']:
        cautions.append(f'Latest card days {ratings["days"]} versus evening source {horse["days_since_run"]}; use source conflict flag')
    return {'archive_starts_all_codes':len(all_past),'same_discipline_surface_starts':len(past),
            'archive_window':'At most 40 prior matched records; no claim of complete career coverage',
            'handicap':m, 'suitability':{'course':stats(course),'trip':stats(trip_runs),'going':stats(going),'course_trip':stats(cd),'course_trip_going':stats(exact)},
            'trip_tolerance_furlongs':tol,'achieved_figures':{'available_365d':len(figures),'comparable_best':summary_run(best) if best else None,'recent':[summary_run(r) for r in figures[-3:]]},
            'current_card_ratings':ratings,'pace':{'style':style,'votes':dict(pace),'known_comments':known,'sample':min(5,len(past))},
            'placement':{'matching_season_wins':[summary_run(r) for r in seasonal],'last3_outside_matching_conditions':recent_away,'intent_confirmed':False},
            'positives':angles,'cautions':cautions,'last_five':[summary_run(r) for r in past[-5:]]}


def rating_index():
    ratings=json.loads((DIRECTORY/'ratings-raceday.json').read_text())
    nr=json.loads((DIRECTORY/'withdrawals-raceday.json').read_text())
    nrids={row[1] for c in nr for row in c['nr']}
    idx={}
    for c in ratings:
        times={row[1]:row[0] for row in c['races']}
        for row in c['rows']:
            name,hid,rid,mark,ts,rpr,days,gear,jockey,trainer,_=row
            idx[(c['course'],times[rid],rp_base(name))]={'official_rating':num(mark),'ts':num(ts),'rpr':num(rpr),'days':int(days) if days else None,'gear_text':gear,'jockey':jockey,'trainer':trainer,'rp_horse_id':hid,'rp_race_id':rid,'nonrunner':hid in nrids,'observed_at':c['observed_at'],'source_url':c['url'],'definition':'Current pre-race card RPR/TS, not figures achieved in this race. Trainer percentage is RTF, not win strike rate.'}
    return ratings,nr,idx


def prepare_source():
    ratings,nr,idx=rating_index()
    folder=DIRECTORY/'raceday-source'
    folder.mkdir(exist_ok=True)
    # Prior form unchanged; source refreshed only for declarations, going, marks and known last-run timing.
    (folder/'prior-form.json').symlink_to((DIRECTORY/'prior-form.json').resolve()) if not (folder/'prior-form.json').exists() else None
    (folder/'shortlist.json').write_text('[]')
    for c in ratings:
        course=c['course'];card=json.loads((DIRECTORY/(course.lower()+'.json')).read_text())
        card['going']={'Doncaster':'Heavy','Cheltenham':'Good','Kelso':'Good','Southwell':'Standard'}[course]
        card['original_snapshot_observed_at']=card['observed_at'];card['observed_at']=max(c['observed_at'],next(n['observed_at'] for n in nr if n['course']==course))
        card['refresh_source']=c['url']
        for race in card['races']:
            path='detail-'+course.lower()+'-'+race['time'].replace(':','')+'.json'
            detail=json.loads((DIRECTORY/path).read_text());byid={h['id']:h for h in detail['horses']}
            for row in race['rows']:
                key=(course,race['time'],base_name(row[0]));fact=idx.get(key)
                if not fact:raise ValueError('Missing fresh rating identity: '+str(key))
                det=byid[row[11]];det['nonrunner']=fact['nonrunner']
                # Verified changes in the fresh factual card; spelling-only aliases stay unchanged.
                if row[0] in ('Micky Haller','African Spirit'):
                    current_jockey=re.sub(r'^\d+', '', fact['jockey'])
                    row[6]=re.sub(r'\(.*', '', current_jockey).strip()
                    claim=re.search(r'\(\s*(\d+)\)', current_jockey)
                    row[7]=claim[1] if claim else ''
                if fact['official_rating'] is not None:row[4]=str(int(fact['official_rating']))
                if fact['days'] is not None:det['days_since_run']=str(fact['days'])
            expected=int(next(x[2].split()[0] for x in c['races'] if x[0]==race['time']))
            assert sum(not h['nonrunner'] for h in detail['horses'])==expected, (course,race['time'])
            (folder/path).write_text(json.dumps(detail,separators=(',',':')))
        (folder/(course.lower()+'.json')).write_text(json.dumps(card,separators=(',',':')))
    return folder,idx


def enrich(data,idx):
    prior=json.loads((DIRECTORY/'prior-form.json').read_text())['form']
    all_evidence=[]
    for race in data['races']:
        evidence=[]
        for h in race['ranking']:
            h['research']=runner_evidence(h,race,prior.get(base_name(h['display_name']),[]),idx[(race['course'],race['time'],base_name(h['display_name']))])
            evidence.append(h['research']);all_evidence.append(h['research'])
        for metric in ('rpr','ts'):
            vals=[e['current_card_ratings'][metric] for e in evidence if e['current_card_ratings'][metric] is not None]
            for e in evidence:
                v=e['current_card_ratings'][metric]
                e['current_card_ratings'][metric+'_field_rank']=1+sum(x>v for x in vals) if v is not None else None
                e['current_card_ratings'][metric+'_behind_top']=max(vals)-v if vals and v is not None else None
        styles=[e['pace']['style'] for e in evidence];leaders=styles.count('front')
        race['research_pace']={'potential_leaders':leaders,'known_styles':len(styles)-styles.count('unknown'),'field':len(styles),'notice':'Majority of at most five prior early-race comments; incomplete tactical evidence. No score adjustment.'}
    data['research']={'version':TAG,'created_at':datetime.now(timezone.utc).isoformat(),'independent_of_prices':True,'new_evidence_changes_model_weights':False,
        'covered_runners':len(all_evidence),'runners_with_pre_race_rpr':sum(e['current_card_ratings']['rpr'] is not None for e in all_evidence),
        'runners_with_prior_achieved_rpr_365d':sum(e['achieved_figures']['available_365d']>0 for e in all_evidence),
        'previous_snapshot':'https://github.com/jamesburtondrums-ops/burtco-race-club/blob/92fff451608ed2d2c3127276c480233c2b060786/v3/public/tomorrow.json',
        'limits':['New handicap/suitability/pace diagnostics are research evidence, not independently validated probability adjustments.','Archive history stops on 22 October; missing 23 October form is flagged.','Current card ratings are third-party pre-race estimates. Neither RPR nor TS is an odds quote.','Trainer intent cannot be established from placement alone.','Same discipline/surface comparisons use at most 40 matched runs; a falling mark can reflect declining ability.','The retired June–September test remains closed. No model selection or tuning used its results.']}
    data['limitations']=list(dict.fromkeys([x for x in data['limitations'] if 'morning recheck' not in x]+data['research']['limits']))
    # Review existing shortlist against deeper evidence; omit withdrawn selection.
    data['selections']=[]
    previous=json.loads((DIRECTORY/'shortlist.json').read_text())
    notes={
      'Road To Wembley (GB)':('Three wins from four archived Good-ground hurdle starts. Pre-race RPR 132 narrowly leads Newbrook Diamond (131).','No matched start at this near-three-mile trip. TS 115 trails Newbrook Diamond (117); the model estimate is not independent proof of stamina.'),
      'Hi Corbett Court (IRE)':('Leads this field on current pre-race RPR 108; three archived six-furlong turf starts include one win and two top-three finishes.','No archived Heavy-ground start. Latest UK card OR 102 differs materially from evening source; TS 77 trails several rivals. Listed-class and going questions remain.'),
      'Ashdown Forest (IRE)':('Two wins and four top-three finishes from four archived Good-ground hurdle starts; recent Stratford win supports current form.','Now 6lb above last winning hurdle mark after a seven-day return. Card RPR 110 is joint-lowest of the seven runners; the model and ratings disagree substantially.'),
      'Moulin Booj (IRE)':('Two wins from six archived Southwell starts at a similar trip; three wins from fourteen comparable all-weather sprint starts.','3lb above last winning all-weather handicap mark. RPR 95 trails joint leaders Almaty Star and Bona Fortuna (99); TS 55 gives another reason for restraint.'),
      'Prosperitas (IRE)':('Two wins from two archived Heavy-ground starts. Won the corresponding course/trip/going race last year; joint-top current card RPR 91 with Tolstoy.','Small going sample. Current OR 80 is 4lb above last winning turf mark 76, so this is a conditions/placement case rather than evidence of a lower winning mark. TS 57 is well below several rivals.')}
    for pick in previous:
        race=next((r for r in data['races'] if r['race_id'].removesuffix('|'+TAG)==pick['race_id']),None)
        if not race or not any(h['horse']==pick['horse'] for h in race['ranking']):continue
        pick=dict(pick);pick['race_id']=race['race_id'];pick['why'],pick['risk']=notes[pick['horse']]
        pick['review_status']='CONDITIONAL_RESEARCH_SELECTION';pick['condition']+=' Morning prices remain unverified; do not infer a live value edge.'
        data['selections'].append(pick)
    names={'Almaty Star','Tolstoy','Al Suil Eile','Mount Ruapehu','Desperate Dan','Heart Above','Uncle Sam'}
    data['research_watchlist']=[{'race_id':r['race_id'],'horse':h['horse'],'status':'RESEARCH_ANGLE_NOT_AUTOMATIC_BET'} for r in data['races'] for h in r['ranking'] if h['display_name'] in names]
    data['removed_selection']={'horse':'Coup De Coeur (FR)','reason':'Non-runner in race-day card','previous_snapshot_unchanged':True}
    return data


def run(freeze=False):
    import sklearn
    if sklearn.__version__ != '1.8.0':
        raise RuntimeError('The rebuilt experimental artifact requires scikit-learn 1.8.0; use its saved runtime requirements.')
    folder,idx=prepare_source()
    data=build(freeze,folder,TAG,'raceday.json','raceday-predictions.sqlite')
    data=enrich(data,idx)
    (Path('v3/public')/'raceday.json').write_text(json.dumps(safe(data),separators=(',',':'),allow_nan=False))
    if freeze:
        ledger=Ledger('v3/workspace/raceday-predictions.sqlite');ledger.verify()
        # Archive exact immutable forecast events. Research annotations are explicitly separate.
        rows=ledger.db.execute('SELECT * FROM events').fetchall()
        cols=[x[1] for x in ledger.db.execute('PRAGMA table_info(events)')]
        payload={'hash_chain_verified':True,'snapshot_version':TAG,'events':[dict(zip(cols,r)) for r in rows]}
        (DIRECTORY/'frozen-raceday.json').write_text(json.dumps(payload,separators=(',',':')))
    print(json.dumps({'research':data['research'],'runners':data['runner_count'],'withdrawals':data['nonrunner_count']}))

if __name__=='__main__':
    import sys
    run('--freeze' in sys.argv)
