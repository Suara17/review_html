from pathlib import Path
import re
import json
import html

root = Path(r"E:/面试/review_html")
md_path = root / "MinerU_markdown_代码随想录知识星球精华（最强八股文）第五版（计算机基础篇）_2058408209875202048.md"
template_path = root / "python.html"

text = md_path.read_text(encoding="utf-8")
lines = text.splitlines()
template = template_path.read_text(encoding="utf-8")

heading_positions = []
for idx, line in enumerate(lines):
    if line.startswith("# "):
        heading_positions.append((idx, line[2:].strip()))

position_by_title = {}
for idx, title in heading_positions:
    position_by_title.setdefault(title, idx)

sections = {
    "computer-network": {
        "page_title": "计算机网络知识点动态展示 - 精讲版",
        "sidebar_title": "计算机网络高频知识点",
        "page_id": "computer-network",
        "output": root / "computer-network.html",
        "ranges": [("计算机⽹络", "操作系统")],
    },
    "operating-system": {
        "page_title": "操作系统知识点动态展示 - 精讲版",
        "sidebar_title": "操作系统高频知识点",
        "page_id": "operating-system",
        "output": root / "operating-system.html",
        "ranges": [("操作系统", "数据库-MySQL"), ("计算机系统&Linux", "场景题 & 系统设计")],
    },
    "mysql-topics": {
        "page_title": "MySQL知识点动态展示 - 精讲版",
        "sidebar_title": "MySQL 高频知识点",
        "page_id": "mysql-topics",
        "output": root / "mysql-topics.html",
        "ranges": [("数据库-MySQL", "数据库-Redis")],
    },
    "redis-topics": {
        "page_title": "Redis知识点动态展示 - 精讲版",
        "sidebar_title": "Redis 高频知识点",
        "page_id": "redis-topics",
        "output": root / "redis-topics.html",
        "ranges": [("数据库-Redis", "设计模式")],
    },
    "design-patterns-topics": {
        "page_title": "设计模式知识点动态展示 - 精讲版",
        "sidebar_title": "设计模式高频知识点",
        "page_id": "design-patterns-topics",
        "output": root / "design-patterns-topics.html",
        "ranges": [("设计模式", "计算机系统&Linux")],
    },
    "system-design-topics": {
        "page_title": "系统设计场景题动态展示 - 精讲版",
        "sidebar_title": "场景题与系统设计",
        "page_id": "system-design-topics",
        "output": root / "system-design-topics.html",
        "ranges": [("场景题 & 系统设计", None)],
    },
}


def chunk_to_html(chunk_lines):
    parts = []
    paragraph = []
    list_items = []
    in_code = False
    code_lines = []
    code_lang = ""
    in_table = False
    table_lines = []

    def flush_paragraph():
        nonlocal paragraph
        if paragraph:
            content = "".join(s.strip() for s in paragraph).strip()
            if content:
                parts.append(f"<p>{html.escape(content)}</p>")
            paragraph = []

    def flush_list():
        nonlocal list_items
        if list_items:
            items_html = "".join(f"<li>{html.escape(item)}</li>" for item in list_items if item.strip())
            if items_html:
                parts.append(f"<ul>{items_html}</ul>")
            list_items = []

    def flush_code():
        nonlocal code_lines, code_lang
        code = "\n".join(code_lines).rstrip("\n")
        class_attr = f' class="language-{html.escape(code_lang)}"' if code_lang else ""
        parts.append(f"<pre><code{class_attr}>{html.escape(code)}</code></pre>")
        code_lines = []
        code_lang = ""

    def flush_table():
        nonlocal table_lines
        table_html = "\n".join(table_lines).strip()
        if table_html:
            parts.append(table_html)
        table_lines = []

    for raw in chunk_lines:
        line = raw.rstrip("\n")
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            flush_list()
            if in_code:
                flush_code()
                in_code = False
            else:
                in_code = True
                code_lang = stripped[3:].strip()
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        if "<table" in stripped:
            flush_paragraph()
            flush_list()
            in_table = True

        if in_table:
            table_lines.append(line)
            if "</table>" in stripped:
                flush_table()
                in_table = False
            continue

        if not stripped:
            flush_paragraph()
            flush_list()
            continue

        if re.match(r'^(\d+[\.、]|[（(]\d+[)）]|[-*•])\s*', stripped):
            flush_paragraph()
            item = re.sub(r'^(\d+[\.、]|[（(]\d+[)）]|[-*•])\s*', '', stripped)
            list_items.append(item)
            continue

        if re.match(r'^[A-Za-z]+\s*[:：]$', stripped):
            flush_paragraph()
            flush_list()
            parts.append(f"<p><strong>{html.escape(stripped)}</strong></p>")
            continue

        paragraph.append(stripped)

    if in_code:
        flush_code()
    if in_table:
        flush_table()
    flush_paragraph()
    flush_list()

    return "".join(parts).replace("</script>", "<\\/script>").strip()


IRRELEVANT_TEXT_PATTERNS = [
    r"欢迎加入代码随想录知识星球",
    r"点击进入",
    r"代码随想录知识星球精华（最强.*?）第五版为九份PDF",
    r"代码随想录知识星球八股文概述",
    r"本篇为最强.*?计算机基础篇",
    r"大部分内容来自.*?(代码随想录|小林coding|牛客网|博客资料)",
    r"内容参考总结自.*?(小林coding|MySQL45讲|网络资料)",
    r"本部分面试题仅做参考.*",
    r"本部分是一些基础的概念，仅做了解使用",
    r"超高频面试题，从这道题.*?引导到你更熟悉的地方",
    r"超⾼频⾯试题，从这道题.*?引导到你更熟悉的地⽅",
    r"原图链接.*代码随想录.*",
    r"思维导图：",
]



def normalize_plain_text(text):
    return html.unescape(re.sub(r"\s+", "", text or ""))



def strip_irrelevant_text(content_html):
    if not content_html:
        return content_html

    blocks = re.findall(r"(<p>.*?</p>|<ul>.*?</ul>|<pre>.*?</pre>|<table>.*?</table>)", content_html, re.S)
    filtered = []

    for block in blocks:
        if block.startswith("<p>"):
            plain = normalize_plain_text(re.sub(r"<[^>]+>", "", block))
            if any(re.search(pattern, plain, re.I) for pattern in IRRELEVANT_TEXT_PATTERNS):
                continue
        filtered.append(block)

    return "".join(filtered).strip()



def get_text_length(content_html):
    text = re.sub(r"<[^>]+>", "", content_html)
    text = html.unescape(text)
    return len(re.sub(r"\s+", "", text))



def format_embedded_entry(entry):
    return (
        f'<div class="embedded-entry">'
        f'<p class="embedded-entry-title">{html.escape(entry["title"])}</p>'
        f'{entry["content"]}'
        f'</div>'
    )



def is_numbered_title(title):
    return bool(re.match(r"^(\d+[、.．]|[（(]\d+[)）])", title))



def is_step_title(title):
    return bool(re.search(r"第.+步", title))



def is_auxiliary_title(title):
    return title in {
        "面试题", "⾯试题", "概述", "总结", "总结：", "实际应⽤", "实际应用", "应⽤", "应用",
        "实现步骤", "实现步骤：", "使⽤场景", "使用场景", "使⽤场景总结：", "使用场景总结：",
        "主要⻆⾊", "主要角色", "结构图", "结构图："
    }



def should_merge_entry(entry):
    content = entry["content"]
    if any(tag in content for tag in ("<ul>", "<ol>", "<pre>", "<table>")):
        return False
    return get_text_length(content) <= 120



def should_merge_backward(entry, previous_entry):
    if previous_entry is None:
        return False

    title = entry["title"]
    previous_title = previous_entry["title"]

    if is_auxiliary_title(title):
        return True

    if title.endswith(("：", ":")) or title in {"WWW 构建技术（3 项）：", "HTTP 版本："}:
        return True

    if is_numbered_title(title):
        if is_step_title(title):
            return False
        return not is_numbered_title(previous_title)

    if len(title) >= 12 and not title.endswith(("？", "?")) and not any(sep in title for sep in ("/", "-", "：", ":")):
        return True

    return False



def should_merge_forward(entry, previous_entry, next_entry):
    if next_entry is None:
        return False

    title = entry["title"]
    next_title = next_entry["title"]

    if title in {"基础知识讲解", "面试题", "概述"}:
        return True

    if "发生什么" in title or "发⽣什么" in title:
        return True

    if should_merge_entry(entry) and is_step_title(next_title):
        return True

    return False



def merge_short_entries(entries):
    merged = []
    pending_forward = []

    for index, entry in enumerate(entries):
        previous_entry = merged[-1] if merged else None
        next_entry = entries[index + 1] if index + 1 < len(entries) else None

        if should_merge_backward(entry, previous_entry):
            previous_entry["content"] += format_embedded_entry(entry)
            continue

        if should_merge_forward(entry, previous_entry, next_entry):
            pending_forward.append(entry)
            continue

        if pending_forward:
            entry["content"] = "".join(format_embedded_entry(item) for item in pending_forward) + entry["content"]
            pending_forward = []

        merged.append(entry)

    if pending_forward:
        if merged:
            merged[-1]["content"] += "".join(format_embedded_entry(item) for item in pending_forward)
        else:
            merged.extend(pending_forward)

    return merged



def post_process_design_patterns(entries):
    if not entries:
        return entries

    auxiliary_titles = {
        "概述", "概述：", "概念", "定义", "主要构成", "代理模式结构图",
        "UML", "结构图", "结构图：", "实际应⽤", "实际应用", "应⽤", "应用",
        "实现步骤", "实现步骤：", "使⽤场景", "使用场景", "主要⻆⾊", "主要角色",
        "案例", "优点", "缺点", "举例来说："
    }
    drop_titles = {
        "设计模式", "⼯⼚⽅法模式", "装饰模式"
    }
    drop_content_markers = {
        "想要了解更多设计模式，可以查看卡码⽹设计模式精讲",
        "第6章穿什么有这么重要？—装饰模式",
        "代理模式（Proxy）结构图",
        "装饰模式（Decorator）结构图"
    }

    merged = []
    for entry in entries:
        plain_content = normalize_plain_text(re.sub(r"<[^>]+>", "", entry["content"]))

        if entry["title"] in drop_titles and (not plain_content or plain_content in {normalize_plain_text(x) for x in drop_content_markers}):
            continue

        if any(marker in plain_content for marker in {normalize_plain_text(x) for x in drop_content_markers}):
            entry["content"] = strip_irrelevant_text(entry["content"])
            plain_content = normalize_plain_text(re.sub(r"<[^>]+>", "", entry["content"]))
            if not plain_content:
                continue

        if merged and entry["title"] in auxiliary_titles:
            merged[-1]["content"] += format_embedded_entry(entry)
            continue

        merged.append(entry)

    return merged



def parse_entries(range_start, range_end):
    entries = []
    local_headings = [(idx, title) for idx, title in heading_positions if idx >= range_start and idx < range_end]
    for i, (idx, title) in enumerate(local_headings):
        next_idx = local_headings[i + 1][0] if i + 1 < len(local_headings) else range_end
        body_lines = lines[idx + 1:next_idx]
        body_html = strip_irrelevant_text(chunk_to_html(body_lines))
        if not body_html:
            continue
        entries.append({"title": title, "content": body_html})
    return merge_short_entries(entries)


extra_css = """
.content p { margin: 0 0 1em; }
.content ul, .content ol { margin: 0 0 1.2em 1.4em; }
.content li { margin-bottom: 0.45em; }
.content .embedded-entry { margin: 0 0 1.1em; }
.content .embedded-entry-title {
  margin: 0 0 0.55em;
  color: #9fffe7;
  font-weight: 700;
}
.content pre {
  margin: 0 0 1.2em;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0,255,255,0.16);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.92em;
  line-height: 1.7;
}
.content code {
  font-family: 'Consolas', 'SFMono-Regular', monospace;
  color: #9fffe7;
}
.content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1.2em;
  font-size: 0.92em;
  display: block;
  overflow-x: auto;
}
.content th, .content td {
  border: 1px solid rgba(0,255,255,0.18);
  padding: 8px 10px;
  text-align: left;
}
.content th {
  background: rgba(0,255,255,0.08);
  color: #9fffe7;
}
""".strip()

pattern = re.compile(r'const knowledgePoints = \[[\s\S]*?\n\];', re.S)

for config in sections.values():
    entries = []
    for start_title, end_title in config["ranges"]:
        start = position_by_title[start_title]
        end = position_by_title[end_title] if end_title else len(lines)
        entries.extend(parse_entries(start, end))

    if config["page_id"] == "design-patterns-topics":
        entries = post_process_design_patterns(entries)

    page = template
    page = page.replace("<title>Python知识点动态展示 - 精讲版</title>", f"<title>{config['page_title']}</title>")
    page = page.replace("<h3>Python 高频知识点精讲</h3>", f"<h3>{config['sidebar_title']}</h3>")
    page = page.replace("pageId: 'python-notes'", f"pageId: '{config['page_id']}'")
    serialized = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    page = pattern.sub(lambda _: 'const knowledgePoints = ' + serialized + ';', page, count=1)
    if extra_css not in page:
        page = page.replace("</style>", f"\n{extra_css}\n</style>", 1)
    config["output"].write_text(page, encoding="utf-8")
    print(config["output"].name, len(entries))
