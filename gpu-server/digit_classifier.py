"""
digit_classifier.py — SVHN-style jersey number classifier.

A small CNN trained on jersey-number crops (SVHN-style, two digit heads)
is consistently more accurate than general OCR for the constrained
jersey-number problem (digits only, 1–99, 1–2 characters). This module
provides the inference wrapper; weights are fine-tuned offline and
fetched at container startup from JERSEY_DIGIT_MODEL_URL (cached under
MODEL_WEIGHTS_DIR), never bundled into the Docker image.

When no weights are configured or the download fails, `available` is
False and jersey_ocr.py falls back to EasyOCR alone — fully backward
compatible.

Output space is constrained to 1–99 by construction:
  head_tens:  11 classes (blank + 0–9)   [blank = single-digit number]
  head_units: 10 classes (0–9)
and the decoded value 0 is rejected.
"""

from __future__ import annotations

import os

import numpy as np

WEIGHTS_DIR = os.environ.get("MODEL_WEIGHTS_DIR", "/app/weights")
MODEL_URL_ENV = "JERSEY_DIGIT_MODEL_URL"
MODEL_FILENAME = "jersey_digit_cnn.pt"
INPUT_SIZE = 64  # square grayscale input


def _build_model():
    import torch.nn as nn

    class JerseyDigitCNN(nn.Module):
        """Compact SVHN-style CNN: 3 conv blocks + two classification heads."""

        def __init__(self):
            super().__init__()
            def block(cin, cout):
                return nn.Sequential(
                    nn.Conv2d(cin, cout, 3, padding=1),
                    nn.BatchNorm2d(cout),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(cout, cout, 3, padding=1),
                    nn.BatchNorm2d(cout),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(2),
                )
            self.features = nn.Sequential(
                block(1, 32), block(32, 64), block(64, 128),
                nn.AdaptiveAvgPool2d(4),
            )
            self.trunk = nn.Sequential(
                nn.Flatten(), nn.Linear(128 * 16, 256), nn.ReLU(inplace=True), nn.Dropout(0.3),
            )
            self.head_tens = nn.Linear(256, 11)   # blank + 0-9
            self.head_units = nn.Linear(256, 10)  # 0-9

        def forward(self, x):
            z = self.trunk(self.features(x))
            return self.head_tens(z), self.head_units(z)

    return JerseyDigitCNN()


def fetch_weights() -> str | None:
    """Download the fine-tuned weights at container startup, if configured."""
    url = os.environ.get(MODEL_URL_ENV)
    if not url:
        return None
    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    dest = os.path.join(WEIGHTS_DIR, MODEL_FILENAME)
    if os.path.exists(dest):
        return dest
    try:
        import urllib.request
        print(f"⬇ Fetching jersey digit model: {url[:80]}…")
        urllib.request.urlretrieve(url, dest)
        return dest
    except Exception as exc:
        print(f"⚠ jersey digit model download failed: {exc}")
        return None


class JerseyDigitClassifier:
    """Singleton-ish wrapper. Use `get_classifier()` rather than constructing."""

    def __init__(self):
        self.available = False
        self._model = None
        self._device = "cpu"
        path = fetch_weights()
        if path is None:
            return
        try:
            import torch
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
            model = _build_model()
            state = torch.load(path, map_location=self._device)
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            model.load_state_dict(state)
            model.eval().to(self._device)
            self._model = model
            self.available = True
            print(f"✓ Jersey digit classifier loaded ({self._device})")
        except Exception as exc:
            print(f"⚠ jersey digit classifier load failed, using EasyOCR only: {exc}")

    def predict(self, crop_bgr: np.ndarray) -> tuple[int, float] | None:
        """Classify a preprocessed number-region crop. Returns (number, conf)
        with number in 1–99, or None if unavailable / low confidence."""
        if not self.available or crop_bgr is None or crop_bgr.size == 0:
            return None
        try:
            import cv2
            import torch
            gray = (cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
                    if crop_bgr.ndim == 3 else crop_bgr)
            gray = cv2.resize(gray, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)
            x = torch.from_numpy(gray.astype(np.float32) / 255.0)
            x = x.unsqueeze(0).unsqueeze(0).to(self._device)
            with torch.no_grad():
                logits_t, logits_u = self._model(x)
                p_t = torch.softmax(logits_t, dim=1)[0]
                p_u = torch.softmax(logits_u, dim=1)[0]
            t_idx = int(p_t.argmax())
            u_idx = int(p_u.argmax())
            conf = float(p_t[t_idx]) * float(p_u[u_idx])
            number = u_idx if t_idx == 0 else (t_idx - 1) * 10 + u_idx
            if not (1 <= number <= 99):
                return None
            return (number, conf)
        except Exception:
            return None


_classifier: JerseyDigitClassifier | None = None


def get_classifier() -> JerseyDigitClassifier:
    global _classifier
    if _classifier is None:
        _classifier = JerseyDigitClassifier()
    return _classifier
