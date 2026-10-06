export const mainSkillSlugs = [
  'ask',
  'brainstorm',
  'specs',
  'develop',
  'test',
  'code-review',
  'sync',
  'debug',
  'fix',
  'docs',
  'scout',
  'git',
] as const;

export type MainSkillSlug = (typeof mainSkillSlugs)[number];

export type SkillDetail = {
  title: string;
  command: string;
  category: string;
  summary: string;
  when: string[];
  flow: Array<[string, string]>;
  output: string;
  avoid: string;
  next: string;
};

export type SkillDetailMap = Record<MainSkillSlug, SkillDetail>;
