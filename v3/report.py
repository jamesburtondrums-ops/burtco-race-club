import hashlib
import json
from pathlib import Path
from .experiment import save


def inventory():
    paths = list(Path('data').rglob('*.json')) + list(Path('research').rglob('*.json')) + list(Path('functions/_private').glob('*.json'))
    files = []
    for path in sorted(paths):
        raw = path.read_bytes()
        value = json.loads(raw)
        stamps = {k: value[k] for k in ('createdAt', 'collectedAt', 'verifiedAt', 'updatedAt', 'asOf', 'date', 'sourceCheckedAt')
                  if isinstance(value, dict) and k in value}
        files.append({'path': path.as_posix(), 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                      'recorded_timestamps': stamps, 'independently_verified_point_in_time': False})
    result = {'files': files, 'file_count': len(files), 'source_policy': 'Retain original records. Dates and git commit times alone do not certify pre-race publication or field completeness.'}
    Path('v3/reports').mkdir(parents=True, exist_ok=True)
    save('v3/reports/source-inventory.json', result)
    print(json.dumps({'inventoried_source_files': len(files)}))


def report_bundle(root):
    root = Path(root)
    bundle = {'title': 'Racing Intelligence v3', 'production_decision': 'RETAIN_ORIGINAL'}
    for label, filename in [('audit', 'data-audit.json'), ('development', 'development-report.json'),
                            ('final', 'final-report.json'), ('frozen', 'frozen-config.json')]:
        path = root / filename
        bundle[label] = json.loads(path.read_text()) if path.exists() else None
    # A clean checkout retains the recorded experiment even when its ignored runtime is absent.
    if all(bundle[label] is None for label in ('audit', 'development', 'final', 'frozen')):
        saved = Path(__file__).with_name('reports') / 'summary.json'
        if saved.exists():
            bundle = json.loads(saved.read_text(encoding='utf-8'))
            bundle['report_origin'] = 'COMMITTED_PREVIOUS_EXPERIMENT_NOT_A_NEW_EVALUATION'
    runtime = root / 'runtime-rebuild.json'
    bundle['runtime'] = json.loads(runtime.read_text()) if runtime.exists() else {
        'status': 'AVAILABLE' if (root / 'model.pkl').exists() else 'MODEL_NOT_INSTALLED',
        'historical_report_applies_to_runtime': False}
    return bundle


def export_reports(root):
    output = Path('v3/reports')
    output.mkdir(parents=True, exist_ok=True)
    bundle = report_bundle(root)
    save(output / 'summary.json', bundle)
    manifest = Path(root) / 'raw/manifest.json'
    if manifest.exists():
        save(output / 'data-source.json', json.loads(manifest.read_text()))
    if bundle['final']:
        result = bundle['final']
        candidate = result['candidate']
        lines = ['# Racing Intelligence v3 — completed experiment', '',
                 f"Decision: **{result['promotion']['decision']}**. Candidate: **{result['selected']}**.",
                 f"Reserved period: {result['period'][0]} through {result['period'][1]}.",
                 f"{candidate['races']:,} races; {candidate['runners']:,} runners.", '',
                 '| Method | Top one | Top two | Top three | Race log loss | Race Brier |',
                 '|---|---:|---:|---:|---:|---:|']
        for name, data in [('v3 candidate', candidate), ('Uniform', result['uniform']),
                           ('Retrospective starting-price reference', result.get('retrospective_sp_baseline'))]:
            if data:
                lines.append(f"| {name} | {data['top_one']:.2%} | {data['top_two']:.2%} | {data['top_three']:.2%} | {data['log_loss']:.4f} | {data['brier']:.4f} |")
        lines += ['', 'This is a one-use, later-period archive evaluation. Archive reconstruction is provisional: source snapshots and contemporaneous declaration/ratings versions are unavailable.', '', 'Promotion blockers:']
        lines += ['- ' + x for x in result['promotion']['blockers']]
        lines += ['', 'Early-price returns, paid-place profitability and drawdown are unavailable without timestamped executable prices and bookmaker terms. Top-three finishing frequency is not a paid-place strike rate.', '',
                  'Models learn from independent ability features. Current starting prices are excluded from inputs and shown only as a retrospective reference. No 25% reference is treated as an identical-race original-model result.', '',
                  'Data: Delta Romeo, Horse Racing results — UK/Ireland 1988–2026, Kaggle; Community Data License Agreement – Sharing 1.0. Exact download URL and SHA-256 are in data-source.json.']
        (output / 'experiment.md').write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps({'reports': str(output.resolve())}))
