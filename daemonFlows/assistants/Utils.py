"""
utils.py
Common utility functions for data processing.
"""

import math
import time
from typing import List

def now_ms() -> int:
    return int(time.time() * 1000)

def chunk_list(data: List, size: int) -> List[List]:
    return [data[i : i + size] for i in range(0, len(data), size)]

def flatten(list_of_lists: List[List]) -> List:
    return [item for sublist in list_of_lists for item in sublist]

def mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0
