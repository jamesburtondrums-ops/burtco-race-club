import copy
from datetime import date
import math
import unittest
import pandas as pd
from v3.formula_features import FormulaHistory, code, comment_facts, identity


def runner(horse='A', kind='Hurdle', pos='1', mark='100', margin='0', age='5'):
    return {'date':'2025-01-01','race_id':'race','off':'12:00','horse':horse,
            'type':kind,'course':'Test','race_name':'Test Handicap','class':'Class 4',
            'dist':'2m','going':'Good','ran':'2','pos':pos,'or':mark,'ovr_btn':margin,
            'rpr':'110','ts':'90','wgt':'11-0','age':age,'draw':'','sex':'G','hg':'',
            'trainer':'Trainer','jockey':'Jockey','sire':'Sire','sp':'5/1',
            'comment':'Held up, stayed on well'}


class FormulaFeatureTests(unittest.TestCase):
    def history(self):
        state=FormulaHistory()
        state.incorporate([runner(),runner('B',pos='2',mark='120',margin='3')],date(2025,1,1))
        return state

    def test_same_day_outcomes_cannot_enter_prediction(self):
        with self.assertRaises(ValueError):
            self.history().race([runner(),runner('B')],date(2025,1,1))

    def test_current_outcomes_prices_ratings_comments_are_ignored(self):
        rows=[runner(),runner('B')]
        state=self.history()
        before=state.race(rows,date(2025,1,2))
        dirty=copy.deepcopy(rows)
        for r in dirty:
            r.update(pos='99',ovr_btn='999',rpr='999',ts='999',sp='1000/1',
                     comment='Made all and won easily',time='1m',won=1)
        pd.testing.assert_frame_equal(before,state.race(dirty,date(2025,1,2)))
        self.assertFalse(any('sp' in c or c=='won' for c in before.columns))

    def test_hurdle_win_does_not_become_chase_win_or_winning_mark(self):
        f=self.history().race([runner(kind='Chase'),runner('B',kind='Chase')],date(2025,1,2))
        self.assertEqual(f.loc[0,'base__prior_starts'],1)
        self.assertEqual(f.loc[0,'typed__prior_starts'],0)
        self.assertEqual(f.loc[0,'typed__different_code_starts'],1)
        self.assertTrue(math.isnan(f.loc[0,'typed__below_last_win']))

    def test_birth_year_prevents_reused_name_contamination(self):
        f=self.history().race([runner(age='3'),runner('B',age='3')],date(2025,1,2))
        self.assertEqual(f.loc[0,'typed__prior_starts'],0)
        self.assertEqual(identity(runner(age='5'),date(2025,12,31)),identity(runner(age='6'),date(2026,1,1)))

    def test_margin_distinguishes_identical_finishing_positions(self):
        a,b=FormulaHistory(),FormulaHistory()
        a.incorporate([runner(),runner('B',pos='2',margin='1')],date(2025,1,1))
        b.incorporate([runner(),runner('B',pos='2',margin='25')],date(2025,1,1))
        fa=a.race([runner(),runner('B')],date(2025,1,2))
        fb=b.race([runner(),runner('B')],date(2025,1,2))
        self.assertEqual(fa.loc[1,'typed__last_finish'],fb.loc[1,'typed__last_finish'])
        self.assertLess(fa.loc[1,'form__last_log_margin_per_furlong'],fb.loc[1,'form__last_log_margin_per_furlong'])

    def test_opposition_strength_is_previous_race_field_not_current_outcome(self):
        f=self.history().race([runner(),runner('B')],date(2025,1,2))
        self.assertEqual(f.loc[0,'form__last_field_median_rating'],110)

    def test_preliminaries_do_not_hide_early_style(self):
        self.assertEqual(comment_facts('Wore red hood to post, made all, stayed on')['style'],'front')
        self.assertEqual(comment_facts('Mounted in chute, held up, ran on')['style'],'held_up')
        self.assertEqual(comment_facts('Never led, weakened')['style'],'unknown')
        self.assertEqual(comment_facts('Prominent, not fluent last')['jump_error'],1)

    def test_non_finisher_is_not_a_close_defeat(self):
        state=FormulaHistory()
        state.incorporate([runner(),runner('B',pos='F',margin='0')],date(2025,1,1))
        f=state.race([runner(),runner('B')],date(2025,1,2))
        self.assertTrue(math.isnan(f.loc[1,'form__last_log_margin_per_furlong']))
        self.assertEqual(f.loc[1,'form__completion_rate5'],0)

    def test_unknown_comment_is_missing_pace_not_a_front_runner(self):
        state=FormulaHistory()
        rows=[runner(),runner('B')]
        for r in rows:r['comment']=''
        state.incorporate(rows,date(2025,1,1))
        f=state.race(rows,date(2025,1,2))
        self.assertTrue(math.isnan(f.loc[0,'pace__front_rate5']))
        self.assertEqual(f.loc[0,'pace__field_style_coverage'],0)


if __name__=='__main__':unittest.main()
