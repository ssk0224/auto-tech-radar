// 改行を LF にそろえる。Windows の作業ツリー（core.autocrlf=true）やエディタで保存したファイルは CRLF のことがある。
// ファイルの中身を読んで `\n`・段落の区切り（空行）・行ごとの split で判定・加工するコードは、読み込みの境界でこれを通す
// （通さないと、行末に \r が残って文字数が増える・空行を段落の区切りと見なせず判定が変わる）
export const normalizeEol = (s) => String(s ?? "").replace(/\r\n?/g, "\n");
