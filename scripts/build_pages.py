from __future__ import annotations

from html import escape
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'topics-data'
REGISTRY_PATH = DATA_DIR / 'registry.json'
TOPIC_TEMPLATE_PATH = ROOT / 'templates' / 'topic-page.template.html'

REQUIRED_GROUP_FIELDS = [
    'slug', 'page_id', 'title', 'sidebar_title', 'description', 'tag', 'output', 'template'
]
REQUIRED_CARD_FIELDS = ['title', 'content']


def load_registry() -> dict:
    registry = json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))
    groups = registry.get('groups')
    if not isinstance(groups, list):
        raise ValueError('registry.json 缺少 groups 数组')
    return registry


def validate_group_meta(group: dict) -> None:
    for key in REQUIRED_GROUP_FIELDS:
        if not group.get(key):
            raise ValueError(f"分组 {group.get('slug') or '<unknown>'} 缺少字段: {key}")


def validate_cards(slug: str, cards: list) -> None:
    if not isinstance(cards, list):
        raise ValueError(f'{slug}.json 的 knowledge_points 必须是数组')
    for idx, card in enumerate(cards, 1):
        if not isinstance(card, dict):
            raise ValueError(f'{slug}.json 第 {idx} 个卡片不是对象')
        for key in REQUIRED_CARD_FIELDS:
            if key not in card:
                raise ValueError(f'{slug}.json 第 {idx} 个卡片缺少字段: {key}')
        if not isinstance(card['title'], str) or not card['title'].strip():
            raise ValueError(f'{slug}.json 第 {idx} 个卡片 title 非法')
        if not isinstance(card['content'], str):
            raise ValueError(f'{slug}.json 第 {idx} 个卡片 content 必须是字符串')


def load_group_data(group: dict) -> dict:
    data_path = DATA_DIR / f"{group['slug']}.json"
    if not data_path.exists():
        raise FileNotFoundError(f'未找到数据文件: {data_path.name}')
    payload = json.loads(data_path.read_text(encoding='utf-8'))
    validate_cards(group['slug'], payload.get('knowledge_points'))
    return payload


def render_topic_page(template_text: str, group: dict, payload: dict) -> str:
    rendered = template_text
    rendered = rendered.replace('{{PAGE_TITLE}}', group['title'])
    rendered = rendered.replace('{{SIDEBAR_TITLE}}', group['sidebar_title'])
    rendered = rendered.replace('{{PAGE_ID}}', group['page_id'])
    rendered = rendered.replace(
        '__KNOWLEDGE_POINTS_JSON__',
        json.dumps(payload['knowledge_points'], ensure_ascii=False, separators=(',', ':')),
    )
    return rendered


def build_card_html(group: dict, count: int) -> str:
    return (
        '      <article class="nav-card">\n'
        f'        <span class="card-tag">{escape(group["tag"])}</span>\n'
        f'        <h2>{escape(group["title"])}</h2>\n'
        f'        <div class="route">/{escape(group["output"])}</div>\n'
        f'        <p class="description">{escape(group["description"])}</p>\n'
        f'        <p class="meta">共 {count} 张卡片</p>\n'
        f'        <a class="enter-btn" href="./{escape(group["output"])}">进入卡片组</a>\n'
        '      </article>'
    )


def render_index(groups_with_counts: list[dict]) -> str:
    cards_html = '\n'.join(build_card_html(group, group['count']) for group in groups_with_counts)
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>面经笔记</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ffffff; min-height: 100vh; overflow-x: hidden; background: #000; }}
#matrix-canvas {{ position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 0; opacity: 0.28; }}
.scanlines {{ position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; pointer-events: none; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.02) 2px, rgba(0,255,255,0.02) 4px); }}
.page-shell {{ position: relative; z-index: 2; min-height: 100vh; padding: 28px 24px 40px; }}
.hero {{ max-width: 980px; margin: 0 auto 24px; background: rgba(0,8,16,0.82); border: 1px solid rgba(0,255,255,0.18); border-radius: 18px; padding: 24px 24px 20px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 12px 32px rgba(0,0,0,0.28); }}
.hero-kicker {{ font-size: 0.82em; letter-spacing: 2px; color: rgba(0,255,255,0.76); margin-bottom: 10px; }}
.hero h1 {{ font-size: 1.8em; color: #00ffff; text-shadow: 0 0 8px rgba(0,255,255,0.35); margin-bottom: 10px; line-height: 1.4; }}
.hero p {{ color: rgba(255,255,255,0.82); line-height: 1.8; font-size: 1em; }}
.card-grid {{ max-width: 980px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }}
.nav-card {{ background: rgba(0,10,20,0.78); border: 1px solid rgba(0,255,255,0.18); border-radius: 18px; padding: 18px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 10px 28px rgba(0,0,0,0.24); transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s; display: flex; flex-direction: column; min-height: 250px; }}
.nav-card:hover {{ transform: translateY(-4px); border-color: rgba(0,255,255,0.34); box-shadow: 0 0 24px rgba(0,255,255,0.12), 0 12px 28px rgba(0,0,0,0.3); }}
.card-tag {{ display: inline-flex; align-items: center; width: fit-content; padding: 6px 12px; margin-bottom: 14px; border-radius: 999px; border: 1px solid rgba(0,255,255,0.26); background: rgba(0,255,255,0.08); color: #00ffff; font-size: 0.8em; letter-spacing: 0.5px; }}
.nav-card h2 {{ font-size: 1.08em; line-height: 1.5; color: #ffffff; margin-bottom: 10px; }}
.route {{ color: rgba(0,255,255,0.82); font-size: 0.84em; margin-bottom: 12px; word-break: break-all; }}
.description {{ color: rgba(255,255,255,0.82); line-height: 1.72; font-size: 0.95em; flex: 1; }}
.meta {{ margin-top: 12px; color: rgba(159,255,231,0.88); font-size: 0.9em; }}
.enter-btn {{ margin-top: 18px; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; border-radius: 12px; text-decoration: none; font-weight: bold; color: #00ffff; background: rgba(0,255,255,0.14); border: 1px solid rgba(0,255,255,0.36); transition: all 0.25s; }}
.enter-btn:hover {{ background: rgba(0,255,255,0.22); box-shadow: 0 0 20px rgba(0,255,255,0.16); }}
.toolbar {{ max-width: 980px; margin: 0 auto 18px; display: flex; gap: 10px; flex-wrap: wrap; color: rgba(255,255,255,0.72); }}
.toolbar code {{ background: rgba(255,255,255,0.08); padding: 4px 8px; border-radius: 8px; }}
@media (max-width: 900px) {{ .card-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
@media (max-width: 640px) {{ .page-shell {{ padding: 16px 14px 28px; }} .hero {{ padding: 18px 16px 16px; border-radius: 16px; margin-bottom: 16px; }} .hero h1 {{ font-size: 1.28em; }} .hero p {{ font-size: 0.92em; line-height: 1.68; }} .card-grid {{ grid-template-columns: 1fr; gap: 14px; }} .nav-card {{ min-height: auto; border-radius: 16px; padding: 16px; }} }}
</style>
</head>
<body>
<canvas id="matrix-canvas"></canvas>
<div class="scanlines"></div>
<div class="page-shell">
  <section class="hero">
    <div class="hero-kicker">NOTE SYSTEM</div>
    <h1>面经笔记卡片组</h1>
  </section>
  <section class="card-grid">
{cards_html}
  </section>
</div>
<script>
const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');
let w, h, columns, drops; const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function resize() {{ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; columns = Math.floor(w / 20); drops = Array(columns).fill(1); }}
function draw() {{ ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0,0,w,h); ctx.fillStyle = '#00ffff'; ctx.font = '14px monospace'; for (let i = 0; i < drops.length; i += 1) {{ const text = chars[Math.floor(Math.random() * chars.length)]; ctx.fillText(text, i * 20, drops[i] * 20); if (drops[i] * 20 > h && Math.random() > 0.975) drops[i] = 0; drops[i] += 1; }} }}
resize(); setInterval(draw, 50); window.addEventListener('resize', resize);
</script>
</body>
</html>'''


def main() -> None:
    registry = load_registry()
    template_text = TOPIC_TEMPLATE_PATH.read_text(encoding='utf-8')
    groups_with_counts = []
    for group in registry['groups']:
        validate_group_meta(group)
        payload = load_group_data(group)
        output_path = ROOT / group['output']
        output_path.write_text(render_topic_page(template_text, group, payload), encoding='utf-8')
        groups_with_counts.append({**group, 'count': len(payload['knowledge_points'])})
    (ROOT / 'index.html').write_text(render_index(groups_with_counts), encoding='utf-8')
    print(f'构建完成: {len(groups_with_counts)} 个卡片组')


if __name__ == '__main__':
    main()
