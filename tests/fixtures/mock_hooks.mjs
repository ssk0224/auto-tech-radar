export async function resolve(spec, ctx, next) {
  if (spec === "@google/genai") return { url: new URL("./genai_mock.mjs", import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
