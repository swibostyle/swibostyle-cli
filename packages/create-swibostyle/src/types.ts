export type TemplateType = "novel" | "manga" | "techbook" | "minimal";

export interface ProjectOptions {
  name: string;
  template: TemplateType;
  lang: string;
  pageDirection: "ltr" | "rtl";
  writingMode: "horizontal-tb" | "vertical-rl";
  packageManager: "bun" | "npm";
}
