"""Main-thread bridge for safe Anki collection access from background threads.

Uses mw.taskman.run_on_main() + concurrent.futures.Future to schedule work
on the Qt main thread and block until it completes.
"""

import concurrent.futures
from functools import wraps

from aqt import mw

_TIMEOUT = 30


def on_main(fn, *args, **kwargs):
    """Call fn(*args, **kwargs) on Anki's main thread, block until done."""
    future = concurrent.futures.Future()

    def _run():
        try:
            future.set_result(fn(*args, **kwargs))
        except Exception as e:
            future.set_exception(e)

    mw.taskman.run_on_main(_run)
    return future.result(timeout=_TIMEOUT)


def main_thread(fn):
    """Decorator: wraps fn so it always executes on the main thread."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        return on_main(fn, *args, **kwargs)

    return wrapper
