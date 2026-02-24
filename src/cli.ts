import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import { listArticles, fetchArticle, type ArticleEntry } from "./github.js";
import { markdownToXArticle } from "./converter.js";

const OUTPUT_DIR = "output";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectArticle(
  articles: ArticleEntry[]
): Promise<ArticleEntry | ArticleEntry[]> {
  console.error("\nAvailable articles:\n");
  articles.forEach((a, i) => {
    console.error(`  ${String(i + 1).padStart(2)}. ${a.name}`);
  });
  console.error(`  ${String(articles.length + 1).padStart(2)}. [All articles]`);

  const input = await prompt(`\nSelect article (1-${articles.length + 1}): `);
  const num = parseInt(input, 10);

  if (num === articles.length + 1) {
    return articles;
  }

  if (isNaN(num) || num < 1 || num > articles.length) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  return articles[num - 1];
}

async function processArticle(article: ArticleEntry): Promise<string> {
  console.error(`\nFetching: ${article.name}...`);
  const markdown = await fetchArticle(article);
  const xArticle = markdownToXArticle(markdown);

  console.error(`  Title: ${xArticle.meta.title}`);
  console.error(`  Characters: ${xArticle.charCount.toLocaleString()}`);

  if (xArticle.charCount > 25000) {
    console.error(
      `  ⚠ Warning: ${xArticle.charCount.toLocaleString()} chars exceeds X Article limit (25,000)`
    );
  }

  return xArticle.body;
}

function saveToFile(name: string, content: string): string {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filePath = path.join(OUTPUT_DIR, `${name}.txt`);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

async function main() {
  const args = process.argv.slice(2);

  // Direct article name via CLI argument
  if (args[0] === "--list") {
    const articles = await listArticles();
    articles.forEach((a) => console.log(a.name));
    return;
  }

  console.error("Fetching article list from GitHub...");
  const articles = await listArticles();

  if (articles.length === 0) {
    console.error("No articles found.");
    process.exit(1);
  }

  let selected: ArticleEntry | ArticleEntry[];

  // If article name provided as argument, find it
  if (args[0] && args[0] !== "--stdout") {
    const searchName = args[0].replace(/\.md$/, "");
    const found = articles.find(
      (a) =>
        a.name === searchName ||
        a.name.toLowerCase().includes(searchName.toLowerCase())
    );
    if (!found) {
      console.error(`Article not found: ${args[0]}`);
      console.error("Use --list to see available articles.");
      process.exit(1);
    }
    selected = found;
  } else {
    selected = await selectArticle(articles);
  }

  const toStdout = args.includes("--stdout");
  const toProcess = Array.isArray(selected) ? selected : [selected];

  for (const article of toProcess) {
    const content = await processArticle(article);

    if (toStdout) {
      console.log(content);
      if (toProcess.length > 1) {
        console.log("\n" + "=".repeat(80) + "\n");
      }
    } else {
      const filePath = saveToFile(article.name, content);
      console.error(`  Saved: ${filePath}`);
    }
  }

  if (!toStdout) {
    console.error(`\nDone! Files saved to ${OUTPUT_DIR}/`);
    console.error("Copy the content from any .txt file and paste into X's article editor.");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
