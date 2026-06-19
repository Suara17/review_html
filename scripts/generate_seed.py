"""Generate seed data JSON for Worker embedding"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / 'topics-data' / 'registry.json'
DATA_DIR = ROOT / 'topics-data'
OUTPUT_PATH = ROOT / 'worker' / 'seed-data.json'

registry = json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))

categories = []
cards = []
card_id = 1

for g in registry['groups']:
    slug = g['slug']
    cat_id = f'cat-{slug}'
    
    title = g['title'].replace('知识点笔记', '').strip()
    
    categories.append({
        'id': cat_id,
        'slug': slug,
        'title': title,
        'label': g['tag'],
        'order': len(categories) + 1
    })
    
    data_path = DATA_DIR / f'{slug}.json'
    if data_path.exists():
        payload = json.loads(data_path.read_text(encoding='utf-8'))
        kps = payload.get('knowledge_points', [])
        for idx, kp in enumerate(kps):
            cards.append({
                'id': f'card-{card_id}',
                'slug': slug,
                'category': g['tag'],
                'title': kp['title'],
                'content': kp['content'],
                'order': idx + 1,
                'updatedAt': '2026-06-17T00:00:00.000Z'
            })
            card_id += 1

result = {'categories': categories, 'cards': cards}
OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Seed data written to {OUTPUT_PATH} ({len(categories)} categories, {len(cards)} cards)')
