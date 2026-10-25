"""Publish actual development results, including rejected changes and price-band failures."""
import html
import json
from pathlib import Path


def build(root='v3/workspace-formula',refinement='v3/workspace-formula-b'):
    root,refinement=Path(root),Path(refinement)
    a=json.loads((root/'formula-development.json').read_text())
    b=json.loads((refinement/'refinement-report.json').read_text())
    prep=json.loads((root/'preparation.json').read_text())
    models={**a['later_development_validation'],**b['validation']}
    labels={'original_ensemble':'Earlier v3 architecture, refitted','typed_boosted':'Separate racing disciplines',
      'context_boosted':'Discipline + race achievement','pace_boosted':'Discipline + pace comments',
      'context_ensemble':'Full context, fixed ensemble','deep_context':'Full context, deeper boosting',
      'learned_blend':'Full context, learned ensemble'}
    table=''.join(f'<tr><td>{labels[n]}</td><td>{100*s["top_one"]:.2f}%</td><td>{100*s["top_three"]:.2f}%</td><td>{s["log_loss"]:.4f}</td><td>{s["brier"]:.4f}</td></tr>' for n,s in models.items())
    best=b['validation']['learned_blend']
    old=a['later_development_validation']['original_ensemble']
    old_odds=a['odds_band_diagnostics']['original_ensemble']
    new_odds=b['odds_band_diagnostics']['learned_blend']
    band_rows=[]
    for key,label in [('over_6_to_1_to_12_to_1','Above 6/1 through 12/1'),('over_12_to_1','Above 12/1')]:
        o,n=old_odds[key],new_odds[key]
        band_rows.append(f'<tr><td>{label}</td><td>{o["actual_winners"]:,}</td><td>{o["winners_ranked_first"]} → {n["winners_ranked_first"]}</td><td>{o["winners_in_model_top3"]} → {n["winners_in_model_top3"]}</td></tr>')
    long_o,long_n=old_odds['over_12_to_1'],new_odds['over_12_to_1']
    fold_rows=''.join(f'<tr><td>{f["start"][:4]}</td><td>{100*a["folds"][i]["models"]["original_ensemble"]["top_one"]:.2f}%</td><td>{100*f["learned_blend"]["top_one"]:.2f}%</td><td>{a["folds"][i]["models"]["original_ensemble"]["log_loss"]:.4f} → {f["learned_blend"]["log_loss"]:.4f}</td></tr>' for i,f in enumerate(b['chronological_folds']))
    ci=b['development_day_bootstrap']['learned_blend']['accuracy_gain']['ci95']
    output={'cycle_a':a,'cycle_b':b,'preparation':prep,'production_action':'RETAIN_ORIGINAL',
      'live_betting_formula_replaced':False,'independent_final_results_available':False,
      'decision':'The learned blend improved overall development metrics but failed the predefined larger-price winner gate. No replacement or longshot edge is approved.'}
    public=Path('v3/public')
    (public/'formula-development.json').write_text(json.dumps(output,indent=2,allow_nan=False))
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Formula development · Racing Intelligence v3</title><style>:root{color-scheme:dark;font:16px/1.6 system-ui;background:#0b1420;color:#eaf1f6}*{box-sizing:border-box}body{margin:0}main{max-width:1150px;padding:28px 18px 70px;margin:auto}a{color:#7ce1d2}h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.1;max-width:850px}h2{margin-top:34px;font-size:1.4rem}.tag{font-size:.8rem;letter-spacing:.1em;color:#7ce1d2}.intro{max-width:850px;color:#bacdd9}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:28px 0}.stat,.panel{padding:20px;border:1px solid #29404c;border-radius:12px;background:#12212e}.stat b{font-size:1.9rem;color:#b7efe1;display:block}.note{padding:18px;border-left:4px solid #e4ba79;background:#24251f;margin:25px 0}.meta{color:#a4b9c9;font-size:.85rem}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;min-width:550px;font-size:.9rem}td,th{padding:12px 10px;border-bottom:1px solid #2c414e;text-align:left}th{color:#a4b9c9}li{margin:10px 0}code{color:#bce7db}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px}footer{margin-top:32px}</style><main>
<a href="./">← Race research</a> · <a href="review-2026-10-24.html">Yesterday’s complete review</a>
<p class="tag">FORMULA DEVELOPMENT · 25 OCTOBER 2026</p><h1>A rebuilt formula, with its gains and failures measured.</h1>
<p class="intro">The algorithm now learns from prior beaten margins, opposition strength, separate turf/AW/hurdle/chase/bumper records, handicap recency and factual running comments. Odds do not enter the ability model. Seven models were compared across chronological development periods.</p>
<div class="stats"><div class="stat"><b>31,262</b>Development races<br><span class="meta">297,961 runner records</span></div><div class="stat"><b>11,010</b>Later validation races<br><span class="meta">8 Jan 2024–27 May 2026</span></div><div class="stat"><b>7</b>Models compared<br><span class="meta">Two recorded development cycles</span></div><div class="stat"><b>3</b>Chronological folds<br><span class="meta">2021, 2022 and 2023</span></div></div>
<div class="note"><b>The original selection process remains retained.</b> The strongest development model improved overall accuracy, but failed the predefined requirement to preserve winner detection above 12/1. It has not been promoted. These periods have been studied in earlier work: they are development evidence, not a fresh independent final test.</div>
<h2>What changed inside the formula</h2><div class="grid"><section class="panel"><b>Actual previous achievement</b><p>A close third and a remote third now differ through beaten margins. Earlier race field size, class and opponents’ ratings provide context. Prior achieved RPR/TS are used only after their race is completed.</p></section><section class="panel"><b>Separate racing disciplines</b><p>Hurdle success does not become a chase win or chase winning mark. Debut uncertainty, fitness in another code and missing evidence are explicit inputs.</p></section><section class="panel"><b>How horses raced</b><p>Prior comments supply running style, slow-start, keen-running, obstruction, jumping-error, late-progress and weakening indicators. Rival pace pressure is estimated; a contested lead does not automatically earn a closer a bonus.</p></section><section class="panel"><b>Learned combinations</b><p>Boosting and conditional ranking learn relationships. A second experiment learned ensemble weights from earlier out-of-fold predictions, rather than assigning fixed handicap or outsider points.</p></section></div>
<h2>Later development comparison</h2><div class="scroll"><table><thead><tr><th>Model</th><th>Winner first</th><th>Winner in top three</th><th>Log loss ↓</th><th>Brier ↓</th></tr></thead><tbody>'''+table+'''</tbody></table></div>
<p class="meta">Identical races and fields. Each validation model was fitted only through 2023. Calibration and blend weights came from earlier chronological predictions. “Earlier v3 architecture” means a refit of the experimental v3 architecture, not a scored comparison with the original production website’s historical selections.</p>
<h2>The strongest result is promising, but incomplete</h2><p>Winner accuracy increased from '''+f'{100*old["top_one"]:.2f}% to {100*best["top_one"]:.2f}%'+'''. Log loss and Brier also improved. The development day-bootstrap 95% interval for the accuracy change was '''+f'{100*ci[0]:+.2f} to {100*ci[1]:+.2f} percentage points'+'''. Model selection used these development outcomes, so this interval does not establish an independent prospective gain.</p>
<div class="scroll"><table><thead><tr><th>Earlier fold</th><th>Earlier architecture</th><th>Chronological learned blend</th><th>Log loss: earlier → blend</th></tr></thead><tbody>'''+fold_rows+'''</tbody></table></div>
<p class="meta">The first blend fold used equal weights. Later folds learned weights from completed earlier folds only. The final development blend learned '''+f'{100*b["learned_weights"][0]:.1f}% conditional ranker and {100*b["learned_weights"][2]:.1f}% deeper boosting'+'''; the shallow boosted component received zero weight. Temperature calibration was 0.85.</p>
<h2>The bigger-price test was not passed</h2><div class="scroll"><table><thead><tr><th>Winner’s SP band</th><th>Actual winners</th><th>Winner ranked first: earlier → blend</th><th>Winner in top three: earlier → blend</th></tr></thead><tbody>'''+''.join(band_rows)+'''</tbody></table></div>
<p>The learned blend found more longer-priced winners within its top three, but fewer as its first choice above 12/1. That failed the recorded development gate. More top-three detections do not automatically mean better each-way bets.</p>
<p>Among horses above 12/1 that were model-ranked in the top three, actual top-three finishes were '''+f'{long_o["top3_ranked_finishing_top3"]}/{long_o["top3_ranked_runners"]} ({100*long_o["top3_ranked_finishing_top3"]/long_o["top3_ranked_runners"]:.1f}%) before and {long_n["top3_ranked_finishing_top3"]}/{long_n["top3_ranked_runners"]} ({100*long_n["top3_ranked_finishing_top3"]/long_n["top3_ranked_runners"]:.1f}%) with the blend'+'''. Place precision did not improve.</p>
<div class="note">The earlier model already assigned about '''+f'{long_o["expected_winners"]:,.0f}'+''' expected wins to the above-12/1 group, where '''+f'{long_o["actual_winners"]:,}'+''' actually won. The new blend still overestimated this group. A larger model/market disagreement is not automatically a market error. A blanket outsider boost is unsupported.</div>
<p class="meta">SP bands are retrospective diagnostic groups after the predictions were generated. They are not verified early quotes, paid-place terms, betting returns or proof of value. The model never receives SP, favouritism or horse names as fitted ability features.</p>
<h2>Checks and next independent evaluation</h2><ul><li>Current-race results, margins, comments, achieved figures and prices cannot change prediction inputs.</li><li>Every same-day result is embargoed until all that day’s predictions are complete.</li><li>Separate identities and unambiguous aliases protect against reused horse names and missing country suffixes.</li><li>The trained challenger produces full-field probabilities and immutable pre-race records; an expired cutoff is rejected.</li><li>The June–September 2026 test remains retired. October’s reviewed races cannot be reused as unseen evidence.</li><li>A future period is reserved from 26 October 2026 through 31 January 2027, with at least 1,000 races required. It has not been collected or evaluated here.</li></ul>
<p class="note">No independent accuracy improvement or betting profitability has been demonstrated. Candidate A is preserved as experimental software. The second cycle was rejected under its larger-price criterion. Neither replaces production selections.</p>
<footer><a href="formula-development.json">Complete results, gates, uncertainty and data coverage</a><p class="meta">Archive: deltaromeo/horse-racing-results-ukireland-2015-2025, CDLA Sharing 1.0. Historical declaration timing and rating-version timestamps are not verified. Operational form history currently ends 22 October; later missing days are disclosed.</p></footer></main></html>'''
    (public/'formula-lab.html').write_text(page)
    print(json.dumps({'models':len(models),'races':11010,'promoted':False,'page':'v3/public/formula-lab.html'}))


if __name__=='__main__':build()
