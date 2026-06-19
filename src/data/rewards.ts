/* rewards.ts — 经验值、等级、徽章系统 */

export interface RewardState {
  xp: number;
  level: number;
  ttsMinutes: number;
  cardCycles: number;
  completedCategories: string[];
  lastLoginDate: string;
  loginStreak: number;
  seenLevelUp: number[]; // levels the user has already seen the celebration for
}

export interface LevelDef {
  level: number;
  name: string;
  icon: string;
  xpRequired: number;
  color: string; // Tailwind text color class
}

export const LEVELS: LevelDef[] = [
  { level: 1, name: '新手观察者',  icon: '🌱', xpRequired: 0,    color: 'text-slate-400' },
  { level: 2, name: '知识学徒',    icon: '🥉', xpRequired: 100,  color: 'text-amber-600' },
  { level: 3, name: '面经猎手',    icon: '⚙️', xpRequired: 300,  color: 'text-cyan-400' },
  { level: 4, name: '八股达人',    icon: '📖', xpRequired: 600,  color: 'text-yellow-400' },
  { level: 5, name: '面试大师',    icon: '🔷', xpRequired: 1000, color: 'text-blue-400' },
  { level: 6, name: '赛博学霸',    icon: '💎', xpRequired: 2000, color: 'text-violet-400' },
  { level: 7, name: '知识领主',    icon: '🏆', xpRequired: 3500, color: 'text-orange-400' },
  { level: 8, name: '面经收藏家',  icon: '👑', xpRequired: 5000, color: 'text-amber-300' },
  { level: 9, name: '终极面试王',  icon: '🌟', xpRequired: 7500, color: 'text-rose-400' },
];

export const XP_PER_CARD_CYCLE      = 10;
export const XP_PER_TTS_MINUTE      = 5;
export const XP_PER_CATEGORY_CLEAR  = 50;
export const XP_PER_LOGIN           = 5;
export const XP_LOGIN_STREAK_BONUS  = 2; // extra per consecutive day

const STORAGE_KEY = 'cyber_rewards_v1';

export function loadRewards(): RewardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    xp: 0,
    level: 1,
    ttsMinutes: 0,
    cardCycles: 0,
    completedCategories: [],
    lastLoginDate: '',
    loginStreak: 0,
    seenLevelUp: [],
  };
}

export function saveRewards(state: RewardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getLevel(xp: number): LevelDef {
  let lv = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xpRequired) lv = level;
  }
  return lv;
}

export function getNextLevel(xp: number): LevelDef | null {
  const current = getLevel(xp);
  const idx = LEVELS.indexOf(current);
  if (idx < LEVELS.length - 1) return LEVELS[idx + 1];
  return null;
}

export function xpProgress(xp: number): { current: number; required: number; progress: number } {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return { current: xp, required: xp, progress: 1 };
  const base = current.xpRequired;
  const required = next.xpRequired - base;
  const progress = Math.min(1, Math.max(0, (xp - base) / required));
  return { current: xp - base, required, progress };
}
