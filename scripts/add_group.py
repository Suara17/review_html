from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'topics-data'
REGISTRY_PATH = DATA_DIR / 'registry.json'

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
sidebar_title = params.get('sidebar-title') or (f'{title} 高频知识点' if title else None)
page_id = params.get('page-id') or slug
output = params.get('output') or (f'{slug}.html' if slug else None)
description = params.get('description') or (f'{title} 卡片组' if title else None)
tag = params.get('tag') or '自定义'

if not slug or not title:
    print('用法: python scripts/add_group.py --slug new-group --title "新卡片组" [--sidebar-title "目录标题"] [--description "描述"] [--tag "标签"]')
    sys.exit(1)
if not re.fullmatch(r'[a-z0-9-]+', slug):
    print('slug 只能包含小写字母、数字和连字符')
    sys.exit(1)

registry = json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))
if any(g.get('slug') == slug for g in registry['groups']):
    print(f'分组已存在: {slug}')
    sys.exit(1)

registry['groups'].append({
    'slug': slug,
    'page_id': page_id,
    'title': title,
    'sidebar_title': sidebar_title,
    'description': description,
    'tag': tag,
    'output': output,
    'template': 'templates/topic-page.template.html'
})
REGISTRY_PATH.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

(DATA_DIR / f'{slug}.json').write_text(json.dumps({
    'slug': slug,
    'title': title,
    'sidebar_title': sidebar_title,
    'page_id': page_id,
    'knowledge_points': [
        {
            'title': '1. 请在这里填写新卡片标题',
            'content': '<strong>请编辑这张新卡片的内容。</strong><br><br>支持直接写 HTML 内容。'
        }
    ]
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print(f'已新增卡片组: {slug}')
print(f'数据文件: topics-data/{slug}.json')
print('接着执行: python scripts/build_pages.py')
