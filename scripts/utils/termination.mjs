// プロセスがどう終わっても後片付け（復号した有料本文の削除など）を 1 回だけ走らせる。
// Node の 'exit' は、Ctrl+C（SIGINT）・窓を閉じる（Windows の SIGHUP / SIGBREAK）・kill（SIGTERM）では呼ばれない
// （シグナルの既定の動作で即座に終わるため）。シグナルを受けたら片付けてから、同じ終了コードの慣例（128 + 番号）で終わる
export const TERMINATION_SIGNALS = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1, SIGBREAK: 21 };

export function onTermination(cleanup, proc = process) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    try {
      cleanup();
    } catch (e) {
      console.error(`終了時の後片付けに失敗しました: ${e.message}`);
    }
  };
  proc.on("exit", run);
  for (const [sig, num] of Object.entries(TERMINATION_SIGNALS)) {
    try {
      proc.on(sig, () => {
        run();
        proc.exit(128 + num);
      });
    } catch (e) {
      // その OS に無いシグナル（Linux の SIGBREAK など）は登録できない
    }
  }
  return run;
}
