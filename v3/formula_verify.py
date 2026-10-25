"""Verify the trained forecast path with explicitly synthetic, unpublished runners."""
from datetime import datetime,timedelta,timezone
import json
import os
from pathlib import Path
import tempfile
from .formula_predict import predict
from .records import Ledger


def verify(root='v3/workspace-formula'):
    root=Path(root).resolve()
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        target=Path(temporary)
        for name in ('candidate.pkl','formula-frozen-config.json','history-live.pkl'):
            os.link(root/name,target/name)
        now=datetime.now(timezone.utc)
        rows=[{'horse':'INTEGRATION FIXTURE '+name,'trainer':'Fixture Trainer','jockey':'Fixture Jockey',
            'sire':'Fixture Sire','course':'Fixture Course (AW)','type':'Flat',
            'race_name':'Synthetic Integration Handicap','class':'Class 4','going':'Standard',
            'dist':'6f','or':mark,'age':'4','sex':'G','wgt':weight,'hg':'','draw':draw}
            for name,mark,weight,draw in [('A','60','9-0','1'),('B','62','9-2','2')]]
        snapshot={'race_id':'INTEGRATION_TEST_ONLY_NOT_A_REAL_RACE',
            'cutoff':(now+timedelta(minutes=30)).isoformat(),
            'off_at':(now+timedelta(hours=1)).isoformat(),
            'published_at':(now-timedelta(seconds=10)).isoformat(),
            'observed_at':(now-timedelta(seconds=5)).isoformat(),
            'source_url':'https://example.com/synthetic-test-fixture','declared_runner_count':2,'runners':rows}
        out=predict(target,snapshot)
        assert len(out['forecast']['ranking'])==2
        assert abs(sum(r['win_probability'] for r in out['forecast']['ranking'])-1)<1e-10
        assert Ledger(target/'prospective-predictions.sqlite').verify()
        try:predict(target,dict(snapshot,cutoff=(now-timedelta(seconds=1)).isoformat()))
        except ValueError:pass
        else:raise AssertionError('Expired forecast accepted')
        report={'synthetic_fixture_only':True,'real_race_selections_created':False,
                'trained_artifact_loaded':True,'full_field_probabilities_sum_to_one':True,
                'ledger_verified':True,'expired_cutoff_rejected':True,
                'history_through':out['forecast']['history_through']}
        (root/'integration-verification.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report),flush=True)
        return report


if __name__=='__main__':verify()
