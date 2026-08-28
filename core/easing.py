"""
Easing Module (AI Director support).
Professional easing curves so motion feels human and polished instead of
robotic linear motion. Research: natural easing (ease-out-back / elastic)
is what separates premium motion from default tool output.

All curves take p in [0,1] and return t in [0,1].
"""

import logging
import math

logger = logging.getLogger(__name__)


def linear(p):
    return p


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in(p):
    return p ** 3


def ease_in_out(p):
    if p < 0.5:
        return 4 * p ** 3
    return 1 - (-2 * p + 2) ** 3 / 2


def ease_out_back(p):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2


def elastic_out(p):
    if p <= 0:
        return 0
    if p >= 1:
        return 1
    c4 = (2 * math.pi) / 3
    return 2 ** (-10 * p) * math.sin((p * 10 - 0.75) * c4) + 1


def bounce_out(p):
    n1 = 7.5625
    d1 = 2.75
    if p < 1 / d1:
        return n1 * p * p
    elif p < 2 / d1:
        p -= 1.5 / d1
        return n1 * p * p + 0.75
    elif p < 2.5 / d1:
        p -= 2.25 / d1
        return n1 * p * p + 0.9375
    else:
        p -= 2.625 / d1
        return n1 * p * p + 0.984375


def ease_out_cubic(p):
    return 1 - (1 - p) ** 3


def ease_out_quad(p):
    return 1 - (1 - p) * (1 - p)


CURVES = {
    "linear": linear,
    "ease_out": ease_out,
    "ease_in": ease_in,
    "ease_in_out": ease_in_out,
    "ease_out_back": ease_out_back,
    "elastic_out": elastic_out,
    "bounce_out": bounce_out,
    "ease_out_cubic": ease_out_cubic,
    "ease_out_quad": ease_out_quad,
}


def apply(name, p):
    name = name or "ease_out"
    return CURVES.get(name, ease_out)(min(max(float(p), 0.0), 1.0))