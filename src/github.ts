import { execSync } from "node:child_process";

const REPO_OWNER = "ProfessorSeb";
const REPO_NAME = "maniak-io";
const ARTICLES_PATH = "content/articles";
const BRANCH = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${ARTICLES_PATH}`;

export interface ArticleEntry {
  name: string;
  path: string;
  downloadUrl: string;
}

function httpGet(url: string): string {
  return execSync(`curl -sfL "${url}"`, {
    encoding: "utf-8",
    timeout: 30_000,
  });
}

/**
 * List articles via GitHub API. Falls back to git ls-remote tree if rate-limited.
 */
export async function listArticles(): Promise<ArticleEntry[]> {
  // Try GitHub API first
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${ARTICLES_PATH}?ref=${BRANCH}`;
    const body = httpGet(url);
    const items: any[] = JSON.parse(body);

    if (Array.isArray(items)) {
      return items
        .filter(
          (item: any) =>
            item.type === "file" &&
            item.name.endsWith(".md") &&
            item.name !== "_index.md"
        )
        .map((item: any) => ({
          name: item.name.replace(/\.md$/, ""),
          path: item.path,
          downloadUrl: `${RAW_BASE}/${item.name}`,
        }));
    }
  } catch {
    // API failed (rate limit, etc.) — fall through to git approach
  }

  // Fallback: use git ls-tree via the GitHub API for trees
  try {
    const treeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`;
    const body = httpGet(treeUrl);
    const data = JSON.parse(body);

    if (data.tree) {
      return data.tree
        .filter(
          (item: any) =>
            item.path.startsWith(`${ARTICLES_PATH}/`) &&
            item.path.endsWith(".md") &&
            !item.path.endsWith("_index.md") &&
            item.type === "blob"
        )
        .map((item: any) => {
          const name = item.path.split("/").pop()!.replace(/\.md$/, "");
          return {
            name,
            path: item.path,
            downloadUrl: `${RAW_BASE}/${name}.md`,
          };
        });
    }
  } catch {
    // Tree API also failed
  }

  // Final fallback: clone the article list from a raw index page
  // This uses the GitHub raw content which has no rate limit
  try {
    const indexUrl = `${RAW_BASE}/_index.md`;
    httpGet(indexUrl); // Just verify raw.githubusercontent.com is accessible

    // If raw content works, we need to know filenames. Use a shallow clone.
    const tmpDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
    execSync(
      `git clone --depth 1 --filter=blob:none --sparse "https://github.com/${REPO_OWNER}/${REPO_NAME}.git" "${tmpDir}" 2>/dev/null`,
      { timeout: 30_000 }
    );
    execSync(`git -C "${tmpDir}" sparse-checkout set ${ARTICLES_PATH}`, {
      timeout: 15_000,
    });

    const files = execSync(`ls "${tmpDir}/${ARTICLES_PATH}"/*.md`, {
      encoding: "utf-8",
    });

    const articles = files
      .trim()
      .split("\n")
      .map((f) => f.split("/").pop()!)
      .filter((f) => f !== "_index.md")
      .map((f) => {
        const name = f.replace(/\.md$/, "");
        return {
          name,
          path: `${ARTICLES_PATH}/${f}`,
          downloadUrl: `${RAW_BASE}/${f}`,
        };
      });

    execSync(`rm -rf "${tmpDir}"`);
    return articles;
  } catch {
    throw new Error(
      "Could not fetch article list. GitHub API rate-limited and fallbacks failed.\n" +
        "Try again in a few minutes, or set a GITHUB_TOKEN env var."
    );
  }
}

export async function fetchArticle(article: ArticleEntry): Promise<string> {
  return httpGet(article.downloadUrl);
}
