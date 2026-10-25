"""Join frozen ability forecasts to later price observations and human form review."""
import json,math
from pathlib import Path
from datetime import datetime,timezone
from .daily_archive import base_name
from .market_review import market_name,fractional_decimal
from .records import Ledger

ROOT=Path('v3/research/2026-10-25')
CASES={
 'Simply Natural':dict(minimum_decimal=2.625,quote_bookmaker='bet365',assessment='Preferred form case; moderate conviction',
  why='Twice runner-up over hurdles at Fairyhouse: an achieved RPR of 111 on heavy ground, then narrowly beaten in a 16-runner race on yielding to soft. Her last run was fourth in a 14-runner Punchestown maiden over a longer trip. Returning to about two miles on soft ground gives a concrete form case against a shorter-priced opponent.',
  risk='179 days away. Light Up The Dark has substantially better Flat ability than most of this field and could improve for hurdling; absence of matched hurdle form is not evidence of poor jumping. Simply Natural has also made late jumping errors.',
  opposition=['Light Up The Dark','Holly\'s Thunder']),
 'Character Testing':dict(minimum_decimal=4.0,quote_bookmaker='Ladbrokes',assessment='Secondary price case; moderate to low conviction',
  why='Second over this course and roughly this trip in January from the same mark of 92, achieving RPR 97. Second at Sedgefield in August from 92. Current card RPR 107 and TS 104 are useful cross-checks, not extra model points. He is race-fit and meets several opponents returning from long absences.',
  risk='His last two fourths included losing the lead and weakening. Lightning Flash can race prominently, so an uncontested lead cannot be assumed. His soft-ground third was weaker than his better good-to-soft runs. Kourosh is dangerous on old soft-ground form if ready after 585 days.',
  opposition=['Lightning Flash','Justus','Kourosh']),
 'Dunsy Rock':dict(minimum_decimal=3.25,quote_bookmaker='bet365',assessment='Conditions and class case; moderate to low conviction',
  why='Won a 15-runner Fairyhouse maiden on heavy ground, staying on to lead after the last and win going away (achieved RPR 119). Her subsequent listed fifth and a poor handicap run came on quicker ground. Soft ground and this conditions race offer a plausible route back to her better form. Current card RPR 132 is a published assessment, not a new achieved figure.',
  risk='155-day absence and a tailed-off last run mean recovery is unproven. Her heavy-ground win was over two miles; today is about two and a half. Baymount has a recent win at this trip and may control the pace; Miss Mini Bee receives 7lb before claims.',
  opposition=['Baymount','Miss Mini Bee'])}

RACE_NOTES={
 ('Galway','12:32'):'Pass. Chart Topper is odds-on after one matched chase start with jumping errors. Da Capo Glory has stronger chase evidence but returns after 107 days. Mint Boy has a much longer absence. The models disagree materially about this field.',
 ('Wexford','12:50'):'Pass despite a model-indicated case for Caher Roes Den. His recent improvement was over hurdles on good ground; chasing and soft ground introduce two new questions. Chase The Moon has a heavy-ground hurdle win and Long Branch has prior Wexford chase experience. Their ability is not captured reliably by a simple code switch.',
 ('Market Rasen','13:00'):'Pass. Moore Brion is an odds-on hurdles debutant returning after 211 days. His bumper wins are useful evidence but do not establish jumping ability. Kaldoun Des Rocs has a mark of 122 but a 302-day absence; Military Cross is the fit, experienced alternative.',
 ('Galway','13:07'):'Pass. Only For Our Man is 11lb higher after his first chase win. Crecora Hills has won on testing ground but is 6lb higher and absent 263 days. Illtakehimmyself has recent competitive chase form, but two starts provide limited evidence. Several plausible winners prevent a strong independent price conclusion.',
 ('Wexford','13:25'):'Pass. Miss Doyenne has only two matched chase starts and weakened on her return. Fountain House has stronger achieved chase figures but drops in trip after 176 days. Luimneach is up 9lb after a six-runner win. Watch The Weather is fit and consistent, but the price offers limited room for uncertainty.',
 ('Market Rasen','13:35'):'Pass. Don Dandy is odds-on with one matched hurdle win and 187 days away. See Blue has better Flat ability than the modest hurdle evidence of several rivals; the unknowns make the model leader unsafe to treat as high confidence.',
 ('Galway','13:42'):'Pass. Harty Cup and Lanzhou rank well mainly on hurdle evidence, with no matched chase starts. Springboard is up 6lb after a ten-runner chase win; Dearg Mor has a recent placed chase run but a short record. Soft-to-heavy ground magnifies the jumping uncertainty.',
 ('Wexford','14:00'):'Pass. Seven of eight active runners lack matched UK/Irish hurdle history. Overseas form and newcomer ability are incompletely measured; the numerical ranking is not a reliable reason to back the leader.',
 ('Market Rasen','14:10'):'Pass. Sure Touch returns to a course and mark from which he won, but his recent fourth of four is a negative and first blinkers are not a guaranteed remedy. Tommy\'s Oscar has a recent run and proven good-to-soft form, but model disagreement weakens the value claim. Triple Trade and Ga Law return from long absences.',
 ('Galway','14:17'):'Reviewed selection: Simply Natural. Her actual hurdle performances provide an alternative to the odds-on Light Up The Dark. The latter has recent Flat fitness, so the 581-day jumping-card figure must not be interpreted as 581 days since any race.',
 ('Wexford','14:35'):'Pass. Lirakali has a recent second in a 20-runner maiden but only one matched hurdle start. Soul Asylum is a bumper winner changing code after 178 days. Jessbers Wish has a respectable hurdle fourth but also a long absence. The models do not agree on a sufficiently clear price advantage.',
 ('Market Rasen','14:41'):'Pass. Paper Mill is up 5lb after beating three opponents; the shadow model is much less enthusiastic. Livin On Luco and Rivers Corner have staying chase evidence but return from absences. The Doyen Chief is dropping in class after stronger handicaps but carries 12 stone. No automatic bonus for being the fit recent winner.',
 ('Galway','14:50'):'Pass. Inthenickoftime is up 8lb since the latest win and 15lb across the last two wins. Blue Train is a bigger-priced model alternative, but recent hurdle form is weaker and his later Flat run means code-specific layoff figures need care. Shellrunforbriggs returns from chasing with a higher hurdle mark.',
 ('Wexford','15:07'):'Pass. Jumbos Jet is 6lb higher after a maiden handicap win and returns after 164 days. Club Manager has recent Flat fitness despite an old hurdle date. The field contains several poorly exposed or returning runners and no convincing independently supported discrepancy.',
 ('Market Rasen','15:13'):'Pass on Walk In The Valley despite both model leads. Only one matched chase start, a fourth of six, plus an earlier trainer report that soft ground did not suit him. Noble Recall is up 8lb after a win on good ground. Gambie Tiep returns after 833 days; Walkinthewoods has recent refusal/fall evidence. Prices do not erase these risks.',
 ('Galway','15:20'):'Pass. Harpy Eagle is 8lb higher after his latest win and the shadow model ranks him much lower. Ole Ole disappointed on his latest hurdle start; Fly Away Home returns after 192 days. Brother Walfrid has a plausible mark but jumping errors and a recent sixth prevent a strong selection.',
 ('Wexford','15:40'):'Pass. Huntin Boots has useful bumper form but no matched hurdle starts; Square Necker brings good Flat ability to his hurdle debut. The leader probability understates the uncertainty in comparing two new codes. The remaining newcomers also contain unmeasured ability.',
 ('Market Rasen','15:48'):'Reviewed secondary selection: Character Testing at 3/1 or bigger. Same-mark course second and race fitness support the case, while repeated late weakening and possible pace competition prevent high conviction.',
 ('Galway','15:56'):'Pass. Bulgaden Castle has the strongest consistent hurdle form but is odds-on after 232 days away. Doctor Elvis has achieved similar figures but pulled up last time. The price does not justify forcing either into the shortlist.',
 ('Wexford','16:10'):'Reviewed selection: Dunsy Rock at 9/4 or bigger. Heavy-ground maiden win supports conditions suitability, but a longer trip, absence and poor latest run leave a substantial risk. Baymount is the fit, pace-relevant opposition.',
 ('Market Rasen','16:23'):'Pass. All five are newcomers without matched race form. Trainer and pedigree priors cannot support a confident assessment of individual ability.',
 ('Galway','16:30'):'Pass. Most of the field lacks matched bumper form; the archive sometimes labels Irish bumpers as Flat. Race-type ambiguity and newcomer ability make the probability estimates especially uncertain.',
 ('Wexford','16:40'):'Pass. B U Train is a big-priced numerical leader without matched race form. That is a prior-driven model discrepancy, not evidence of hidden ability. Socrates Smiled is also unmeasured. No speculative outsider is promoted solely because the model differs from the market.'}


def build():
 data=json.loads((ROOT/'full-field-research.json').read_text())
 markets=json.loads((ROOT/'market-grid.json').read_text())
 career=json.loads((ROOT/'career-form-today-local.json').read_text())
 ledger=Ledger(ROOT/'prospective-predictions.sqlite')
 now=datetime.now(timezone.utc)
 selections=[]
 for race in data['races']:
  if now>=datetime.fromisoformat(race['off_at']):raise ValueError('Publication cutoff expired')
  market=next(x for x in markets if f"-{race['course'].lower().replace(' ','-')}/{race['time']}/" in x['url'])
  offered={market_name(x[0])[0]:x for x in market['rows'] if not market_name(x[0])[1]}
  assert set(offered)=={base_name(h['display_name']) for h in race['ranking']},'Market field conflict'
  race['market_observed_at']=market['observed_at'];race['market_url']=market['url'];race['market_field_matches']=True
  race['review']=RACE_NOTES[(race['course'],race['time'])]
  baseline={k:1/fractional_decimal(dict(row[1:])['bet365']) for k,row in offered.items() if dict(row[1:]).get('bet365') and fractional_decimal(dict(row[1:])['bet365'])}
  total=sum(baseline.values())
  for h in race['ranking']:
   raw=offered[base_name(h['display_name'])]
   quotes=[{'bookmaker':b,'fractional':q,'decimal':fractional_decimal(q)} for b,q in raw[1:] if fractional_decimal(q)]
   h['best_observed_quote']=max(quotes,key=lambda q:q['decimal'])
   h['quotes']=quotes
   h['bookmaker_probability']=baseline[base_name(h['display_name'])]/total if len(baseline)==len(offered) else None
   h['bookmaker_probability_source']='bet365, overround removed proportionally'
   h['model_gap_percentage_points']=100*(h['win_probability']-1/h['best_observed_quote']['decimal'])
   h['shadow_rank']=1+sum(o['shadow_challenger_probability']>h['shadow_challenger_probability'] for o in race['ranking'])
   past=career.get(base_name(h['display_name']),[])
   h['unresolved_archive_entries']=sum(x['pos'] in ('','-','–') for x in past)
   confirmed=[x for x in past if x['pos'] not in ('','-','–')]
   h['confirmed_archive_starts']=len(confirmed)
   h['wet_ground_prior_runs']=sum(('soft' in x['going'].lower() or 'heavy' in x['going'].lower()) for x in confirmed)
   h['evidence_coverage']='Limited' if h['matched_exact_discipline_starts']<3 else 'Moderate; check fitness and relevance'
   h['interpretation']='Numerical discrepancy only; not proven value'
   if h['display_name'] in CASES:
    s=dict(CASES[h['display_name']],race_id=race['race_id'],horse=h['horse'],display_name=h['display_name'],time=race['time'],course=race['course'],bet_type='Win single',recorded_at=now.isoformat(),forecast_hash=race['record_hash'],stake_placed=False)
    s['quote']=next(q for q in quotes if q['bookmaker']==s['quote_bookmaker'])
    s['quote_observed_at']=market['observed_at'];s['quote_source']=market['url']
    s['price_condition_met']=s['quote']['decimal']>=s['minimum_decimal']
    s['model_probability']=h['win_probability'];s['shadow_probability']=h['shadow_challenger_probability']
    s['status']='CONDITIONAL_RESEARCH_SELECTION' if s['price_condition_met'] else 'PRICE_TOO_SHORT_PASS'
    s['record_hash']=ledger.append('selection',s['race_id'],s)
    selections.append(s)
  race.pop('feature_vectors');race.pop('shadow_feature_vectors');race.pop('identity_resolutions')
 selections.sort(key=lambda s:s['time'])
 data.update(selections=selections,selection_status='MANUAL_REVIEW_COMPLETE',market_field_matches=23,review_completed_at=now.isoformat(),matched_prior_rows=sum(len(x) for x in career.values()),historical_fields_reviewed=731)
 data['limitations'] += ['Horse-specific last-run dates on jumping cards can exclude later Flat races; do not treat them as universal fitness dates.', 'Some archive rows have no confirmed finish; these are flagged and excluded from manual form evidence.', 'Exact going-category counts distinguish soft from heavy; zero soft starts does not exclude heavy-ground evidence.', 'Model records labelled live-research-1 are superseded by live-research-2 following correction of two abbreviated race types. Both versions remain in the audit chain.']
 correction={'recorded_at':now.isoformat(),'reason':'Pre-race correction: Galway 12:32 Beg Sch is Chase, Wexford 15:40 Mdn Hdl is Hurdle; all v2 records supersede v1. No outcomes consulted.','active_version':'live-research-2','superseded_version':'live-research-1','outcomes_used':False}
 ledger.append('correction','2026-10-25|race-type-interpretation',correction)
 assert ledger.verify()
 Path('v3/public/today.json').write_text(json.dumps(data,separators=(',',':'),allow_nan=False))
 (ROOT/'selection-record.json').write_text(json.dumps({'created_at':now.isoformat(),'selections':selections,'correction':correction},indent=2,allow_nan=False))
 (ROOT/'frozen-predictions.json').write_text(json.dumps({'verified':True,'events':ledger.rows()},separators=(',',':'),allow_nan=False))
 print(json.dumps({'races':len(data['races']),'runners':data['runner_count'],'markets_matched':23,'selections':[(s['display_name'],s['quote'],s['price_condition_met']) for s in selections],'ledger_verified':True}))
 return data

if __name__=='__main__':build()
