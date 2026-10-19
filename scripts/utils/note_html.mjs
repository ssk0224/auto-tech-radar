// note.com エディタ（ProseMirror）互換の HTML ペイロード変換ユーティリティ
// - Markdown 表（| col | col |）を note.com ネイティブの箇条書き（<ul><li>）へ構造化変換
// - インラインコード（`code`）、太字（**bold**）、リンク（[text](url)）を HTML タグへ変換
// - インデント付きリスト継続行やネスト箇条書きが <ol>/<ul> を分断しないよう統合
// - 有料ライン境界（separator）と末尾の出品用ハッシュタグ注記をクリーンに分離
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

export function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function inlineMd(s) {
  let text = String(s || "");
  // 1. Extract inline code spans first so inner characters are not altered by bold/link regexes
  const codeTokens = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code>${escHtml(code)}</code>`);
    return `\x00CODE_${idx}\x00`;
  });

  // 2. Escape remaining HTML
  let out = escHtml(text);

  // 3. Bold (**...**)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 4. Links ([label](https://...))
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // 5. Bare URLs not already inside href="..." or >...</a>
  out = out.replace(/(^|[\s：:])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

  // 6. Restore inline code tokens
  out = out.replace(/\x00CODE_(\d+)\x00/g, (_, idx) => codeTokens[Number(idx)]);
  return out;
}

function parseTableCells(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);

  const cells = [];
  let cur = "";
  let inCode = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      if (i + 1 < s.length && s[i + 1] === "|") {
        cur += "|";
        i++;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === "`") {
      inCode = !inCode;
      cur += ch;
      continue;
    }
    if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function isTableSeparator(line) {
  const t = line.trim();
  if (!t.includes("-") || !t.includes("|")) return false;
  const cells = parseTableCells(t);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function cleanMermaidToText(codeLines) {
  const out = ["【アーキテクチャ・処理フロー】"];
  for (const raw of codeLines) {
    const l = raw.trim();
    if (!l || /^(flowchart|graph)\s+/i.test(l) || /^style\s+/i.test(l) || /^classDef\s+/i.test(l)) continue;
    if (/^subgraph\s+/i.test(l)) {
      out.push(`\n■ ${l.replace(/^subgraph\s+/i, "")}`);
      continue;
    }
    if (l === "end") continue;
    const readable = l
      .replace(/([A-Za-z0-9_]+)\["([^"]+)"\]/g, "$2")
      .replace(/([A-Za-z0-9_]+)\[([^\]]+)\]/g, "$2")
      .replace(/-->\|([^|]+)\|/g, " ──($1)──► ")
      .replace(/-->/g, " ──► ");
    out.push(`  ${readable}`);
  }
  return out.join("\n");
}

export function mdToNoteHtml(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let lastId = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Skip standalone markdown image syntax ![alt](url) since note.com does not render external markdown image tags
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      i++;
      continue;
    }

    // Fenced code blocks (``` or ~~~~)
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const fenceChar = fenceMatch[1][0];
      const fenceLen = fenceMatch[1].length;
      const lang = (fenceMatch[2] || "").trim().toLowerCase();
      const closeRe = new RegExp(`^${fenceChar}{${fenceLen},}\\s*$`);
      i++;
      const codeLines = [];
      while (i < lines.length && !closeRe.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const content = lang === "mermaid" ? cleanMermaidToText(codeLines) : codeLines.join("\n");
      const id = uuid();
      lastId = id;
      blocks.push(`<pre name="${id}" id="${id}"><code>${escHtml(content)}</code></pre>`);
      continue;
    }

    // Horizontal rule (--- or ----...)
    if (/^-{3,}$/.test(trimmed)) {
      const id = uuid();
      lastId = id;
      blocks.push(`<hr name="${id}" id="${id}">`);
      i++;
      continue;
    }

    // Headings (# to ####) -> note.com supports h2 and h3
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length <= 2 ? "h2" : "h3";
      const id = uuid();
      lastId = id;
      blocks.push(`<${level} name="${id}" id="${id}">${inlineMd(hMatch[2].trim())}</${level}>`);
      i++;
      continue;
    }

    // Markdown Table (| ... | followed by | --- | separator)
    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableCells(lines[i]);
      i += 2; // skip header + separator
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (isTableSeparator(lines[i])) {
          i++;
          continue;
        }
        const cells = parseTableCells(lines[i]);
        if (cells.length > 0 && cells.some((c) => c.length > 0)) {
          const pId = uuid();
          let itemHtml = "";
          if (headers.length === 2 && cells.length >= 2) {
            const k = inlineMd(cells[0].replace(/^#+\s*/, "").replace(/^\*\*|\*\*$/g, ""));
            const v = inlineMd(cells[1]);
            itemHtml = `<strong>${k}</strong>：${v}`;
          } else {
            const lead = inlineMd(cells[0].replace(/^#+\s*/, "").replace(/^\*\*|\*\*$/g, ""));
            const details = [];
            for (let cIdx = 1; cIdx < cells.length; cIdx++) {
              const val = cells[cIdx];
              if (!val || val === "-") continue;
              const hName = headers[cIdx] ? escHtml(headers[cIdx].replace(/^\*\*|\*\*$/g, "")) : "";
              details.push(hName ? `${hName}: ${inlineMd(val)}` : inlineMd(val));
            }
            itemHtml = details.length > 0 ? `<strong>${lead}</strong> ── ${details.join(" ／ ")}` : `<strong>${lead}</strong>`;
          }
          items.push(`<li><p name="${pId}" id="${pId}">${itemHtml}</p></li>`);
        }
        i++;
      }
      if (items.length > 0) {
        const ulId = uuid();
        lastId = ulId;
        blocks.push(`<ul name="${ulId}" id="${ulId}">${items.join("")}</ul>`);
      }
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const qLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        qLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const fId = uuid();
      const pId = uuid();
      lastId = fId;
      blocks.push(
        `<figure name="${fId}" id="${fId}"><blockquote><p name="${pId}" id="${pId}">${qLines.map(inlineMd).join("<br>")}</p></blockquote><figcaption></figcaption></figure>`,
      );
      continue;
    }

    // Top-level Unordered List (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const subLines = [inlineMd(lines[i].trim().replace(/^[-*]\s+/, "").trim())];
        i++;
        // Absorb indented continuation lines or nested sub-bullets into the same <li>
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(`{3,}|~{3,})/.test(lines[i])) {
          const sub = lines[i].trim();
          if (/^[-*]\s+/.test(sub)) {
            subLines.push(`・${inlineMd(sub.replace(/^[-*]\s+/, ""))}`);
          } else {
            subLines.push(inlineMd(sub));
          }
          i++;
        }
        const pId = uuid();
        items.push(`<li><p name="${pId}" id="${pId}">${subLines.join("<br>")}</p></li>`);
      }
      const ulId = uuid();
      lastId = ulId;
      blocks.push(`<ul name="${ulId}" id="${ulId}">${items.join("")}</ul>`);
      continue;
    }

    // Top-level Ordered List (1. 2. ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const subLines = [inlineMd(lines[i].trim().replace(/^\d+\.\s+/, "").trim())];
        i++;
        // Absorb indented continuation lines or nested sub-bullets so <ol> numbering never resets
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(`{3,}|~{3,})/.test(lines[i])) {
          const sub = lines[i].trim();
          if (/^[-*]\s+/.test(sub)) {
            subLines.push(`・${inlineMd(sub.replace(/^[-*]\s+/, ""))}`);
          } else {
            subLines.push(inlineMd(sub));
          }
          i++;
        }
        const pId = uuid();
        items.push(`<li><p name="${pId}" id="${pId}">${subLines.join("<br>")}</p></li>`);
      }
      const olId = uuid();
      lastId = olId;
      blocks.push(`<ol name="${olId}" id="${olId}">${items.join("")}</ol>`);
      continue;
    }

    // Regular Paragraph
    const pLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[i].trim()) &&
      !/^(`{3,}|~{3,})/.test(lines[i].trim()) &&
      !/^-{3,}$/.test(lines[i].trim()) &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      pLines.push(lines[i].trim());
      i++;
    }
    if (pLines.length > 0) {
      const pId = uuid();
      lastId = pId;
      blocks.push(`<p name="${pId}" id="${pId}">${pLines.map(inlineMd).join("<br>")}</p>`);
    }
  }

  return { html: blocks.join(""), lastId };
}

export function parseDraftToNotePayload(rawMd, isPaid = true) {
  const s = String(rawMd || "").replace(/\r\n/g, "\n");
  const m = s.match(/^#\s+(.+)$/m);
  const title = m ? m[1].replace(/^#+\s*/, "").trim() : "";

  // Strip H1 title and trailing hashtag instruction footer
  const cleaned = s
    .replace(/^#\s+.+\n+/, "")
    .replace(/<!--\s*PAID_CONTENT_START\s*-->\n*/g, "")
    .replace(/\n*---\n+\*\*【note出品時用 推奨ハッシュタグ】\*\*[\s\S]*$/, "")
    .trim();

  if (!isPaid) {
    const { html } = mdToNoteHtml(cleaned);
    const plainLen = cleaned.replace(/[#*`>|~-]/g, "").length;
    return {
      title,
      freeBody: html,
      payBody: "",
      fullBody: html,
      separator: null,
      bodyLength: plainLen,
      price: 0,
    };
  }

  const splitRegex =
    /(?:\n-{3,})?\n+(?:#{1,3}\s*)?【有料ライン[^\n]*】\s*(?:\n+-{3,})?\n+|\n-{3,}\n+(?=ここから先は|##\s*第1章|##\s*1\.|##\s*💡\s*このOSS)/;
  const parts = cleaned.split(splitRegex);
  const freeMd = parts[0].replace(/\n+-{3,}\s*$/, "").trim();
  const paidMd = parts.length > 1 ? parts.slice(1).join("\n\n---\n\n").replace(/^-{3,}\n+/, "").trim() : "";

  const freeConv = mdToNoteHtml(freeMd);
  const paidConv = mdToNoteHtml(paidMd);
  const plainLen = (freeMd + paidMd).replace(/[#*`>|~-]/g, "").length;

  return {
    title,
    freeBody: freeConv.html,
    payBody: paidConv.html,
    fullBody: freeConv.html + paidConv.html,
    separator: freeConv.lastId,
    bodyLength: plainLen,
    price: 980,
  };
}
