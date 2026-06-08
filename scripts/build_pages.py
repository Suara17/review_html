from __future__ import annotations

from html import escape
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'topics-data'
REGISTRY_PATH = DATA_DIR / 'registry.json'
TOPIC_TEMPLATE_PATH = ROOT / 'templates' / 'topic-page.template.html'

REQUIRED_GROUP_FIELDS = [
    'slug', 'page_id', 'title', 'sidebar_title', 'description', 'tag', 'output', 'template'
]
REQUIRED_CARD_FIELDS = ['title', 'content']
NON_WORD_RE = re.compile(r'[^a-z0-9]+')


def load_registry() -> list[dict]:
    payload = json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))
    groups = payload.get('groups')
    if not isinstance(groups, list):
        raise ValueError('registry.json 必须包含 groups 数组')
    for idx, group in enumerate(groups):
        missing = [field for field in REQUIRED_GROUP_FIELDS if not group.get(field)]
        if missing:
            raise ValueError(f'registry.json 第 {idx + 1} 项缺少字段: {missing}')
    return groups


def load_topic_payload(slug: str) -> dict:
    path = DATA_DIR / f'{slug}.json'
    if not path.exists():
        raise FileNotFoundError(f'未找到题库数据文件: {path}')
    payload = json.loads(path.read_text(encoding='utf-8'))
    cards = payload.get('knowledge_points')
    if not isinstance(cards, list) or not cards:
        raise ValueError(f'{path.name} 的 knowledge_points 必须是非空数组')
    for idx, card in enumerate(cards):
        missing = [field for field in REQUIRED_CARD_FIELDS if not card.get(field)]
        if missing:
            raise ValueError(f'{path.name} 第 {idx + 1} 个知识点缺少字段: {missing}')
    return payload


def slugify(value: str) -> str:
    lowered = (value or '').strip().lower()
    normalized = NON_WORD_RE.sub('-', lowered).strip('-')
    return normalized or 'item'


def with_ids(slug: str, cards: list[dict]) -> list[dict]:
    enriched = []
    for idx, card in enumerate(cards, start=1):
        base_title = re.sub(r'^\s*\d+\s*[.．、]\s*', '', card['title'])
        enriched.append({
            'id': card.get('id') or f'{slug}--{idx:03d}--{slugify(base_title)}',
            'title': card['title'],
            'content': card['content'],
        })
    return enriched


def build_page(group: dict, payload: dict) -> str:
    template_path = ROOT / group['template']
    template = template_path.read_text(encoding='utf-8')
    cards = with_ids(group['slug'], payload['knowledge_points'])
    replacements = {
        '{{PAGE_TITLE}}': escape(payload.get('title') or group['title']),
        '{{SIDEBAR_TITLE}}': escape(payload.get('sidebar_title') or group['sidebar_title']),
        '{{PAGE_ID}}': escape(payload.get('page_id') or group['page_id']),
        '{{KNOWLEDGE_POINTS_JSON}}': json.dumps(cards, ensure_ascii=False, indent=2),
    }
    html = template
    for marker, value in replacements.items():
        html = html.replace(marker, value)
    return html


def main() -> None:
    groups = load_registry()
    for group in groups:
        payload = load_topic_payload(group['slug'])
        html = build_page(group, payload)
        output_path = ROOT / group['output']
        output_path.write_text(html, encoding='utf-8')
        print(f'Built {output_path.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
