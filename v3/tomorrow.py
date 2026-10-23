"""Prospective full-field forecasts. Prices never enter independent ability inputs."""
import hashlib
import json
import math
import pickle
import re
from collections import defaultdict, deque
from datetime import datetime, date, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
from .daily_archive import base_name
from .data import discipline, number, token, weight
from .experiment import file_digest
from .records import Ledger

DAY = date(2026, 10, 24)
DIRECTORY = Path('v3/research/2026-10-24')


def safe(value):
    if isinstance(value, dict):
        return {k: safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [safe(v) for v in value]
    if isinstance(value, (float, np.floating)):
        return float(value) if math.isfinite(value) else None
    if isinstance(value, np.integer):
        return int(value)
    return value


def same_person(a, b):
    def bits(s):
        s = re.sub(r'\b(MR|MRS|MISS|MS|DR)\b', '', token(s))
        return re.findall(r'[A-Z]+', s)
    x, y = bits(a), bits(b)
    if not x or not y or x[-1] != y[-1]:
        return False
    if x == y:
        return True
    return len(x) == len(y) and all(u == v or (min(len(u), len(v)) == 1 and u[0] == v[0]) for u, v in zip(x, y))


def pace_style(comment):
    s = comment.lower()
    if re.match(r'(made (?:virtually )?all|(?:soon )?led|disputed (?:early )?lead)', s):
        return 'front'
    if re.match(r'(prominent|tracked|chased|pressed|close up)', s):
        return 'prominent'
    if re.match(r'(held up|in rear|towards rear|slowly|dwelt)', s):
        return 'held_up'
    if re.match(r'(midfield|mid-division|in touch)', s):
        return 'midfield'
    return 'unknown'


def build(freeze=False):
    root = Path('v3/workspace')
    with (root / 'model.pkl').open('rb') as f:
        artifact = pickle.load(f)
    with (root / 'history-latest.pkl').open('rb') as f:
        history = pickle.load(f)
    assert history.last_day < DAY
    prior = json.loads((DIRECTORY / 'prior-form.json').read_text())['form']
    index = defaultdict(list)
    for key in list(history.horses):
        index[base_name(key)].append(key)
    model_hash = file_digest(root / 'model.pkl')
    races, warnings = [], []
    fields = ['horse', 'origin', 'age', 'wgt', 'or', 'trainer', 'jockey', 'claim', 'draw', 'gear_badges', 'form', 'horse_id']
    for course in ('Cheltenham', 'Doncaster', 'Kelso', 'Southwell'):
        card = json.loads((DIRECTORY / (course.lower() + '.json')).read_text())
        for race in card['races']:
            detail_path = DIRECTORY / ('detail-' + course.lower() + '-' + race['time'].replace(':', '') + '.json')
            detail = json.loads(detail_path.read_text())
            details = {r['id']: r for r in detail['horses']}
            if len(details) != len(race['rows']) or int(detail['declared']) != len(race['rows']):
                raise ValueError('Declared field mismatch: ' + race['url'])
            current, evidence, withdrawn = [], [], []
            kind = 'Chase' if 'Chase' in race['title'] else 'Hurdle' if 'Hurdle' in race['title'] else 'NH Flat' if 'NH Flat' in race['title'] else 'Flat'
            for values in race['rows']:
                row = dict(zip(fields, values))
                item = details[row['horse_id']]
                if item['nonrunner']:
                    withdrawn.append({'horse': item['horse'], 'horse_id': row['horse_id'],
                                      'status': 'NON_RUNNER', 'source_url': detail['url']})
                    continue
                key, base = token(item['horse']), base_name(row['horse'])
                birth_year = DAY.year - int(row['age'])
                past = [r for r in prior.get(base, [])
                        if math.isfinite(number(r.get('age'))) and date.fromisoformat(r['date']).year - int(number(r['age'])) == birth_year
                        and (not re.search(r'\([A-Z]{2,3}\)$', token(r['horse'])) or token(r['horse']).endswith('(' + row['origin'] + ')'))]
                permitted_runs = {(r['date'], token(r['course'])) for r in past}
                aliases = [a for a in index.get(base, []) if not re.search(r'\([A-Z]{2,3}\)$', a) or a.endswith('(' + row['origin'] + ')')]
                merged, seen = [], set()
                for alias in aliases:
                    for event in history.horses[alias]:
                        if (str(event['day']), event['course']) not in permitted_runs:
                            continue
                        stamp = (str(event['day']), event['course'], event['trip'], event['performance'], str(event['mark']))
                        if stamp not in seen:
                            merged.append(dict(event)); seen.add(stamp)
                history.horses[key] = deque(sorted(merged, key=lambda r: r['day'])[-40:], maxlen=40)
                resolved, person_aliases = {}, {}
                for kind_name in ('trainer', 'jockey'):
                    name = row[kind_name]
                    candidates = [k for (typ, k) in history.totals if typ == kind_name and same_person(name, k)]
                    # Keep an exact source spelling when the abbreviated name is ambiguous.
                    full = [k for k in candidates if all(len(v) > 1 for v in k.split()[:-1])]
                    if len(full) == 1:
                        canonical = full[0]
                        aliases_person = [k for k in candidates if same_person(k, canonical)]
                        total = [sum(history.totals[(kind_name, k)][j] for k in aliases_person) for j in (0, 1)]
                        events = sorted([e for k in aliases_person for e in history.events[(kind_name, k)]], key=lambda e: e[0])
                        # Unique per-current-label key prevents later forecasts from double-counting aliases.
                        canonical_key = '__CARD__' + token(name)
                        history.totals[(kind_name, canonical_key)] = total
                        history.events[(kind_name, canonical_key)] = deque(events)
                        resolved[kind_name] = canonical_key
                        person_aliases[kind_name] = aliases_person
                    else:
                        resolved[kind_name] = token(name)
                        person_aliases[kind_name] = [token(name)]
                pair = (resolved['trainer'], resolved['jockey'])
                if any(k.startswith('__CARD__') for k in pair):
                    history.totals[('pair', pair)] = [sum(history.totals[('pair', (t, j))][k]
                        for t in person_aliases['trainer'] for j in person_aliases['jockey']) for k in (0, 1)]
                for event in history.horses[key]:
                    if event['jockey'] in person_aliases['jockey']:
                        event['jockey'] = resolved['jockey']
                gear = ''.join(re.findall(r'(ts|cp|hd|bl|vs|es|h|b|v)', row['gear_badges']))
                claim = int(row['claim'] or 0)
                net = weight(row['wgt']) - claim
                net_weight = f'{int(net)//14}-{int(net)%14}'
                runner = {'horse': key, 'trainer': resolved['trainer'], 'jockey': resolved['jockey'],
                          'sire': item['sire'], 'course': course + (' (AW)' if course == 'Southwell' else ''),
                          'type': kind, 'race_name': race['title'], 'class': race['class'], 'going': card['going'],
                          'dist': race['distance'].replace('.', ''), 'or': row['or'], 'age': row['age'],
                          'sex': item['sex'], 'wgt': net_weight, 'hg': gear, 'draw': row['draw']}
                current.append(runner)
                evidence.append({'card': row, 'detail': item, 'past': past, 'aliases': aliases})
            frame = history.race(current, DAY)
            race_id = '2026-10-24|' + course.lower() + '|' + race['time']
            frame['race_id'], frame['horse'], frame['code'] = race_id, [r['horse'] for r in current], discipline(current[0])
            p = artifact['model'].predict(frame, artifact['temperature'])
            if not np.isfinite(p).all() or abs(p.sum() - 1) > 1e-10:
                raise ValueError('Invalid complete-field probabilities')
            ranked = []
            for i, ev in enumerate(evidence):
                row, det, past = ev['card'], ev['detail'], ev['past']
                code = discipline(current[i])
                history_same = [r for r in history.horses[current[i]['horse']] if (r['code'] == 'jumps') == (code == 'jumps')]
                actual_days = int(det['days_since_run']) if str(det['days_since_run']).isdigit() else None
                actual_form = det['runs']
                positives, risks = [], []
                form = history_same[-5:]
                wins = sum(r['won'] for r in form)
                if wins:
                    positives.append(f'{wins} wins in the last {len(form)} archived starts in this code')
                if not form:
                    risks.append('No matched GB/IRE archive form in this code; probability relies heavily on other features')
                elif len(form) <= 2:
                    risks.append(f'Limited form evidence: {len(form)} archived starts in this code')
                course_wins = sum(r['won'] for r in history_same if r['course'] == token(current[i]['course']))
                if course_wins:
                    positives.append(f'{course_wins} prior wins at this course in matched archive form')
                if actual_days is not None and actual_days >= 180:
                    risks.append(f'{actual_days}-day absence; fitness has to be taken on trust')
                if actual_days is not None and actual_days <= 7:
                    risks.append(f'Quick return after {actual_days} days')
                if actual_days is not None and history_same:
                    archive_days = (DAY - history_same[-1]['day']).days
                    if archive_days != actual_days:
                        risks.append(f'Latest-run timing differs: card {actual_days} days, archive {archive_days} days')
                if form and math.isfinite(number(row['or'])):
                    change = number(row['or']) - form[-1]['mark']
                    if math.isfinite(change) and change >= 5 and 'handicap' in race['title'].lower():
                        risks.append(f'{change:g}lb higher than the mark on the latest archived start')
                    elif math.isfinite(change) and change <= -3:
                        positives.append(f'{-change:g}lb below the mark on the latest archived start')
                recent = [r for r in past if (DAY - date.fromisoformat(r['date'])).days <= 180]
                figures = [number(r['rpr']) for r in recent[-3:] if math.isfinite(number(r['rpr']))]
                style = next((pace_style(r['comment']) for r in reversed(past[-3:]) if pace_style(r['comment']) != 'unknown'), 'unknown')
                trainer_events = [e for e in history.events[('trainer', current[i]['trainer'])] if 0 < (DAY - e[0]).days <= 14]
                trainer_wins = sum(e[1] for e in trainer_events)
                if len(trainer_events) >= 10 and trainer_wins / len(trainer_events) >= .2:
                    positives.append(f'Stable {trainer_wins}/{len(trainer_events)} in the preceding 14-day archive window')
                if not actual_form:
                    risks.append('No published recent race-form lines; pedigree and debut uncertainty matter')
                ranked.append({'horse': det['horse'], 'display_name': row['horse'], 'horse_id': row['horse_id'],
                               'win_probability': float(p[i]), 'fair_decimal_odds': float(1 / p[i]),
                               'or': number(row['or']), 'age': int(row['age']), 'weight': row['wgt'], 'claim': int(row['claim'] or 0),
                               'trainer': row['trainer'], 'jockey': row['jockey'], 'draw': row['draw'],
                               'days_since_run': actual_days, 'form': row['form'], 'sire': det['sire'], 'dam': det['dam'],
                               'matched_prior_starts': len(history_same), 'archive_aliases': ev['aliases'],
                               'recent_best_rpr': max(figures) if figures else None,
                               'pace_style_inferred': style, 'positives': positives, 'risks': risks,
                               'last_three_published_runs': actual_form,
                               'trainer14': {'wins': trainer_wins, 'runs': len(trainer_events)}})
            ranked.sort(key=lambda r: (-r['win_probability'], r['horse']))
            for i, runner in enumerate(ranked):
                runner['rank'] = i + 1
            leaders = sum(r['pace_style_inferred'] == 'front' for r in ranked)
            pace = 'Several potential leaders; competition for the lead is plausible' if leaders >= 3 else 'One identified early leader; possible tactical advantage if confirmed' if leaders == 1 else 'Pace evidence is incomplete; no confident tactical assumption'
            off = datetime.combine(DAY, datetime.strptime(race['time'], '%H:%M').time(), ZoneInfo('Europe/London'))
            observed = max(card['observed_at'], detail['observed_at'])
            result = {'race_id': race_id, 'course': course, 'time': race['time'], 'off_at': off.isoformat(),
                      'title': race['title'], 'going': card['going'], 'distance': race['distance'], 'class': race['class'],
                      'declared_runner_count': len(ranked), 'original_declarations': len(race['rows']),
                      'withdrawn': withdrawn, 'source_url': race['url'], 'observed_at': observed,
                      'model_hash': model_hash, 'status': 'PROVISIONAL_PRE_RACE_EXPERIMENTAL',
                      'ranking': ranked, 'pace_context': pace, 'potential_early_leaders': leaders,
                      'forecast_odds_source_text': race['forecast'], 'live_bookmaker_quotes_verified': False,
                      'probability_input_features_sha256': hashlib.sha256(frame.to_json().encode()).hexdigest(),
                      'model_history_through': str(history.last_day), 'source_publication_timestamp': None}
            if freeze:
                ledger = Ledger(root / 'predictions.sqlite')
                ledger.verify()
                if datetime.fromisoformat(observed.replace('Z', '+00:00')) > datetime.now(timezone.utc) or datetime.now(timezone.utc) >= off - timedelta(minutes=5):
                    raise ValueError('Observation or recording clock violates the pre-race cutoff')
                payload = dict(result, predicted_winner=ranked[0]['horse'], cutoff=(off - timedelta(minutes=5)).isoformat(),
                               model_name=artifact['model'].name, model_status=artifact['status'],
                               source_snapshot={'runners': current, 'observed_at': observed, 'source_url': race['url'],
                                                'publication_timestamp_verified': False})
                payload['feature_vectors'] = safe(frame.drop(columns=['race_id', 'horse', 'code']).to_dict(orient='records'))
                result['record_hash'] = ledger.append('prediction', race_id, safe(payload))
            races.append(safe(result))
    races.sort(key=lambda r: (r['time'], r['course']))
    output = {'date': str(DAY), 'created_at': datetime.now(timezone.utc).isoformat(), 'races': races,
              'race_count': len(races), 'runner_count': sum(r['declared_runner_count'] for r in races),
              'original_declarations': sum(r['original_declarations'] for r in races),
              'nonrunner_count': sum(len(r['withdrawn']) for r in races),
              'model_status': artifact['status'], 'model_hash': model_hash, 'history_through': str(history.last_day),
              'frozen': freeze, 'production_model_changed': False,
              'probability_notice': 'Experimental model estimates, not proven prospective accuracy. All fields are ranked independently of market prices.',
              'price_notice': 'Published probable-SP forecasts are not executable bookmaker quotes. No live price or each-way place terms have been verified.',
              'abandoned': ['Newbury: Saturday abandoned due to waterlogging', 'Galway: Saturday transferred to Monday'],
              'limitations': ['History through 22 October; 23 October results are not incorporated.',
                              'Running style is inferred from prior race comments and does not alter model probabilities.',
                              'Source publication times are unavailable; retrieval times are recorded.',
                              'Current declarations and going require a morning recheck.'],
              'selections': json.loads((DIRECTORY / 'shortlist.json').read_text())}
    target = Path('v3/public')
    target.mkdir(exist_ok=True)
    (target / 'tomorrow.json').write_text(json.dumps(safe(output), indent=2, allow_nan=False))
    print(json.dumps({'races': len(races), 'runners': output['runner_count'], 'frozen': freeze,
                      'ranked_first': [(r['course'], r['time'], r['ranking'][0]['horse'], round(r['ranking'][0]['win_probability'], 3)) for r in races]}))


if __name__ == '__main__':
    import sys
    build('--freeze' in sys.argv)
