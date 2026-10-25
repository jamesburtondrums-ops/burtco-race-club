import copy
import math
import unittest
from v3.postrace_review import audit, probability_scores


class PostraceReviewTests(unittest.TestCase):
    def fixture(self):
        race = {'race_id': 'r', 'course': 'Test', 'time': '12:00',
                'off_at': '2026-10-24T12:00:00+01:00',
                'ranking': [{'horse': 'A (IRE)', 'rank': 1, 'win_probability': .6},
                            {'horse': 'B', 'rank': 2, 'win_probability': .4}]}
        pre = {'frozen': True, 'date': '2026-10-24', 'model_hash': 'frozen',
               'created_at': '2026-10-24T09:00:00+00:00', 'races': [race]}
        outcome = {'races': [{'race_id': 'r', 'observed_at': '2026-10-25T09:00:00+00:00',
                             'actual_starters': 2, 'source_url': 'https://example.com/result',
                             'runners': [{'horse': 'A (IRE)', 'position': '2nd', 'sp': '2/1'},
                                         {'horse': 'B', 'position': '1st', 'sp': '1/1'}]}]}
        study = {'races': [{'race_id': 'r', 'runners': [
            {'horse': h, 'market': {'field_matches_frozen_declarations': True,
             'bookmaker_normalised_probability': p, 'baseline_bookmaker': 'Test',
             'observed_at': '2026-10-24T09:30:00+00:00'}} for h, p in [('A (IRE)', .3), ('B', .7)]]}]}
        return pre, outcome, study, [{'race_id': 'r', 'horse': 'A (IRE)', 'groups': ['selected']}]

    def test_known_probability_errors_and_no_input_mutation(self):
        args = self.fixture()
        old = copy.deepcopy(args)
        result = audit(*args)
        self.assertEqual(args, old)
        self.assertAlmostEqual(result['model_identical_fields']['log_loss'], -math.log(.4))
        self.assertAlmostEqual(result['model_identical_fields']['brier'], .72)
        self.assertEqual(result['model_identical_fields']['top_one'], 0)
        self.assertEqual(result['later_pre_race_market_reference_identical_fields']['top_one'], 1)

    def test_withdrawn_leader_is_not_replaced_by_winner(self):
        pre, out, study, groups = self.fixture()
        out['races'][0]['runners'][0]['position'] = 'NR'
        out['races'][0]['actual_starters'] = 1
        result = audit(pre, out, study, groups)
        self.assertEqual(result['race_reviews'][0]['result'], 'NR')
        self.assertEqual(result['model_identical_fields']['races'], 0)
        self.assertEqual(result['selection_groups']['selected']['wins'], 0)
        self.assertEqual(result['model_leader_runners'], 0)

    def test_refusal_is_a_recorded_starter_not_a_nonrunner(self):
        args = self.fixture()
        args[1]['races'][0]['runners'][0]['position'] = 'RR'
        result = audit(*args)
        self.assertEqual(result['model_leader_runners'], 1)
        self.assertEqual(result['model_identical_fields']['races'], 1)

    def test_incomplete_results_are_rejected(self):
        args = self.fixture()
        args[1]['races'][0]['runners'].pop()
        with self.assertRaises(ValueError):
            audit(*args)

    def test_duplicate_normalised_identities_are_rejected(self):
        args = self.fixture()
        args[1]['races'][0]['runners'][1]['horse'] = 'A'
        with self.assertRaises(ValueError):
            audit(*args)

    def test_retrospective_forecast_is_rejected(self):
        args = self.fixture()
        args[0]['created_at'] = '2026-10-25T00:00:00+00:00'
        with self.assertRaises(ValueError):
            audit(*args)

    def test_late_market_quote_is_rejected(self):
        args = self.fixture()
        args[2]['races'][0]['runners'][0]['market']['observed_at'] = '2026-10-25T00:00:00+00:00'
        with self.assertRaises(ValueError):
            audit(*args)

    def test_probability_mass_is_not_silently_fixed(self):
        with self.assertRaises(ValueError):
            probability_scores({'a': .6, 'b': .3}, 'a')


if __name__ == '__main__':
    unittest.main()
