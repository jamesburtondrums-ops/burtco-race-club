"""Resolve unambiguous card aliases to existing histories without merging people."""
from collections import defaultdict
import re
from .data import token
from .formula_features import identity


def horse_parts(name):
    s=token(name)
    match=re.search(r'\s*\(([A-Z]{2,3})\)$',s)
    origin=match[1] if match else None
    if match:s=s[:match.start()]
    return re.sub(r'[^A-Z0-9]','',s),origin


def person_parts(name):
    s=re.sub(r'\b(MR|MRS|MISS|MS|DR)\b','',token(name))
    return re.findall(r'[A-Z]+',s)


def resolve_rows(history,rows,day):
    horses=defaultdict(list)
    for key,events in history.horses.items():
        stem,origin=horse_parts(key[0])
        if events:horses[(stem,key[1])].append((key,origin,events[-1]['day']))
    people={kind:{key for (role,key) in history.baseline.totals if role==kind}
            for kind in ('trainer','jockey')}
    output,changes=[],[]
    for row in rows:
        r=dict(row)
        current=identity(row,day)
        if current not in history.horses:
            stem,origin=horse_parts(row['horse'])
            candidates=[x for x in horses[(stem,current[1])] if origin is None or x[1] in (None,origin)]
            origins={x[1] for x in candidates if x[1] is not None}
            if candidates and len(origins)<=1:
                chosen=max(candidates,key=lambda x:x[2])[0][0]
                r['horse']=chosen
                changes.append({'kind':'horse','card':row['horse'],'history':chosen})
        for kind in people:
            raw=token(row.get(kind))
            if not raw or raw in people[kind]:continue
            bits=person_parts(raw)
            candidates=[]
            for name in people[kind]:
                other=person_parts(name)
                if len(bits)<2 or len(other)<2 or bits[-1]!=other[-1] or bits[0][0]!=other[0][0]:continue
                if len(bits[0])>1 and len(other[0])>1 and bits[0]!=other[0]:continue
                candidates.append(name)
            if len(candidates)==1:
                r[kind]=candidates[0]
                changes.append({'kind':kind,'card':row[kind],'history':candidates[0]})
        output.append(r)
    return output,changes
