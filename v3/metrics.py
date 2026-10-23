import numpy as np
import pandas as pd


def race_scores(frame, probabilities):
    f = frame[['race_id', 'date', 'horse', 'won', 'position', 'code', 'field_size']].copy()
    f['p'] = probabilities
    # Stable, recorded tie-break; outcome and bookmaker price never break prediction ties.
    f = f.sort_values(['race_id', 'p', 'horse'], ascending=[True, False, True], kind='stable')
    f['rank'] = f.groupby('race_id', sort=False).cumcount() + 1
    f['brier_part'] = (f.p-f.won) ** 2
    winners = f[f.won == 1].set_index('race_id')
    winners['log_loss'] = -np.log(np.clip(winners.p, 1e-15, 1))
    winners['brier'] = f.groupby('race_id').brier_part.sum()
    picks = f[f['rank'] == 1].set_index('race_id')
    winners['top_one'] = (winners['rank'] == 1).astype(int)
    winners['top_two'] = (winners['rank'] <= 2).astype(int)
    winners['top_three'] = (winners['rank'] <= 3).astype(int)
    winners['pick_top3'] = ((picks.position > 0) & (picks.position <= 3)).astype(int)
    return winners, f


def metrics(frame, p):
    races, runners = race_scores(frame, p)
    result = {'races': len(races), 'runners': len(runners)}
    result.update({k: float(races[k].mean()) for k in ('top_one', 'top_two', 'top_three', 'pick_top3', 'log_loss', 'brier')})
    result['calibration'] = []
    runners['bin'] = pd.cut(runners.p, bins=np.linspace(0, 1, 11), include_lowest=True)
    for _, g in runners.groupby('bin', observed=True):
        result['calibration'].append({'count': len(g), 'predicted': float(g.p.mean()), 'observed': float(g.won.mean())})
    result['segments'] = {}
    for code, subset in races.groupby('code'):
        result['segments'][code] = {k: float(subset[k].mean()) for k in ('top_one', 'log_loss', 'brier')}
        result['segments'][code]['races'] = len(subset)
    result['field_sizes'] = {}
    for label, mask in [('2-7', races.field_size <= 7), ('8-11', races.field_size.between(8, 11)), ('12+', races.field_size >= 12)]:
        g = races[mask]
        result['field_sizes'][label] = {'races': len(g), 'top_one': float(g.top_one.mean()) if len(g) else None}
    return result


def paired_bootstrap(frame, candidate, baseline, seed=61023, repetitions=2000):
    a, _ = race_scores(frame, candidate)
    b, _ = race_scores(frame, baseline)
    deltas = pd.DataFrame({'date': a.date, 'accuracy_gain': a.top_one-b.top_one,
                          'log_loss_gain': b.log_loss-a.log_loss, 'brier_gain': b.brier-a.brier})
    # Resample whole days so shared weather, meetings and runner conditions stay together.
    days = deltas.groupby('date').agg(n=('accuracy_gain', 'size'), accuracy_gain=('accuracy_gain', 'sum'),
                                     log_loss_gain=('log_loss_gain', 'sum'), brier_gain=('brier_gain', 'sum'))
    rng = np.random.default_rng(seed)
    draws = rng.integers(0, len(days), size=(repetitions, len(days)))
    result = {}
    for key in ('accuracy_gain', 'log_loss_gain', 'brier_gain'):
        samples = days[key].to_numpy()[draws].sum(axis=1) / days.n.to_numpy()[draws].sum(axis=1)
        result[key] = {'mean': float(deltas[key].mean()), 'ci95': [float(x) for x in np.quantile(samples, [.025, .975])]}
    return result
