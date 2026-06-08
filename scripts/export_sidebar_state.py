from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
TOPICS_DIR = ROOT / 'topics-data'
OUTPUT_DIR = ROOT / 'data' / 'sidebar-state'
NON_WORD_RE = re.compile(r'[^a-z0-9]+')


def slugify(value: str) -> str:
    lowered = (value or '').strip().lower()
    normalized = NON_WORD_RE.sub('-', lowered).strip('-')
    return normalized or 'item'


def make_item_id(page_slug: str, idx: int, title: str) -> str:
    title = re.sub(r'^\s*\d+\s*[.．、]\s*', '', title)
    return f'{page_slug}--{idx:03d}--{slugify(title)}'


def export_one(path: Path) -> None:
    payload = json.loads(path.read_text(encoding='utf-8'))
    page_slug = payload.get('slug') or path.stem
    cards = payload.get('knowledge_points') or []
    items = []
    order = []
    for idx, card in enumerate(cards, start=1):
        items.append({
            'id': card.get('id') or make_item_id(page_slug, idx, card['title']),
            'title': re.sub(r'^\s*\d+\s*[.．、]\s*', '', card['title']),
            'content': card['content'],
        })
        order.append(idx - 1)
    out = {
        'page_id': page_slug,
        'updated_at': None,
        'state': {
            'items': items,
            'order': order,
        },
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUTPUT_DIR / f'{page_slug}.json'
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {target.relative_to(ROOT)}')


def main() -> None:
    for path in sorted(TOPICS_DIR.glob('*.json')):
        if path.name == 'registry.json':
            continue
        export_one(path)


if __name__ == '__main__':
    main()
