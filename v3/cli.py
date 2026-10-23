import argparse
import json
import pickle
from datetime import datetime, timedelta, timezone
from pathlib import Path


def advance_history(root):
    from .records import Ledger, timestamp
    root = Path(root)
    with (root / 'history-latest.pkl').open('rb') as handle:
        history = pickle.load(handle)
    ledger = Ledger(root / 'predictions.sqlite')
    ledger.verify()
    predictions = {r['race_id']: r['payload'] for r in ledger.rows('prediction')}
    results = {r['race_id']: r['payload'] for r in ledger.rows('result')}
    pending_days = {timestamp(p['off_at']).date() for rid, p in predictions.items() if rid not in results}
    days = {}
    for event in ledger.rows('result'):
        pred = predictions[event['race_id']]
        day = timestamp(pred['off_at']).date()
        if (history.last_day and day <= history.last_day) or day >= datetime.now(timezone.utc).date():
            continue
        rows = days.setdefault(day, [])
        for runner in pred['source_snapshot']['runners']:
            rows.append(dict(runner, ran=len(pred['ranking']), pos=event['payload']['finishes'][runner['horse']]))
    for day, rows in sorted(days.items()):
        if any(pending <= day and (not history.last_day or pending > history.last_day) for pending in pending_days):
            break
        history.incorporate(rows, day)
    temporary = root / 'history-latest.tmp'
    with temporary.open('wb') as output:
        pickle.dump(history, output)
    temporary.replace(root / 'history-latest.pkl')
    return {'history_as_of': str(history.last_day),
            'completed_days_added': sum(day <= history.last_day for day in days) if history.last_day else 0,
            'pending_result_days': sorted(str(d) for d in pending_days), 'model_parameters_changed': False}


def new_cycle(root, destination, protocol):
    """A fresh development cycle retires old outcomes and requires a genuinely later holdout."""
    from .experiment import save
    from .governance import assert_unopened_period
    assert_unopened_period(protocol)
    root, destination = Path(root), Path(destination)
    previous = json.loads((root / 'final-use.json').read_text())
    if not destination.exists():
        destination.mkdir(parents=True)
    elif any(destination.iterdir()):
        raise ValueError('Next cycle destination must be empty')
    old_end = previous['period'][1]
    if protocol['validation_end'] < old_end or protocol['final_start'] <= old_end:
        raise ValueError('Previously evaluated outcomes must be development-only; reserve a later final period')
    if (datetime.fromisoformat(protocol['final_start']) - datetime.fromisoformat(protocol['validation_end'])).days <= protocol['embargo_days']:
        raise ValueError('Next cycle needs an embargo after development')
    save(destination / 'protocol.json', protocol)
    save(destination / 'retired-periods.json', {'previous_final': previous, 'rule': 'Never report this old period as unseen again.'})
    return {'workspace': str(destination), 'status': 'NEW_CYCLE_RESERVED', 'next': 'Acquire updated source, prepare, develop, freeze, evaluate once.'}


def main():
    parser = argparse.ArgumentParser(description='Racing Intelligence v3')
    parser.add_argument('command', choices=['acquire', 'inventory', 'prepare', 'develop', 'freeze', 'evaluate-final', 'predict',
                                           'record-result', 'score-records', 'advance-history', 'new-cycle', 'reports', 'serve', 'rebuild-runtime'])
    parser.add_argument('--workspace', default='v3/workspace')
    parser.add_argument('--protocol', default='v3/protocol.json')
    parser.add_argument('--input')
    parser.add_argument('--destination')
    parser.add_argument('--port', type=int, default=8763)
    args = parser.parse_args()
    root = Path(args.workspace)
    root.mkdir(parents=True, exist_ok=True)
    protocol = json.loads(Path(args.protocol).read_text())
    if args.command == 'rebuild-runtime':
        from .runtime import rebuild_runtime
        return rebuild_runtime(root)
    if args.command == 'acquire':
        from .acquire import acquire
        return acquire(root / 'raw')
    if args.command == 'prepare':
        if (root / 'final-use.json').exists():
            raise ValueError('Final period opened; use new-cycle with a later holdout')
        from .prepare import prepare
        return prepare(root, protocol)
    if args.command in ('develop', 'evaluate-final'):
        from .experiment import develop, final_evaluate
        return (develop if args.command == 'develop' else final_evaluate)(root, protocol)
    if args.command == 'freeze':
        from .experiment import freeze_configuration
        return print(json.dumps(freeze_configuration(root, protocol), indent=2))
    if args.command == 'inventory':
        from .report import inventory
        return inventory()
    if args.command == 'reports':
        from .report import export_reports
        return export_reports(root)
    if args.command == 'serve':
        from .server import serve
        return serve(root, args.port)
    if args.command == 'new-cycle':
        print(json.dumps(new_cycle(root, args.destination, protocol)))
        return
    if args.command == 'advance-history':
        print(json.dumps(advance_history(root)))
        return
    from .predict import predict, record_result, score_records
    if args.command == 'score-records':
        print(json.dumps(score_records(root)))
    else:
        if not args.input:
            parser.error('--input is required')
        payload = json.loads(Path(args.input).read_text(encoding='utf-8'))
        print(json.dumps((predict if args.command == 'predict' else record_result)(root, payload), indent=2))


if __name__ == '__main__':
    main()
