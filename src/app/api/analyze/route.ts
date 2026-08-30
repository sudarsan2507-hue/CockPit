import { buildManifest } from "@/lib/analyzer";
import {
  DEMO_REPO_FILES,
  DEMO_REPO_LABEL,
  DEMO_REPO_URL,
  type RepoFile,
} from "@/lib/fixtures/demoRepo";

/** Cap the GitHub work so one paste cannot spend the whole rate limit. */
const MAX_FILES = 20;

interface TreeEntry {
  path: string;
  type: string;
}

function parseRepo(url: string): { owner: string; repo: string } | null {
  const match = url
    .trim()
    .match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "webmcp-forge",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchRepoFiles(owner: string, repo: string): Promise<RepoFile[]> {
  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(),
  });
  if (!meta.ok) throw new Error(`GitHub returned ${meta.status} for ${owner}/${repo}`);
  const { default_branch: branch } = (await meta.json()) as { default_branch: string };

  const tree = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: githubHeaders() },
  );
  if (!tree.ok) throw new Error(`Could not read the file tree (${tree.status}).`);
  const { tree: entries } = (await tree.json()) as { tree: TreeEntry[] };

  const routeFiles = entries
    .filter((entry) => entry.type === "blob" && /app\/.*\/route\.[tj]sx?$/.test(entry.path))
    .slice(0, MAX_FILES);

  return Promise.all(
    routeFiles.map(async (entry) => {
      const raw = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${entry.path}`,
      );
      return { path: entry.path, content: raw.ok ? await raw.text() : "" };
    }),
  );
}

export async function POST(request: Request) {
  const { repoUrl } = (await request.json().catch(() => ({}))) as { repoUrl?: string };
  const target = (repoUrl ?? "").trim();

  // The bundled storefront is the demo path and needs no network access.
  if (target === "" || target === DEMO_REPO_URL || /demo-storefront/i.test(target)) {
    return Response.json({
      manifest: buildManifest(DEMO_REPO_FILES, DEMO_REPO_URL, DEMO_REPO_LABEL),
      source: "bundled",
    });
  }

  const parsed = parseRepo(target);
  if (!parsed) {
    return Response.json(
      { error: "Enter a public GitHub repository URL, or leave the field empty for the demo." },
      { status: 400 },
    );
  }

  try {
    const files = await fetchRepoFiles(parsed.owner, parsed.repo);
    if (files.length === 0) {
      return Response.json(
        {
          error:
            "No Next.js App Router route handlers found. Forge reads app/**/route.ts files; " +
            "other frameworks are not supported yet.",
        },
        { status: 422 },
      );
    }
    return Response.json({
      manifest: buildManifest(
        files,
        target,
        `${parsed.owner}/${parsed.repo}`,
      ),
      source: "github",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 502 },
    );
  }
}
