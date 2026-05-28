"""Offline 3-way merge (2.5).

Given (base, server, local) text, attempts a line-based diff3 merge.
On clean merge we return the merged text. On conflict we return the
text with standard ``<<<<<<<`` / ``=======`` / ``>>>>>>>`` markers so
the client can prompt the user to resolve.

Implementation uses ``difflib.SequenceMatcher`` to walk the three-way
diff. This is intentionally simple — it handles the common cases
(non-overlapping edits, identical edits, true conflicts) without
pulling in a third-party diff3 library.
"""
from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher


@dataclass
class MergeResult:
    text: str
    conflicts: int


def _split_lines(text: str) -> list[str]:
    return text.splitlines(keepends=True) if text else []


def _detect_changes(base: list[str], side: list[str]) -> dict[int, tuple[str, list[str]]]:
    """Return {base_index: (tag, replacement_lines)} for every change in side vs base."""
    matcher = SequenceMatcher(a=base, b=side, autojunk=False)
    changes: dict[int, tuple[str, list[str]]] = {}
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        # Record one entry keyed by the starting base index of the block.
        changes[i1] = (tag, list(side[j1:j2]))
        # For pure inserts the replacement region in base is empty; we
        # still store ``i2 - i1 = 0`` so the merge loop can advance correctly.
        changes[i1] = (tag, list(side[j1:j2]) if tag != "delete" else [])
        # Cache the base-range length so the merger can advance correctly
        # when applying the change.
        changes[i1 + 0.5] = (tag, [str(i2 - i1)])  # sneaky length marker
    return changes


def three_way_merge(base: str, server: str, local: str) -> MergeResult:
    """diff3 merge: combine ``server`` and ``local`` against ``base``."""
    base_lines = _split_lines(base)
    server_lines = _split_lines(server)
    local_lines = _split_lines(local)

    # Trivial cases first
    if server == local:
        return MergeResult(text=server, conflicts=0)
    if base == server:
        return MergeResult(text=local, conflicts=0)
    if base == local:
        return MergeResult(text=server, conflicts=0)

    server_changes = _changes_by_base_index(base_lines, server_lines)
    local_changes = _changes_by_base_index(base_lines, local_lines)

    merged: list[str] = []
    conflicts = 0
    i = 0
    while i < len(base_lines):
        srv = server_changes.get(i)
        loc = local_changes.get(i)
        if srv is None and loc is None:
            merged.append(base_lines[i])
            i += 1
            continue
        if srv is not None and loc is None:
            merged.extend(srv.replacement)
            i += srv.base_length
            continue
        if loc is not None and srv is None:
            merged.extend(loc.replacement)
            i += loc.base_length
            continue
        # Both sides changed this region.
        if srv.replacement == loc.replacement and srv.base_length == loc.base_length:
            merged.extend(srv.replacement)
            i += srv.base_length
        else:
            conflicts += 1
            merged.append("<<<<<<< server\n")
            merged.extend(srv.replacement)
            merged.append("=======\n")
            merged.extend(loc.replacement)
            merged.append(">>>>>>> local\n")
            i += max(srv.base_length, loc.base_length, 1)

    # Tail inserts past the end of base
    tail_srv = server_changes.get(len(base_lines))
    tail_loc = local_changes.get(len(base_lines))
    if tail_srv is not None and tail_loc is not None:
        if tail_srv.replacement == tail_loc.replacement:
            merged.extend(tail_srv.replacement)
        else:
            conflicts += 1
            merged.append("<<<<<<< server\n")
            merged.extend(tail_srv.replacement)
            merged.append("=======\n")
            merged.extend(tail_loc.replacement)
            merged.append(">>>>>>> local\n")
    elif tail_srv is not None:
        merged.extend(tail_srv.replacement)
    elif tail_loc is not None:
        merged.extend(tail_loc.replacement)

    return MergeResult(text="".join(merged), conflicts=conflicts)


# --- helpers ---

@dataclass
class _Change:
    base_length: int
    replacement: list[str]


def _changes_by_base_index(base: list[str], side: list[str]) -> dict[int, _Change]:
    matcher = SequenceMatcher(a=base, b=side, autojunk=False)
    out: dict[int, _Change] = {}
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        out[i1] = _Change(base_length=i2 - i1, replacement=list(side[j1:j2]))
    return out
