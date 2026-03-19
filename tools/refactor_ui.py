from __future__ import annotations

import pathlib
import re


def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[1]
    p = root / "app" / "main.py"
    text = p.read_text(encoding="utf-8")

    # Replace the huge inline HTML page with a FileResponse serving app/ui/index.html
    pat = re.compile(
        r'@app\.get\("/ui",\s*response_class=HTMLResponse,\s*include_in_schema=False\)\n'
        r"async def ui_page\(\) -> str:\n"
        r"(?:    .*\n)*?"
        r'    return """[\s\S]*?^    """\n',
        re.M,
    )
    m = pat.search(text)
    if not m:
        raise SystemExit("ui_page block not found; aborting")

    replacement = (
        '@app.get("/ui", response_class=HTMLResponse, include_in_schema=False)\n'
        "async def ui_page() -> FileResponse:\n"
        '    """前端页面已移动到 app/ui/index.html，避免 main.py 臃肿。"""\n'
        '    return FileResponse("app/ui/index.html")\n'
        "\n"
    )
    text2 = pat.sub(replacement, text, count=1)

    # Ensure import includes FileResponse.
    text2 = text2.replace(
        "from fastapi.responses import HTMLResponse",
        "from fastapi.responses import FileResponse, HTMLResponse",
    )

    p.write_text(text2, encoding="utf-8", newline="\n")
    print("ok: updated app/main.py")


if __name__ == "__main__":
    main()
