export type Mode = 'write' | 'voice' | 'sprint' | 'dialogue';

export const AXES = [
  { key: 'specificity', label: '具体性' },
  { key: 'logic', label: '論理' },
  { key: 'structure', label: '構成' },
  { key: 'vocabulary', label: '語彙' },
  { key: 'clarity', label: '伝わりやすさ' },
] as const;

export type AxisKey = (typeof AXES)[number]['key'];

export interface Improvement {
  /** 回答から抜き出した該当箇所 */
  quote: string;
  /** 何をどう変えるとよいか */
  advice: string;
}

export interface Review {
  /** 各観点は0〜20点 */
  scores: Record<AxisKey, number>;
  strengths: string[];
  /** 効果の大きい順 */
  improvements: Improvement[];
  rewrite: string;
  /** 声の回答のときだけ、話し方の指摘が入る */
  speechNotes?: string;
  /** AIを使わない見本の採点なら true */
  isSample?: boolean;
}

export interface Turn {
  role: 'ai' | 'me';
  text: string;
}

export interface Entry {
  id?: number;
  createdAt: string;
  mode: Mode;
  promptText: string;
  text: string;
  review?: Review;
  /** 書き直しの元になった回答 */
  retryOf?: number;
  sprintSeconds?: number;
  sprintItems?: string[];
  sprintComment?: string;
  turns?: Turn[];
}

export function totalScore(review: Review): number {
  return AXES.reduce((sum, axis) => sum + review.scores[axis.key], 0);
}
