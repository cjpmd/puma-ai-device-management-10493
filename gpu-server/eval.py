#!/usr/bin/env python3
"""
Local accuracy evaluation: compare a metadata.json (GPU pipeline output)
against a ground-truth JSON of coach-tagged events.

Ground-truth JSON shape (export from match_event_tags):
    [
      {"event_type": "shot", "timestamp_ms": 124300, "team": "home"},
      {"event_type": "goal", "timestamp_ms": 128100, "team": "home"},
      ...
    ]

metadata.json shape (subset of pipeline output):
    {
      "events": [
        {"type": "shot", "time": 124.1, "team": "A"},
        ...
      ],
      "team_metrics": {...},
      "player_metrics": {...}
    }

Usage:
    python eval.py --pred metadata.json --truth tags.json [--window 5]
"""
from __future__ import annotations
import argparse
import json
import sys
from collections import defaultdict


def canon(t: str) -> str:
    x = (t or "").lower()
    for k in ("goal", "shot", "pass", "tackle", "corner", "foul", "save"):
        if k in x:
            return k
    return x


def score(cv_times: list[float], gt_times: list[float], window_s: float):
    used = set()
    tp = 0
    for g in gt_times:
        best_idx, best_dt = -1, float("inf")
        for i, c in enumerate(cv_times):
            if i in used:
                continue
            dt = abs(c - g)
            if dt <= window_s and dt < best_dt:
                best_idx, best_dt = i, dt
        if best_idx >= 0:
            used.add(best_idx)
            tp += 1
    fp = len(cv_times) - tp
    fn = len(gt_times) - tp
    precision = tp / len(cv_times) if cv_times else 0.0
    recall = tp / len(gt_times) if gt_times else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return dict(gt=len(gt_times), cv=len(cv_times), tp=tp, fp=fp, fn=fn,
                precision=precision, recall=recall, f1=f1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pred", required=True, help="metadata.json from pipeline")
    ap.add_argument("--truth", required=True, help="ground-truth tags JSON")
    ap.add_argument("--window", type=float, default=5.0, help="±seconds for a match")
    args = ap.parse_args()

    with open(args.pred) as f:
        pred = json.load(f)
    with open(args.truth) as f:
        truth = json.load(f)

    cv_events = pred.get("events", [])
    cv_by_type: dict[str, list[float]] = defaultdict(list)
    for e in cv_events:
        cv_by_type[canon(e.get("type", ""))].append(float(e.get("time", 0)))

    gt_by_type: dict[str, list[float]] = defaultdict(list)
    for t in truth:
        gt_by_type[canon(t.get("event_type", ""))].append(int(t.get("timestamp_ms", 0)) / 1000.0)

    all_types = sorted(set(cv_by_type) | set(gt_by_type))

    print(f"\n  Match window: \u00b1{args.window}s\n")
    print(f"  {'event':<14} {'GT':>4} {'CV':>4} {'TP':>4} {'FP':>4} {'FN':>4} "
          f"{'Prec':>6} {'Rec':>6} {'F1':>6}")
    print("  " + "-" * 64)
    tot_tp = tot_fp = tot_fn = 0
    for t in all_types:
        s = score(cv_by_type[t], gt_by_type[t], args.window)
        tot_tp += s["tp"]; tot_fp += s["fp"]; tot_fn += s["fn"]
        print(f"  {t:<14} {s['gt']:>4} {s['cv']:>4} {s['tp']:>4} {s['fp']:>4} {s['fn']:>4} "
              f"{s['precision']*100:>5.0f}% {s['recall']*100:>5.0f}% {s['f1']*100:>5.0f}%")
    print("  " + "-" * 64)
    p = tot_tp / (tot_tp + tot_fp) if (tot_tp + tot_fp) else 0.0
    r = tot_tp / (tot_tp + tot_fn) if (tot_tp + tot_fn) else 0.0
    f1 = (2 * p * r / (p + r)) if (p + r) else 0.0
    print(f"  {'TOTAL':<14} {tot_tp+tot_fn:>4} {tot_tp+tot_fp:>4} {tot_tp:>4} {tot_fp:>4} {tot_fn:>4} "
          f"{p*100:>5.0f}% {r*100:>5.0f}% {f1*100:>5.0f}%\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())