// コミットに足す（ステージする）操作と、オーナー端末 / CI の入口が書く出力を、コードと workflow から導いて確かめる。
// - workflow: git の呼び出しを書き方（-C・-c・パス付きの git・sh -c の中・行の継続）を問わず見つけ、ステージするのは
//   台帳で CI が書く出力の明示パスだけかを見る。コミットする action・GitHub の API での書き込みも止める
// - scripts: ステージは commitAndSync の中だけ（入口で pathsOutsideLedger で台帳を確かめる）。commitAndSync に渡すパスは台帳でオーナーが書く出力
// - 入口: ランチャー（owner）と workflow（ci）が動かすスクリプトの書き出しが、台帳でその書く側が書く出力か
import fs from "fs";
import path from "path";
import { parseFrontmatter } from "astro/markdown";
import { publicOutputOf, isWrittenBy } from "../../scripts/utils/public_tree.mjs";
import { Resolver, maskCode, commandsOf, writeTargetsResolved, codeFiles, callSitesOf, splitTop, scanTop } from "./write_targets.mjs";

// 読むだけ・取り込むだけの git の操作（ステージしない）
const SAFE_GIT = new Set(["config", "fetch", "merge", "pull", "push", "status", "diff", "log", "show", "rev-parse", "ls-files", "ls-tree", "ls-remote", "checkout", "clean", "remote", "branch", "rebase", "describe", "cat-file", "check-ignore", "symbolic-ref", "reset", "restore", "switch", "init", "clone", "version", "help"]);
// ステージ・コミットに関わる操作（配列で書いた git の引数の見分けに使う）
const STAGING_GIT = new Set(["add", "stage", "commit", "update-index", "apply", "am", "mv", "rm", "read-tree", "stash"]);
// 値を 1 つとる git 全体のオプション
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--super-prefix", "--config-env"]);
const COMMIT_LONG_OK = new Set(["--message", "--file", "--quiet", "--allow-empty", "--no-edit", "--signoff", "--no-verify", "--author", "--date", "--verbose", "--cleanup"]);
const COMMIT_LONG_VALUE = new Set(["--message", "--file", "--author", "--date", "--cleanup"]);
// workflow で使ってよい action（コミット・push をしないことを確かめたもの）。新しい action は、コミットしないかを確かめてから足す
const REVIEWED_ACTIONS = new Set(["actions/checkout", "actions/setup-node", "actions/configure-pages", "actions/upload-pages-artifact", "actions/deploy-pages", "actions/cache", "actions/upload-artifact", "actions/download-artifact"]);
const HOLE_RE = /\u0001\d+\u0001/;
const rel = (repoRoot, f) => path.relative(repoRoot, f).split(path.sep).join("/");

// シェルの単語に分ける（start から、コマンドの区切り ; & | 改行・閉じていない引用符まで）
function wordsFrom(text, start) {
  const words = [];
  let i = start;
  while (i < text.length) {
    while (text[i] === " " || text[i] === "\t") i++;
    if (i >= text.length || /[\n;&|)`]/.test(text[i])) break;
    let w = "";
    let closed = true;
    while (i < text.length && !/[\s;&|)`]/.test(text[i])) {
      if (text[i] === '"' || text[i] === "'") {
        const q = text[i];
        const end = text.indexOf(q, i + 1);
        const nl = text.indexOf("\n", i + 1);
        if (end < 0 || (nl >= 0 && nl < end)) {
          closed = false;
          break;
        }
        w += text.slice(i + 1, end);
        i = end + 1;
      } else w += text[i++];
    }
    if (w) words.push(w);
    if (!closed) break;
  }
  return words;
}

// テキストの中の git の呼び出し: [{ sub, args, globals }]
export function gitInvocations(text) {
  const t = text.replace(/\\\r?\n\s*/g, " ");
  const out = [];
  for (const m of t.matchAll(/(?<![\w.-])(?:[\w.-]*\/)*git(?:\.exe)?(?![\w.-])/g)) {
    const words = wordsFrom(t, m.index + m[0].length);
    const globals = [];
    let k = 0;
    while (k < words.length && words[k].startsWith("-")) {
      globals.push(words[k]);
      if (GLOBAL_WITH_VALUE.has(words[k])) globals.push(words[++k]);
      k++;
    }
    if (k >= words.length) continue; // 文章の中の「git」・git だけの行
    out.push({ sub: words[k], args: words.slice(k + 1), globals });
  }
  return out;
}

// 1 つの git の呼び出しの問題。addOk(arg) は git add に渡してよいパスか
function invocationProblems({ sub, args, globals }, addOk) {
  const at = `git ${[...globals, sub, ...args].join(" ")}`;
  const problems = [];
  if (globals.some((g) => /^alias\./.test(g || ""))) problems.push(`${at}: git の別名を作って使っている`);
  if (sub === "add" || sub === "stage") {
    if (args.filter((a) => a !== "--").length === 0) problems.push(`${at}: パスの無い add`);
    for (const a of args) {
      if (a === "--") continue;
      if (a.startsWith("-")) problems.push(`${at}: オプション ${a}（全部入り・無視したファイルの追加）`);
      else if (!addOk(a)) problems.push(`${at}: 台帳で書く側が書く出力ではない ${a}`);
    }
  } else if (sub === "commit") {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--") {
        if (args.length > i + 1 && !args.slice(i + 1).every((x) => addOk(x))) problems.push(`${at}: パスを指定したコミット（ステージしていない変更も入る）`);
        break;
      }
      if (/^--/.test(a)) {
        const name = a.split("=")[0];
        if (!COMMIT_LONG_OK.has(name)) problems.push(`${at}: オプション ${name}`);
        else if (COMMIT_LONG_VALUE.has(name) && !a.includes("=")) i++;
      } else if (/^-[A-Za-z]+$/.test(a)) {
        if (/[aio]/.test(a.slice(1))) problems.push(`${at}: オプション ${a}（変更をすべてコミットに含める）`);
        if (/[mFC]$/.test(a)) i++;
      } else problems.push(`${at}: パスを指定したコミット（ステージしていない変更も入る）`);
    }
  } else if (!SAFE_GIT.has(sub) || HOLE_RE.test(sub)) {
    problems.push(`${at}: 確かめていない git の操作 ${sub}（ステージ・コミットしないものだけを使う）`);
  }
  return problems;
}

// workflow の YAML のコミットの問題: { problems, adds }
export function workflowStagingProblems(yml, allowedPaths) {
  // YAML として読み、実行される run と、使う action（uses）だけを見る（step の名前などの文章の「git」は見ない）
  let runs = [];
  let uses = [];
  try {
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (k === "run" && typeof x === "string") runs.push(x);
          else if (k === "uses" && typeof x === "string") uses.push(x);
          else walk(x);
        }
      }
    };
    walk(parseFrontmatter(`---\n${yml.replace(/\r\n/g, "\n")}\n---\n`).frontmatter);
  } catch {
    // YAML として読めない断片は、そのまま全体を見る（見逃すより止める）
    runs = [yml];
    uses = [...yml.matchAll(/uses:\s*["']?([^\s"'#]+)/g)].map((m) => m[1]);
  }
  const text = runs.map((r) => r.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n")).join("\n");
  const addOk = (a) => !/[*?[\]$:]/.test(a) && a !== "." && (allowedPaths.includes(a) || allowedPaths.includes(`${a.replace(/\/$/, "")}/`));
  const problems = [];
  let adds = 0;
  for (const inv of gitInvocations(text)) {
    if (inv.sub === "add" || inv.sub === "stage") adds++;
    problems.push(...invocationProblems(inv, addOk));
  }
  for (const u of uses) {
    const name = u.split("@")[0];
    if (!REVIEWED_ACTIONS.has(name)) problems.push(`uses: ${name}（コミット・push をしないか確かめていない action）`);
  }
  for (const m of [...runs, ...uses].join("\n").matchAll(/repos\/[^\s"']*\/(?:contents|git\/(?:blobs|trees|commits|refs))\b/g)) problems.push(`GitHub の API でリポに書いている（${m[0]}）`);
  return { problems, adds };
}

const GIT_SYNC = "scripts/utils/git_sync.mjs";
const isJs = (f) => /\.(?:mjs|cjs|js|ts|mts|cts|jsx|tsx|astro)$/.test(f);

// git の引数の配列（spawnSync('git', [...])・ラッパー git(cwd, [...])）のステージの問題
function arrayStagingProblems(repoRoot, f, r) {
  const problems = [];
  const masked = maskCode(r.src);
  const lineOf = (i) => r.src.slice(0, i).split("\n").length;
  for (const m of masked.matchAll(/\[/g)) {
    const close = scanTop(r.src, m.index + 1);
    const elems = splitTop(r.src.slice(m.index + 1, close), ",").filter(Boolean);
    if (!elems.length || !/^["'`]/.test(elems[0])) continue;
    const words = elems.map((e) => (e.startsWith("...") ? e : r.str(e, m.index, [])[0]));
    const globals = [];
    let k = 0;
    // git 全体のオプション（-C dir・-c k=v・--no-pager など）を飛ばして、操作の名前を見る
    while (k < words.length && /^-/.test(words[k] || "")) {
      globals.push(words[k]);
      if (GLOBAL_WITH_VALUE.has(words[k])) globals.push(words[++k]);
      k++;
    }
    if (!STAGING_GIT.has(words[k]) && !globals.some((g) => /^alias\./.test(g || ""))) continue;
    const sub = words[k];
    const args = words.slice(k + 1);
    const spreads = args.filter((a) => a.startsWith("...")).map((a) => a.slice(3).trim());
    const where = `${rel(repoRoot, f)}:${lineOf(m.index)}`;
    // 広げて渡すパスは、同じファイルのこの配列より前で台帳を確かめたもの（pathsOutsideLedger(P, ...)）だけ
    const guarded = (p) => new RegExp(`\\bpathsOutsideLedger\\(\\s*${p.replace(/\$/g, "\\$")}\\s*,`).test(r.src.slice(0, m.index));
    for (const p of spreads) if (!guarded(p)) problems.push(`${where} git ${sub}: 台帳を確かめていないパス ...${p}`);
    const plain = args.map((a) => (a.startsWith("...") ? "<guarded>" : a));
    for (const p of invocationProblems({ sub, args: plain, globals }, (a) => a === "<guarded>")) problems.push(`${where} ${p}`);
  }
  return problems;
}

// scripts（tests 以外のコード）のステージの問題
export function scriptStagingProblems(repoRoot, files) {
  const problems = [];
  const jsFiles = files.filter(isJs);
  for (const f of jsFiles) {
    const r = new Resolver(repoRoot, f);
    const lineOf = (i) => r.src.slice(0, i).split("\n").length;
    // コマンドの文字列（execSync('git add .') など）では、ステージしない
    for (const c of commandsOf(r)) {
      for (const text of c.texts) {
        for (const inv of gitInvocations(text)) for (const p of invocationProblems(inv, () => false)) problems.push(`${rel(repoRoot, f)}:${lineOf(c.index)} ${p}`);
      }
    }
    problems.push(...arrayStagingProblems(repoRoot, f, r));
  }
  // commitAndSync に渡すパスは、台帳でオーナーが書く出力
  const defFile = path.join(repoRoot, GIT_SYNC);
  if (fs.existsSync(defFile)) {
    const { calls, valueUse } = callSitesOf(repoRoot, jsFiles, defFile, "commitAndSync");
    if (valueUse) problems.push(`commitAndSync を値として渡している（${valueUse}）`);
    for (const s of calls) {
      const at = `${rel(repoRoot, s.resolver.file)}:${s.resolver.src.slice(0, s.index).split("\n").length} commitAndSync`;
      const paths = s.args[1] ? s.resolver.eval(s.args[1], s.index) : [];
      if (!paths.length) problems.push(`${at}: パスをたどれない`);
      for (const p of paths) if (!isWrittenBy(p, "owner")) problems.push(`${at}: 台帳でオーナーが書く出力ではない ${p}`);
    }
  }
  return problems;
}

// コマンドの文字列から、起動するスクリプト（node scripts/x.mjs 引数 / npm run 名前）を取り出す
function launchedScripts(repoRoot, text, depth = 0) {
  const out = [];
  for (const m of text.matchAll(/(?:^|[\s"'(&|;])node(?:\.exe)?\s+((?:--?[\w-]+(?:=\S+)?\s+)*)([^\s;&|"']+\.(?:mjs|cjs|js))([^;&|\n]*)/g)) {
    out.push({ script: m[2].replace(/^\.\//, ""), args: m[3].trim().split(/\s+/).filter(Boolean) });
  }
  for (const m of text.matchAll(/\bnpm\s+(?:run(?:-script)?\s+([\w:-]+)|(test|start))/g)) {
    const name = m[1] || m[2];
    if (name === "test" || depth > 3) continue; // テストは一時フォルダに書く
    const pkgFile = path.join(repoRoot, "package.json");
    const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, "utf8")) : {};
    if (pkg.scripts?.[name]) out.push(...launchedScripts(repoRoot, pkg.scripts[name], depth + 1));
  }
  return out;
}

// workflow が動かすスクリプト（リポのルートからの相対パス）
export function workflowScripts(repoRoot) {
  const dir = path.join(repoRoot, ".github/workflows");
  const out = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const text = fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    for (const s of launchedScripts(repoRoot, text)) out.add(s.script);
  }
  return [...out];
}

// フラグで止めている書き出し（const ONLY = process.argv.includes('--x'); if (!ONLY) write(...)）で、そのフラグを渡しているもの
function skippedByFlag(src, index, args) {
  const lineStart = src.lastIndexOf("\n", index) + 1;
  const m = src.slice(lineStart, index).match(/if\s*\(\s*!\s*([A-Za-z_$][\w$]*)\s*\)/);
  if (!m) return false;
  const def = src.match(new RegExp(`(?:const|let|var)\\s+${m[1].replace(/\$/g, "\\$")}\\s*=\\s*process\\.argv\\.includes\\(\\s*["']([^"']+)["']\\s*\\)`));
  return Boolean(def && args.includes(def[1]));
}

// 入口（owner: ランチャーなど / ci: workflow のスクリプト）の書き出しが、台帳でその書く側が書く出力か。
// 見るもの: 入口とそこから起動するスクリプト（node scripts/x.mjs・npm run）の書き出しと、それぞれが直接 import するモジュールの書き出し
export function entrypointWriterProblems(repoRoot, entries) {
  const files = codeFiles(repoRoot, { all: !fs.existsSync(path.join(repoRoot, ".git")) });
  const problems = [];
  for (const [writer, scripts] of Object.entries(entries)) {
    const seen = new Set();
    const visit = (script, args, via, depth) => {
      const key = `${script} ${args.join(" ")}`;
      if (seen.has(key) || depth > 3) return;
      seen.add(key);
      const file = path.join(repoRoot, script);
      if (!fs.existsSync(file)) {
        problems.push(`${via}${script}: 起動するスクリプトが見つからない`);
        return;
      }
      const src = fs.readFileSync(file, "utf8");
      const imported = [...src.matchAll(/import\s[^'"]*?from\s*["'](\.[^"']+)["']/g)].map((m) => path.resolve(path.dirname(file), m[1])).filter((p) => fs.existsSync(p));
      for (const mod of [file, ...imported]) {
        const modSrc = fs.readFileSync(mod, "utf8");
        for (const w of writeTargetsResolved(repoRoot, mod, files)) {
          if (mod === file && skippedByFlag(modSrc, w.index, args)) continue;
          for (const p of w.repoPaths) {
            const o = publicOutputOf(p);
            if (o && !o.writers.includes(writer)) problems.push(`${via}${rel(repoRoot, mod)}:${w.line}: ${p} は台帳で ${o.writers.join("・")} だけが書く出力（${writer} の入口から書いている）`);
          }
        }
      }
      for (const c of commandsOf(new Resolver(repoRoot, file))) {
        for (const text of c.texts) {
          // node に渡すスクリプトが値の分からない式（穴）なら、何を起動するかをたどれない
          if (/(?:^|\s)node(?:\.exe)?\s+(?:--?[\w-]+(?:=\S+)?\s+)*\u0001\d+\u0001/.test(text)) problems.push(`${via}${script}: 起動するスクリプトをたどれない（${text.replace(/\u0001\d+\u0001/g, "*")}）`);
          for (const s of launchedScripts(repoRoot, text)) {
            if (HOLE_RE.test(s.script) || s.script.includes("*")) problems.push(`${via}${script}: 起動するスクリプトをたどれない（${s.script.replace(/\u0001\d+\u0001/g, "*")}）`);
            else visit(s.script, s.args, `${via}${script} → `, depth + 1);
          }
        }
      }
    };
    for (const s of scripts) visit(s, [], "", 0);
  }
  return problems;
}
