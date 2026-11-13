"""Обучает RandomForest (параметры 1-в-1 как в ForestClasifier.ipynb) и экспортирует в ONNX.

Запуск:
    python ml/export_onnx.py <путь к csv> [--out public/models] [--classes src/lib/crop]

Результат:
    <out>/crop_classifier.onnx   - вход float32 [N, 12], выход `probabilities` float32 [N, 22]
    <classes>/classes.json       - порядок классов (== порядок колонок `probabilities`)
    <classes>/features.json      - порядок 12 признаков (== порядок колонок входа)
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

FEATURES = [
    "N",
    "P",
    "K",
    "ph",
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "RH2M",
    "PRECTOTCORR",
    "ALLSKY_SFC_SW_DWN",
    "GDD",
    "WS2M",
]

ap = argparse.ArgumentParser()
ap.add_argument("csv")
ap.add_argument("--out", default="public/models")
ap.add_argument("--classes", default="src/lib/crop")
args = ap.parse_args()

df = pd.read_csv(args.csv).rename(
    columns={"temperature": "T2M", "humidity": "RH2M", "rainfall": "PRECTOTCORR"}
)
X = df[FEATURES].astype(np.float32)
y = df["label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=12,
    min_samples_split=4,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1,
)
rf.fit(X_train, y_train)
print(f"Accuracy: {accuracy_score(y_test, rf.predict(X_test)) * 100:.2f}%")

onx = convert_sklearn(
    rf,
    initial_types=[("input", FloatTensorType([None, len(FEATURES)]))],
    options={id(rf): {"zipmap": False}},  # probabilities как тензор, без словарей
    target_opset=15,
)

out, cls = Path(args.out), Path(args.classes)
out.mkdir(parents=True, exist_ok=True)
cls.mkdir(parents=True, exist_ok=True)
(out / "crop_classifier.onnx").write_bytes(onx.SerializeToString())
(cls / "classes.json").write_text(json.dumps([str(c) for c in rf.classes_], indent=2))
(cls / "features.json").write_text(json.dumps(FEATURES, indent=2))
print("classes:", len(rf.classes_))

# эталон для сверки в JS-тестах: sklearn-вероятности на первых 5 строках
gold = [
    {"x": X.iloc[i].tolist(), "p": rf.predict_proba(X.iloc[[i]])[0].tolist()}
    for i in range(5)
]
(out.parent.parent / "ml" / "golden.json").write_text(json.dumps(gold))
