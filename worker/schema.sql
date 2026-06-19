-- Cloudflare D1 数据库表结构（v2 - React SPA）
-- 部署: npx wrangler d1 execute review-cards-db --file=schema.sql --remote
-- 注意: 会清除旧表数据

DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cards_slug ON cards(slug);
