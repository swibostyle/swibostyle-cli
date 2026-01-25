export type TemplateType = "novel" | "manga" | "techbook" | "minimal";

export interface ProjectOptions {
  name: string;
  template: TemplateType;
  lang: string;
  pageDirection: "ltr" | "rtl";
  writingMode: "horizontal-tb" | "vertical-rl";
  packageManager: "bun" | "npm";
}

export interface PromptCliOptions {
  template?: string;
  lang?: string;
  direction?: string;
  writingMode?: string;
  pm?: string;
}
