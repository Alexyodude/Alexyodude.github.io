export type Repo = {
  name: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  language: string | null;
  updatedAt: string;
};

type GhRepo = {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
  archived: boolean;
};

const USER = 'Alexyodude';
const WEBSITE_REPO = 'alexyodude.github.io';

export async function fetchRepos(): Promise<Repo[]> {
  const url = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`;
  const res = await fetch(url, {
    headers: { 'User-Agent': `${USER}-website`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub API failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as GhRepo[];
  return data
    .filter((r) => !r.fork && !r.archived && r.name !== WEBSITE_REPO)
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .map((r) => ({
      name: r.name,
      description: r.description,
      htmlUrl: r.html_url,
      stars: r.stargazers_count,
      language: r.language,
      updatedAt: r.updated_at,
    }));
}
