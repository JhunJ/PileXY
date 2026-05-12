"""One-off: remove _agent_debug_log_6c2724 calls from meissa_api.py"""
from pathlib import Path


def strip_calls(text: str) -> str:
    needle = "_agent_debug_log_6c2724("
    out = []
    i = 0
    while i < len(text):
        idx = text.find(needle, i)
        if idx == -1:
            out.append(text[i:])
            break
        out.append(text[i:idx])
        start = idx + len(needle) - 1
        depth = 0
        j = start
        in_str = None
        esc = False
        while j < len(text):
            c = text[j]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == in_str:
                    in_str = None
            elif c in "\"'":
                in_str = c
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    j += 1
                    while j < len(text) and text[j] in " \t":
                        j += 1
                    if j < len(text) and text[j] == "\r":
                        j += 1
                    if j < len(text) and text[j] == "\n":
                        j += 1
                    i = j
                    break
            j += 1
        else:
            out.append(text[idx:])
            break
    return "".join(out)


def main() -> None:
    path = Path(__file__).resolve().parent.parent / "backend" / "meissa_api.py"
    text = path.read_text(encoding="utf-8")
    text2 = strip_calls(text)
    stub = (
        '\ndef _agent_debug_log_6c2724(*_args: Any, **_kwargs: Any) -> None:\n'
        '    """디버그 세션용(비활성)."""\n'
        "    return\n\n\n"
    )
    text2 = text2.replace(stub, "\n\n")
    path.write_text(text2, encoding="utf-8", newline="\n")
    print("delta", len(text) - len(text2))


if __name__ == "__main__":
    main()
