#!/usr/bin/env python3
"""Before/after tables from analysis-probe.mjs results (see LOADING.md).

    python3 scripts/perf/summarize.py DIR

DIR holds the probe's --out files named {cold,warm}-{base,new}-<game>-c<cores>-r<n>.json
and paging-{base,new}-<game>-c<cores>.json (cores: 8 or "real").
"""
import glob
import json
import os
import statistics
import sys

CAMP = sys.argv[1]


def load(pattern):
    out = []
    for f in sorted(glob.glob(os.path.join(CAMP, pattern))):
        try:
            out.append(json.load(open(f)))
        except Exception:
            pass
    return out


def med(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    return statistics.median(vals)


def s(v):
    return '–' if v is None else f'{v / 1000:.2f}'


def rng(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return '–'
    if len(vals) == 1:
        return s(vals[0])
    return f'{s(med(vals))} ({s(min(vals))}–{s(max(vals))})'


def retries(runs):
    return sum(1 for d in runs if sum(1 for r in d.get('resources', []) if r['name'].endswith('sf17-79.wasm')) > 1)


games = ['G3MXUHW9', 'YQC4zrpR']
cores = ['8', 'real']
print('## Load (seconds after navigation; median, range in brackets)\n')
for kind in ['warm', 'cold']:
    print(f'### {kind}\n')
    print('| game | cores | build | runs | board shown | first SF depth | SF d18 | Maia moves shown | JS transferred (KB) | SF retries |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for g in games:
        for c in cores:
            for tag, name in [('base', 'main'), ('new', 'branch')]:
                runs = load(f'{kind}-{tag}-{g}-c{c}-r*.json')
                if not runs:
                    continue
                cc = '160' if c == 'real' else c
                print(f"| {g} | {cc} | {name} | {len(runs)} | {rng([d['board'] for d in runs])} | {rng([d['sfFirst'] for d in runs])} | "
                      f"{rng([d['sfD18'] for d in runs])} | {rng([d['maiaFirst'] for d in runs])} | {med([d['jsKB'] for d in runs]):.0f} | {retries(runs)} |")
    print()

def stalls(d):
    """Positions where the depth label stopped below 14 for > 3.5 s while shown."""
    acts = [e for e in d.get('events', []) if e['k'] in ('ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'click')]
    n = 0
    for i, a in enumerate(acts):
        t1 = acts[i + 1]['t'] if i + 1 < len(acts) else d['timeline'][-1]['t'] + 1
        last, lastd = None, None
        for e in d['timeline']:
            if a['t'] < e['t'] < t1 and e['depth'] != lastd:
                last, lastd = e['t'], e['depth']
        if lastd is not None and lastd < 14 and t1 - last > 3500:
            n += 1
    return n


print('## Paging (warm cache; seconds from the key press or click)\n')
print('| game | cores | build | runs | Maia shown after a step (median, max) | first SF depth after a step (median, max) | steps with SF d12 within 2.6 s | Maia after 10 rapid presses | jumps: Maia / SF d12 / SF d18 (median) | SF froze |')
print('|---|---|---|---|---|---|---|---|---|---|')


def mm(vals):
    vv = [v for v in vals if v is not None]
    missing = len(vals) - len(vv)
    txt = f"{s(med(vv))}, {s(max(vv))}" if vv else '–'
    return txt + (f' ({missing} of {len(vals)} none)' if missing else '')


def med_none(vals):
    vv = [v for v in vals if v is not None]
    txt = s(med(vv)) if vv else '–'
    missing = len(vals) - len(vv)
    return txt + (f' ({missing}/{len(vals)} none)' if missing else '')


for g in games:
    for c in cores:
        for tag, name in [('base', 'main'), ('new', 'branch')]:
            runs = load(f'paging-{tag}-{g}-c{c}.json') + load(f'paging-{tag}-{g}-c{c}-r*.json')
            if not runs:
                continue
            steps = [p for d in runs for p in d['paging'] if p['name'].startswith('step')]
            rapid = [p['maia'] for d in runs for p in d['paging'] if p['name'].startswith('after 10')]
            jumps = [p for d in runs for p in d['paging'] if p['name'].startswith('jump')]
            d12 = sum(1 for p in steps if p['sfD12'] is not None)
            cc = '160' if c == 'real' else c
            print(f"| {g} | {cc} | {name} | {len(runs)} | {mm([p['maia'] for p in steps])} | {mm([p['sf'] for p in steps])} | "
                  f"{d12} of {len(steps)} | {s(med(rapid))} | {med_none([p['maia'] for p in jumps])} / "
                  f"{med_none([p['sfD12'] for p in jumps])} / {med_none([p['sfD18'] for p in jumps])} | {sum(stalls(d) for d in runs)} |")
print()
for tag, name in [('base', 'main'), ('new', 'branch')]:
    runs = load(f'*-{tag}-*.json')
    print(f'{name}: Stockfish set up twice (NNUE retry) in {retries(runs)} of {len(runs)} runs')
errs = {}
for f in sorted(glob.glob(os.path.join(CAMP, '*.json'))):
    d = json.load(open(f))
    tag = 'base' if '-base' in os.path.basename(f) else 'new'
    for e in d.get('consoleErrors', []):
        if 'PostHog' in e or 'status of 404' in e or 'onnxruntime' in e:
            continue
        errs.setdefault(tag, {}).setdefault(e[:140], 0)
        errs[tag][e[:140]] += 1
print('other console errors/warnings:', json.dumps(errs, indent=1))
