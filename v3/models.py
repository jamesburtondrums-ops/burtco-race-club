"""Learned ability models. No market features or runner identity inputs."""
import numpy as np
from scipy.optimize import minimize
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

META = {'race_id', 'date', 'horse', 'code', 'won', 'position', 'sp'}


def normalise(raw, groups, temperature=1.):
    raw = np.clip(np.asarray(raw, dtype=float), 1e-12, None) ** (1 / temperature)
    _, inverse = np.unique(np.asarray(groups), return_inverse=True)
    totals = np.bincount(inverse, weights=raw)
    return raw / totals[inverse]


class RaceSoftmax:
    """Conditional multinomial likelihood: one winner per race; race-balanced objective."""
    def fit(self, X, y, groups):
        self.imputer = SimpleImputer(add_indicator=True, keep_empty_features=True)
        self.scale = StandardScaler()
        Z = self.scale.fit_transform(self.imputer.fit_transform(X))
        _, inv = np.unique(groups, return_inverse=True)
        count = inv.max() + 1
        def objective(beta):
            scores = Z @ beta
            maxes = np.full(count, -np.inf)
            np.maximum.at(maxes, inv, scores)
            exp = np.exp(scores-maxes[inv])
            sums = np.bincount(inv, weights=exp)
            prob = exp / sums[inv]
            loss = -np.sum(y * np.log(np.clip(prob, 1e-15, 1))) / count + .01 * np.sum(beta ** 2)
            grad = Z.T @ (prob-y) / count + .02 * beta
            return loss, grad
        fit = minimize(objective, np.zeros(Z.shape[1]), jac=True, method='L-BFGS-B', options={'maxiter': 120})
        if not np.isfinite(fit.fun):
            raise ValueError('Rank model did not fit')
        self.beta = fit.x
        return self

    def scores(self, X):
        Z = self.scale.transform(self.imputer.transform(X))
        return np.exp(np.clip(Z @ self.beta, -30, 30))


class AbilityModel:
    def __init__(self, name, columns, seed=61023):
        self.name, self.columns, self.seed = name, columns, seed
        self.models = {}

    def fit(self, frame):
        if self.name == 'boosted_no_handicap':
            self.columns = [c for c in self.columns if not any(s in c for s in ('rating', 'mark_', 'below_last_win', 'class_drop'))]
        if self.name == 'boosted_no_connections':
            self.columns = [c for c in self.columns if not any(s in c for s in ('trainer', 'jockey', 'sire'))]
        y = frame.won.to_numpy()
        X = frame[self.columns].to_numpy(dtype=float)
        with threadpool_limits(limits=4):
            if self.name == 'race_softmax':
                self.model = RaceSoftmax().fit(X, y, frame.race_id.to_numpy())
            elif self.name == 'logistic':
                self.model = make_pipeline(SimpleImputer(add_indicator=True, keep_empty_features=True), StandardScaler(),
                                           LogisticRegression(C=.1, max_iter=250, random_state=self.seed))
                self.model.fit(X, y, logisticregression__sample_weight=1 / frame.field_size.to_numpy())
            elif self.name == 'specialists':
                self.model = AbilityModel('boosted_small', self.columns, self.seed).fit(frame)
                for code in ('turf', 'aw', 'jumps'):
                    subset = frame[frame.code == code]
                    if subset.race_id.nunique() >= 1500:
                        self.models[code] = AbilityModel('boosted_small', self.columns, self.seed).fit(subset)
            elif self.name == 'ensemble':
                self.models = {name: AbilityModel(name, self.columns, self.seed).fit(frame)
                               for name in ('race_softmax', 'boosted_small')}
            else:
                self.model = HistGradientBoostingClassifier(max_iter=130, learning_rate=.07,
                    max_leaf_nodes=31 if self.name == 'boosted_deep' else 15,
                    min_samples_leaf=80, l2_regularization=3., early_stopping=False, random_state=self.seed)
                self.model.fit(X, y, sample_weight=1 / frame.field_size.to_numpy())
        return self

    def predict(self, frame, temperature=1.):
        groups = frame.race_id.to_numpy()
        with threadpool_limits(limits=4):
            if self.name == 'ensemble':
                p = np.mean([m.predict(frame) for m in self.models.values()], axis=0)
            elif self.name == 'specialists':
                p = self.model.predict(frame)
                for code, model in self.models.items():
                    mask = (frame.code == code).to_numpy()
                    if mask.any():
                        p[mask] = model.predict(frame.loc[mask])
            elif self.name == 'race_softmax':
                p = self.model.scores(frame[self.columns].to_numpy(dtype=float))
            else:
                p = self.model.predict_proba(frame[self.columns].to_numpy(dtype=float))[:, 1]
        return normalise(p, groups, temperature)
