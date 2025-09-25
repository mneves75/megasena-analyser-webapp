const defaultRepoBase =
  "https://github.com/mneves75/megasena-analyser-webapp/blob/main";

export const REPO_BASE_URL = (process.env.NEXT_PUBLIC_REPO_BASE?.trim().replace(
  /\/$/,
  "",
) || defaultRepoBase) as string;
