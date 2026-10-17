// Compatibility boundary for @next/eslint-plugin-next 16.4.2 only.
// Its sole fast-glob call is globSync(string, { onlyDirectories: true }).
const { globSync: find, statSync } = require("node:fs");

function globSync(pattern, options) {
  if (
    typeof pattern !== "string" ||
    options?.onlyDirectories !== true ||
    Object.keys(options).some((key) => key !== "onlyDirectories")
  ) {
    throw new TypeError(
      "Unsupported Next.js root-directory glob API; review the adapter before upgrading the plugin.",
    );
  }
  const reject = () => {
    const error = new RangeError(
      "Next.js root-directory glob exceeds the supported complexity limit.",
    );
    error.code = "ERR_GLOB_PATTERN_COMPLEXITY";
    throw error;
  };
  if (pattern.length > 32768) reject();
  const depths = { "{": 0, "(": 0, "[": 0 };
  const opening = { "}": "{", ")": "(", "]": "[" };
  for (let i = 0; i < pattern.length; i++) {
    const character = pattern[i];
    if (character === "\\") {
      i++;
      continue;
    }
    if (Object.hasOwn(depths, character)) {
      if (++depths[character] > 64) reject();
    } else if (Object.hasOwn(opening, character)) {
      const key = opening[character];
      depths[key] = Math.max(0, depths[key] - 1);
    }
  }
  // Native globbing expands braces; bound expansion work as well as depth.
  const frames = [{ sum: 0, product: 1, start: -1 }];
  for (let i = 0; i < pattern.length; i++) {
    const character = pattern[i];
    if (character === "\\") {
      i++;
      continue;
    }
    if (character === "{") frames.push({ sum: 0, product: 1, start: i });
    else if (character === "," && frames.length > 1) {
      const frame = frames.at(-1);
      frame.sum += frame.product;
      frame.product = 1;
      if (frame.sum > 1024) reject();
    } else if (character === "}" && frames.length > 1) {
      const frame = frames.pop();
      let count = frame.sum + frame.product;
      const range = pattern
        .slice(frame.start + 1, i)
        .match(/^(-?\d+|[a-zA-Z])\.\.(-?\d+|[a-zA-Z])(?:\.\.(-?\d+))?$/);
      if (range) {
        const value = (text) =>
          /^[a-zA-Z]$/.test(text) ? text.charCodeAt(0) : Number(text);
        const first = value(range[1]),
          last = value(range[2]);
        const step = Math.abs(Number(range[3] || 1)) || 1;
        if (![first, last, step].every(Number.isSafeInteger)) reject();
        count = Math.floor(Math.abs(last - first) / step) + 1;
      }
      frames.at(-1).product *= count;
      if (frames.at(-1).product > 1024) reject();
    }
  }
  return find(pattern, { followSymlinks: true })
    .filter((entry) => {
      try {
        return statSync(entry).isDirectory();
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    })
    .map((entry) => {
      let result = entry.replaceAll("\\", "/");
      if (pattern.startsWith("./") && !result.startsWith("./"))
        result = "./" + result;
      if (pattern.endsWith("/") && !result.endsWith("/")) result += "/";
      return result;
    })
    .sort();
}
module.exports = { globSync };
