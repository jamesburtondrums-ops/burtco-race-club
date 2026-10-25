"""Prior-only learned feature inputs; no handcrafted selection-point bonuses.

Baseline History is preserved. This challenger keeps exact-code horse histories,
previous race achievement/context and descriptive pace evidence separately.
"""
from collections import defaultdict, deque
import math
import re
import numpy as np
import pandas as pd
from .data import category, discipline, distance, number, position, token
from .features import History, mean

NAN = float('nan')
STYLES = ('front', 'prominent', 'midfield', 'held_up')


def code(row):
    kind = row.get('type', '').lower()
    if 'chase' in kind:
        return 'chase'
    if 'hurdle' in kind:
        return 'hurdle'
    if any(s in kind for s in ('nh flat', 'national hunt', 'bumper')):
        return 'bumper'
    return discipline(row)


def identity(row, day):
    name = token(row.get('horse')).replace('’', "'")
    age = number(row.get('age'))
    # Names retrieve histories; neither names nor birth year are fitted features.
    return name, day.year - int(age) if math.isfinite(age) and age > 0 else None


def comment_facts(comment):
    s = str(comment or '').lower().strip()
    # Equipment and mounting preliminaries are not running styles.
    preliminary = r'^(?:(?:wore[^,;]*?to post)|(?:went (?:early )?to post[^,;]*)|(?:mounted[^,;]*))[,;]\s*'
    for _ in range(4):
        newer = re.sub(preliminary, '', s)
        if newer == s:
            break
        s = newer
    if re.match(r'(made (?:virtually |most of )?all|(?:soon )?led|disputed (?:early )?lead)', s):
        style = 'front'
    elif re.match(r'(prominent|tracked|chased|pressed|close up|handy)', s):
        style = 'prominent'
    elif re.match(r'(held up|in rear|towards rear|slowly|dwelt|raced in rear)', s):
        style = 'held_up'
    elif re.match(r'(midfield|mid-division|in touch|raced in mid)', s):
        style = 'midfield'
    else:
        style = 'unknown'
    return {'style': style,
        'slow_start': int(bool(re.search(r'slowly|dwelt|awkward.*start|missed.*break', s))),
        'keen': int(bool(re.search(r'keen|pull(?:ed|ing) hard|took.*hold', s))),
        'blocked': int(bool(re.search(r'not clear|no room|hampered|short of room|blocked|checked', s))),
        'jump_error': int(bool(re.search(r'not fluent|mistake|blunder|jumped (?:left|right)|hit (?:\d|last)|pecked', s))),
        'late_progress': int(bool(re.search(r'stayed on|ran on|kept on|headway.*(?:final|last|finish)', s))),
        'weakened': int(bool(re.search(r'weakened|faded|no extra|tired|gave way', s)))}


def avg(events, key):
    return mean([e[key] for e in events])


def safe_card(row):
    fields = ('horse', 'trainer', 'jockey', 'sire', 'course', 'type', 'race_name', 'class',
              'going', 'dist', 'or', 'age', 'sex', 'wgt', 'hg', 'draw')
    return {k:row.get(k, '') for k in fields}


class FormulaHistory:
    def __init__(self):
        self.baseline = History()
        self.horses = defaultdict(lambda: deque(maxlen=80))
        self.last_day = None

    def race(self, rows, day):
        if self.last_day is not None and day <= self.last_day:
            raise ValueError('Prediction must follow all incorporated result dates')
        current = [safe_card(r) for r in rows]
        base = self.baseline.race(current, day)
        typed, context, pace = [], [], []
        for i, row in enumerate(current):
            exact = code(row)
            all_history = list(self.horses[identity(row, day)])
            hist = [e for e in all_history if e['code'] == exact]
            recent, last = hist[-5:], hist[-1] if hist else None
            trip, mark = distance(row['dist']), number(row['or'])
            going = category(row['going'])
            course, jockey = token(row['course']), token(row['jockey'])
            cl = number(str(row['class']).lower().replace('class', '').strip())
            same_course = [e for e in hist if e['course'] == course]
            same_trip = [e for e in hist if abs(e['trip']-trip) <= .5]
            same_going = [e for e in hist if e['going'] == going and going >= 0]
            same_cd = [e for e in same_course if abs(e['trip']-trip) <= .5]
            winning_handicaps = [e for e in hist if e['won'] and e['handicap']]
            last_win = winning_handicaps[-1] if winning_handicaps else None
            form = [e['performance'] for e in recent]
            t = base.iloc[i].to_dict()
            t.update(prior_starts=len(hist), days_since_run=(day-last['day']).days if last else NAN,
                win_rate5=avg(recent, 'won'), top3_rate5=avg(recent, 'placed'),
                mean_finish5=mean(form), last_finish=form[-1] if form else NAN,
                improvement=mean(form[-2:])-mean(form[:-2]) if len(form) >= 4 else NAN,
                best_finish5=max(form) if form else NAN,
                mark_change=mark-last['mark'] if last else NAN,
                below_last_win=last_win['mark']-mark if last_win else NAN,
                class_drop=cl-last['class'] if last else NAN,
                distance_change=trip-last['trip'] if last else NAN,
                headgear_change=int(bool(last) and token(row['hg']) != last['headgear']),
                course_starts=len(same_course), course_win=avg(same_course, 'won'),
                distance_win=avg(same_trip, 'won'), going_win=avg(same_going, 'won'),
                cd_top3=avg(same_cd, 'placed'),
                horse_jockey=avg([e for e in hist if e['jockey'] == jockey], 'won'))
            for k in ('turf', 'aw', 'hurdle', 'chase', 'bumper'):
                t['code_'+k] = int(exact == k)
            t['days_since_any_code'] = (day-all_history[-1]['day']).days if all_history else NAN
            t['different_code_starts'] = len(all_history)-len(hist)
            t['exact_code_debut'] = int(not hist)
            t['known_going_starts'] = len(same_going)
            t['known_trip_starts'] = len(same_trip)
            typed.append(t)
            three = hist[-3:]
            c = {'last_log_margin_per_furlong': last['log_margin_per_furlong'] if last else NAN,
                 'mean_log_margin3': avg(three, 'log_margin_per_furlong'),
                 'mean_field_size3': avg(three, 'field_size'),
                 'last_field_median_rating': last['field_median_rating'] if last else NAN,
                 'mean_opposition_rating3': avg(three, 'field_median_rating'),
                 'last_opposition_rating_coverage': last['rating_coverage'] if last else NAN,
                 'mean_field_top_rating3': avg(three, 'field_top_rating'),
                 'mean_outperform_rating_rank3': avg(three, 'outperform_rating_rank'),
                 'last_rpr': last['rpr'] if last else NAN,
                 'best_rpr3': max((e['rpr'] for e in three if math.isfinite(e['rpr'])), default=NAN),
                 'mean_rpr3': avg(three, 'rpr'), 'mean_ts3': avg(three, 'ts'),
                 'completion_rate5': avg(recent, 'completed'),
                 'current_vs_last_trip': trip-last['trip'] if last else NAN,
                 'last_going_matches': int(last['going'] == going) if last else NAN,
                 'last_win_age_days': (day-last_win['day']).days if last_win else NAN,
                 'days_since_any_win': (day-next(e for e in reversed(hist) if e['won'])['day']).days
                     if any(e['won'] for e in hist) else NAN,
                 'below_recent_winning_mark': max((e['mark']-mark for e in winning_handicaps
                     if (day-e['day']).days <= 730 and math.isfinite(e['mark'])), default=NAN),
                 'handicap_wins_known': len(winning_handicaps),
                 'trainer_14_known_runs': sum(0 < (day-e[0]).days <= 14 for e in
                     self.baseline.events[('trainer', token(row['trainer']))]),
                 'jockey_14_known_runs': sum(0 < (day-e[0]).days <= 14 for e in
                     self.baseline.events[('jockey', token(row['jockey']))])}
            c['rpr_vs_current_mark'] = c['best_rpr3']-mark
            context.append(c)
            known = [e for e in recent if e['style'] != 'unknown']
            p = {'style_coverage5': len(known)/len(recent) if recent else 0,
                 'comment_coverage5': mean([e['comment_known'] for e in recent]) if recent else 0}
            p.update({s+'_rate5': mean([int(e['style'] == s) for e in known]) for s in STYLES})
            p.update({k+'_rate5': avg([e for e in recent if e['comment_known']], k)
                      for k in ('slow_start', 'keen', 'blocked', 'jump_error', 'late_progress', 'weakened')})
            pace.append(p)
        typed = pd.DataFrame(typed)
        # Recompute relative features after replacing horse form, not before.
        for col in ('official_rating', 'weight', 'mean_finish5', 'win_rate5', 'trainer_all'):
            typed[col+'_vs_field'] = typed[col]-typed[col].mean()
            typed[col+'_rank'] = typed[col].rank(pct=True)
        context, pace = pd.DataFrame(context), pd.DataFrame(pace)
        for col in ('best_rpr3', 'mean_log_margin3', 'mean_opposition_rating3'):
            context[col+'_vs_field'] = context[col]-context[col].mean()
        known = pace.front_rate5.notna()
        leaders = pace.front_rate5.sum(min_count=1)
        pace['field_style_coverage'] = float(known.mean())
        pace['expected_front_runners'] = leaders
        pace['other_front_runners'] = leaders-pace.front_rate5.fillna(0)
        pace['hold_up_x_other_front_runners'] = pace.held_up_rate5*pace.other_front_runners
        pace['front_x_other_front_runners'] = pace.front_rate5*pace.other_front_runners
        pace['draw_x_front_rate'] = typed.draw_fraction*pace.front_rate5
        return pd.concat([base.add_prefix('base__'), typed.add_prefix('typed__'),
                          context.add_prefix('form__'), pace.add_prefix('pace__')], axis=1)

    def incorporate(self, rows, day):
        if self.last_day is not None and day < self.last_day:
            raise ValueError('Cannot incorporate results out of chronological order')
        fields = defaultdict(list)
        for row in rows:
            fields[(row.get('race_id'), row.get('course'), row.get('off'))].append(row)
        for race in fields.values():
            ratings = [number(r.get('or')) for r in race]
            valid = [x for x in ratings if math.isfinite(x)]
            median = float(np.median(valid)) if valid else NAN
            top = max(valid, default=NAN)
            for row in race:
                n, pos = number(row.get('ran')), position(row.get('pos'))
                if not math.isfinite(n) or n < 1:
                    continue
                trip, mark = distance(row.get('dist')), number(row.get('or'))
                percentile = (n-pos)/(n-1) if n > 1 and pos > 0 else 0.
                margin = number(row.get('ovr_btn'))
                if pos == 1:
                    margin = 0.
                if pos == 0 or margin < 0:
                    margin = NAN
                rating_percentile = (sum(r < mark for r in valid)/(len(valid)-1)
                    if len(valid)>1 and math.isfinite(mark) else NAN)
                facts = comment_facts(row.get('comment'))
                event = dict(day=day, code=code(row), course=token(row.get('course')),
                    trip=trip, going=category(row.get('going')), mark=mark,
                    **{'class': number(str(row.get('class', '')).lower().replace('class', '').strip())},
                    won=int(pos == 1), placed=int(0 < pos <= 3), completed=int(pos > 0),
                    handicap=int('handicap' in row.get('race_name', '').lower()),
                    headgear=token(row.get('hg')), jockey=token(row.get('jockey')),
                    performance=percentile, field_size=n, field_median_rating=median,
                    field_top_rating=top, rating_coverage=len(valid)/len(race),
                    outperform_rating_rank=percentile-rating_percentile,
                    rpr=number(row.get('rpr')), ts=number(row.get('ts')),
                    log_margin_per_furlong=math.log1p(margin)/max(trip, 1)
                        if math.isfinite(margin) and math.isfinite(trip) else NAN,
                    comment_known=int(bool(str(row.get('comment') or '').strip())), **facts)
                self.horses[identity(row, day)].append(event)
        self.baseline.incorporate(rows, day)
        self.last_day = day

    def __getstate__(self):
        return {'baseline': self.baseline, 'horses': dict(self.horses), 'last_day': self.last_day}

    def __setstate__(self, state):
        self.__init__()
        self.baseline = state['baseline']
        self.horses.update(state['horses'])
        self.last_day = state['last_day']
