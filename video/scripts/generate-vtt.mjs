import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT = "video/output/audio/sofia-presentacion-eleven-v3.alignment.json";
const DEFAULT_OUTPUT = "assets/sofia-presentacion.es.vtt";
const MAX_LINE_LENGTH = 42;
const MAX_CUE_LENGTH = MAX_LINE_LENGTH * 2 + 1;
const MIN_CUE_SECONDS = 2;
const MAX_CUE_SECONDS = 7;

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token !== "--input" && token !== "--output") continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Falta el valor de ${token}`);
    }
    args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

function cueText(words) {
  return words.map(({ word }) => word).join(" ");
}

function isSentenceEnd(word) {
  return /[.!?…][”"']?$/u.test(word);
}

function tryWrapCue(words) {
  const tokens = words.map(({ word }) => word);
  const fullText = tokens.join(" ");
  if (fullText.length <= MAX_LINE_LENGTH) return fullText;
  if (fullText.length > MAX_CUE_LENGTH) return null;

  let best = null;
  for (let split = 1; split < tokens.length; split += 1) {
    const first = tokens.slice(0, split).join(" ");
    const second = tokens.slice(split).join(" ");
    if (first.length > MAX_LINE_LENGTH || second.length > MAX_LINE_LENGTH) continue;
    const score = Math.abs(first.length - second.length);
    if (!best || score < best.score) best = { first, second, score };
  }

  return best ? `${best.first}\n${best.second}` : null;
}

function wrapCue(words) {
  const wrapped = tryWrapCue(words);
  if (!wrapped) {
    throw new Error(`No se pudo ajustar el subtítulo a dos líneas: ${cueText(words)}`);
  }
  return wrapped;
}

function boundaryPenalty(word, nextWord) {
  if (isSentenceEnd(word)) return 0;
  const current = word.toLocaleLowerCase("es").replace(/[.,;:!?…]+$/u, "");
  const next = nextWord?.toLocaleLowerCase("es").replace(/[.,;:!?…]+$/u, "");
  if (current === "inteligencia" && next === "artificial") return 6;
  if (["a", "de", "del", "en", "para", "por", "que", "y", "o"].includes(current)) return 4;
  if (["a", "de", "del", "el", "en", "la", "las", "los", "o", "para", "por", "que", "y"].includes(next)) {
    return 3;
  }
  if (/[,;:][”"']?$/u.test(word)) return 0.2;
  return 1;
}

function partitionSentence(words) {
  const memo = new Map();
  const sentenceDuration = words.at(-1).end - words[0].start;

  function solve(start) {
    if (start === words.length) return { chunks: [], score: 0 };
    if (memo.has(start)) return memo.get(start);

    let best = null;
    for (let end = start; end < words.length; end += 1) {
      const chunk = words.slice(start, end + 1);
      const duration = chunk.at(-1).end - chunk[0].start;
      const wrapped = tryWrapCue(chunk);
      if (duration > MAX_CUE_SECONDS || !wrapped) break;
      if (sentenceDuration >= MIN_CUE_SECONDS && duration < MIN_CUE_SECONDS) continue;

      const tail = solve(end + 1);
      if (!tail) continue;
      const candidate = {
        chunks: [chunk, ...tail.chunks],
        score:
          tail.score +
          boundaryPenalty(chunk.at(-1).word, words[end + 1]?.word) +
          Math.abs(duration - 4) * 0.02,
      };
      if (
        !best ||
        candidate.chunks.length < best.chunks.length ||
        (candidate.chunks.length === best.chunks.length && candidate.score < best.score)
      ) {
        best = candidate;
      }
    }

    memo.set(start, best);
    return best;
  }

  const result = solve(0);
  if (!result) {
    throw new Error(`No se pudo segmentar la oración: ${cueText(words)}`);
  }
  return result.chunks;
}

function splitWordsIntoCues(words) {
  const sentences = [];
  let start = 0;
  for (let index = 0; index < words.length; index += 1) {
    if (isSentenceEnd(words[index].word)) {
      sentences.push(words.slice(start, index + 1));
      start = index + 1;
    }
  }
  if (start < words.length) sentences.push(words.slice(start));
  return sentences.flatMap(partitionSentence);
}

function formatTimestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return [hours, minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":") + `.${String(millis).padStart(3, "0")}`;
}

function validateCues(cues, sourceWords) {
  const emittedWords = cues.flatMap((cue) => cue.words.map(({ word }) => word));
  const expectedWords = sourceWords.map(({ word }) => word);
  if (JSON.stringify(emittedWords) !== JSON.stringify(expectedWords)) {
    throw new Error("Los subtítulos no cubren exactamente todas las palabras alineadas");
  }

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    const duration = cue.end - cue.start;
    const lines = cue.text.split("\n");
    if (duration > MAX_CUE_SECONDS + 0.001) {
      throw new Error(`El subtítulo ${index + 1} supera ${MAX_CUE_SECONDS} segundos`);
    }
    if (lines.length > 2 || lines.some((line) => line.length > MAX_LINE_LENGTH)) {
      throw new Error(`El subtítulo ${index + 1} excede el límite visual`);
    }
    if (index > 0 && cue.start < cues[index - 1].end) {
      throw new Error(`Los subtítulos ${index} y ${index + 1} se superponen`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const alignment = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const sourceWords = alignment.words;

  if (!Array.isArray(sourceWords) || sourceWords.length === 0) {
    throw new Error("La alineación no contiene palabras");
  }
  if (alignment.voiceGender !== "female" || alignment.model !== "eleven_v3") {
    throw new Error("La alineación debe corresponder a una voz femenina generada con Eleven v3");
  }

  const cues = splitWordsIntoCues(sourceWords).map((words) => ({
    start: words[0].start,
    end: words.at(-1).end,
    words,
    text: wrapCue(words),
  }));
  validateCues(cues, sourceWords);

  const body = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}`,
    )
    .join("\n\n");
  const vtt = `WEBVTT\n\nNOTE Voz: ${alignment.voiceName}; modelo: ${alignment.model}\n\n${body}\n`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, vtt, "utf8");

  const durations = cues.map((cue) => cue.end - cue.start);
  console.log(
    JSON.stringify({
      ok: true,
      inputPath,
      outputPath,
      cues: cues.length,
      sourceWords: sourceWords.length,
      startSeconds: cues[0].start,
      endSeconds: cues.at(-1).end,
      minCueSeconds: Number(Math.min(...durations).toFixed(3)),
      maxCueSeconds: Number(Math.max(...durations).toFixed(3)),
    }),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
