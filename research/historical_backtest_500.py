import csv, io, json, math, os, re, statistics, urllib.parse, urllib.request, zipfile
from collections import defaultdict, deque
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import brier_score_loss, log_loss

OUT = Path("research/output")
OUT.mkdir(parents=True, exist_ok=True)
DATASET = "deltaromeo/horse-racing-results-ukireland-2015-2025"
UA = "racing-intelligence-research/1.0"

def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=3600) as r, open(dest, "wb") as f:
        total = 0
        while True:
            b = r.read(1 << 22)
            if not b: break
            f.write(b); total += len(b)
            if total and total % (200 << 20) < (1 << 22):
                print(f"downloaded {total/1e6:.0f} MB")
    return dest

def pick_source_file():
    # The archive's current post-2015 race-runner file. Hard-code the known
    # member rather than relying on Kaggle's dataset-list response, which can
    # omit nested members and previously caused the 2005-2014 file to be chosen.
    return "form_2015-present/form_2015-present/raceform.csv", 0

def open_csv_stream():
    name, size = pick_source_file()
    print("selected", name, size)
    encoded = urllib.parse.quote(name, safe="")
    url = f"https://www.kaggle.com/api/v1/datasets/download/deltaromeo/horse-racing-results-ukireland-2015-2025/{encoded}"
    dest = Path("/tmp/raceform_download")
    download(url, dest)
    if zipfile.is_zipfile(dest):
        z = zipfile.ZipFile(dest)
        members = z.namelist()
        target = next((m for m in members if m.endswith(name) or m.endswith(Path(name).name)), None)
        if target is None:
            csvs = [m for m in members if m.lower().endswith(".csv")]
            if not csvs: raise RuntimeError("Downloaded zip contains no CSV")
            target = max(csvs, key=lambda m: z.getinfo(m).file_size)
        print("zip member", target, z.getinfo(target).file_size)
        return io.TextIOWrapper(z.open(target), encoding="utf-8", errors="replace"), {"dataset_file": name, "zip_member": target}
    return open(dest, "r", encoding="utf-8", errors="replace", newline=""), {"dataset_file": name}

def norm_fields(reader):
    reader.fieldnames = [(x or "").strip().lower() for x in (reader.fieldnames or [])]
    return reader

def fnum(v):
    try:
        if v is None or str(v).strip()=="":
            return np.nan
        return float(str(v).strip())
    except: return np.nan

def pint(v):
    m = re.search(r"\d+", str(v or ""))
    return int(m.group()) if m else 0

def parse_date(v):
    s = str(v or "").strip()
    for fmt in ("%Y-%m-%d","%d/%m/%Y","%d-%m-%Y","%Y/%m/%d","%d %b %Y","%d %B %Y"):
        try: return datetime.strptime(s[:len(datetime.now().strftime(fmt))], fmt).date()
        except: pass
    try: return pd.to_datetime(s, dayfirst=True, errors="raise").date()
    except: return None

def parse_sp(v):
    s = str(v or "").strip().lower()
    if not s: return np.nan
    s = s.replace("fav","").replace("jf","").replace("f","").strip()
    if s in ("evens","even","evs","ev"):
        return 2.0
    m = re.search(r"(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)", s)
    if m:
        a,b=map(float,m.groups()); return 1+a/b if b else np.nan
    try:
        x=float(re.sub(r"[^\d.]","",s))
        return x if x>1 else np.nan
    except: return np.nan

def dist_furlongs(v):
    s = str(v or "").lower().strip()
    if not s: return np.nan
    miles=0; furl=0.0
    m=re.search(r"(\d+)\s*m",s)
    if m: miles=int(m.group(1))
    m=re.search(r"(\d+(?:\.\d+)?)\s*f",s)
    if m: furl=float(m.group(1))
    for ch,val in {"½":.5,"¼":.25,"¾":.75}.items():
        if ch in s and "f" in s: furl+=val
    if miles or furl: return miles*8+furl
    try:
        x=float(re.sub(r"[^\d.]","",s))
        if x>100: return x/201.168
    except: pass
    return np.nan

def going_cat(v):
    s=str(v or "").lower()
    if "heavy" in s: return "heavy"
    if "soft" in s: return "soft"
    if "firm" in s: return "firm"
    if "standard" in s or "slow" in s or "fast" in s: return "aw"
    if "good" in s: return "good"
    return "unknown"


def parse_money(v):
    s=str(v or "").replace(",","").strip()
    m=re.search(r"(\d+(?:\.\d+)?)",s)
    return float(m.group(1)) if m else np.nan

def value_band(v):
    if not np.isfinite(v): return "unknown"
    if v < 5000: return "<5k"
    if v < 10000: return "5-10k"
    if v < 20000: return "10-20k"
    if v < 50000: return "20-50k"
    return "50k+"

def grade_cat(row):
    text=" ".join(str(row.get(k) or "") for k in ("pattern","race_name","title","class")).lower()
    if "group 1" in text or "grade 1" in text: return 1
    if "group 2" in text or "grade 2" in text: return 2
    if "group 3" in text or "grade 3" in text: return 3
    if "listed" in text: return 4
    c=class_num(row)
    return int(c)+4 if np.isfinite(c) else 10

def run_style_from_comment(v):
    s=str(v or "").lower()
    # 4 = led/front rank, 3 = prominent/tracked leaders, 2 = midfield, 1 = held up/rear
    if re.search(r"\b(made all|made virtually all|led|soon led|disputed lead|pressed leader)\b",s): return 4.0
    if re.search(r"\b(prominent|tracked leader|tracked leaders|chased leader|close up|handy)\b",s): return 3.0
    if re.search(r"\b(midfield|mid-division|mid division|in touch|towards midfield)\b",s): return 2.0
    if re.search(r"\b(held up|towards rear|in rear|rear of field|last pair|raced in last)\b",s): return 1.0
    return np.nan

def class_num(row):
    for k in ("class","race_class"):
        if row.get(k):
            m=re.search(r"(\d+)",str(row[k]))
            if m: return float(m.group(1))
    m=re.search(r"class\s*(\d+)", str(row.get("race_name") or row.get("title") or ""), re.I)
    return float(m.group(1)) if m else np.nan

def race_type(row):
    text=" ".join(str(row.get(k) or "") for k in ("type","race_name","title")).lower()
    if "nursery" in text: return "nursery"
    if "maiden" in text: return "maiden"
    if "novice" in text: return "novice"
    if "handicap" in text: return "handicap"
    if "chase" in text: return "chase"
    if "hurdle" in text: return "hurdle"
    if "bumper" in text or "nh flat" in text: return "bumper"
    return "other"

def race_key(row):
    for k in ("rid","race_id","raceid"):
        if row.get(k): return str(row[k])
    return "|".join(str(row.get(k) or "") for k in ("date","course","off","time","race_name"))

def clean_name(v):
    return re.sub(r"\s*\([A-Z]{2,3}\)\s*$","",str(v or "").strip(),flags=re.I).upper()

def rate(stats):
    n,w=stats
    return w/n if n>=5 else np.nan

horse_hist=defaultdict(lambda: deque(maxlen=12))
trainer_events=defaultdict(deque)
jockey_events=defaultdict(deque)
trainer_course=defaultdict(lambda:[0,0])
trainer_type=defaultdict(lambda:[0,0])
tj_combo=defaultdict(lambda:[0,0])
owner_trainer=defaultdict(lambda:[0,0])
owner_course=defaultdict(lambda:[0,0])
owner_type=defaultdict(lambda:[0,0])
sire_dist=defaultdict(lambda:[0,0])
sire_going=defaultdict(lambda:[0,0])
dam_dist=defaultdict(lambda:[0,0])
dam_going=defaultdict(lambda:[0,0])
horse_handicap_starts=defaultdict(int)
trainer_all=defaultdict(lambda:[0,0])
trainer_handicap=defaultdict(lambda:[0,0])
trainer_course_handicap=defaultdict(lambda:[0,0])
trainer_course_class=defaultdict(lambda:[0,0])
trainer_course_grade=defaultdict(lambda:[0,0])
trainer_value_band=defaultdict(lambda:[0,0])
horse_jockey=defaultdict(lambda:[0,0,0])
course_style=defaultdict(lambda:[0,0])


def recent_rate(events, who, day, days):
    q=events[who]
    cutoff=day-timedelta(days=60)
    while q and q[0][0]<cutoff: q.popleft()
    vals=[w for d,w in q if d>=day-timedelta(days=days)]
    return sum(vals)/len(vals) if len(vals)>=5 else np.nan

def rate_place(stats):
    n,w,p=stats
    return (w/n if n>=3 else np.nan, p/n if n>=3 else np.nan)

def hist_rate(hist, predicate, wins=False):
    arr=[h for h in hist if predicate(h)]
    if not arr: return np.nan
    if wins: return sum(h["win"] for h in arr)/len(arr)
    return len(arr)

def feature_row(r, day, field_size, current_race_value=np.nan, current_grade=10, market_prob=np.nan, market_rank=np.nan):
    horse=clean_name(r.get("horse") or r.get("horsename"))
    trainer=clean_name(r.get("trainer"))
    jockey=clean_name(r.get("jockey"))
    owner=clean_name(r.get("owner"))
    course=clean_name(r.get("course"))
    rt=race_type(r)
    dist=dist_furlongs(r.get("dist") or r.get("distance"))
    going=going_cat(r.get("going"))
    cur_or=fnum(r.get("or") or r.get("official_rating"))
    hist=list(horse_hist[horse])
    last=hist[-1] if hist else None
    recent=hist[-5:]
    wins=[h for h in hist if h["win"]]
    last_win=wins[-1] if wins else None
    same_course=[h for h in hist if h["course"]==course]
    same_dist=[h for h in hist if np.isfinite(dist) and np.isfinite(h["dist"]) and abs(h["dist"]-dist)<=0.5]
    same_going=[h for h in hist if h["going"]==going and going!="unknown"]
    same_cd=[h for h in hist if h["course"]==course and np.isfinite(dist) and np.isfinite(h["dist"]) and abs(h["dist"]-dist)<=0.5]
    same_month_win=any(h["win"] and h["course"]==course and abs(h["date"].month-day.month)<=1 for h in hist)
    last2=hist[-2:]
    return_to_win_conditions=bool(wins and (
        any(h["win"] and h["course"]==course for h in hist) or
        any(h["win"] and np.isfinite(dist) and np.isfinite(h["dist"]) and abs(h["dist"]-dist)<=0.5 for h in hist)
    ) and last2 and all((h["course"]!=course or (np.isfinite(dist) and np.isfinite(h["dist"]) and abs(h["dist"]-dist)>0.5)) for h in last2))
    recent_rprs=[h["rpr"] for h in recent if np.isfinite(h["rpr"])]
    recent_ts=[h["ts"] for h in recent if np.isfinite(h["ts"])]
    last_or=last["or"] if last else np.nan
    last_class=last["class"] if last else np.nan
    current_class=class_num(r)
    current_is_handicap=int(rt in ("handicap","nursery"))
    current_value_band=value_band(current_race_value)
    sire=clean_name(r.get("sire"))
    dam=clean_name(r.get("dam"))
    d_bucket=round(dist/2)*2 if np.isfinite(dist) else np.nan
    starts=len(hist)
    last_jockey=last["jockey"] if last else ""
    jockey14=recent_rate(jockey_events,jockey,day,14) if jockey else np.nan
    prev_jockey14=recent_rate(jockey_events,last_jockey,day,14) if last_jockey else np.nan
    trainer_base=rate(trainer_all[trainer]) if trainer else np.nan
    trainer14_now=recent_rate(trainer_events,trainer,day,14) if trainer else np.nan
    trainer30_now=recent_rate(trainer_events,trainer,day,30) if trainer else np.nan
    hj_win,hj_place=rate_place(horse_jockey[(horse,jockey)]) if horse and jockey else (np.nan,np.nan)
    same_going_rprs=[h["rpr"] for h in same_going if np.isfinite(h["rpr"])]
    style_vals=[h.get("style",np.nan) for h in hist[-4:] if np.isfinite(h.get("style",np.nan))]
    preferred_style=float(np.mean(style_vals)) if style_vals else np.nan
    last_value=last.get("race_value",np.nan) if last else np.nan
    last_grade=last.get("grade",np.nan) if last else np.nan
    same_class=[h for h in hist if np.isfinite(current_class) and np.isfinite(h.get("class",np.nan)) and h["class"]==current_class]
    same_grade=[h for h in hist if h.get("grade")==current_grade]
    f={
      "field_size":field_size,
      "starts_prior":starts,
      "win_rate5":sum(h["win"] for h in recent)/len(recent) if recent else np.nan,
      "place_rate5":sum(h["place"] for h in recent)/len(recent) if recent else np.nan,
      "last_pos":last["pos"] if last else np.nan,
      "days_since_run":(day-last["date"]).days if last else np.nan,
      "cur_or":cur_or,
      "or_change":cur_or-last_or if np.isfinite(cur_or) and np.isfinite(last_or) else np.nan,
      "lbs_below_last_win_or":(last_win["or"]-cur_or) if last_win and np.isfinite(last_win["or"]) and np.isfinite(cur_or) else np.nan,
      "prev_rpr_minus_or":(recent_rprs[-1]-cur_or) if recent_rprs and np.isfinite(cur_or) else np.nan,
      "best_rpr3_minus_or":(max(recent_rprs[-3:])-cur_or) if recent_rprs and np.isfinite(cur_or) else np.nan,
      "best_ts3_minus_or":(max(recent_ts[-3:])-cur_or) if recent_ts and np.isfinite(cur_or) else np.nan,
      "course_win_rate":sum(h["win"] for h in same_course)/len(same_course) if same_course else np.nan,
      "dist_win_rate":sum(h["win"] for h in same_dist)/len(same_dist) if same_dist else np.nan,
      "going_win_rate":sum(h["win"] for h in same_going)/len(same_going) if same_going else np.nan,
      "cd_place_rate":sum(h["place"] for h in same_cd)/len(same_cd) if same_cd else np.nan,
      "class_drop":(current_class-last_class) if np.isfinite(current_class) and np.isfinite(last_class) else np.nan,
      "same_course_month_win":float(same_month_win),
      "return_to_win_conditions":float(return_to_win_conditions),
      "handicap_start_no":horse_handicap_starts[horse]+1 if rt in ("handicap","nursery") else 0,
      "trainer14":trainer14_now,
      "trainer30":trainer30_now,
      "trainer_base_sr":trainer_base,
      "trainer14_vs_base":trainer14_now-trainer_base if np.isfinite(trainer14_now) and np.isfinite(trainer_base) else np.nan,
      "trainer30_vs_base":trainer30_now-trainer_base if np.isfinite(trainer30_now) and np.isfinite(trainer_base) else np.nan,
      "trainer_course_sr":rate(trainer_course[(trainer,course)]) if trainer else np.nan,
      "trainer_type_sr":rate(trainer_type[(trainer,rt)]) if trainer else np.nan,
      "trainer_handicap_sr":rate(trainer_handicap[(trainer,current_is_handicap)]) if trainer else np.nan,
      "trainer_course_handicap_sr":rate(trainer_course_handicap[(trainer,course,current_is_handicap)]) if trainer else np.nan,
      "trainer_course_class_sr":rate(trainer_course_class[(trainer,course,current_class)]) if trainer and np.isfinite(current_class) else np.nan,
      "trainer_course_grade_sr":rate(trainer_course_grade[(trainer,course,current_grade)]) if trainer else np.nan,
      "trainer_value_band_sr":rate(trainer_value_band[(trainer,current_value_band)]) if trainer else np.nan,
      "jockey14":jockey14,
      "jockey_upgrade":jockey14-prev_jockey14 if np.isfinite(jockey14) and np.isfinite(prev_jockey14) else np.nan,
      "trainer_jockey_sr":rate(tj_combo[(trainer,jockey)]) if trainer and jockey else np.nan,
      "horse_jockey_win_sr":hj_win,
      "horse_jockey_place_sr":hj_place,
      "preferred_style":preferred_style,
      "course_style_sr":rate(course_style[(course,round(preferred_style))]) if np.isfinite(preferred_style) else np.nan,
      "going_place_rate":sum(h["place"] for h in same_going)/len(same_going) if same_going else np.nan,
      "going_avg_rpr_minus_or":(float(np.mean(same_going_rprs))-cur_or) if same_going_rprs and np.isfinite(cur_or) else np.nan,
      "class_win_rate":sum(h["win"] for h in same_class)/len(same_class) if same_class else np.nan,
      "grade_win_rate":sum(h["win"] for h in same_grade)/len(same_grade) if same_grade else np.nan,
      "current_race_value_log":math.log1p(current_race_value) if np.isfinite(current_race_value) else np.nan,
      "value_change_log":math.log1p(current_race_value)-math.log1p(last_value) if np.isfinite(current_race_value) and np.isfinite(last_value) else np.nan,
      "grade_change":current_grade-last_grade if np.isfinite(last_grade) else np.nan,
      "owner_trainer_sr":rate(owner_trainer[(owner,trainer)]) if owner and trainer else np.nan,
      "owner_course_sr":rate(owner_course[(owner,course)]) if owner else np.nan,
      "owner_type_sr":rate(owner_type[(owner,rt)]) if owner else np.nan,
      "headgear_change":float(bool((r.get("hg") or "").strip()) and bool(last) and (r.get("hg") or "").strip() != (last.get("hg") or "")),
      "sire_dist_sr":rate(sire_dist[(sire,d_bucket)]) if sire and np.isfinite(d_bucket) else np.nan,
      "sire_going_sr":rate(sire_going[(sire,going)]) if sire and going!="unknown" else np.nan,
      "dam_dist_sr":rate(dam_dist[(dam,d_bucket)]) if dam and np.isfinite(d_bucket) else np.nan,
      "dam_going_sr":rate(dam_going[(dam,going)]) if dam and going!="unknown" else np.nan,
      "market_prob":market_prob,
      "market_rank":market_rank,
    }
    f["targeting_combo"]=float(
        ((f["lbs_below_last_win_or"] if np.isfinite(f["lbs_below_last_win_or"]) else -99)>=2) +
        (f["course_win_rate"]>0 if np.isfinite(f["course_win_rate"]) else False) +
        (f["return_to_win_conditions"]>0) +
        (f["class_drop"]>=1 if np.isfinite(f["class_drop"]) else False) +
        (f["trainer_course_sr"]>=0.12 if np.isfinite(f["trainer_course_sr"]) else False)
        >=3
    )
    return f

def update_states(r, day, current_race_value=np.nan, current_grade=10):
    horse=clean_name(r.get("horse") or r.get("horsename")); trainer=clean_name(r.get("trainer"))
    jockey=clean_name(r.get("jockey")); course=clean_name(r.get("course")); rt=race_type(r); owner=clean_name(r.get("owner"))
    pos=pint(r.get("pos") or r.get("position")); win=pos==1; place=0<pos<=3
    dist=dist_furlongs(r.get("dist") or r.get("distance")); going=going_cat(r.get("going"))
    cur_or=fnum(r.get("or") or r.get("official_rating")); rpr=fnum(r.get("rpr")); ts=fnum(r.get("ts") or r.get("topspeed"))
    cl=class_num(r); sire=clean_name(r.get("sire")); dam=clean_name(r.get("dam"))
    style=run_style_from_comment(r.get("comment"))
    is_hcap=int(rt in ("handicap","nursery"))
    vb=value_band(current_race_value)
    horse_hist[horse].append({"date":day,"course":course,"dist":dist,"going":going,"or":cur_or,
                             "rpr":rpr,"ts":ts,"class":cl,"grade":current_grade,"race_value":current_race_value,"style":style,
                             "pos":pos,"win":win,"place":place,"jockey":jockey,"hg":(r.get("hg") or "").strip()})
    if rt in ("handicap","nursery"): horse_handicap_starts[horse]+=1
    if trainer:
        trainer_events[trainer].append((day,win)); trainer_all[trainer][0]+=1; trainer_all[trainer][1]+=int(win)
        trainer_course[(trainer,course)][0]+=1; trainer_course[(trainer,course)][1]+=int(win)
        trainer_type[(trainer,rt)][0]+=1; trainer_type[(trainer,rt)][1]+=int(win)
        trainer_handicap[(trainer,is_hcap)][0]+=1; trainer_handicap[(trainer,is_hcap)][1]+=int(win)
        trainer_course_handicap[(trainer,course,is_hcap)][0]+=1; trainer_course_handicap[(trainer,course,is_hcap)][1]+=int(win)
        if np.isfinite(cl):
            trainer_course_class[(trainer,course,cl)][0]+=1; trainer_course_class[(trainer,course,cl)][1]+=int(win)
        trainer_course_grade[(trainer,course,current_grade)][0]+=1; trainer_course_grade[(trainer,course,current_grade)][1]+=int(win)
        trainer_value_band[(trainer,vb)][0]+=1; trainer_value_band[(trainer,vb)][1]+=int(win)
    if jockey: jockey_events[jockey].append((day,win))
    if horse and jockey:
        horse_jockey[(horse,jockey)][0]+=1; horse_jockey[(horse,jockey)][1]+=int(win); horse_jockey[(horse,jockey)][2]+=int(place)
    if trainer and jockey: tj_combo[(trainer,jockey)][0]+=1; tj_combo[(trainer,jockey)][1]+=int(win)
    if np.isfinite(style):
        sk=(course,round(style)); course_style[sk][0]+=1; course_style[sk][1]+=int(win)
    if owner and trainer: owner_trainer[(owner,trainer)][0]+=1; owner_trainer[(owner,trainer)][1]+=int(win)
    if owner: owner_course[(owner,course)][0]+=1; owner_course[(owner,course)][1]+=int(win); owner_type[(owner,rt)][0]+=1; owner_type[(owner,rt)][1]+=int(win)
    d_bucket=round(dist/2)*2 if np.isfinite(dist) else np.nan
    if sire and np.isfinite(d_bucket):
        sire_dist[(sire,d_bucket)][0]+=1; sire_dist[(sire,d_bucket)][1]+=int(win)
    if sire and going!="unknown":
        sire_going[(sire,going)][0]+=1; sire_going[(sire,going)][1]+=int(win)
    if dam and np.isfinite(d_bucket):
        dam_dist[(dam,d_bucket)][0]+=1; dam_dist[(dam,d_bucket)][1]+=int(win)
    if dam and going!="unknown":
        dam_going[(dam,going)][0]+=1; dam_going[(dam,going)][1]+=int(win)

def finalize_race(rows, collected, start_collect, max_races):
    if not rows: return False
    day=parse_date(rows[0].get("date"))
    if not day: return False
    sps=[parse_sp(r.get("sp") or r.get("odds")) for r in rows]
    inv=np.array([1/x if np.isfinite(x) and x>1 else np.nan for x in sps],dtype=float)
    denom=np.nansum(inv) if np.isfinite(inv).sum() else np.nan
    market_valid=bool(np.isfinite(inv).sum()==len(rows) and np.isfinite(denom) and 1.01<=denom<=1.40)
    if market_valid:
        probs=inv/denom
        ranks=np.argsort(np.argsort(sps))+1
    else:
        probs=np.full(len(rows),np.nan); ranks=np.full(len(rows),np.nan)
    field=len(rows)
    race_prizes=[parse_money(r.get("prize")) for r in rows]
    current_race_value=max([x for x in race_prizes if np.isfinite(x)], default=np.nan)
    current_grade=grade_cat(rows[0])
    if day>=start_collect and len(collected)<max_races:
        rr=[]
        for i,r in enumerate(rows):
            f=feature_row(r,day,field,current_race_value,current_grade,probs[i],ranks[i])
            pos=pint(r.get("pos") or r.get("position"))
            rr.append({"race_id":race_key(r),"date":day.isoformat(),"course":r.get("course",""),"race_name":r.get("race_name") or r.get("title") or "",
                       "race_type":race_type(r),"horse":r.get("horse") or r.get("horsename") or "",
                       "sp":sps[i],"won":int(pos==1),"market_valid":int(market_valid),"market_overround":float(denom) if np.isfinite(denom) else np.nan,**f})
        # Projected pace from each horse's historical preferred run style.
        leaders=sum(1 for x in rr if np.isfinite(x.get("preferred_style",np.nan)) and x["preferred_style"]>=3.5)
        for x in rr:
            st=x.get("preferred_style",np.nan)
            x["projected_leaders"]=leaders
            if not np.isfinite(st): x["pace_fit"]=np.nan
            elif st>=3.5: x["pace_fit"]=1.0 if leaders<=1 else (-1.0 if leaders>=3 else 0.0)
            elif st>=2.5: x["pace_fit"]=0.6 if leaders in (1,2) else 0.0
            elif st<1.5: x["pace_fit"]=0.8 if leaders>=3 else (-0.3 if leaders==0 else 0.0)
            else: x["pace_fit"]=0.3 if leaders>=2 else 0.0
        if sum(x["won"] for x in rr)==1 and len(rr)>=3:
            collected.append(rr)
    for r in rows: update_states(r,day,current_race_value,current_grade)
    return len(collected)>=max_races

fh, provenance = open_csv_stream()
reader=norm_fields(csv.DictReader(fh))
print("columns", reader.fieldnames)
provenance["columns"]=reader.fieldnames

COLLECT_FROM = datetime(2022,1,1).date()
MAX_RACES = 10000
races=[]
current_key=None; current=[]
last_seen_date=None
date_order_violations=0
first_seen_date=None
last_dataset_date=None
for idx,r in enumerate(reader,1):
    rd=parse_date(r.get("date"))
    if rd:
        if first_seen_date is None: first_seen_date=rd
        if last_seen_date is not None and rd < last_seen_date:
            date_order_violations += 1
        last_seen_date=rd
        last_dataset_date=rd
    if (r.get("date") or "").lower()=="date": continue
    k=race_key(r)
    if current_key is None: current_key=k
    if k!=current_key:
        if finalize_race(current,races,COLLECT_FROM,MAX_RACES): break
        current=[]; current_key=k
    current.append(r)
if current and len(races)<MAX_RACES: finalize_race(current,races,COLLECT_FROM,MAX_RACES)
fh.close()
if len(races)<500:
    raise RuntimeError(f"Only {len(races)} eligible races collected; need >=500")
if date_order_violations:
    raise RuntimeError(f"Source is not chronological: {date_order_violations} date-order violations. Refusing leakage-prone backtest.")
print("collected races",len(races),"dataset dates",first_seen_date,last_dataset_date)

flat=[x for race in races for x in race]
df=pd.DataFrame(flat)
features=[c for c in [
 "field_size","starts_prior","win_rate5","place_rate5","last_pos","days_since_run","cur_or","or_change",
 "lbs_below_last_win_or","prev_rpr_minus_or","best_rpr3_minus_or","best_ts3_minus_or","course_win_rate","dist_win_rate",
 "going_win_rate","cd_place_rate","class_drop","same_course_month_win","return_to_win_conditions","handicap_start_no",
 "trainer14","trainer30","trainer_base_sr","trainer14_vs_base","trainer30_vs_base",
 "trainer_course_sr","trainer_type_sr","trainer_handicap_sr","trainer_course_handicap_sr","trainer_course_class_sr","trainer_course_grade_sr","trainer_value_band_sr",
 "jockey14","jockey_upgrade","trainer_jockey_sr","horse_jockey_win_sr","horse_jockey_place_sr",
 "preferred_style","course_style_sr","projected_leaders","pace_fit",
 "going_place_rate","going_avg_rpr_minus_or","class_win_rate","grade_win_rate","current_race_value_log","value_change_log","grade_change",
 "owner_trainer_sr","owner_course_sr","owner_type_sr","headgear_change",
 "sire_dist_sr","sire_going_sr","dam_dist_sr","dam_going_sr","targeting_combo"
] if c in df.columns]
market_features=features+["market_prob","market_rank"]

race_dates=df.groupby("race_id")["date"].first().sort_values()
ids=list(race_dates.index)
cut=int(len(ids)*0.72)
train_ids=set(ids[:cut]); test_ids=set(ids[cut:])
train=df[df.race_id.isin(train_ids)].copy(); test=df[df.race_id.isin(test_ids)].copy()

def fit_model(cols, frame):
    X=frame[cols].replace([np.inf,-np.inf],np.nan)
    y=frame.won
    w=1/frame.field_size.clip(lower=1)
    model=HistGradientBoostingClassifier(max_iter=180,learning_rate=.06,max_leaf_nodes=15,l2_regularization=1.2,
                                          min_samples_leaf=35,random_state=42)
    model.fit(X,y,sample_weight=w)
    return model

train_market=train[train.market_valid==1].copy()
test_market=test[test.market_valid==1].copy()
form_model=fit_model(features,train)
fusion_model=fit_model(market_features,train_market)

def race_eval(model, cols, frame, value_threshold=None):
    f=frame.copy()
    raw=model.predict_proba(f[cols].replace([np.inf,-np.inf],np.nan))[:,1]
    f["p_raw"]=raw
    f["p_model"]=f.groupby("race_id")["p_raw"].transform(lambda s:s/s.sum() if s.sum()>0 else np.repeat(1/len(s),len(s)))
    picks=f.loc[f.groupby("race_id")["p_model"].idxmax()].copy()
    acc=picks.won.mean()
    valid=picks[(picks.market_valid==1)&np.isfinite(picks.sp)]
    roi=((valid.won*valid.sp).sum()-len(valid))/len(valid) if len(valid) else np.nan
    return f,picks,acc,roi

form_all,form_picks,form_acc,form_roi=race_eval(form_model,features,test)
fusion_all,fusion_picks,fusion_acc,fusion_roi=race_eval(fusion_model,market_features,test_market)
fav=test_market[np.isfinite(test_market.sp)].loc[test_market[np.isfinite(test_market.sp)].groupby("race_id")["sp"].idxmin()]
fav_acc=fav.won.mean(); fav_roi=((fav.won*fav.sp).sum()-len(fav))/len(fav)

# Tune value threshold on training with form-only model versus market fair probability
tr_raw=form_model.predict_proba(train_market[features].replace([np.inf,-np.inf],np.nan))[:,1]
train2=train_market.copy(); train2["p_raw"]=tr_raw
train2["p_model"]=train2.groupby("race_id")["p_raw"].transform(lambda s:s/s.sum() if s.sum()>0 else np.repeat(1/len(s),len(s)))
best_t=None; best_score=-999
for t in [1.05,1.10,1.15,1.20,1.25,1.30,1.40,1.50]:
    cand=train2[np.isfinite(train2.market_prob)&np.isfinite(train2.sp)&(train2.p_model>=train2.market_prob*t)&(train2.p_model>=0.08)]
    if len(cand)<80: continue
    roi=((cand.won*cand.sp).sum()-len(cand))/len(cand)
    score=roi-0.15/max(1,len(cand)/100)
    if score>best_score: best_score=score; best_t=t
if best_t is None: best_t=1.20

value=test_market.copy()
raw=form_model.predict_proba(value[features].replace([np.inf,-np.inf],np.nan))[:,1]
value["p_raw"]=raw
value["p_model"]=value.groupby("race_id")["p_raw"].transform(lambda s:s/s.sum() if s.sum()>0 else np.repeat(1/len(s),len(s)))
vc=value[np.isfinite(value.market_prob)&np.isfinite(value.sp)&(value.p_model>=value.market_prob*best_t)&(value.p_model>=0.08)]
value_roi=((vc.won*vc.sp).sum()-len(vc))/len(vc) if len(vc) else np.nan
value_sr=vc.won.mean() if len(vc) else np.nan

# calibration for fusion top picks
fusion_picks=fusion_picks.copy()
fusion_picks["band"]=pd.cut(fusion_picks.p_model,[0,.15,.2,.25,.3,.4,.5,1],include_lowest=True)
cal=[]
for band,g in fusion_picks.groupby("band",observed=True):
    cal.append({"band":str(band),"n":len(g),"avg_model":float(g.p_model.mean()),"win_rate":float(g.won.mean()),
                "roi":float(((g.won*g.sp).sum()-g.sp.notna().sum())/g.sp.notna().sum()) if g.sp.notna().sum() else None})

def signal_stats(frame, name, mask):
    g=frame[mask.fillna(False)]
    if len(g)<30: return None
    exp=g.market_prob.sum(skipna=True)
    actual=g.won.sum()
    valid=g[np.isfinite(g.sp)]
    roi=((valid.won*valid.sp).sum()-len(valid))/len(valid) if len(valid) else np.nan
    return {"signal":name,"runners":int(len(g)),"wins":int(actual),"strike_rate":float(actual/len(g)),
            "ae":float(actual/exp) if exp>0 else None,"roi":float(roi) if np.isfinite(roi) else None}

signals=[]
signal_frame=test_market
tests={
 "2lb+ below last winning OR": signal_frame.lbs_below_last_win_or>=2,
 "5lb+ below last winning OR": signal_frame.lbs_below_last_win_or>=5,
 "return to prior winning conditions": signal_frame.return_to_win_conditions>=1,
 "same course / same time-of-year prior win": signal_frame.same_course_month_win>=1,
 "class drop >=1": signal_frame.class_drop>=1,
 "trainer 14d strike rate >=15%": signal_frame.trainer14>=.15,
 "trainer course strike rate >=15%": signal_frame.trainer_course_sr>=.15,
 "trainer race-type strike rate >=15%": signal_frame.trainer_type_sr>=.15,
 "positive jockey upgrade": signal_frame.jockey_upgrade>=.05,
 "first/second handicap start": (signal_frame.handicap_start_no>0)&(signal_frame.handicap_start_no<=2),
 "targeting combo (3+ placement signals)": signal_frame.targeting_combo>=1,
 "previous RPR 5lb+ above current OR": signal_frame.prev_rpr_minus_or>=5,
 "best recent TS 5lb+ above OR": signal_frame.best_ts3_minus_or>=5,
 "course win rate >0": signal_frame.course_win_rate>0,
 "distance win rate >0": signal_frame.dist_win_rate>0,
 "2-3lb below last winning OR": (signal_frame.lbs_below_last_win_or>=2)&(signal_frame.lbs_below_last_win_or<=3),
 "0-3lb below last winning OR": (signal_frame.lbs_below_last_win_or>=0)&(signal_frame.lbs_below_last_win_or<=3),
 "4-8lb below last winning OR": (signal_frame.lbs_below_last_win_or>=4)&(signal_frame.lbs_below_last_win_or<=8),
 "9lb+ below last winning OR": signal_frame.lbs_below_last_win_or>=9,
 "owner-trainer strike rate >=15%": signal_frame.owner_trainer_sr>=.15,
 "owner course strike rate >=15%": signal_frame.owner_course_sr>=.15,
 "owner race-type strike rate >=15%": signal_frame.owner_type_sr>=.15,
 "headgear change": signal_frame.headgear_change>=1,
 "ability + placement": (signal_frame.prev_rpr_minus_or>=5)&((signal_frame.same_course_month_win>=1)|(signal_frame.trainer_course_sr>=.15)|((signal_frame.lbs_below_last_win_or>=0)&(signal_frame.lbs_below_last_win_or<=3))),
 "ability + placement + market top3": (signal_frame.prev_rpr_minus_or>=5)&((signal_frame.same_course_month_win>=1)|(signal_frame.trainer_course_sr>=.15)|((signal_frame.lbs_below_last_win_or>=0)&(signal_frame.lbs_below_last_win_or<=3)))&(signal_frame.market_rank<=3),
 "target race + jockey upgrade": (signal_frame.same_course_month_win>=1)&(signal_frame.jockey_upgrade>=.05),
 "trainer course handicap/non-handicap SR >=15%": signal_frame.trainer_course_handicap_sr>=.15,
 "trainer course class SR >=15%": signal_frame.trainer_course_class_sr>=.15,
 "trainer course grade SR >=15%": signal_frame.trainer_course_grade_sr>=.15,
 "trainer value-band SR >=15%": signal_frame.trainer_value_band_sr>=.15,
 "stable 14d form +5pp above baseline": signal_frame.trainer14_vs_base>=.05,
 "stable 14d form +10pp above baseline": signal_frame.trainer14_vs_base>=.10,
 "horse-jockey win SR >=20%": signal_frame.horse_jockey_win_sr>=.20,
 "horse-jockey place SR >=50%": signal_frame.horse_jockey_place_sr>=.50,
 "positive pace fit": signal_frame.pace_fit>=.6,
 "proven going place rate >=50%": signal_frame.going_place_rate>=.50,
 "same-class win rate >0": signal_frame.class_win_rate>0,
 "same-grade win rate >0": signal_frame.grade_win_rate>0,
 "dropping race value >=25%": signal_frame.value_change_log<=math.log(.75),
 "rising race value >=25%": signal_frame.value_change_log>=math.log(1.25),
}
for n,m in tests.items():
    x=signal_stats(signal_frame,n,m)
    if x: signals.append(x)
signals.sort(key=lambda x:(x["ae"] if x["ae"] is not None else -9),reverse=True)

# Confidence gate study from fusion predicted probability + market rank
gate_rows=[]
for pthr in [.18,.20,.22,.25,.28,.30,.35,.40,.45,.50,.55,.60]:
    g=fusion_picks[(fusion_picks.p_model>=pthr)&(fusion_picks.market_rank<=2)]
    if len(g)<20: continue
    valid=g[np.isfinite(g.sp)]
    gate_rows.append({"min_probability":pthr,"races":len(g),"wins":int(g.won.sum()),"strike_rate":float(g.won.mean()),
                      "roi":float(((valid.won*valid.sp).sum()-len(valid))/len(valid)) if len(valid) else None})

# high-accuracy PRIME gate study: model probability + independent aiming groups
fp=fusion_picks.copy()
fp["aim_retained_ability"]=((fp.prev_rpr_minus_or>=5)|(fp.best_rpr3_minus_or>=5)).astype(int)
fp["aim_target_return"]=((fp.same_course_month_win>=1)|(fp.return_to_win_conditions>=1)).astype(int)
fp["aim_course_connections"]=((fp.trainer_course_sr>=.15)|(fp.owner_course_sr>=.15)).astype(int)
fp["aim_booking"]=(fp.jockey_upgrade>=.05).astype(int)
fp["aim_mark_sweetspot"]=((fp.lbs_below_last_win_or>=2)&(fp.lbs_below_last_win_or<=3)).astype(int)
fp["aim_groups"]=fp[["aim_retained_ability","aim_target_return","aim_course_connections","aim_booking","aim_mark_sweetspot"]].sum(axis=1)

prime_gate_defs=[
 ("P>=45%, market favourite", (fp.p_model>=.45)&(fp.market_rank==1)),
 ("P>=50%, market favourite", (fp.p_model>=.50)&(fp.market_rank==1)),
 ("P>=55%, market favourite", (fp.p_model>=.55)&(fp.market_rank==1)),
 ("P>=50%, >=2 aiming groups", (fp.p_model>=.50)&(fp.aim_groups>=2)),
 ("P>=50%, favourite, >=2 aiming groups", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.aim_groups>=2)),
 ("P>=55%, >=2 aiming groups", (fp.p_model>=.55)&(fp.aim_groups>=2)),
 ("P>=50%, >=3 aiming groups", (fp.p_model>=.50)&(fp.aim_groups>=3)),
]
prime_gates=[]
for label,mask in prime_gate_defs:
    g=fp[mask]
    if len(g)>=20:
        valid=g[np.isfinite(g.sp)]
        prime_gates.append({"gate":label,"races":len(g),"wins":int(g.won.sum()),"strike_rate":float(g.won.mean()),
                            "roi":float(((valid.won*valid.sp).sum()-len(valid))/len(valid)) if len(valid) else None})

# accuracy-maximisation study: sacrifice volume for higher win rate
acc_defs=[
 ("P>=50 favourite", (fp.p_model>=.50)&(fp.market_rank==1)),
 ("P>=55 favourite", (fp.p_model>=.55)&(fp.market_rank==1)),
 ("P>=60 favourite", (fp.p_model>=.60)&(fp.market_rank==1)),
 ("P>=50 favourite + retained ability", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.aim_retained_ability>=1)),
 ("P>=55 favourite + retained ability", (fp.p_model>=.55)&(fp.market_rank==1)&(fp.aim_retained_ability>=1)),
 ("P>=50 favourite + 2 aiming groups", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.aim_groups>=2)),
 ("P>=55 favourite + 2 aiming groups", (fp.p_model>=.55)&(fp.market_rank==1)&(fp.aim_groups>=2)),
 ("P>=50 favourite + course/connection evidence", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.aim_course_connections>=1)),
 ("P>=50 favourite + target return", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.aim_target_return>=1)),
 ("P>=50 favourite + jockey upgrade", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.aim_booking>=1)),
 ("P>=50 favourite, not nursery/hurdle", (fp.p_model>=.50)&(fp.market_rank==1)&(~fp.race_type.isin(["nursery","hurdle"]))),
 ("P>=55 favourite, not nursery/hurdle", (fp.p_model>=.55)&(fp.market_rank==1)&(~fp.race_type.isin(["nursery","hurdle"]))),
 ("P>=50 favourite, maiden/novice only", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.race_type.isin(["maiden","novice"]))),
 ("P>=50 favourite, handicap only", (fp.p_model>=.50)&(fp.market_rank==1)&(fp.race_type=="handicap")),
]
accuracy_gates=[]
for label,mask in acc_defs:
    g=fp[mask]
    if len(g)>=15:
        valid=g[np.isfinite(g.sp)]
        accuracy_gates.append({"gate":label,"races":len(g),"wins":int(g.won.sum()),"strike_rate":float(g.won.mean()),
                               "roi":float(((valid.won*valid.sp).sum()-len(valid))/len(valid)) if len(valid) else None,
                               "avg_model_probability":float(g.p_model.mean())})

# segment results
segments=[]
for seg in ["handicap","nursery","maiden","novice","chase","hurdle","other"]:
    ids_seg=set(test.loc[test.race_type==seg,"race_id"])
    g=fusion_picks[fusion_picks.race_id.isin(ids_seg)]
    if len(g)>=20:
        valid=g[np.isfinite(g.sp)]
        segments.append({"segment":seg,"races":len(g),"strike_rate":float(g.won.mean()),
                         "roi":float(((valid.won*valid.sp).sum()-len(valid))/len(valid)) if len(valid) else None})

# model/market agreement diagnostics on the same unseen races
agreement=[]
form_picks_valid=form_picks[form_picks.market_valid==1].copy()
for label, source, mask in [
    ("fusion pick = market favourite", fusion_picks, fusion_picks.market_rank==1),
    ("fusion pick = market second choice", fusion_picks, fusion_picks.market_rank==2),
    ("form-only pick = market favourite", form_picks_valid, form_picks_valid.market_rank==1),
    ("form-only pick in market top2", form_picks_valid, form_picks_valid.market_rank<=2),
    ("form-only pick outside market top2", form_picks_valid, form_picks_valid.market_rank>2),
]:
    g=source[mask]
    if len(g):
        valid=g[np.isfinite(g.sp)]
        agreement.append({"segment":label,"bets":len(g),"wins":int(g.won.sum()),"strike_rate":float(g.won.mean()),
                          "roi":float(((valid.won*valid.sp).sum()-len(valid))/len(valid)) if len(valid) else None})

# market price audit: SP overround and favourite performance by month
ov=[]
for rid,g in test.groupby("race_id"):
    inv=(1/g.sp.replace([np.inf,-np.inf],np.nan)).dropna()
    if len(inv)>=3: ov.append(float(inv.sum()))
price_audit={
    "races_with_any_prices":len(ov),
    "valid_complete_market_races":int(test_market.race_id.nunique()),
    "mean_overround":float(np.mean(ov)) if ov else None,
    "median_overround":float(np.median(ov)) if ov else None,
    "underround_pct":float(np.mean(np.array(ov)<1)) if ov else None,
    "over_150_pct":float(np.mean(np.array(ov)>1.5)) if ov else None,
}
monthly=[]
fav2=fav.copy(); fav2["month"]=fav2.date.str.slice(0,7)
for month,g in fav2.groupby("month"):
    if len(g)>=50:
        monthly.append({"month":month,"bets":len(g),"strike_rate":float(g.won.mean()),
                        "roi":float(((g.won*g.sp).sum()-len(g))/len(g))})

# approximate probability metrics over all runners after normalization
y=test_market.won.to_numpy()
p=fusion_all.set_index(test_market.index).loc[test_market.index,"p_model"].clip(1e-6,1-1e-6).to_numpy()
brier=float(np.mean((p-y)**2))
ll=float(-np.mean(y*np.log(p)+(1-y)*np.log(1-p)))

summary={
 "provenance":provenance,
 "races_total":len(races),
 "date_audit":{"first_seen":str(first_seen_date),"last_seen":str(last_dataset_date),"order_violations":date_order_violations,
               "sample_first":races[0][0]["date"] if races else None,"sample_last":races[-1][0]["date"] if races else None},
 "train_races":len(train_ids),
 "test_races":len(test_ids),
 "valid_market_test_races":int(test_market.race_id.nunique()),
 "runners_total":len(df),
 "features":features,
 "test":{
   "form_only":{"strike_rate":float(form_acc),"roi":float(form_roi),"bets":len(form_picks)},
   "market_favourite":{"strike_rate":float(fav_acc),"roi":float(fav_roi),"bets":len(fav)},
   "fusion":{"strike_rate":float(fusion_acc),"roi":float(fusion_roi),"bets":len(fusion_picks),"brier":brier,"log_loss":ll},
   "value":{"threshold_ratio":best_t,"bets":len(vc),"strike_rate":float(value_sr) if np.isfinite(value_sr) else None,
            "roi":float(value_roi) if np.isfinite(value_roi) else None}
 },
 "signal_lifts":signals,
 "confidence_gates":gate_rows,
 "prime_gates":prime_gates,
 "accuracy_gates":accuracy_gates,
 "segments":segments,
 "calibration":cal,
 "agreement":agreement,
 "price_audit":price_audit,
 "favourite_monthly":monthly,
 "methodology":{
   "leakage_control":"All horse/trainer/jockey/pedigree features are calculated only from runs occurring before each tested race. Current-race RPR/TS are never used as inputs.",
   "targeting_interpretation":"Observable placement profile only. It does not infer deliberate non-trying or handicap manipulation.",
   "split":"Chronological 72/28 race split; later races are unseen test data."
 }
}
(OUT/"historical_backtest.json").write_text(json.dumps(summary,indent=2))

def pct(x):
    return "—" if x is None or not np.isfinite(x) else f"{x*100:.1f}%"
def rpct(x):
    return "—" if x is None or not np.isfinite(x) else f"{x*100:+.1f}%"
lines=[
 "# 500+ Race Historical Backtest",
 "",
 f"Analysed **{len(races):,} races / {len(df):,} runners** with a chronological train/test split.",
 "",
 "## Unseen-test performance",
 "",
 "| Method | Bets | Strike rate | ROI at SP |",
 "|---|---:|---:|---:|",
 f"| Form/placement model (no market) | {len(form_picks)} | {pct(form_acc)} | {rpct(form_roi)} |",
 f"| SP favourite baseline | {len(fav)} | {pct(fav_acc)} | {rpct(fav_roi)} |",
 f"| Fusion: market + independent evidence | {len(fusion_picks)} | {pct(fusion_acc)} | {rpct(fusion_roi)} |",
 f"| Value overlay (all qualifying runners) | {len(vc)} | {pct(value_sr)} | {rpct(value_roi)} |",
 "",
 "## Targeting / placement signal lift",
 "",
 "| Signal | Runners | Win% | A/E | ROI |",
 "|---|---:|---:|---:|---:|",
]
for s in signals:
    lines.append(f"| {s['signal']} | {s['runners']} | {s['strike_rate']*100:.1f}% | {s['ae']:.2f} | {s['roi']*100:+.1f}% |")
lines += ["","## Confidence gates","","| Min model P | Races | Win% | ROI |","|---|---:|---:|---:|"]
for g in gate_rows:
    lines.append(f"| {g['min_probability']:.0%} | {g['races']} | {g['strike_rate']*100:.1f}% | {g['roi']*100:+.1f}% |")
lines += ["","## Key integrity rule","The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.","","Current-race RPR/TS were excluded from features to prevent hindsight leakage."]
(OUT/"historical_backtest.md").write_text("\n".join(lines))
print("\n".join(lines[:35]))
