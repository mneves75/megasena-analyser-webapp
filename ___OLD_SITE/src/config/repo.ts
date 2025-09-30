const defaultRepoBase =
  "https://github.com/mneves75/megasena-analyser-nextjs/blob/main";

export const REPO_BASE_URL = (process.env.NEXT_PUBLIC_REPO_BASE?.trim().replace(
  /\/$/,
  "",
) || defaultRepoBase) as string;
