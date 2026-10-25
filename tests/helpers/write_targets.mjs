// リポのコード（scripts・src・ルートの設定。tests は除く）のファイルの書き出しを静的に集め、書き先の式を「どこを基点にしたパスか」までたどる。
// tests/public_tree.test.mjs が、リポ内の書き先がすべて公開出力の台帳にあるか gitignore 済みかを確かめる（書き先を文字列の一覧で持たず、コードから導く）。
// 書き出しの見つけ方: fs の書き出し API（別名の import・分割代入・代入した関数・fs.promises を含む）、openSync の書き込みモード、
// シェルのコマンドのリダイレクト・tee・Out-File・出力先の引数、.sh / .ps1 / .bat のリダイレクト。書き出し API を値として渡すもの・
// 検査できない種類のスクリプトは「たどれない」として返す（見逃さずに止める）。
// 戻り値の各パス: "<repo>/相対パス"（* は実行時に決まる名前）、"<outside>"（ownerDir・一時フォルダ・ホーム）、"<arg>"（コマンドラインの引数・環境変数）、
// "<param:関数名:位置>"（関数の引数。allWriteTargets が呼び出し元でたどる）、"<unknown>"（たどれない）
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { outputPathsWrittenBy } from "../../scripts/utils/public_tree.mjs";

export const OUTSIDE = "<outside>";
export const ARG = "<arg>";
export const UNKNOWN = "<unknown>";

// 書き出し API と、書き先の引数の位置（open は 2 つ目の引数のモードで決まる）
const WRITE_APIS = {
  writeFileSync: 0, appendFileSync: 0, createWriteStream: 0, truncateSync: 0, openSync: "open",
  copyFileSync: 1, renameSync: 1, cpSync: 1, symlinkSync: 1, linkSync: 1,
  writeFile: 0, appendFile: 0, truncate: 0, open: "open", copyFile: 1, rename: 1, cp: 1, symlink: 1, link: 1,
};
// 同期版の名前は fs のほかに意味が無いので、どの受け手でも書き出しとみなす
const SYNC_WRITE = new Set(Object.keys(WRITE_APIS).filter((n) => n.endsWith("Sync") || n === "createWriteStream"));
const FS_MODULE = /^(?:node:)?fs(?:\/promises)?$|^fs-extra$/;
const JS_EXT = /\.(?:mjs|cjs|js|ts|mts|cts|jsx|tsx|astro)$/;
const SHELL_EXT = /\.(?:sh|bash|zsh|ps1|psm1|bat|cmd)$/i;
// 書き出し先をたどれない種類のスクリプト（あれば止める）
const OTHER_SCRIPT_EXT = /\.(?:py|rb|pl|php|go|rs|java|kt|lua|vbs|ahk|jl|r|swift|exe|dll|jar)$/i;

// i の / が正規表現のリテラルの始まりなら、閉じる / の位置（違えば -1）。手前の文字で割り算と見分ける。
// 正規表現の中の ' " ` を文字列の始まりと取り違えると、その後ろの書き出しを読み落とす
export function regexEnd(s, i) {
  if (s[i] !== "/" || s[i + 1] === "/" || s[i + 1] === "*") return -1;
  let p = i - 1;
  while (p >= 0 && /\s/.test(s[p])) p--;
  const word = s.slice(Math.max(0, p - 11), p + 1).match(/[A-Za-z_$][\w$]*$/)?.[0];
  const regexContext = p < 0 || "(,=:[!&|?{};+-*%<>~^".includes(s[p]) || /^(?:return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await|instanceof)$/.test(word || "");
  if (!regexContext) return -1;
  let inClass = false;
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") j++;
    else if (c === "\n") return -1;
    else if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) return j;
  }
  return -1;
}

// 括弧・文字列・テンプレート・正規表現の中を飛ばして、トップレベルの位置 i から閉じ括弧までを読む
export function scanTop(s, start, onTop) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    const re = ch === "/" ? regexEnd(s, i) : -1;
    if (re > 0) {
      i = re;
      continue;
    }
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
    if (ch === "/" && s[i + 1] === "*") {
      const end = s.indexOf("*/", i + 2);
      i = end < 0 ? s.length : end + 1;
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

export function splitTop(s, sep) {
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

export function argsOf(s, open) {
  const close = scanTop(s, open + 1);
  return { args: splitTop(s.slice(open + 1, close), ","), end: close };
}

// コメントと文字列の中身を空白にした写し（位置はそのまま）。テンプレートの ${} の中はコードとして残す
export function maskCode(s) {
  const out = s.split("");
  const blank = (a, b) => {
    for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " ";
  };
  const skipString = (i) => {
    const q = s[i];
    let start = i + 1;
    let j = i + 1;
    for (; j < s.length && s[j] !== q; j++) {
      if (s[j] === "\\") j++;
      else if (q === "`" && s[j] === "$" && s[j + 1] === "{") {
        blank(start, j);
        const close = scanTop(s, j + 2);
        j = close;
        start = close + 1;
      }
    }
    blank(start, j);
    return j;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const re = ch === "/" ? regexEnd(s, i) : -1;
    if (re > 0) {
      blank(i + 1, re);
      i = re;
    } else if (ch === "/" && s[i + 1] === "/") {
      const end = s.indexOf("\n", i);
      blank(i, end < 0 ? s.length : end);
      i = end < 0 ? s.length : end;
    } else if (ch === "/" && s[i + 1] === "*") {
      const end = s.indexOf("*/", i + 2);
      blank(i, end < 0 ? s.length : end + 2);
      i = end < 0 ? s.length : end + 1;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      i = skipString(i);
    }
  }
  return out.join("");
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const esc = (s) => s.replace(/\$/g, "\\$");
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

// 引数の名前 NAME を持つ関数の名前と、引数の位置（名前の無い関数なら fn: null）
function functionOfParam(src, open, name) {
  const close = scanTop(src, open + 1);
  const params = splitTop(src.slice(open + 1, close), ",").map((p) => p.split("=")[0].trim());
  const idx = params.indexOf(name);
  const before = src.slice(Math.max(0, open - 200), open);
  const m =
    before.match(/function\s*\*?\s*([A-Za-z_$][\w$]*)\s*$/) ||
    before.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*\*?\s*)?$/) ||
    before.match(/(?:^|[\n;{}])\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*$/);
  const fn = m && !/^(?:if|for|while|switch|catch|function|return)$/.test(m[1]) ? m[1] : null;
  return { fn, idx, callbackBase: callbackBaseBefore(src, open) };
}

// expr が base.method(args) の形（最後の呼び出し）なら { base, args }
function lastCall(expr, method) {
  let found = null;
  for (const m of expr.matchAll(new RegExp(`\\.${method}\\s*\\(`, "g"))) {
    const open = m.index + m[0].length - 1;
    if (scanTop(expr, open + 1) === expr.length - 1) found = { base: expr.slice(0, m.index).trim(), args: expr.slice(open + 1, -1) };
  }
  return found;
}

const CALLBACK_METHODS =/\.(?:forEach|map|flatMap|filter|some|every|find|findLast)\(\s*(?:async\s*)?$/;
// list.forEach((x) => ...) の list の式（x は list の要素）。コールバックでなければ null
function callbackBaseBefore(src, open) {
  const head = src.slice(Math.max(0, open - 400), open);
  const cb = head.match(CALLBACK_METHODS);
  if (!cb) return null;
  // 呼び出しの手前の式を後ろから読む（識別子・. ・対になった括弧）
  let i = head.length - cb[0].length - 1;
  while (i >= 0) {
    const ch = head[i];
    if (ch === ")" || ch === "]") {
      const open2 = ch === ")" ? "(" : "[";
      let d = 0;
      for (; i >= 0; i--) {
        if (head[i] === ch) d++;
        else if (head[i] === open2 && --d === 0) break;
      }
      i--;
    } else if (/[\w$.]/.test(ch)) i--;
    else break;
  }
  const base = head.slice(i + 1, head.length - cb[0].length).trim();
  return base || null;
}

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
  // 既定値の無い引数（関数の見出し function f(a, NAME) { / (a, NAME) => / メソッド f(a, NAME) { だけ。呼び出し f(NAME) は含めない）
  for (const m of src.matchAll(new RegExp(`(function\\s*\\*?\\s*[\\w$]*\\s*)?\\(\\s*(?:[\\w$]+\\s*,\\s*)*${n}\\s*[,)]`, "g"))) {
    const open = m.index + (m[1] || "").length;
    const after = src.slice(scanTop(src, open + 1) + 1);
    const isMethod = /(?:^|[\n;{}])\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*$/.test(src.slice(Math.max(0, open - 80), open));
    if (/^\s*=>/.test(after) || (/^\s*\{/.test(after) && (m[1] || isMethod))) add("param", m.index, null, functionOfParam(src, open, name));
  }
  // 括弧の無い 1 引数のアロー関数 name => ...
  for (const m of src.matchAll(new RegExp(`(?<![\\w$.])${n}\\s*=>`, "g"))) add("param", m.index, null, { fn: null, idx: 0, callbackBase: callbackBaseBefore(src, m.index) });
  // コールバックの組の分割 list.forEach(([NAME, other]) => ...): NAME は list の要素の組の k 番目
  for (const m of src.matchAll(new RegExp(`\\(\\s*\\[([^\\]]*\\b${n}\\b[^\\]]*)\\]\\s*\\)\\s*=>`, "g"))) {
    const k = m[1].split(",").map((x) => x.trim()).indexOf(name);
    const base = callbackBaseBefore(src, m.index);
    if (k >= 0 && base) add("param", m.index, null, { fn: null, idx: -1, callbackBase: base, tupleIndex: k });
  }
  for (const m of src.matchAll(new RegExp(`(?:function\\s+${n}\\s*\\(|(?:const|let)\\s+${n}\\s*=\\s*(?:async\\s*)?\\()`, "g"))) {
    const open = m.index + m[0].length - 1;
    const close = scanTop(src, open + 1);
    const params = splitTop(src.slice(open + 1, close), ",").map((p) => p.split("=")[0].trim()).filter(Boolean);
    const after = src.slice(close + 1);
    const arrow = after.match(/^\s*=>\s*/);
    if (!arrow && !/^\s*\{/.test(after)) continue;
    const bodyStart = arrow ? arrow[0].length : after.indexOf("{") + 1;
    const rest = after.slice(bodyStart);
    const body = arrow && !rest.startsWith("{") ? rest.slice(0, scanTop(rest, 0, (i) => rest[i] === ";" || rest[i] === "\n")) : rest.slice(rest.startsWith("{") ? 1 : 0, scanTop(rest, rest.startsWith("{") ? 1 : 0));
    add("function", m.index, null, { params, body, bodyIndex: close + 1 + bodyStart + (arrow && rest.startsWith("{") ? 1 : 0) });
  }
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g)) {
    for (const spec of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
      const [orig, local = orig] = spec.split(/\s+as\s+/).map((x) => x.trim());
      if (local === name) add("import", m.index, null, { from: m[2], orig });
    }
  }
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

// コマンドの文字列の穴（${...}・値の分からない式）の印
const HOLE = (i) => `\u0001${i}\u0001`;
const HOLE_RE = /\u0001(\d+)\u0001/g;

export class Resolver {
  constructor(repoRoot, file, bindings = new Map(), src = null) {
    this.repoRoot = repoRoot;
    this.file = file;
    this.src = src ?? fs.readFileSync(file, "utf8");
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
        return mod ? mod.name(d.orig, Infinity) : [UNKNOWN];
      }
      if (d.kind === "param") {
        if (d.expr) return this.eval(d.expr, d.index);
        if (d.callbackBase) return d.tupleIndex !== undefined ? this.tupleElements(d.callbackBase, d.tupleIndex, d.index) : this.elements(d.callbackBase, d.index);
        return d.fn && d.idx >= 0 ? [`<param:${d.fn}:${d.idx}>`] : [UNKNOWN];
      }
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
    const inner = new Resolver(this.repoRoot, resolver.file, this.bindArgs(def.params, callExpr, pos), resolver.src);
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
    const fd = mod && allDefinitionsOf(mod.src, imp.orig).find((x) => x.kind === "function");
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
    expr = expr.replace(/^await\s+/, "");
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
    // 台帳から作るパス（outputPathsWrittenBy('owner')）は、台帳の値そのもの
    if ((m = expr.match(/^outputPathsWrittenBy\(\s*(["'])(\w+)\1\s*\)$/))) return outputPathsWrittenBy(m[2]);
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
      return bases.flatMap((b) => (b.startsWith("<") && !b.startsWith("<repo>") ? [b] : combos.map((c) => path.posix.normalize([b, ...c].join("/")))));
    }
    // x.filter(...) は x の一部（候補は x と同じ）
    if ((m = expr.match(/^([\s\S]+?)\.filter\s*\(/)) && scanTop(expr, m[0].length) === expr.length - 1) return this.eval(m[1], pos);
    // x.replace(...) / x.slice(...) などファイル名だけを変える呼び出しは、置き場所（ディレクトリ）を変えない
    if ((m = expr.match(/^([\s\S]+?)\.(?:replace|replaceAll|slice|trim)\s*\(/)) && scanTop(expr, m[0].length) === expr.length - 1) {
      return this.eval(m[1], pos).map((p) => (p.startsWith("<") && !p.startsWith("<repo>/") ? p : `${path.posix.dirname(p)}/*`));
    }
    // list.map((f) => path.join(dir, f)) の要素（f は list の要素。list をたどれなければ実行時に決まる名前）
    const mapped = lastCall(expr, "map");
    if (mapped && (m = mapped.args.match(/^\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([\s\S]+)$/))) {
      const inner = new Resolver(this.repoRoot, this.file, new Map([...this.bindings, [m[1], this.elements(mapped.base, pos)]]), this.src);
      return inner.eval(m[2], pos);
    }
    if ((m = expr.match(/^\[([\s\S]*)\]$/))) return splitTop(m[1], ",").filter(Boolean).flatMap((p) => this.eval(p.startsWith("...") ? p.slice(3) : p, pos));
    if ((m = expr.match(/^([A-Za-z_$][\w$]*)\s*\(/)) && scanTop(expr, m[0].length) === expr.length - 1) {
      const c = this.callee(m[1]);
      if (!c) return /^(?:readdirSync|listFiles)$/.test(m[1]) ? ["*"] : [UNKNOWN];
      const inner = new Resolver(this.repoRoot, c.resolver.file, this.bindArgs(c.def.params, expr, pos), c.resolver.src);
      const ret = c.def.body.match(/\breturn\s+([^;\n]+)/)?.[1] || c.def.body;
      return inner.eval(ret, c.def.bodyIndex + c.def.body.length);
    }
    if (IDENT.test(expr)) return this.name(expr, pos);
    if (/^(?:fs\.)?readdirSync\(|\.filter\(|\.map\(/.test(expr)) return ["*"];
    return [UNKNOWN];
  }

  // 配列の式の要素（パスの候補）。たどれなければ実行時に決まる名前（*）
  elements(expr, pos) {
    const v = this.eval(expr, pos);
    return v.length === 0 || v.some((x) => x === UNKNOWN) ? ["*"] : v;
  }

  // 組の配列 list の各組の k 番目（list = base.map((g) => [e0, e1]) / [[a, b], ...]）
  tupleElements(expr, k, pos) {
    expr = expr.trim();
    if (++this.depth > 40) return [UNKNOWN];
    try {
      if (IDENT.test(expr)) {
        const defs = definitionsOf(this.src, expr, pos).filter((d) => d.kind === "value" && d.expr);
        return defs.length ? defs.flatMap((d) => this.tupleElements(d.expr, k, d.index)) : [UNKNOWN];
      }
      const filtered = lastCall(expr, "filter");
      if (filtered) return this.tupleElements(filtered.base, k, pos);
      const mapped = lastCall(expr, "map");
      const m = mapped && mapped.args.match(/^\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*\[([\s\S]*)\]\s*$/);
      if (m) {
        const e = splitTop(m[2], ",")[k];
        if (!e) return [UNKNOWN];
        const inner = new Resolver(this.repoRoot, this.file, new Map([...this.bindings, [m[1], this.elements(mapped.base, pos)]]), this.src);
        return inner.eval(e, pos);
      }
      const lit = expr.match(/^\[([\s\S]*)\]$/);
      if (lit) return splitTop(lit[1], ",").filter(Boolean).flatMap((t) => (t.startsWith("[") ? this.eval(splitTop(t.slice(1, -1), ",")[k] || "undefined", pos) : [UNKNOWN]));
      return [UNKNOWN];
    } finally {
      this.depth--;
    }
  }

  // 式 → 文字列の候補（コマンドの組み立て用）。値の分からない部分は穴（HOLE）にして、穴の式を holes に残す
  str(expr, pos, holes) {
    expr = expr.trim();
    if (++this.depth > 40) return [HOLE(holes.push(expr) - 1)];
    try {
      let m;
      if (expr.startsWith("(") && scanTop(expr, 1) === expr.length - 1) return this.str(expr.slice(1, -1), pos, holes);
      if ((m = expr.match(/^(["'])((?:\\.|(?!\1).)*)\1$/))) return [m[2].replace(/\\(.)/g, "$1")];
      if (expr.startsWith("`") && expr.endsWith("`") && scanTop(expr, 0) === expr.length) {
        let out = [""];
        const body = expr.slice(1, -1);
        let i = 0;
        while (i < body.length) {
          if (body[i] === "$" && body[i + 1] === "{") {
            const close = scanTop(body, i + 2);
            const inner = this.str(body.slice(i + 2, close), pos, holes);
            out = out.flatMap((o) => inner.map((x) => o + x));
            i = close + 1;
          } else {
            out = out.map((o) => o + body[i]);
            i++;
          }
        }
        return out;
      }
      const plus = splitTop(expr, "+");
      if (plus.length > 1) return plus.reduce((acc, p) => acc.flatMap((a) => this.str(p, pos, holes).map((x) => a + x)), [""]);
      if ((m = expr.match(/^\[([\s\S]*)\]$/))) return [splitTop(m[1], ",").filter(Boolean).map((p) => (p.startsWith("...") ? HOLE(holes.push(p.slice(3)) - 1) : this.str(p, pos, holes)[0])).join(" ")];
      if (expr === "process.execPath") return ["node"];
      // path.join('scripts', 'x.mjs') などのパスは、たどれた候補（<repo>/ は外す）
      if (/^path\.(?:join|resolve)\s*\(/.test(expr)) {
        const v = this.eval(expr, pos);
        if (v.length && v.every((x) => x === "<repo>" || x.startsWith("<repo>/") || !x.startsWith("<"))) return v.map((x) => x.replace(/^<repo>\/?/, ""));
      }
      if (IDENT.test(expr) && !this.bindings.has(expr)) {
        const defs = definitionsOf(this.src, expr, pos).filter((d) => d.kind === "value" && d.expr);
        if (defs.length) return defs.flatMap((d) => this.str(d.expr, d.index, holes));
      }
      // Buffer.from(X, 'utf16le').toString('base64')（PowerShell の -EncodedCommand）は X の中身
      if ((m = expr.match(/^([A-Za-z_$][\w$]*)\.toString\(\s*['"]base64['"]\s*\)$/))) {
        const def = definitionsOf(this.src, m[1], pos).find((d) => d.kind === "value" && /^Buffer\.from\(/.test(d.expr || ""));
        if (def) return this.str(argsOf(def.expr, def.expr.indexOf("(")).args[0], def.index, holes).map((t) => `<<decoded>> ${t}`);
      }
      return [HOLE(holes.push(expr) - 1)];
    } finally {
      this.depth--;
    }
  }
}

// 相対パス（基点の無い path.join("articles", f) など）は、スクリプトをリポのルートで実行したときの場所
const toRepoRel = (p) => {
  if (p === "<repo>") return "";
  if (p.startsWith("<repo>/")) return path.posix.normalize(p.slice("<repo>/".length));
  if (p.startsWith("<") || path.posix.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("~")) return null;
  return path.posix.normalize(p);
};
// 置き場所（最初のディレクトリ）まで決まらない書き先（* から始まる）は、たどれなかったものとして扱う
const isUnresolved = (p) => p === UNKNOWN || /^(?:\.\/)?\*/.test(p) || /^<repo>\/\*/.test(p);
const isParam = (p) => /^<param:/.test(p);

function entry(file, src, index, call, targets, unresolvedWhy = []) {
  return {
    file,
    index,
    line: lineOf(src, index),
    call,
    targets,
    unresolved: [...targets.filter(isUnresolved), ...unresolvedWhy],
    repoPaths: targets.filter((t) => !isUnresolved(t) && !isParam(t)).map(toRepoRel).filter((p) => p !== null),
  };
}

// このファイルで fs の書き出し API を指す名前: 名前空間（fs・fsp・fs.promises）と、関数の別名（put → writeFileSync）
function fsBindingsOf(src) {
  const ns = new Set(["fs", "fsp"]);
  const alias = new Map();
  const addSpecs = (list, sep) => {
    for (const spec of list.split(",").map((x) => x.trim()).filter(Boolean)) {
      const [orig, local = orig] = spec.split(sep).map((x) => x.trim());
      if (orig in WRITE_APIS) alias.set(local, orig);
      if (orig === "promises") ns.add(local);
    }
  };
  for (const m of src.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s*(?:,\s*\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g)) {
    if (!FS_MODULE.test(m[3])) continue;
    ns.add(m[1]);
    if (m[2]) addSpecs(m[2], /\s+as\s+/);
  }
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) if (FS_MODULE.test(m[2])) addSpecs(m[1], /\s+as\s+/);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:require\(\s*["']([^"']+)["']\s*\)(\.promises)?|([A-Za-z_$][\w$]*)\.promises)\s*;?\s*$/gm)) {
    if (m[2] ? FS_MODULE.test(m[2]) : ns.has(m[4])) ns.add(m[1]);
  }
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:require\(\s*["']([^"']+)["']\s*\)|([A-Za-z_$][\w$]*)(?:\.promises)?)/g)) {
    if (m[2] ? FS_MODULE.test(m[2]) : ns.has(m[3])) addSpecs(m[1], /\s*:\s*/);
  }
  // const put = fs.writeFileSync / fs.promises.writeFile
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)(?:\.promises)?\.([A-Za-z]+)\s*(?:\.bind\([^)]*\))?\s*;?\s*$/gm)) {
    if (ns.has(m[2]) && m[3] in WRITE_APIS) alias.set(m[1], m[3]);
  }
  return { ns, alias };
}

// open / openSync のモードが書き込みか（モードを省くと読み取り）
function opensForWrite(flagExpr) {
  if (!flagExpr) return false;
  const m = flagExpr.match(/^(["'])([a-z+]+)\1$/);
  if (!m) return true;
  return !/^rs?$/.test(m[2]);
}

// コマンドの文字列の中の書き先（リダイレクト・tee・PowerShell の書き出し・出力先の引数）
const TOKEN = String.raw`("[^"]*"|'[^']*'|[^\s;&|<>]+)`;
const REDIRECT_RES = [
  new RegExp(String.raw`(?:^|[\s;&|(])(?:[0-9]?>{1,2}|&>{1,2})(?!&)\s*${TOKEN}`, "g"),
  new RegExp(String.raw`\|\s*tee\s+(?:-[a-z]+\s+)*${TOKEN}`, "gi"),
  new RegExp(String.raw`\b(?:Out-File|Set-Content|Add-Content|Export-Csv|Export-Clixml|Tee-Object)\b(?:\s+-(?:FilePath|Path|LiteralPath))?\s+${TOKEN}`, "gi"),
  new RegExp(String.raw`(?:^|\s)--?(?:[\w-]*(?:output|outfile|screenshot|print-to-pdf|dest(?:ination)?|log-file)|out|o)(?:=|\s+)${TOKEN}`, "gi"),
];
const DISCARD = /^(?:\/dev\/null|nul|\$null|&\d)$/i;
// コピー・移動・リンクのプログラム（書き先は最後の引数。robocopy は 2 つ目）
const COPY_PROGRAMS = /^(?:cp|mv|install|ln|rsync|scp|copy|move|xcopy|robocopy|Copy-Item|Move-Item|cpi|mi)(?:\.exe)?$/i;
function copyDestinations(text) {
  const out = [];
  for (const seg of text.split(/&&|\|\||[;&|\n]/)) {
    const words = seg.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
    const prog = (words[0] || "").replace(/^["']|["']$/g, "").split(/[\\/]/).pop();
    if (!COPY_PROGRAMS.test(prog)) continue;
    const positional = words.slice(1).filter((w) => !/^-/.test(w)).map((w) => w.replace(/^(["'])(.*)\1$/, "$2"));
    const dest = /^robocopy/i.test(prog) ? positional[1] : positional.length > 1 ? positional[positional.length - 1] : null;
    if (dest && !DISCARD.test(dest)) out.push(dest);
  }
  return out;
}
export function commandWriteTokens(text) {
  const out = [];
  for (const re of REDIRECT_RES) {
    for (const m of text.matchAll(re)) {
      const t = m[1].replace(/^(["'])(.*)\1$/, "$2");
      if (t && !DISCARD.test(t)) out.push(t);
    }
  }
  return [...new Set([...out, ...copyDestinations(text)])];
}

// トークン（穴を含みうる）→ 書き先の候補。穴そのものなら穴の式をたどる。cwd は呼び出しの cwd（既定はリポのルート）
function tokenTargets(r, token, holes, cwdBases, pos) {
  const whole = token.match(/^\u0001(\d+)\u0001$/);
  if (whole) return r.eval(holes[Number(whole[1])], pos);
  const lead = token.match(/^\u0001(\d+)\u0001(.*)$/);
  if (lead) return r.eval(holes[Number(lead[1])], pos).map((b) => (b.startsWith("<") && !b.startsWith("<repo>") ? b : b + lead[2].replace(HOLE_RE, "*")));
  const t = token.replace(HOLE_RE, "*");
  if (t.startsWith("$") || t.startsWith("%")) return [ARG];
  if (path.posix.isAbsolute(t) || /^[A-Za-z]:[\\/]/.test(t) || t.startsWith("~")) return [OUTSIDE];
  return cwdBases.map((b) => (b.startsWith("<") && !b.startsWith("<repo>") ? b : path.posix.normalize(`${b}/${t}`)));
}

// import / export ... from の文の範囲（複数行を含む）。その中の名前は呼び出しでも値の使用でもない
export function importRanges(src) {
  return [...src.matchAll(/(?:^|\n)[ \t]*(?:import|export)\b[^;'"`]*?\bfrom\s*["'][^"']+["']|(?:^|\n)[ \t]*(?:const|let|var)\s*\{[^}]*\}\s*=\s*require\([^)]*\)/g)].map((m) => [m.index, m.index + m[0].length]);
}
export const inRanges = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b);

const CHILD_CALLS = new Set(["exec", "execSync", "spawn", "spawnSync", "execFile", "execFileSync", "fork"]);
// このファイルで child_process の関数を指す名前: 名前空間（cp.execSync）と、関数の別名（run → execSync）
function childBindingsOf(src) {
  const ns = new Set();
  const local = new Map();
  const isChild = (spec) => /^(?:node:)?child_process$/.test(spec);
  const addSpecs = (list, sep) => {
    for (const spec of list.split(",").map((x) => x.trim()).filter(Boolean)) {
      const [orig, as = orig] = spec.split(sep).map((x) => x.trim());
      if (CHILD_CALLS.has(orig)) local.set(as, orig);
    }
  };
  for (const m of src.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s*(?:,\s*\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g)) {
    if (!isChild(m[3])) continue;
    ns.add(m[1]);
    if (m[2]) addSpecs(m[2], /\s+as\s+/);
  }
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) if (isChild(m[2])) addSpecs(m[1], /\s+as\s+/);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g)) if (isChild(m[2])) ns.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g)) if (isChild(m[2])) addSpecs(m[1], /\s*:\s*/);
  return { ns, local };
}

// child_process の呼び出しのコマンドの文字列: [{ index, call, texts, holes, cwdBases, shell }]
export function commandsOf(r) {
  const masked = maskCode(r.src);
  const { ns, local } = childBindingsOf(r.src);
  const out = [];
  for (const m of masked.matchAll(/(?<![\w$.])(?:([A-Za-z_$][\w$]*)\.)?([A-Za-z_$][\w$]*)\s*\(/g)) {
    const call = m[1] ? (ns.has(m[1]) && CHILD_CALLS.has(m[2]) ? m[2] : null) : local.get(m[2]);
    if (!call) continue;
    const open = m.index + m[0].length - 1;
    const { args } = argsOf(r.src, open);
    const holes = [];
    const isExec = call === "exec" || call === "execSync";
    const opts = (isExec ? args[1] : args.find((a, i) => i > 0 && a.startsWith("{"))) || "";
    // fork(モジュール, 引数) は node でそのモジュールを起動する
    const progs = r.str(args[0] || "''", m.index, holes).map((p) => (call === "fork" ? `node ${p.replace(/^<repo>\//, "")}` : p));
    const texts = isExec || !(args[1] || "").startsWith("[") ? progs : progs.flatMap((p) => r.str(args[1], m.index, holes).map((a) => `${p} ${a}`));
    const cwdExpr = opts.match(/\bcwd\s*:\s*([^,}]+)/)?.[1];
    const cwdBases = cwdExpr ? r.eval(cwdExpr, m.index) : ["<repo>"];
    out.push({ index: m.index, call, texts, holes, cwdBases, shell: isExec || /\bshell\s*:\s*true/.test(opts) });
  }
  return out;
}

function shellWrites(file, text) {
  return commandWriteTokens(text).map((t) => entry(file, text, Math.max(0, text.indexOf(t)), "shell>", [t.startsWith("$") || t.startsWith("%") ? ARG : path.posix.isAbsolute(t) || /^[A-Za-z]:[\\/]/.test(t) ? OUTSIDE : t]));
}

// file の書き出し: [{ file, index, line, call, targets, unresolved, repoPaths }]
export function writeTargetsOf(repoRoot, file) {
  const rel = path.relative(repoRoot, file).split(path.sep).join("/");
  if (SHELL_EXT.test(file)) return shellWrites(file, fs.readFileSync(file, "utf8"));
  if (OTHER_SCRIPT_EXT.test(file)) return [entry(file, "", 0, "script", [], [`検査できない種類のスクリプト ${rel}`])];
  let src = fs.readFileSync(file, "utf8");
  // .astro はビルド時に動くフロントマター（先頭の --- の間）だけがサーバー側のコード
  if (file.endsWith(".astro")) {
    const fm = src.match(/^---\r?\n[\s\S]*?\r?\n---/);
    src = fm ? fm[0] + src.slice(fm[0].length).replace(/[^\n]/g, " ") : src.replace(/[^\n]/g, " ");
  }
  const r = new Resolver(repoRoot, file, new Map(), src);
  const masked = maskCode(src);
  const { ns, alias } = fsBindingsOf(src);
  const isFsRecv = (recv) => ns.has(recv) || [...ns].some((n) => recv === `${n}.promises`);
  const out = [];
  // 書き出し API の呼び出し
  for (const m of masked.matchAll(/(?<![\w$])((?:[A-Za-z_$][\w$]*\s*\.\s*)*)([A-Za-z_$][\w$]*)\s*\(/g)) {
    const recv = m[1].replace(/\s+/g, "").replace(/\.$/, "");
    const name = m[2];
    let api = null;
    if (!recv && alias.has(name)) api = alias.get(name);
    else if (name in WRITE_APIS && (SYNC_WRITE.has(name) || (recv && isFsRecv(recv)))) api = name;
    if (!api) continue;
    if (/(?:function\s+|async\s+)$/.test(masked.slice(Math.max(0, m.index - 12), m.index))) continue; // 同じ名前の関数・メソッドの定義
    const open = m.index + m[0].length - 1;
    const { args } = argsOf(src, open);
    const at = WRITE_APIS[api];
    if (at === "open" && !opensForWrite(args[1])) continue;
    const dest = at === "open" ? args[0] : args[at];
    out.push(entry(file, src, m.index, api, dest ? r.eval(dest, m.index) : [UNKNOWN]));
  }
  // fs の関数を名前で選ぶ（fs[name](...)・fs.promises[name]）と、書き出しかどうか・書き先をたどれない
  for (const m of masked.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*(?:\.promises)?)\s*\[/g)) {
    if (isFsRecv(m[1])) out.push(entry(file, src, m.index, `${m[1]}[]`, [], [`fs の関数を名前で選んでいる（${m[1]}[...]）`]));
  }
  // 書き出し API を値として渡す・しまう（forEach(fs.writeFileSync) など）は、書き先をたどれない
  const imports = importRanges(src);
  const apiNames = [...Object.keys(WRITE_APIS), ...alias.keys()].map(esc).join("|");
  for (const m of masked.matchAll(new RegExp(`(?<![\\w$])((?:[A-Za-z_$][\\w$]*\\.)*)(${apiNames})\\b(?!\\s*\\()`, "g"))) {
    const recv = m[1].replace(/\.$/, "");
    const isApi = alias.has(m[2]) ? !recv : SYNC_WRITE.has(m[2]) ? Boolean(recv) : Boolean(recv) && isFsRecv(recv);
    if (!isApi) continue;
    const lineStart = masked.lastIndexOf("\n", m.index) + 1;
    const lineEnd = masked.indexOf("\n", m.index);
    const lineText = masked.slice(lineStart, lineEnd < 0 ? masked.length : lineEnd);
    if (inRanges(imports, m.index) || /^\s*(?:const|let|var)\s*\{/.test(lineText)) continue; // import・分割代入（別名として上で扱う）
    if (new RegExp(`(?:const|let|var)\\s+[A-Za-z_$][\\w$]*\\s*=\\s*${esc(m[0])}\\s*(?:\\.bind\\([^)]*\\))?\\s*;?\\s*$`).test(lineText)) continue; // const put = fs.writeFileSync
    if (/^\s*:/.test(masked.slice(m.index + m[0].length)) || /typeof\s+$/.test(masked.slice(lineStart, m.index))) continue; // オブジェクトのキー・typeof
    out.push(entry(file, src, m.index, m[2], [], [`書き出し API を値として使っている（${m[0]}）`]));
  }
  // 読み落としの検出: 同期版の書き出し API の名前は、コードとして読めた数と、ソースの中の数（行のコメントを除く）が一致する。
  // 合わなければ、文字列・正規表現の読み違いで書き出しを読み落としている（名前を文字列に書くのもやめる）
  const syncNames = new RegExp(`\\b(?:${[...SYNC_WRITE].join("|")})\\b`, "g");
  const rawCount = (src.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1").replace(/\/\*[\s\S]*?\*\//g, "").match(syncNames) || []).length;
  const codeCount = (masked.match(syncNames) || []).length;
  if (rawCount !== codeCount) out.push(entry(file, src, 0, "parse", [], [`書き出し API の名前 ${rawCount} 件のうち ${codeCount} 件しかコードとして読めない（文字列・正規表現の読み違い、または文字列の中に名前がある）`]));
  // シェルのコマンドの書き先
  for (const c of commandsOf(r)) {
    for (const text of c.texts) {
      if (c.shell && /^\s*\u0001\d+\u0001\s*$/.test(text)) {
        out.push(entry(file, src, c.index, c.call, [], [`コマンドの中身をたどれない（${c.holes[0]}）`]));
        continue;
      }
      if (/-(?:EncodedCommand|enc|ec)\s+\u0001/i.test(text)) {
        out.push(entry(file, src, c.index, c.call, [], ["符号化したコマンドの中身をたどれない"]));
        continue;
      }
      for (const t of commandWriteTokens(text)) out.push(entry(file, src, c.index, `${c.call}>`, tokenTargets(r, t, c.holes, c.cwdBases, c.index)));
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

// fn の呼び出し（定義したファイルと、import しているファイル）と、値としての使用
export function callSitesOf(repoRoot, files, defFile, fn) {
  const calls = [];
  let valueUse = null;
  for (const f of files) {
    if (!JS_EXT.test(f)) continue;
    const src = fs.readFileSync(f, "utf8");
    const locals = [];
    if (path.resolve(f) === path.resolve(defFile)) locals.push(fn);
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g)) {
      if (path.resolve(path.dirname(f), m[2]) !== path.resolve(defFile)) continue;
      for (const spec of m[1].split(",").map((x) => x.trim())) {
        const [orig, as = orig] = spec.split(/\s+as\s+/).map((x) => x.trim());
        if (orig === fn) locals.push(as);
      }
    }
    if (!locals.length) continue;
    const r = new Resolver(repoRoot, f, new Map(), src);
    const masked = maskCode(src);
    const imports = importRanges(src);
    for (const local of locals) {
      for (const m of masked.matchAll(new RegExp(`(?<![\\w$.])${esc(local)}\\b`, "g"))) {
        const after = masked.slice(m.index + m[0].length);
        const lineStart = masked.lastIndexOf("\n", m.index) + 1;
        const before = masked.slice(lineStart, m.index);
        if (/^\s*\(/.test(after)) {
          if (/(?:function\s*\*?\s*|(?:const|let|var)\s+)$/.test(before)) continue; // 定義
          const open = m.index + m[0].length + after.indexOf("(");
          calls.push({ resolver: r, index: m.index, args: argsOf(src, open).args });
        } else if (!inRanges(imports, m.index) && !/^\s*export\b/.test(masked.slice(lineStart)) && !/(?:const|let|var)\s+$/.test(before) && !/^\s*=\s*(?:async\s*)?\(/.test(after)) {
          valueUse = valueUse || `${path.relative(repoRoot, f).split(path.sep).join("/")}:${lineOf(src, m.index)}`;
        }
      }
    }
  }
  return { calls, valueUse };
}

// 関数の引数として渡された書き先（<param:fn:i>）を、呼び出し元の式でたどる。呼び出しが無く、値としても渡していない関数は書かない
function resolveParams(repoRoot, files, w, depth = 0) {
  const params = w.targets.filter(isParam);
  if (!params.length) return w;
  const extra = [];
  const why = [];
  for (const p of params) {
    const [, fn, idx] = p.match(/^<param:([^:]+):(\d+)>$/);
    const sites = callSitesOf(repoRoot, files, w.file, fn);
    if (sites.valueUse) why.push(`関数 ${fn} を値として渡している（${sites.valueUse}）`);
    for (const s of sites.calls) {
      const arg = s.args[Number(idx)];
      if (!arg) continue;
      const targets = s.resolver.eval(arg.startsWith("...") ? arg.slice(3) : arg, s.index);
      if (targets.some(isParam) && depth < 4) extra.push(...resolveParams(repoRoot, files, { ...w, file: s.resolver.file, targets }, depth + 1).targets);
      else extra.push(...targets.map((t) => (isParam(t) ? UNKNOWN : t)));
    }
  }
  const targets = [...w.targets.filter((t) => !isParam(t)), ...extra];
  const e = entry(w.file, "", 0, w.call, targets, [...w.unresolved.filter((u) => !isUnresolved(u)), ...why]);
  return { ...w, targets, unresolved: e.unresolved, repoPaths: e.repoPaths };
}

// files 全体の書き出し（関数の引数の書き先は呼び出し元までたどる）
export function allWriteTargets(repoRoot, files) {
  return files.flatMap((f) => writeTargetsResolved(repoRoot, f, files));
}
// file の書き出し（関数の引数の書き先は files の中の呼び出し元までたどる）
export function writeTargetsResolved(repoRoot, file, files) {
  return writeTargetsOf(repoRoot, file).map((w) => resolveParams(repoRoot, files, w));
}

// 検査するコードのファイル: 公開リポに出うるファイル（追跡中と、gitignore されていない未追跡）のうち、tests 以外のコードとスクリプト。
// all: git を使わずフォルダをすべて見る（テスト用の一時フォルダ）
export function codeFiles(repoRoot, { all = false } = {}) {
  let rels;
  if (all) {
    rels = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(path.join(repoRoot, d), { withFileTypes: true })) {
        const p = d ? `${d}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (!/^(?:node_modules|\.git)$/.test(e.name)) walk(p);
        } else rels.push(p);
      }
    };
    walk("");
  } else {
    rels = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  }
  return [...new Set(rels)]
    .filter((p) => !/^(?:tests|node_modules|dist)\//.test(p) && !p.endsWith(".d.ts") && (JS_EXT.test(p) || SHELL_EXT.test(p) || OTHER_SCRIPT_EXT.test(p)))
    .map((p) => path.join(repoRoot, p))
    .filter((p) => fs.existsSync(p));
}
