"""
Easing Module (AI Director support).
Professional easing curves so motion feels human and polished instead of
robotic linear motion.

All curves take p in [0,1] and return t in [0,1].
"""

import logging

logger = logging.getLogger(__name__)


def ease_out(p):
    return 1 - (1 - p) ** 3


# Registry: currently only the cubic ease-out is used by the effect director.
CURVES = {
    "ease_out": ease_out,
}


def apply(name, p):
    name = name or "ease_out"
    return CURVES.get(name, ease_out)(min(max(float(p), 0.0), 1.0))
