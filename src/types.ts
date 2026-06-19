export interface Card {
  id: string;
  slug: string; // matches the Category slug
  category: string; // label e.g., "计算机基础"
  title: string;
  content: string;
  order: number;
  updatedAt: string;
}

export interface Category {
  id: string;
  slug: string;
  title: string;
  label: string;
  order: number;
}

export interface DragItem {
  id: string;
  index: number;
}
