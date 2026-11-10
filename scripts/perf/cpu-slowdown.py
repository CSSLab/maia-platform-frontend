#!/usr/bin/env python3
"""Slow down every thread of a Chromium's renderer processes by SLOWDOWN.

    cpu-slowdown.py MARKER SLOWDOWN [PERIOD_MS]

Chrome's CPU throttling (Emulation.setCPUThrottlingRate) only slows a page's
main thread; Stockfish's and Maia's workers run at full speed. This instead
stops the renderer processes (SIGSTOP) for (1 - 1/SLOWDOWN) of every PERIOD_MS
(default 20) and lets them run (SIGCONT) for the rest, like `cpulimit` but with
a fixed duty cycle, so every thread runs at 1/SLOWDOWN of its speed. On a busy
machine a resumed thread may wait a millisecond or two for its CPU, which
costs a short run window proportionally more: at 4x, a 6 ms period slowed a
JavaScript loop 5.7-6x while ada was ~55% busy, 20 ms 4.1-4.4x, 50 ms 4.1x.
Renderers are the processes with --type=renderer below the browser whose
command line contains MARKER (its profile directory); they are looked for
while stopped, every 20 ms, and "attached" is printed once the first is
found. On exit everything is resumed. With DUTY_STATS set, the measured
average run and stop times are printed to stderr on exit.

With a frequency governor such as schedutil, the pauses also let the cores
clock down, which slows the renderer several times more than intended. Keep
the cores busy with idle-priority spinners while measuring, e.g. for each CPU
the browser runs on: taskset -c CPU chrt -i 0 python3 -c 'while True: pass'
"""
import os
import signal
import sys
import time

marker, slowdown = sys.argv[1], float(sys.argv[2])
period = (float(sys.argv[3]) if len(sys.argv) > 3 else 20.0) / 1000
on = period / slowdown

browsers = set()  # browser processes (MARKER in the command line)
parents = set()  # processes that renderers are forked from (zygotes)
renderers = set()
known = set()  # renderer pids seen
stats = {'on': 0.0, 'off': 0.0, 'n': 0}


def cmdline(pid):
    try:
        with open(f'/proc/{pid}/cmdline', 'rb') as f:
            return f.read()
    except OSError:
        return b''


def children(pid):
    out = []
    try:
        for tid in os.listdir(f'/proc/{pid}/task'):
            with open(f'/proc/{pid}/task/{tid}/children') as f:
                out += [int(c) for c in f.read().split()]
    except OSError:
        pass
    return out


def find_browsers():
    found = set()
    for d in os.listdir('/proc'):
        if d.isdigit():
            cmd = cmdline(d)
            if marker.encode() in cmd and b'--type=' not in cmd:
                found.add(int(d))
    return found


def find_parents():
    """The zygotes, and any other non-renderer process below the browsers."""
    found = set(browsers)
    todo = list(browsers)
    while todo:
        for c in children(todo.pop()):
            if c not in known and b'--type=renderer' not in cmdline(c):
                found.add(c)
                todo.append(c)
    return found


def find_renderers():
    # A child forked by the zygote shows the zygote's command line until it
    # renames itself, so a child that isn't a renderer yet is checked again.
    found = set()
    for p in parents:
        for c in children(p):
            if c in known or b'--type=renderer' in cmdline(c):
                known.add(c)
                found.add(c)
    return found


def signal_all(sig):
    for p in list(renderers):
        try:
            os.kill(p, sig)
        except OSError:
            renderers.discard(p)


def stop(*_):
    signal_all(signal.SIGCONT)
    if os.environ.get('DUTY_STATS'):
        n = max(stats['n'], 1)
        sys.stderr.write(
            f"cpu-slowdown: {stats['n']} cycles, run {stats['on'] / n * 1000:.2f} ms,"
            f" stopped {stats['off'] / n * 1000:.2f} ms, renderers {sorted(renderers)}\n"
        )
    sys.exit(0)


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)

attached = False
next_scan = 0.0
next_parent_scan = 0.0
t = time.perf_counter()
while True:
    t_run = time.perf_counter()
    signal_all(signal.SIGCONT)
    d = t + on - time.perf_counter()
    if d > 0:
        time.sleep(d)
    t_stop = time.perf_counter()
    signal_all(signal.SIGSTOP)
    stats['on'] += t_stop - t_run
    stats['n'] += 1
    # Look for (new) renderers while they are stopped.
    if t_stop >= next_parent_scan:
        if not browsers:
            browsers = find_browsers()
        parents = find_parents()
        next_parent_scan = t_stop + (1.0 if browsers else 0.2)
    if t_stop >= next_scan:
        new = find_renderers() - renderers
        for p in new:
            try:
                os.kill(p, signal.SIGSTOP)
            except OSError:
                continue
            renderers.add(p)
        if renderers and not attached:
            attached = True
            print('attached', flush=True)
        next_scan = t_stop + 0.02
    t += period
    d = t - time.perf_counter()
    if d > 0:
        time.sleep(d)
    else:
        t = time.perf_counter()  # fell behind; don't try to catch up
    stats['off'] += time.perf_counter() - t_stop
