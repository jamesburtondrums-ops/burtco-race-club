"""Prior-only form dossiers and observable race context, independent of prices.

Subsequent form is allowed only when completed BEFORE today's prediction cutoff.
It must never be reused as if it were known before the earlier historical race.
"""
import csv,json,re,math
from collections import defaultdict,Counter
from datetime import date,datetime,timezone
from pathlib import Path
import numpy as np
from .daily_archive import base_name
from .deep_research import matched_prior,same_discipline,stats,num
from .data import position,number,distance,weight,category
from .tomorrow import DAY,DIRECTORY,pace_style,safe


def history_key(r):
    return '|'.join(str(r.get(k,'')) for k in ('date','course','off','race_id'))


def identity(r):
    age=num(r.get('age'))
    return (base_name(r['horse']),date.fromisoformat(r['date']).year-int(age)) if age is not None else None



def early_style(text):
    text=re.sub(r'^(?:Mounted in (?:the )?chute,?\s*)?', '', text, flags=re.I)
    text=re.sub(r'^Wore (?:a |red )?hood to (?:post|start),?\s*', '', text, flags=re.I)
    result=pace_style(text)
    if result!='unknown':return result
    if re.match(r'(?:rear mid-division|in touch|raced in mid)', text, re.I):return 'midfield'
    if re.match(r'(?:raced in (?:second|third)|close to leaders)', text, re.I):return 'prominent'
    return 'unknown'


def comment_flags(text):
    text=text.lower()
    patterns={
      'slow_or_awkward_start':r'slowly|dwelt|awkward.*start|reared.*start|hampered.*start',
      'interference_or_blocked':r'hampered|short of room|not clear run|denied.*run|blocked|squeezed|checked|crowded',
      'raced_freely':r'took keen|raced keen|pulled hard|didn.t settle|raced freely',
      'jumping_error':r'blunder|mistake|not fluent|jumped (?:left|right)|bad.*error',
      'late_progress':r'kept on|stayed on|ran on|headway.*(?:final|last)|rallied',
      'weakened_late':r'weakened|no extra|faded|tired|outpaced',
      'travelled_well':r'travelled (?:strongly|well)|going (?:easily|well)|cruis',
      'wide_or_without_cover':r'raced wide|wide throughout|without cover',
    }
    return [k for k,p in patterns.items() if re.search(p,text)]



def extract_career():
    data=json.loads(Path('v3/public/raceday.json').read_text())
    targets={base_name(h['display_name']):h for r in data['races'] for h in r['ranking']}
    records=defaultdict(list)
    with Path('v3/workspace/raw/raceform.download').open(newline='') as f:
        for r in csv.DictReader(f):
            key=base_name(r['horse'])
            if key in targets and r['date']<str(DAY):records[key].append(r)
    result={k:matched_prior(targets[k],v) for k,v in records.items()}
    (DIRECTORY/'career-form.json').write_text(json.dumps(result,separators=(',',':')))
    return result

def build_context():
    source=Path('v3/workspace/raw/raceform.download')
    if not (DIRECTORY/'career-form.json').exists():extract_career()
    career=json.loads((DIRECTORY/'career-form.json').read_text())
    selected={history_key(r) for rows in career.values() for r in sorted(rows,key=lambda x:(x['date'],x['race_id']))[-6:]}
    races=defaultdict(list)
    with source.open(newline='') as f:
        for r in csv.DictReader(f):
            if history_key(r) in selected and r['date']<str(DAY):races[history_key(r)].append(r)
    identities={identity(r) for rows in races.values() for r in rows};future=defaultdict(list)
    earliest=min(r['date'] for rows in races.values() for r in rows)
    with source.open(newline='') as f:
        for r in csv.DictReader(f):
            if earliest<r['date']<str(DAY) and identity(r) in identities:
                future[identity(r)].append({'date':r['date'],'won':position(r['pos'])==1,'top3':0<position(r['pos'])<=3})
    result={}
    for rid,rows in races.items():
        ages={identity(r) for r in rows};stamp=rows[0]['date']
        marks=[number(r['or']) for r in rows if num(r['or']) is not None]
        later=[e for a in ages for e in future[a] if stamp<e['date']<str(DAY)]
        result[rid]={'date':stamp,'field_size':len(rows),'advertised_starters':int(number(rows[0]['ran'])),
            'median_field_or':float(np.median(marks)) if marks else None,'max_field_or':max(marks) if marks else None,'rating_coverage':len(marks),
            'subsequent_starts_before_today':len(later),'subsequent_wins_before_today':sum(x['won'] for x in later),
            'subsequent_winning_horses_before_today':sum(any(e['won'] and stamp<e['date']<str(DAY) for e in future[a]) for a in ages),
            'cohort_horses':len(ages), 'usable_as_of':str(DAY),'scope':'Whole cohort including this runner; descriptive, not a speed figure or causal form upgrade. Later outcomes after today are excluded.'}
    (DIRECTORY/'form-context.json').write_text(json.dumps(result,separators=(',',':')))
    print(json.dumps({'historical_races':len(result),'cohort_horses':len(identities),'prior_target_runs':sum(map(len,career.values()))}),flush=True)


def form_dossiers(data,career,context):
    output=[]
    for race in data['races']:
        ids={base_name(h['display_name']):h for h in race['ranking']}
        records={k:matched_prior(h,career.get(k,[])) for k,h in ids.items()}
        race_runs=defaultdict(list)
        for key,rows in records.items():
            for r in rows:race_runs[history_key(r)].append((key,r))
        for key,h in ids.items():
            rows=records[key];same=[r for r in rows if same_discipline(r,race)]
            last6=[]
            for r in rows[-6:]:
                flags=comment_flags(r['comment']);pos=position(r['pos']);ran=num(r['ran']);margin=num(r['ovr_btn'])
                last6.append({'date':r['date'],'course':r['course'],'type':r['type'],'distance':r['dist'],'going':r['going'],'class':r['class'],
                    'position':r['pos'],'starters':ran,'beaten_lengths':margin,'or':num(r['or']),'rpr':num(r['rpr']),'ts':num(r['ts']),
                    'weight_lb':num(weight(r['wgt'])),'jockey':r['jockey'],'trainer':r['trainer'],'headgear':r['hg'],
                    'finish_percentile':(ran-pos)/(ran-1) if ran and ran>1 and pos else None,
                    'early_style':early_style(r['comment']),'commentary_indicators':flags,'opposition_context':context.get(history_key(r))})
            head=[]
            for r in rows:
                for other,opp in race_runs[history_key(r)]:
                    if other==key:continue
                    if (DAY-date.fromisoformat(r['date'])).days>730:continue
                    p,q=position(r['pos']),position(opp['pos'])
                    head.append({'date':r['date'],'opponent':ids[other]['display_name'],'course':r['course'],'distance':r['dist'],'going':r['going'],
                        'position':r['pos'],'opponent_position':opp['pos'],'finished_ahead':p<q if p and q else None,
                        'then_weight_difference_lb':num(weight(r['wgt'])-weight(opp['wgt'])),
                        'today_gross_weight_difference_lb':num(weight(h['weight'])-weight(ids[other]['weight'])),
                        'then_or':num(r['or']),'opponent_then_or':num(opp['or']),
                        'notice':'Raw gross weights; no invented pounds-per-length adjustment or allowance for different claims/WFA.'})
            trip=distance(race['distance'].replace('.',''));tol=.5 if race['course'] in ('Doncaster','Southwell') else 1
            recent=[r for r in same if (DAY-date.fromisoformat(r['date'])).days<=365]
            close=[r for r in recent if position(r['pos'])>1 and num(r['ovr_btn']) is not None and 0<number(r['ovr_btn'])<=2]
            hidden=[r for r in rows[-6:] if any(f in comment_flags(r['comment']) for f in ('interference_or_blocked','slow_or_awkward_start','wide_or_without_cover'))]
            career_best=max((num(r['rpr']) for r in recent if num(r['rpr']) is not None),default=None)
            last=rows[-1] if rows else None
            absence=(DAY-date.fromisoformat(last['date'])).days if last else None
            # First run after a long absence, measured only using earlier recorded starts.
            fresh=[]
            for a,b in zip(rows,rows[1:]):
                if (date.fromisoformat(b['date'])-date.fromisoformat(a['date'])).days>=90 and same_discipline(b,race):fresh.append(b)
            flags=[]
            if absence is not None and absence!=h['days_since_run']:flags.append(f'Latest archived start {absence} days ago; published card says {h["days_since_run"]}. Incomplete form can invalidate apparent value.')
            if len(rows)<=2:flags.append('Very little recorded form; large uncertainty and possible missing point-to-point/foreign evidence')
            if hidden:flags.append(f'{len(hidden)} of last {min(6,len(rows))} archived comments flag start/interference/wide-running issues; severity and effect unverified')
            if len(close):flags.append(f'{len(close)} defeats within 2 lengths in this discipline/surface over the last year')
            if absence and absence>=90:flags.append(f'{absence}-day break; prior returns after >=90 days: {stats(fresh)["wins"]}/{len(fresh)} wins')
            if last and abs(distance(last['dist'])-trip)>tol:flags.append(f'Trip changes by {trip-distance(last["dist"]):+.1f}f from latest archived run; assess stamina/pace rather than assume improvement')
            style=h['research']['pace']['style'];styles=[x['research']['pace']['style'] for x in race['ranking']];front=styles.count('front')
            if style=='front' and front>=2:flags.append(f'{front} runners have a front-running history; an uncontested lead cannot be assumed')
            elif style=='front' and front==1:flags.append('Only one identified historical front-runner; tactical opportunity depends on incomplete style evidence')
            coverage='limited' if len(rows)<3 else 'partial' if absence!=h['days_since_run'] or h['research']['current_card_ratings']['rpr'] is None else 'broader'
            output.append({'race_id':race['race_id'],'horse':h['horse'],'horse_id':h['horse_id'],'career_matched_starts':len(rows),'same_discipline_surface_starts':len(same),
                'evidence_coverage':coverage,'trainer14':h['trainer14'],
                'connection_data_notice':'Zero matched recent trainer runs indicates missing/ambiguous coverage, not a cold stable.' if h['trainer14']['runs']==0 else None,
                'stamina_evidence':{'at_or_beyond_today':stats([r for r in same if distance(r['dist'])>=trip-tol]),'longest_winning_trip_furlongs':max([distance(r['dist']) for r in same if position(r['pos'])==1],default=None)},'coverage_definition':'Broader = at least 3 archive starts, latest run timing agrees and current card RPR exists. Partial/limited denote gaps, not winning confidence.',
                'archive_days_since_run':absence,'career_statistics':stats(same),'recent_365d_statistics':stats(recent),'close_defeats_365d':len(close),
                'best_achieved_rpr_365d':career_best,'fresh_after_90d':stats(fresh),'last_six':last6,'head_to_head':sorted(head,key=lambda r:r['date'],reverse=True)[:12],
                'full_history':[{'date':r['date'],'course':r['course'],'type':r['type'],'distance':r['dist'],'going':r['going'],'class':r['class'],'position':r['pos'],'starters':num(r['ran']),'beaten_lengths':num(r['ovr_btn']),'or':num(r['or']),'rpr':num(r['rpr']),'ts':num(r['ts']),'early_style':early_style(r['comment']),'commentary_indicators':comment_flags(r['comment'])} for r in reversed(rows)],
                'research_findings':flags,'limits':['Archive centred on GB/IRE, with some overseas starts; worldwide career coverage is incomplete.','Commentary flags are descriptive; they do not establish that a horse would otherwise have won.','New form diagnostics do not alter frozen model probabilities.'],
                'profile_source':race['source_url']})
    return safe(output)

if __name__=='__main__':
    import sys
    if '--extract' in sys.argv:extract_career()
    build_context()
