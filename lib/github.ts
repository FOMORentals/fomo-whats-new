/** GitHub reads only: merged pull requests and screenshot files. Every failure throws (rule 1). */
import { OWNER } from "./apps";

function token(): string {
  const t = process.env.GITHUB_TOKEN?.trim();
  if (!t) throw new Error("GITHUB_TOKEN is not set");
  return t;
}

async function gh(path: string, accept = "application/vnd.github+json"): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "fomo-whats-new" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${path} failed: HTTP ${res.status}`);
  return res;
}

export type MergedPr = { number: number; title: string; body: string | null; html_url: string; merged_at: string; merge_commit_sha: string };

/** PRs merged into the repo's default branch since `sinceMs`, oldest first. */
export async function mergedPrs(repo: string, sinceMs: number): Promise<MergedPr[]> {
  const info = (await (await gh(`/repos/${OWNER}/${repo}`)).json()) as { default_branch: string };
  const prs = (await (
    await gh(`/repos/${OWNER}/${repo}/pulls?state=closed&base=${encodeURIComponent(info.default_branch)}&sort=updated&direction=desc&per_page=50`)
  ).json()) as (MergedPr & { merged_at: string | null })[];
  return prs
    .filter((p): p is MergedPr => !!p.merged_at && Date.parse(p.merged_at) >= sinceMs)
    .sort((a, b) => Date.parse(a.merged_at) - Date.parse(b.merged_at));
}

/** Raw bytes of a file at a commit. */
export async function fileAt(repo: string, ref: string, path: string): Promise<{ body: ArrayBuffer; type: string }> {
  const res = await gh(`/repos/${OWNER}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, "application/vnd.github.raw");
  return { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "application/octet-stream" };
}
