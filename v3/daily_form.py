"""Extract prior factual form and complete previous fields for a dated daily card."""
import argparse,csv,json,re,math
from collections import defaultdict
from datetime import date
from pathlib import Path
from .daily_archive import base_name
from .data import number,position
from .form_review import history_key


def run(folder,day):
    folder=Path(folder)
    cards=[json.loads(p.read_text()) for p in (folder/'cards').glob('*-complete.json')]
    targets={}
    for card in cards:
        for race in card['races']:
            for h in race['rows']:
                targets[(base_name(h['horse']),day.year-int(h['age']))]=h
    source=Path('v3/workspace-formula/raw/raceform.download')
    career=defaultdict(list)
    with source.open(newline='') as f:
        for r in csv.DictReader(f):
            if r['date']>=str(day):continue
            if r['pos'] in ('','-','–'):continue  # declarations/unconfirmed entries are not prior starts
            age=number(r['age'])
            if not math.isfinite(age):continue
            key=(base_name(r['horse']),date.fromisoformat(r['date']).year-int(age))
            if key not in targets:continue
            origin=re.search(r'\(([A-Z]{2,3})\)\s*$',r['horse'])
            if origin and origin[1]!=targets[key]['origin']:continue
            career[key[0]].append(r)
    for rows in career.values():rows.sort(key=lambda r:(r['date'],r['race_id']))
    (folder/'career-form-today-local.json').write_text(json.dumps(career,separators=(',',':')))
    chosen={history_key(r) for rows in career.values() for r in rows[-6:]}
    fields=defaultdict(list)
    with source.open(newline='') as f:
        for r in csv.DictReader(f):
            if r['date']<str(day) and history_key(r) in chosen:fields[history_key(r)].append(r)
    context={}
    for key,rows in fields.items():
        ratings=sorted(number(r['or']) for r in rows if math.isfinite(number(r['or'])))
        context[key]={'date':rows[0]['date'],'field_size':len(rows),
            'advertised_starters':int(number(rows[0]['ran'])),
            'median_field_or':(ratings[(len(ratings)-1)//2]+ratings[len(ratings)//2])/2 if ratings else None,
            'max_field_or':max(ratings) if ratings else None,'rating_coverage':len(ratings)}
    (folder/'prior-field-context.json').write_text(json.dumps(context,separators=(',',':')))
    print(json.dumps({'declared_targets':len(targets),'with_prior_archive_form':len(career),
        'matched_prior_starts':sum(len(x) for x in career.values()),'previous_fields':len(context)}),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--folder',required=True);p.add_argument('--date',required=True)
    a=p.parse_args();run(a.folder,date.fromisoformat(a.date))
