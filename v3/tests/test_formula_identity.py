from datetime import date
from v3.formula_features import FormulaHistory
from v3.formula_identity import resolve_rows
from test_formula_features import runner


def test_country_suffix_alias_resolves_without_changing_display_input():
    state=FormulaHistory()
    state.incorporate([runner(),runner('B')],date(2025,1,1))
    row=runner('A (IRE)')
    resolved,changes=resolve_rows(state,[row],date(2025,1,2))
    assert resolved[0]['horse']=='A'
    assert row['horse']=='A (IRE)'
    assert changes[0]['kind']=='horse'


def test_ambiguous_origin_without_country_is_not_guessed():
    state=FormulaHistory()
    state.incorporate([runner('A (IRE)'),runner('A (GB)')],date(2025,1,1))
    resolved,_=resolve_rows(state,[runner('A')],date(2025,1,2))
    assert resolved[0]['horse']=='A'


def test_known_identity_is_idempotent_and_different_birth_year_does_not_match():
    state=FormulaHistory()
    state.incorporate([runner(),runner('B')],date(2025,1,1))
    rows=[runner(),runner('A (IRE)',age='3')]
    resolved,_=resolve_rows(state,rows,date(2025,1,2))
    assert resolved==rows
