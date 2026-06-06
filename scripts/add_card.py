from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'topics-data'

args = sys.argv[1:]
params = {}
key = None
for item in args:
    if item.startswith('--'):
        key = item[2:]
        params[key] = None
    elif key:
        params[key] = item
        key = None

slug = params.get('slug')
title = params.get('title')
content = params.get('content') or '<strong>请补充卡片内容。</strong>'

if not slug or not title:
    print('用法: python scripts/add_card.py --slug python --title "新卡片标题" [--content "HTML内容"]')
    sys.exit(1)

path = DATA_DIR / f'{slug}.json'
if not path.exists():
    print(f'未找到卡片组: {slug}')
    sys.exit(1)

data = json.loads(path.read_text(encoding='utf-8'))
points = data.setdefault('knowledge_points', [])
points.append({'title': title, 'content': content})
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'已向 {slug} 新增卡片，当前共 {len(points)} 张')
print('接着执行: python scripts/build_pages.py')
