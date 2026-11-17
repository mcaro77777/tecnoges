import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const result = { mode: "sample" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "sample" || key === "full") {
      result.mode = key;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Falta el valor de --${key}`);
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

function sampleFrom(text) {
  const match = text.match(/^.*?[.!?](?:\s|$)/u);
  return (match?.[0] ?? text.slice(0, 180)).trim();
}

function wordsFromAlignment(alignment) {
  const characters = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const text = characters.join("");
  const words = [];
  for (const match of text.matchAll(/\S+/gu)) {
    const first = match.index;
    const last = first + match[0].length - 1;
    if (first < starts.length && last < ends.length) {
      words.push({
        word: match[0],
        start: Number(Number(starts[first]).toFixed(3)),
        end: Number(Number(ends[last]).toFixed(3)),
      });
    }
  }
  return words;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config || !args.env || !args.output) {
    throw new Error("Uso: --config <json> --env <.env> --output <directorio> [--sample|--full]");
  }

  const [configSource, envSource] = await Promise.all([
    fs.readFile(path.resolve(args.config), "utf8"),
    fs.readFile(path.resolve(args.env), "utf8"),
  ]);
  const config = JSON.parse(configSource);
  const environment = parseEnv(envSource);
  const apiKey = environment.ELEVENLABS_API_KEY?.trim();
  const voiceIdFromEnvironment = environment.ELEVENLABS_VOICE_ID?.trim();
  const selectedVoice = config.voice?.selectedVoice;
  const voiceId = selectedVoice?.voiceId?.trim() || voiceIdFromEnvironment;
  if (!apiKey || !voiceId) {
    throw new Error("El archivo indicado no contiene ELEVENLABS_API_KEY y no existe una voz configurada");
  }

  const selectedModel = config.voice?.modelSelection?.selectedModel;
  if (selectedModel !== "eleven_v3") {
    throw new Error(`El modelo aprobado debe ser eleven_v3; se encontró ${selectedModel ?? "ninguno"}`);
  }
  if (config.presentationSelection?.selectedProfile !== "female-sofia") {
    throw new Error("El perfil aprobado debe ser female-sofia");
  }
  if (selectedVoice?.gender !== "female") {
    throw new Error("La voz seleccionada para Sofía debe estar validada explícitamente como femenina");
  }
  if (config.authorization?.paidGenerationApproved !== true) {
    throw new Error("La generación pagada no está autorizada en el JSON");
  }

  const scene = config.scenes?.find((item) => item.type === "avatar");
  if (!scene?.text) throw new Error("No existe una escena de avatar con texto");
  const text = args.mode === "full" ? scene.text : sampleFrom(scene.text);
  const outputDir = path.resolve(args.output);
  await fs.mkdir(outputDir, { recursive: true });
  const stem = args.mode === "full" ? "sofia-presentacion-eleven-v3" : "sofia-muestra-eleven-v3";
  const audioPath = path.join(outputDir, `${stem}.mp3`);
  const alignmentPath = path.join(outputDir, `${stem}.alignment.json`);

  const endpoint = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
  );
  endpoint.searchParams.set("output_format", "mp3_44100_128");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_v3",
      language_code: "es",
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.8,
        style: 0.48,
        use_speaker_boost: true,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs rechazó la solicitud (HTTP ${response.status})`);
  }

  const body = await response.json();
  if (!body.audio_base64) throw new Error("ElevenLabs no devolvió audio");
  const alignment = body.normalized_alignment ?? body.alignment ?? {};
  const words = wordsFromAlignment(alignment);
  const alignedDuration = words.at(-1)?.end ?? 0;

  await Promise.all([
    fs.writeFile(audioPath, Buffer.from(body.audio_base64, "base64")),
    fs.writeFile(
      alignmentPath,
      `${JSON.stringify(
        {
          provider: "elevenlabs",
          model: "eleven_v3",
          profile: "female-sofia",
          voiceName: selectedVoice.name,
          voiceId,
          voiceGender: selectedVoice.gender,
          mode: args.mode,
          characters: text.length,
          alignedDurationSeconds: alignedDuration,
          words,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  console.log(
    JSON.stringify({
      ok: true,
      provider: "elevenlabs",
      model: "eleven_v3",
      mode: args.mode,
      characters: text.length,
      alignedDurationSeconds: alignedDuration,
      audioPath,
      alignmentPath,
    }),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
