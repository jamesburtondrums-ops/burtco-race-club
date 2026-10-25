"""Audit frozen forecasts against later published results without changing a model.

Late field changes are reported, never silently renormalised or reranked. This
module consumes outcomes only for scoring; it cannot fit or load a model.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re


def name_key(value):
    return re.sub(r'[^a-z0-9]', '', re.sub(r'\s*\([a-z]{2,3}\)', '', value.lower()))


def keyed(rows):
    result = {}
    for row in rows:
        key = name_key(row['horse'])
        if not key or key in result:
            raise ValueError('Empty or ambiguous horse identity')
        result[key] = row
    return result


def instant(value):
    d = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if d.tzinfo is None:
        raise ValueError('Explicit timezone required')
    return d


def probability_scores(probabilities, winner):
    values = list(probabilities.values())
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in values):
        raise ValueError('Invalid probability')
    if not math.isclose(sum(values), 1, abs_tol=1e-8):
        raise ValueError('Complete probabilities must sum to one')
    ranked = sorted(probabilities, key=lambda h: (-probabilities[h], h))
    rank = ranked.index(winner) + 1
    return {'top_one': int(rank == 1), 'top_two': int(rank <= 2),
            'top_three': int(rank <= 3),
            'log_loss': -math.log(max(probabilities[winner], 1e-15)),
            'brier': sum((p - int(h == winner)) ** 2 for h, p in probabilities.items())}


def mean_scores(rows):
    keys = ('top_one', 'top_two', 'top_three', 'log_loss', 'brier')
    return {'races': len(rows), **{k: sum(r[k] for r in rows) / len(rows)
            if rows else None for k in keys}}


def audit(snapshot, outcomes, study, memberships):
    if not snapshot.get('frozen'):
        raise ValueError('Only frozen predictions can be audited')
    races = snapshot['races']
    results = {r['race_id']: r for r in outcomes['races']}
    if len(results) != len(outcomes['races']) or set(results) != {r['race_id'] for r in races}:
        raise ValueError('Result race IDs must exactly match the frozen race IDs')
    studies = {r['race_id']: r for r in study['races']}
    model_scores, market_scores, paired_model_scores, details, calibration = [], [], [], [], []
    for race in races:
        off = instant(race['off_at'])
        if instant(snapshot['created_at']) >= off:
            raise ValueError('Forecast recorded after race start')
        result = results[race['race_id']]
        if instant(result['observed_at']) <= off:
            raise ValueError('Result observation must follow race start')
        pred, actual = keyed(race['ranking']), keyed(result['runners'])
        starters = {h: r for h, r in actual.items() if r['position'] != 'NR'}
        if len(starters) != result['actual_starters']:
            raise ValueError('Incomplete result field')
        finishes = []
        for h, row in starters.items():
            pos = row['position']
            if pos not in ('F', 'UR', 'PU', 'P', 'RR', 'BD', 'RO', 'DSQ'):
                if not re.fullmatch(r'[1-9][0-9]*(st|nd|rd|th)', pos):
                    raise ValueError('Unknown result status')
                finishes.append(int(re.match(r'[0-9]+', pos)[0]))
        if len(set(finishes)) != len(finishes) or finishes.count(1) != 1:
            raise ValueError('One winner and unique finishing positions required')
        winner = next(h for h, row in starters.items() if row['position'] == '1st')
        probabilities = {h: row['win_probability'] for h, row in pred.items()}
        probability_scores(probabilities, next(iter(pred)))  # validates all fields even when changed
        ordered = sorted(pred, key=lambda h: pred[h]['rank'])
        if [pred[h]['rank'] for h in ordered] != list(range(1, len(pred) + 1)):
            raise ValueError('Invalid frozen ranks')
        if any(probabilities[a] < probabilities[b] for a, b in zip(ordered, ordered[1:])):
            raise ValueError('Ranks conflict with frozen probabilities')
        pick = ordered[0]
        if pick not in actual:
            raise ValueError('Frozen leader missing from results, including non-runners')
        same_field = set(pred) == set(starters)
        row = {'race_id': race['race_id'], 'course': race['course'], 'time': race['time'],
               'horse': pred[pick]['horse'], 'frozen_win_probability': probabilities[pick],
               'result': actual[pick]['position'], 'sp': actual[pick].get('sp'),
               'winner': starters[winner]['horse'],
               'winner_frozen_rank': pred.get(winner, {}).get('rank'),
               'identical_field': same_field,
               'late_withdrawals': [pred[h]['horse'] for h in sorted(set(pred) - set(starters))],
               'unexpected_starters': [starters[h]['horse'] for h in sorted(set(starters) - set(pred))],
               'source_url': result['source_url']}
        if same_field:
            ms = probability_scores(probabilities, winner)
            model_scores.append(ms)
            row['model_scores'] = ms
            calibration.extend((p, int(h == winner)) for h, p in probabilities.items())
            market = keyed(studies[race['race_id']]['runners'])
            if set(market) != set(pred):
                raise ValueError('Market study field mismatch')
            mp = {}
            books = set()
            for h, runner in market.items():
                quote = runner.get('market')
                if not quote or not quote.get('field_matches_frozen_declarations'):
                    break
                if instant(quote['observed_at']) >= off:
                    raise ValueError('Market baseline observed after off')
                mp[h] = quote['bookmaker_normalised_probability']
                books.add(quote['baseline_bookmaker'])
            if len(mp) == len(pred) and len(books) == 1 and all(p is not None for p in mp.values()):
                bs = probability_scores(mp, winner)
                market_scores.append(bs)
                paired_model_scores.append(ms)
                row['later_pre_race_market_reference'] = bs
                row['market_bookmaker'] = next(iter(books))
        details.append(row)
    groups = {}
    for group in sorted({g for m in memberships for g in m['groups']}):
        selected = [m for m in memberships if group in m['groups']]
        rows = []
        for m in selected:
            rr = results[m['race_id']]
            actual = keyed(rr['runners'])
            h = name_key(m['horse'])
            if h not in actual:
                raise ValueError('Selected runner missing from results')
            rows.append(actual[h])
        active = [r for r in rows if r['position'] != 'NR']
        groups[group] = {'selections': len(rows), 'runners': len(active),
                         'non_runners': len(rows) - len(active),
                         'wins': sum(r['position'] == '1st' for r in active),
                         'top_three_finishes': sum(r['position'] in ('1st', '2nd', '3rd') for r in active)}
    starters = [r for r in details if r['result'] != 'NR']
    bins = []
    for lower, upper in zip((0, .1, .2, .3, .4, .5, .6, .7, .8, .9), (.1, .2, .3, .4, .5, .6, .7, .8, .9, 1.000001)):
        vals = [(p, y) for p, y in calibration if lower <= p < upper]
        if vals:
            bins.append({'lower': lower, 'upper': min(upper, 1), 'runners': len(vals),
                         'mean_prediction': sum(p for p, _ in vals) / len(vals),
                         'observed_win_rate': sum(y for _, y in vals) / len(vals)})
    return {'created_at': datetime.now(timezone.utc).isoformat(), 'race_date': snapshot['date'],
            'status': 'DESCRIPTIVE_POST_RACE_AUDIT_NOT_A_NEW_HOLDOUT',
            'model_hash': snapshot['model_hash'], 'model_changed': False,
            'frozen_snapshot_sha256': hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest(),
            'unique_named_runners': len(memberships), 'races': len(details),
            'model_leader_runners': len(starters),
            'model_leader_wins': sum(r['result'] == '1st' for r in starters),
            'model_leader_expected_wins': sum(r['frozen_win_probability'] for r in starters),
            'model_leader_top3': sum(r['result'] in ('1st', '2nd', '3rd') for r in starters),
            'model_identical_fields': mean_scores(model_scores),
            'later_pre_race_market_reference_identical_fields': mean_scores(market_scores),
            'model_on_market_reference_subset': mean_scores(paired_model_scores),
            'calibration_single_day_diagnostic': bins, 'selection_groups': groups, 'race_reviews': details,
            'limitations': ['One racing day cannot establish calibration or an improvement.',
                'Market quotes were observed later than the model freeze; this is a reference, not a matched-cutoff promotion test.',
                'Changed fields are excluded from probability metrics without renormalising original probabilities.',
                'Top-three finishes are not bookmaker-paid places; no stakes, BOG settlement or realised ROI inferred.',
                'This reviewed day is development evidence and cannot become a fresh final test.',
                'No model parameter, feature definition, forecast or retired holdout was changed.']}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--snapshot', default='v3/public/raceday.json')
    p.add_argument('--study', default='v3/public/study.json')
    p.add_argument('--results', default='v3/research/2026-10-24/results-reviewed.json')
    p.add_argument('--memberships', default='v3/research/2026-10-24/review-memberships.json')
    p.add_argument('--output', required=True)
    a = p.parse_args()
    load = lambda path: json.loads(Path(path).read_text())
    report = audit(load(a.snapshot), load(a.results), load(a.study), load(a.memberships))
    Path(a.output).write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')


if __name__ == '__main__':
    main()
