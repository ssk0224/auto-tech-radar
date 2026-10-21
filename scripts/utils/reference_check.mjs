// 生成物に書かれた Docker イメージ・パッケージ名がレジストリに実在するかを確認する
// （AI が README に無いイメージ名やパッケージ名を作ってしまう事故を、保存前に機械的に止める）

const TIMEOUT_MS = 10000;

async function exists(url, headers = {}) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Auto-Tech-Radar/2.0", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    return null; // レート制限・障害など判定不能
  } catch (e) {
    return null;
  }
}

async function ghcrImageExists(name, tag) {
  try {
    const t = await fetch(`https://ghcr.io/token?scope=repository:${name}:pull`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // 匿名で取得できない（非公開または存在しない）イメージは、トークン発行の段階で拒否される
    if (t.status === 401 || t.status === 403) return false;
    if (!t.ok) return null;
    const { token } = await t.json();
    const res = await fetch(`https://ghcr.io/v2/${name}/manifests/${tag}`, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 200) return true;
    // 匿名で取得できない（非公開または存在しない）イメージは、購入者もそのままでは pull できない
    if ([401, 403, 404].includes(res.status)) return false;
    return null;
  } catch (e) {
    return null;
  }
}

function parseImage(ref) {
  const clean = ref.replace(/^["']|["']$/g, "").split("@")[0];
  const lastColon = clean.lastIndexOf(":");
  const hasTag = lastColon > clean.lastIndexOf("/");
  return { name: hasTag ? clean.slice(0, lastColon) : clean, tag: hasTag ? clean.slice(lastColon + 1) : "latest" };
}

async function imageExists(ref) {
  if (/\$\{|<|>/.test(ref)) return null; // 変数入りは判定しない
  const { name, tag } = parseImage(ref);
  if (name.startsWith("ghcr.io/")) return ghcrImageExists(name.slice("ghcr.io/".length), tag);
  const first = name.split("/")[0];
  if (name.includes("/") && (first.includes(".") || first.includes(":"))) return null; // その他のレジストリは判定しない
  const repo = name.includes("/") ? name : `library/${name}`;
  return exists(`https://hub.docker.com/v2/repositories/${repo}/tags/${encodeURIComponent(tag)}`);
}

// テキストから確認対象を抜き出す
export function extractReferences(text) {
  const images = new Set();
  const npm = new Set();
  const pypi = new Set();
  for (const m of text.matchAll(/^\s*image:\s*(["']?[A-Za-z0-9][\w.\/:@-]*["']?)\s*$/gm)) images.add(m[1].replace(/["']/g, ""));
  // マルチステージの `FROM x AS name` で付けた名前は、後続の `FROM name` や `--from=name` にも現れるので除外する
  const stages = new Set([...text.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?\S+\s+[Aa][Ss]\s+([\w.-]+)/gm)].map((m) => m[1].toLowerCase()));
  // FROM は大文字のみ（小文字だと Python の `from x import y` を拾う）。イメージ名として完全に妥当なものだけ採る（`${VAR}` 入りの ARG イメージ・scratch・ステージ名は対象外）
  for (const m of text.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gm)) {
    if (/^[A-Za-z0-9][\w.\/:@-]*$/.test(m[1]) && m[1].toLowerCase() !== "scratch" && !stages.has(m[1].toLowerCase())) images.add(m[1]);
  }
  for (const m of text.matchAll(/--from=([A-Za-z0-9][\w.\/:@-]*\/[\w.\/:@-]+)/g)) if (!stages.has(m[1].toLowerCase())) images.add(m[1]);
  // パッケージ名の後ろの @version は文字クラスに含めないので自然に落ちる
  // パッケージ名の直後が + や : のもの（git+https://…・https://…・github:owner/repo）は VCS・URL の指定なので対象外
  for (const m of text.matchAll(/\bnpx\s+(?:-y\s+|--yes\s+)?(@?[a-z0-9][\w.\-]*(?:\/[\w.\-]+)?)(?![\w.\-\/]*[+:])/g)) npm.add(m[1]);
  for (const m of text.matchAll(/"args"\s*:\s*\[\s*"(?:-y|--yes)"\s*,\s*"(@?[a-z0-9][\w.\-]*(?:\/[\w.\-]+)?)/g)) npm.add(m[1]);
  for (const m of text.matchAll(/\b(?:pip3?|uv pip|pipx)\s+install\s+(?:-U\s+|--upgrade\s+)?([A-Za-z0-9][\w.\-]*)(?![\w.\-]*[+:])/g)) if (!/^(-|\.)/.test(m[1])) pypi.add(m[1]);
  return { images: [...images], npm: [...npm], pypi: [...pypi] };
}

// 実在しないと確認できた参照の一覧を返す（判定不能なものは含めない）
export async function findMissingReferences(text) {
  const { images, npm, pypi } = extractReferences(text);
  const missing = [];
  for (const ref of images) if ((await imageExists(ref)) === false) missing.push(`image ${ref}`);
  for (const pkg of npm) if ((await exists(`https://registry.npmjs.org/${pkg.replace("/", "%2F")}`)) === false) missing.push(`npm ${pkg}`);
  for (const pkg of pypi) if ((await exists(`https://pypi.org/pypi/${pkg}/json`)) === false) missing.push(`pypi ${pkg}`);
  return missing;
}
