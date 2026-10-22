// scripts/**/*.mjs の fs の書き出し（writeFileSync・appendFileSync・renameSync の行き先など）を静的に集め、
// 書き先の式を「どこを基点にしたパスか」までたどる。tests/public_tree.test.mjs が、リポ内の書き先がすべて公開出力の台帳にあるか
// gitignore 済みかを確かめる（書き先を文字列の一覧で持たず、コードから導く）。
// 戻り値の各パス: "<repo>/相対パス"（* は実行時に決まる名前）、"<outside>"（ownerDir・一時フォルダ・ホーム）、"<arg>"（呼び出し側が渡すパス）、"<unknown>"（たどれない）
import fs from "fs";
import path from "path";

const WRITE_CALL = /\b(writeFileSync|appendFileSync|createWriteStream|copyFileSync|renameSync|cpSync|writeFile|appendFile)\s*\(/g;
const DEST_IS_SECOND = new Set(["copyFileSync", "renameSync", "cpSync"]);
const OUTSIDE = "<outside>";
const ARG = "<arg>";
const UNKNOWN = "<unknown>";

// 括弧・文字列・テンプレートの中を飛ばして、トップレベルの位置 i から閉じ括弧までを読む
function scanTop(s, start, onTop) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const q = ch;
      for (i++; i < s.length && s[i] !== q; i++) {
        if (s[i] === "\\") i++;
        else if (q === "`" && s[i] === "$" && s[i + 1] === "{") {
          let d = 1;
          for (i += 2; i < s.length && d > 0; i++) {
            if (s[i] === "{") d++;
            else if (s[i] === "}") d--;
          }
          i--;
        }
      }
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) {
      if (depth === 0) return i;
      depth--;
    } else if (depth === 0 && onTop) {
      const stop = onTop(i);
      if (stop) return i;
    }
  }
  return s.length;
}

function splitTop(s, sep) {
  const parts = [];
  let last = 0;
  scanTop(s, 0, (i) => {
    if (s.startsWith(sep, i)) {
      parts.push(s.slice(last, i));
      last = i + sep.length;
    }
    return false;
  });
  parts.push(s.slice(last));
  return parts.map((p) => p.trim());
}

function argsOf(s, open) {
  const close = scanTop(s, open + 1);
  return { args: splitTop(s.slice(open + 1, close), ","), end: close };
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const esc = (s) => s.replace(/\$/g, "\\$");

// src の中の name の定義をすべて返す（宣言・行頭の代入・for-of・分割代入・関数の引数・関数・import）
function allDefinitionsOf(src, name) {
  const n = esc(name);
  const defs = [];
  const add = (kind, index, expr, extra = {}) => defs.push({ kind, index, expr: expr?.trim(), ...extra });
  const exprAt = (start) => src.slice(start, scanTop(src, start, (i) => src[i] === "," || src[i] === ";" || src[i] === "\n")).trim();
  for (const m of src.matchAll(new RegExp(`(?:\\b(?:const|let|var)\\s+|^[ \\t]*)${n}\\s*=(?![=>])\\s*`, "gm"))) add("value", m.index, exprAt(m.index + m[0].length));
  for (const m of src.matchAll(new RegExp(`for\\s*\\(\\s*(?:const|let)\\s+${n}\\s+of\\s+([^\\n]+?)\\)\\s*\\{?\\s*$`, "gm"))) add("for-of", m.index, m[1]);
  // 分割代入: const [, , a, NAME] = rhs / const { a, NAME } = rhs
  for (const m of src.matchAll(new RegExp(`(?:const|let|var)\\s*[\\[{]([^\\]}=]*\\b${n}\\b[^\\]}=]*)[\\]}]\\s*=\\s*`, "g"))) add("destructure", m.index, exprAt(m.index + m[0].length));
  // 関数の引数: 既定値（{ rootDir = process.cwd() } / (a, b = x)）があればそれ、なければ呼び出し側が渡す値
  for (const m of src.matchAll(new RegExp(`[({,]\\s*${n}\\s*=(?![=>])\\s*`, "g"))) {
    if (/\b(?:const|let|var)\s*$/.test(src.slice(Math.max(0, m.index - 12), m.index + 1))) continue;
    add("param", m.index, src.slice(m.index + m[0].length, scanTop(src, m.index + m[0].length, (i) => src[i] === ",")).trim());
  }
  // 既定値の無い引数（関数の見出し function f(a, NAME) { / (a, NAME) => だけ。呼び出し f(NAME) は含めない）
  for (const m of src.matchAll(new RegExp(`(function\\s*[\\w$]*\\s*)?\\(\\s*(?:[\\w$]+\\s*,\\s*)*${n}\\s*[,)]`, "g"))) {
    const open = m.index + (m[1] || "").length;
    const after = src.slice(scanTop(src, open + 1) + 1);
    if (/^\s*=>/.test(after) || (m[1] && /^\s*\{/.test(after))) add("param", m.index, null);
  }
  for (const m of src.matchAll(new RegExp(`(?:function\\s+${n}\\s*\\(|(?:const|let)\\s+${n}\\s*=\\s*\\()`, "g"))) {
    const open = m.index + m[0].length - 1;
    const close = scanTop(src, open + 1);
    const params = splitTop(src.slice(open + 1, close), ",").map((p) => p.split("=")[0].trim()).filter(Boolean);
    const after = src.slice(close + 1);
    const arrow = after.match(/^\s*=>\s*/);
    if (!arrow && !/^\s*\{/.test(after)) continue;
    const bodyStart = arrow ? arrow[0].length : after.indexOf("{") + 1;
    const rest = after.slice(bodyStart);
    const body = arrow && !rest.startsWith("{") ? rest.slice(0, scanTop(rest, 0, (i) => rest[i] === ";" || rest[i] === "\n")) : rest.slice(rest.startsWith("{") ? 1 : 0, scanTop(rest, rest.startsWith("{") ? 1 : 0));
    add("function", m.index, null, { params, body, bodyIndex: close + 1 + bodyStart });
  }
  const imp = src.match(new RegExp(`import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*["'](\\.[^"']+)["']`));
  if (imp) add("import", imp.index, null, { from: imp[1] });
  return defs.sort((a, b) => a.index - b.index);
}

// pos で使っている name の定義: pos より前で一番近いもの（同じ名前への再代入はすべて候補）。前に無ければ最初のもの（関数・モジュールの定数）
function definitionsOf(src, name, pos) {
  const defs = allDefinitionsOf(src, name).filter((d) => d.kind !== "function");
  const before = defs.filter((d) => d.index < pos);
  if (before.length) {
    const near = before[before.length - 1];
    return near.kind === "value" ? before.filter((d) => d.kind === "value") : [near];
  }
  return defs.length ? [defs[0]] : [];
}

class Resolver {
  constructor(repoRoot, file, bindings = new Map()) {
    this.repoRoot = repoRoot;
    this.file = file;
    this.src = fs.readFileSync(file, "utf8");
    this.dirRel = path.relative(repoRoot, path.dirname(file)).split(path.sep).join("/");
    this.bindings = bindings;
    this.depth = 0;
  }

  fromModule(spec) {
    const f = path.resolve(path.dirname(this.file), spec);
    return fs.existsSync(f) ? new Resolver(this.repoRoot, f) : null;
  }

  // 名前 → 候補（pos はその名前を使っている位置）
  name(nameStr, pos) {
    if (this.bindings.has(nameStr)) return this.bindings.get(nameStr);
    if (nameStr === "ownerDir") return [OUTSIDE];
    const defs = definitionsOf(this.src, nameStr, pos);
    if (!defs.length) return [UNKNOWN];
    return defs.flatMap((d) => {
      if (d.kind === "import") {
        const mod = this.fromModule(d.from);
        return mod ? mod.name(nameStr, Infinity) : [UNKNOWN];
      }
      if (d.kind === "param") return d.expr ? this.eval(d.expr, d.index) : [ARG];
      if (d.kind === "for-of") {
        const v = this.eval(d.expr, d.index);
        return v.every((x) => x === UNKNOWN) ? ["*"] : v;
      }
      if (d.kind === "destructure") {
        if (/^process\.argv\b/.test(d.expr)) return [ARG];
        const call = d.expr.match(/^([A-Za-z_$][\w$]*)\s*\(/);
        return call ? this.member(call[1], nameStr, d.expr, d.index) : [UNKNOWN];
      }
      if (/^(?:null|undefined|""|''|\{\}|\[\])$/.test(d.expr)) return [];
      return this.eval(d.expr, d.index);
    });
  }

  // fn(...) が返すオブジェクトの key（const { key } = fn(...)）
  member(fnName, key, callExpr, pos) {
    const c = this.callee(fnName);
    if (!c) return [UNKNOWN];
    const { resolver, def } = c;
    const inner = new Resolver(this.repoRoot, resolver.file, this.bindArgs(def.params, callExpr, pos));
    const end = def.bodyIndex + def.body.length;
    const prop = def.body.match(new RegExp(`[{,]\\s*${esc(key)}\\s*:\\s*`));
    if (prop) {
      const start = prop.index + prop[0].length;
      return inner.eval(def.body.slice(start, scanTop(def.body, start, (i) => def.body[i] === ",")), end);
    }
    if (new RegExp(`[{,]\\s*${esc(key)}\\s*[,}]`).test(def.body)) return inner.name(key, end);
    return [UNKNOWN];
  }

  // 関数の定義（このファイル、なければ import 元）
  callee(fnName) {
    const own = allDefinitionsOf(this.src, fnName);
    const d = own.find((x) => x.kind === "function");
    if (d) return { resolver: this, def: d };
    const imp = own.find((x) => x.kind === "import");
    const mod = imp && this.fromModule(imp.from);
    const fd = mod && allDefinitionsOf(mod.src, fnName).find((x) => x.kind === "function");
    return fd ? { resolver: mod, def: fd } : null;
  }

  bindArgs(params, callExpr, pos) {
    const open = callExpr.indexOf("(");
    const { args } = argsOf(callExpr, open);
    const bound = new Map();
    params.forEach((p, i) => {
      if (IDENT.test(p)) bound.set(p, args[i] ? this.eval(args[i], pos) : [ARG]);
    });
    return bound;
  }

  // 式 → 候補のパスの配列
  eval(expr, pos = Infinity) {
    if (++this.depth > 40) return [UNKNOWN];
    try {
      return this.evalInner(expr.trim(), pos);
    } finally {
      this.depth--;
    }
  }

  evalInner(expr, pos) {
    if (expr.startsWith("(") && scanTop(expr, 1) === expr.length - 1) expr = expr.slice(1, -1).trim();
    for (const op of ["||", "??"]) {
      const parts = splitTop(expr, op);
      if (parts.length > 1) return parts.flatMap((p) => (/^process\.env\.\w+$/.test(p) ? [ARG] : this.eval(p, pos)));
    }
    const q = splitTop(expr, "?");
    if (q.length === 2 && splitTop(q[1], ":").length === 2) return splitTop(q[1], ":").flatMap((p) => this.eval(p, pos));
    let m;
    if (/^(?:null|undefined)$/.test(expr)) return [];
    if ((m = expr.match(/^(["'])((?:\\.|(?!\1).)*)\1$/))) return [m[2]];
    if (expr.startsWith("`") && expr.endsWith("`") && scanTop(expr, 0) === expr.length) {
      const body = expr.slice(1, -1);
      const lead = body.match(/^\$\{([^}]+)\}/);
      const rest = body.replace(/\$\{[^}]+\}/g, "*");
      if (lead) return this.eval(lead[1], pos).map((b) => (b.startsWith("<") && !b.startsWith("<repo>") ? b : b + rest.slice(1)));
      return [rest];
    }
    if (/^(?:__dirname|import\.meta\.dirname)$/.test(expr)) return [`<repo>/${this.dirRel}`];
    if (/^fileURLToPath\(import\.meta\.url\)$/.test(expr)) return [`<repo>/${this.dirRel}/${path.basename(this.file)}`];
    if (/^process\.cwd\(\)$/.test(expr)) return ["<repo>"];
    if (/^(?:os\.tmpdir\(\)|os\.homedir\(\)|process\.env\.RUNNER_TEMP)$/.test(expr) || /mkdtempSync\(/.test(expr)) return [OUTSIDE];
    if (/^process\.argv\b/.test(expr) || /^process\.env\.\w+$/.test(expr)) return [ARG];
    if ((m = expr.match(/^path\.(join|resolve|dirname)\s*\(/))) {
      const { args, end } = argsOf(expr, m[0].length - 1);
      if (end !== expr.length - 1) return [UNKNOWN];
      if (m[1] === "dirname") return this.eval(args[0], pos).map((p) => (p.startsWith("<") && !p.startsWith("<repo>/") ? p : path.posix.dirname(p)));
      const [first, ...more] = args;
      let bases = this.eval(first, pos);
      if (m[1] === "resolve") bases = bases.map((b) => (b.startsWith("<") || path.posix.isAbsolute(b) ? b : `<repo>/${b}`));
      // 2 つ目以降で決まらないのはファイル名（実行時に決まる）→ *。候補が複数（for-of の配列など）ならすべて
      let combos = [[]];
      for (const a of more) {
        const v = this.eval(a, pos);
        const parts = v.length > 0 && v.every((x) => !x.startsWith("<")) ? v : ["*"];
        combos = combos.flatMap((c) => parts.map((p) => [...c, p]));
      }
      return bases.flatMap((b) => (b === OUTSIDE || b === ARG || b === UNKNOWN ? [b] : combos.map((c) => path.posix.normalize([b, ...c].join("/")))));
    }
    // x.replace(...) / x.slice(...) などファイル名だけを変える呼び出しは、置き場所（ディレクトリ）を変えない
    if ((m = expr.match(/^([\s\S]+?)\.(?:replace|replaceAll|slice|trim)\s*\(/)) && scanTop(expr, m[0].length) === expr.length - 1) {
      return this.eval(m[1], pos).map((p) => (p.startsWith("<") && !p.startsWith("<repo>/") ? p : `${path.posix.dirname(p)}/*`));
    }
    // list.map((f) => path.join(dir, f)) の要素（f は実行時に決まる名前）
    if ((m = expr.match(/\.map\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([\s\S]+)\)$/))) {
      const inner = new Resolver(this.repoRoot, this.file, new Map([...this.bindings, [m[1], ["*"]]]));
      return inner.eval(m[2], pos);
    }
    if ((m = expr.match(/^\[([\s\S]*)\]$/))) return splitTop(m[1], ",").filter(Boolean).flatMap((p) => this.eval(p, pos));
    if ((m = expr.match(/^([A-Za-z_$][\w$]*)\s*\(/)) && scanTop(expr, m[0].length) === expr.length - 1) {
      const c = this.callee(m[1]);
      if (!c) return /^(?:readdirSync|listFiles)$/.test(m[1]) ? ["*"] : [UNKNOWN];
      const inner = new Resolver(this.repoRoot, c.resolver.file, this.bindArgs(c.def.params, expr, pos));
      const ret = c.def.body.match(/\breturn\s+([^;\n]+)/)?.[1] || c.def.body;
      return inner.eval(ret, c.def.bodyIndex + c.def.body.length);
    }
    if (IDENT.test(expr)) return this.name(expr, pos);
    if (/^(?:fs\.)?readdirSync\(|\.filter\(|\.map\(/.test(expr)) return ["*"];
    return [UNKNOWN];
  }
}
// 相対パス（基点の無い path.join("articles", f) など）は、スクリプトをリポのルートで実行したときの場所
const toRepoRel = (p) => {
  if (p === "<repo>") return "";
  if (p.startsWith("<repo>/")) return path.posix.normalize(p.slice("<repo>/".length));
  if (p.startsWith("<") || path.posix.isAbsolute(p)) return null;
  return path.posix.normalize(p);
};
// 置き場所（最初のディレクトリ）まで決まらない書き先（* から始まる）は、たどれなかったものとして扱う
const unresolved = (p) => p === UNKNOWN || /^(?:\.\/)?\*/.test(p) || /^<repo>\/\*/.test(p);

// file の書き出し呼び出し: [{ line, call, targets, unresolved: [たどれなかった書き先], repoPaths: [リポ内の相対パス] }]
export function writeTargetsOf(repoRoot, file) {
  const r = new Resolver(repoRoot, file);
  const out = [];
  for (const m of r.src.matchAll(WRITE_CALL)) {
    const lineStart = r.src.lastIndexOf("\n", m.index) + 1;
    if (/^\s*\/\//.test(r.src.slice(lineStart, m.index))) continue; // コメントの中
    const open = m.index + m[0].length - 1;
    const { args } = argsOf(r.src, open);
    const dest = DEST_IS_SECOND.has(m[1]) ? args[1] : args[0];
    const targets = dest ? r.eval(dest, m.index) : [UNKNOWN];
    out.push({
      line: r.src.slice(0, m.index).split("\n").length,
      call: m[1],
      targets,
      unresolved: targets.filter(unresolved),
      repoPaths: targets.filter((t) => !unresolved(t)).map(toRepoRel).filter((p) => p !== null),
    });
  }
  return out;
}

export function scriptFiles(repoRoot) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".mjs")) out.push(p);
    }
  };
  walk(path.join(repoRoot, "scripts"));
  return out;
}
