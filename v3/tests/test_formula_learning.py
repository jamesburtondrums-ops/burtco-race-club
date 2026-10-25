import numpy as np
import pandas as pd
from v3.formula_refine import LearnedBlend,learn_weights


def test_blend_weights_are_learned_from_winner_likelihood_and_stay_on_simplex():
    good=np.array([.8,.2,.2,.8])
    poor=np.array([.2,.8,.8,.2])
    weights=learn_weights([good,poor],[1,0,0,1])
    assert weights[0]>.999
    assert np.all(weights>=0)
    assert np.isclose(weights.sum(),1)


def test_blend_and_calibration_preserve_complete_field_probability_mass():
    class Component:
        columns=['typed__official_rating']
        def __init__(self,p):self.p=np.array(p)
        def predict(self,frame):return self.p
    frame=pd.DataFrame({'race_id':['r1','r1','r2','r2']})
    blend=LearnedBlend([Component([.8,.2,.3,.7]),Component([.6,.4,.5,.5])],[.7,.3])
    p=blend.predict(frame,temperature=1.2)
    assert np.isclose(p[:2].sum(),1)
    assert np.isclose(p[2:].sum(),1)
    assert np.all((p>0)&(p<1))
