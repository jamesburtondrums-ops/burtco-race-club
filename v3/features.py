"""One feature implementation for historical replay and future racecards."""
import math
from collections import defaultdict, deque
import numpy as np
import pandas as pd
from .data import category, discipline, distance, number, position, token, weight


def mean(values):
    vals = [x for x in values if math.isfinite(x)]
    return sum(vals) / len(vals) if vals else float('nan')


def rate(events):
    # Empirical prior regularisation, not an arbitrary predictive scoring rule.
    return (sum(e[1] for e in events) + 1) / (len(events) + 10)


class History:
    def __init__(self):
        self.horses = defaultdict(lambda: deque(maxlen=40))
        self.events = defaultdict(deque)
        self.totals = defaultdict(lambda: [0, 0])
        self.last_day = None

    def aggregate(self, kind, key, day, window=None):
        if not key:
            return float('nan')
        if window:
            q = self.events[(kind, key)]
            return rate([e for e in q if 0 < (day - e[0]).days <= window])
        n, wins = self.totals[(kind, key)]
        return (wins + 1) / (n + 10)

    def race(self, rows, day):
        if self.last_day is not None and day <= self.last_day:
            raise ValueError('Feature cutoff must follow all incorporated result days')
        features = []
        for row in rows:
            code = discipline(row)
            horse, trainer, jockey, course = [token(row.get(k)) for k in ('horse', 'trainer', 'jockey', 'course')]
            # Flat turf/AW evidence may transfer; jumping and flat results stay separate.
            history = [r for r in self.horses[horse] if (r['code'] == 'jumps') == (code == 'jumps')]
            recent = history[-5:]
            last = history[-1] if history else None
            trip, mark = distance(row.get('dist', row.get('distance'))), number(row.get('or'))
            going = category(row.get('going'))
            cl = number(str(row.get('class', '')).lower().replace('class', '').strip())
            same_course = [r for r in history if r['course'] == course]
            same_trip = [r for r in history if abs(r['trip'] - trip) <= .5]
            same_going = [r for r in history if r['going'] == going and going >= 0]
            same_cd = [r for r in same_course if abs(r['trip'] - trip) <= .5]
            wins = [r for r in history if r['won']]
            form = [r['performance'] for r in recent]
            headgear = token(row.get('hg'))
            f = dict(age=number(row.get('age')), weight=weight(row.get('wgt', row.get('weight'))),
                     official_rating=mark, draw=number(row.get('draw')), field_size=len(rows),
                     distance=trip, race_class=cl, going=going, jumps=int(code == 'jumps'),
                     aw=int(code == 'aw'), female=int(token(row.get('sex')) in ('F', 'M')),
                     handicap=int('handicap' in row.get('race_name', '').lower()),
                     headgear=int(bool(headgear)), headgear_change=int(bool(last) and headgear != last['headgear']),
                     prior_starts=len(history), days_since_run=(day-last['day']).days if last else float('nan'),
                     win_rate5=mean([r['won'] for r in recent]), top3_rate5=mean([r['placed'] for r in recent]),
                     mean_finish5=mean(form), last_finish=form[-1] if form else float('nan'),
                     improvement=mean(form[-2:])-mean(form[:-2]) if len(form) >= 4 else float('nan'),
                     best_finish5=max(form) if form else float('nan'),
                     mark_change=mark-last['mark'] if last else float('nan'),
                     below_last_win=wins[-1]['mark']-mark if wins else float('nan'),
                     class_drop=cl-last['class'] if last else float('nan'),
                     distance_change=trip-last['trip'] if last else float('nan'),
                     course_starts=len(same_course), course_win=mean([r['won'] for r in same_course]),
                     distance_win=mean([r['won'] for r in same_trip]), going_win=mean([r['won'] for r in same_going]),
                     cd_top3=mean([r['placed'] for r in same_cd]),
                     horse_jockey=mean([r['won'] for r in history if r['jockey'] == jockey]),
                     trainer14=self.aggregate('trainer', trainer, day, 14),
                     trainer30=self.aggregate('trainer', trainer, day, 30),
                     trainer_all=self.aggregate('trainer', trainer, day),
                     jockey14=self.aggregate('jockey', jockey, day, 14),
                     jockey_all=self.aggregate('jockey', jockey, day),
                     trainer_jockey=self.aggregate('pair', (trainer, jockey) if trainer and jockey else '', day),
                     sire_code=self.aggregate('sire', (token(row.get('sire')), code) if row.get('sire') else '', day))
            features.append(f)
        frame = pd.DataFrame(features)
        for column in ('official_rating', 'weight', 'mean_finish5', 'win_rate5', 'trainer_all'):
            frame[column + '_vs_field'] = frame[column] - frame[column].mean()
            frame[column + '_rank'] = frame[column].rank(pct=True)
        frame['draw_fraction'] = frame['draw'] / len(rows)
        return frame

    def incorporate(self, rows, day):
        if self.last_day is not None and day < self.last_day:
            raise ValueError('Cannot incorporate results out of order')
        for row in rows:
            pos = position(row.get('pos'))
            n = number(row.get('ran'))
            if not math.isfinite(n) or n < 1:
                continue
            won = int(pos == 1)
            code = discipline(row)
            horse, trainer, jockey, course = [token(row.get(k)) for k in ('horse', 'trainer', 'jockey', 'course')]
            self.horses[horse].append(dict(day=day, code=code, course=course, trip=distance(row.get('dist')),
                                         going=category(row.get('going')), mark=number(row.get('or')),
                                         **{'class': number(str(row.get('class', '')).lower().replace('class', '').strip())},
                                         won=won, placed=int(0 < pos <= 3), jockey=jockey,
                                         headgear=token(row.get('hg')),
                                         performance=(n-pos)/(n-1) if n > 1 and pos > 0 else 0.))
            for kind, key in [('trainer', trainer), ('jockey', jockey), ('pair', (trainer, jockey) if trainer and jockey else ''),
                              ('sire', (token(row.get('sire')), code) if row.get('sire') else '')]:
                if key:
                    self.totals[(kind, key)][0] += 1
                    self.totals[(kind, key)][1] += won
                    if kind in ('trainer', 'jockey'):
                        q = self.events[(kind, key)]
                        q.append((day, won))
                        # Prune on a completed result day, never on an arbitrary future forecast date.
                        while q and (day - q[0][0]).days > 60:
                            q.popleft()
        self.last_day = day

    def __getstate__(self):
        return {'horses': dict(self.horses), 'events': dict(self.events), 'totals': dict(self.totals), 'last_day': self.last_day}

    def __setstate__(self, state):
        self.__init__()
        self.horses.update(state['horses'])
        self.events.update(state['events'])
        self.totals.update(state['totals'])
        self.last_day = state['last_day']
