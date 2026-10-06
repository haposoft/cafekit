export type TerminalLineKind = "command" | "output" | "success" | "ghost" | "error";

export type TerminalLine = {
  kind: TerminalLineKind;
  text: string;
};

export type GlossaryTerm = {
  term: string;
  definition: string;
};

export type StepLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type TutorialStep = {
  id: string;
  label: string;
  title: string;
  narrative: string[];
  command?: string;
  outputs?: TerminalLine[];
  youWillSee?: string[];
  troubleshooting?: { problem: string; fix: string }[];
  glossary?: GlossaryTerm[];
  links?: StepLink[];
};

export type TutorialUI = {
  stepWord: string;
  youWillSeeLabel: string;
  troubleshootingLabel: string;
  glossaryLabel: string;
  replay: string;
  back: string;
  next: string;
  prerequisiteItems: string[];
  installCommand: string;
};

export type TutorialContent = {
  eyebrow: string;
  title: string;
  description: string;
  ui: TutorialUI;
  steps: TutorialStep[];
  recap: {
    title: string;
    bullets: string[];
    nextLinks: StepLink[];
    glossary: GlossaryTerm[];
  };
};
