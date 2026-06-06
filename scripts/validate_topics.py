from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'topics-data'
REGISTRY_PATH = DATA_DIR / 'registry.json'

registry = json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))
slugs = set()
errors = []

for group in registry.get('groups', []):
    slug = group.get('slug')
    if not slug:
        errors.append('存在缺少 slug 的分组')
        continue
    if slug in slugs:
        errors.append(f'重复 slug: {slug}')
    slugs.add(slug)
    data_path = DATA_DIR / f'{slug}.json'
    if not data_path.exists():
        errors.append(f'缺少数据文件: {data_path.name}')
        continue
    try:
        data = json.loads(data_path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'{data_path.name} JSON 解析失败: {exc}')
        continue
    points = data.get('knowledge_points')
    if not isinstance(points, list):
        errors.append(f'{data_path.name} knowledge_points 不是数组')
        continue
    for idx, point in enumerate(points, 1):
        if not isinstance(point, dict):
            errors.append(f'{data_path.name} 第 {idx} 项不是对象')
            continue
        if not isinstance(point.get('title'), str) or not point.get('title', '').strip():
            errors.append(f'{data_path.name} 第 {idx} 项 title 非法')
        if not isinstance(point.get('content'), str):
            errors.append(f'{data_path.name} 第 {idx} 项 content 必须是字符串')

if errors:
    print('校验失败:')
    for err in errors:
        print('-', err)
    sys.exit(1)

print(f'校验通过: {len(slugs)} 个卡片组')
