let KokoroTTSClass = null;
let tts = null;
let canvas = null;
let ctx = null;
let logoImage = null;
let endImage = null;
let bgVideo = null;
let audioContext = null;
let bgAudioElement = null;
let queue = [];
let selectedIndex = -1;
let mediaRecorder = null;
let recordedChunks = [];
let assetsReady = false;
let kokoroReady = false;

/* =========================================================
   DOM
   ========================================================= */

const $ = (id) => document.getElementById(id);

const logoStatus = $("logoStatus");
const videoStatus = $("videoStatus");
const audioStatus = $("audioStatus");
const endStatus = $("endStatus");

const customVideo = $("customVideo");
const customAudio = $("customAudio");
const csvInput = $("csvInput");

const copyHeaderBtn = $("copyHeaderBtn");
const clearQueueBtn = $("clearQueueBtn");

const titleInput = $("titleInput");
const creditInput = $("creditInput");
const narrationInput = $("narrationInput");
const voiceInput = $("voiceInput");
const speedInput = $("speedInput");
const subtitlesInput = $("subtitlesInput");

const generateBtn = $("generateBtn");
const loadSelectedBtn = $("loadSelectedBtn");
const previewCanvas = $("previewCanvas");
const statusText = $("statusText");
const generateSelectedBtn = $("generateSelectedBtn");
const generateAllBtn = $("generateAllBtn");

const queueBody = $("queueBody");
const queueCount = $("queueCount");

const logoLoader = $("logoLoader");
const endLoader = $("endLoader");
const bgLoader = $("bgLoader");

/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {
  if (statusText) {
    statusText.textContent = text;
  }
}

function setAssetStatus(element, text, state = "") {
  if (!element) return;

  element.textContent = text;

  element.classList.remove(
    "ready",
    "error",
    "loading"
  );

  if (state) {
    element.classList.add(state);
  }
}

/* =========================================================
   HELPERS
   ========================================================= */

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSubtitleEnabled() {
  return subtitlesInput?.value !== "false";
}

function getSpeed() {
  const value = Number(speedInput?.value || 1);

  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return value;
}

function loadImage(imgElement, statusElement, name) {
  return new Promise((resolve, reject) => {
    if (!imgElement) {
      reject(new Error(`${name} element not found`));
      return;
    }

    setAssetStatus(
      statusElement,
      `Loading ${name}...`,
      "loading"
    );

    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;

      finished = true;

      setAssetStatus(
        statusElement,
        `${name}: Error / Timeout`,
        "error"
      );

      reject(
        new Error(`${name} image loading timeout`)
      );
    }, 5000);

    imgElement.onload = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      setAssetStatus(
        statusElement,
        `${name}: Ready`,
        "ready"
      );

      resolve(imgElement);
    };

    imgElement.onerror = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      setAssetStatus(
        statusElement,
        `${name}: Error`,
        "error"
      );

      reject(
        new Error(`${name} failed to load`)
      );
    };

    if (
      imgElement.complete &&
      imgElement.naturalWidth > 0
    ) {
      imgElement.onload();
    }
  });
}

function loadVideoMetadata(videoElement, statusElement) {
  return new Promise((resolve, reject) => {
    if (!videoElement) {
      reject(
        new Error(
          "Background video element not found"
        )
      );
      return;
    }

    setAssetStatus(
      statusElement,
      "Loading background video...",
      "loading"
    );

    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;

      finished = true;

      setAssetStatus(
        statusElement,
        "Background video: Error / Timeout",
        "error"
      );

      reject(
        new Error(
          "Background video loading timeout"
        )
      );
    }, 5000);

    const done = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      setAssetStatus(
        statusElement,
        "Background video: Ready",
        "ready"
      );

      resolve(videoElement);
    };

    const failed = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      setAssetStatus(
        statusElement,
        "Background video: Error",
        "error"
      );

      reject(
        new Error(
          "Background video failed to load"
        )
      );
    };

    videoElement.addEventListener(
      "loadedmetadata",
      done,
      { once: true }
    );

    videoElement.addEventListener(
      "error",
      failed,
      { once: true }
    );

    if (videoElement.readyState >= 1) {
      done();
    }
  });
}

function loadAudio(audioElement, statusElement) {
  return new Promise((resolve, reject) => {
    if (!audioElement) {
      reject(
        new Error(
          "Background audio element not found"
        )
      );
      return;
    }

    setAssetStatus(
      statusElement,
      "Loading background audio...",
      "loading"
    );

    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;

      finished = true;

      setAssetStatus(
        statusElement,
        "Background audio: Error / Timeout",
        "error"
      );

      reject(
        new Error(
          "Background audio loading timeout"
        )
      );
    }, 5000);

    const done = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      setAssetStatus(
        statusElement,
        "Background audio: Ready",
        "ready"
      );

      resolve(audioElement);
    };

    const failed = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      setAssetStatus(
        statusElement,
        "Background audio: Error",
        "error"
      );

      reject(
        new Error(
          "Background audio failed to load"
        )
      );
    };

    audioElement.addEventListener(
      "canplay",
      done,
      { once: true }
    );

    audioElement.addEventListener(
      "error",
      failed,
      { once: true }
    );

    audioElement.load();

    if (audioElement.readyState >= 3) {
      done();
    }
  });
}

/* =========================================================
   KOKORO
   ========================================================= */

async function loadKokoro() {
  if (kokoroReady && tts) {
    return tts;
  }

  setStatus("Loading Kokoro TTS...");

  try {
    if (!KokoroTTSClass) {
      const module = await import(
        "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm"
      );

      KokoroTTSClass = module.KokoroTTS;
    }

    if (!KokoroTTSClass) {
      throw new Error(
        "KokoroTTS class not found"
      );
    }

    tts =
      await KokoroTTSClass.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0-ONNX",
        {
          dtype: "q8",
          device: "wasm"
        }
      );

    kokoroReady = true;

    setStatus("Kokoro TTS ready.");

    return tts;
  } catch (error) {
    console.error(
      "Kokoro initialization failed:",
      error
    );

    kokoroReady = false;

    setStatus(
      `Kokoro error: ${error.message}`
    );

    throw error;
  }
}

/* =========================================================
   CANVAS
   ========================================================= */

function setupCanvas() {
  canvas = previewCanvas;

  if (!canvas) {
    console.error(
      "previewCanvas not found"
    );
    return;
  }

  canvas.width = 1080;
  canvas.height = 1920;

  ctx = canvas.getContext("2d", {
    alpha: false
  });

  if (!ctx) {
    console.error(
      "Canvas context unavailable"
    );
  }
}

/* =========================================================
   BACKGROUND
   ========================================================= */

function drawBackground() {
  if (!ctx || !canvas) return;

  ctx.fillStyle = "#000";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    !bgVideo ||
    !bgVideo.videoWidth ||
    !bgVideo.videoHeight
  ) {
    return;
  }

  const videoWidth =
    bgVideo.videoWidth;

  const videoHeight =
    bgVideo.videoHeight;

  const scale =
    Math.max(
      canvas.width / videoWidth,
      canvas.height / videoHeight
    );

  const drawWidth =
    videoWidth * scale;

  const drawHeight =
    videoHeight * scale;

  const x =
    (canvas.width - drawWidth) / 2;

  const y =
    (canvas.height - drawHeight) / 2;

  ctx.drawImage(
    bgVideo,
    x,
    y,
    drawWidth,
    drawHeight
  );

  ctx.fillStyle =
    "rgba(0,0,0,0.25)";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
}

/* =========================================================
   LOGO
   ========================================================= */

function drawLogo() {
  if (
    !ctx ||
    !logoImage ||
    !logoImage.naturalWidth
  ) {
    return;
  }

  const maxWidth = 260;
  const maxHeight = 150;

  const ratio =
    logoImage.naturalWidth /
    logoImage.naturalHeight;

  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  const x = 55;
  const y = 55;

  ctx.save();

  ctx.globalAlpha = 0.95;

  ctx.drawImage(
    logoImage,
    x,
    y,
    width,
    height
  );

  ctx.restore();
}

/* =========================================================
   REG-ID
   ========================================================= */

function drawRegId(credit = "") {
  if (!ctx) return;

  const text =
    String(credit || "").trim() ||
    "made with multitools.indoadvfuture.com/shortvid";

  ctx.save();

  ctx.font =
    "600 24px Arial, sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.72)";

  ctx.textAlign = "right";

  ctx.fillText(
    text,
    canvas.width - 55,
    100
  );

  ctx.restore();
}

/* =========================================================
   WATERMARK
   ========================================================= */

function drawWatermark() {
  if (!ctx || !canvas) return;

  ctx.save();

  ctx.font =
    "500 22px Arial, sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.55)";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    "made with multitools.indoadvfuture.com/shortvid",
    canvas.width / 2,
    canvas.height - 55
  );

  ctx.restore();
}

/* =========================================================
   TEXT WRAPPING
   ========================================================= */

function wrapText(
  text,
  maxWidth,
  font
) {
  ctx.save();

  ctx.font = font;

  const words =
    String(text || "").split(/\s+/);

  const lines = [];

  let current = "";

  for (const word of words) {
    const test =
      current.length > 0
        ? `${current} ${word}`
        : word;

    if (
      ctx.measureText(test).width <=
      maxWidth
    ) {
      current = test;
    } else {
      if (current) {
        lines.push(current);
      }

      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  ctx.restore();

  return lines;
}

/* =========================================================
   TITLE
   ========================================================= */

function drawTitle(title) {
  if (!ctx) return;

  const cleanTitle =
    String(title || "").trim();

  if (!cleanTitle) return;

  const font =
    "700 54px Arial, sans-serif";

  const lines =
    wrapText(
      cleanTitle,
      900,
      font
    );

  ctx.save();

  ctx.font = font;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const lineHeight = 65;
  const startY = 250;

  lines
    .slice(0, 4)
    .forEach(
      (line, index) => {
        ctx.fillText(
          line,
          canvas.width / 2,
          startY +
            index * lineHeight
        );
      }
    );

  ctx.restore();
}

/* =========================================================
   NARRATION / SUBTITLE
   ========================================================= */

function drawNarration(
  text,
  enabled = true
) {
  if (!ctx || !enabled) return;

  const cleanText =
    String(text || "").trim();

  if (!cleanText) return;

  const font =
    "600 42px Arial, sans-serif";

  const maxTextWidth = 880;

  const lines =
    wrapText(
      cleanText,
      maxTextWidth,
      font
    );

  ctx.save();

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = 54;
  const maxLines = 5;

  const visibleLines =
    lines.slice(0, maxLines);

  if (!visibleLines.length) {
    ctx.restore();
    return;
  }

  /*
    Cari lebar baris terpanjang.
    Box akan mengikuti ukuran teks,
    bukan memenuhi seluruh layar.
  */
  let maxLineWidth = 0;

  for (const line of visibleLines) {
    maxLineWidth =
      Math.max(
        maxLineWidth,
        ctx.measureText(line).width
      );
  }

  /*
    Padding box kiri/kanan.
  */
  const boxPaddingX = 35;
  const boxPaddingY = 22;

  const boxWidth =
    Math.min(
      maxTextWidth + boxPaddingX * 2,
      maxLineWidth + boxPaddingX * 2
    );

  const totalHeight =
    visibleLines.length * lineHeight;

  const boxHeight =
    totalHeight +
    boxPaddingY * 2;

  const boxX =
    (canvas.width - boxWidth) / 2;

  const boxY =
    canvas.height / 2 -
    boxHeight / 2;

  /*
    Subtitle background.
  */
  ctx.fillStyle =
    "rgba(0,0,0,0.58)";

  ctx.beginPath();

  ctx.roundRect(
    boxX,
    boxY,
    boxWidth,
    boxHeight,
    24
  );

  ctx.fill();

  /*
    Subtitle text.
  */
  ctx.fillStyle = "#ffffff";

  const textStartY =
    canvas.height / 2 -
    totalHeight / 2 +
    lineHeight / 2;

  visibleLines.forEach(
    (line, index) => {
      ctx.fillText(
        line,
        canvas.width / 2,
        textStartY +
          index * lineHeight
      );
    }
  );

  ctx.restore();
}
/* =========================================================
   FULL FRAME
   ========================================================= */

function drawFrame(
  title,
  narration,
  subtitle = true,
  credit = ""
) {
  if (!ctx) return;

  drawBackground();
  drawLogo();
  drawRegId(credit);
  drawTitle(title);

  if (subtitle) {
    drawNarration(
      narration,
      true
    );
  }

  drawWatermark();
}

/* =========================================================
   IDLE PREVIEW
   ========================================================= */

function drawIdleFrame() {
  if (!ctx) return;

  drawFrame(
    titleInput?.value ||
      "Reddit Story Generator",

    narrationInput?.value ||
      "Your generated story will appear here.",

    getSubtitleEnabled(),

    creditInput?.value ||
      ""
  );
}

/* =========================================================
   TTS
   ========================================================= */

async function generateSpeech(
  text,
  voice,
  speed
) {
  if (
    !text ||
    !text.trim()
  ) {
    throw new Error(
      "Narration is empty."
    );
  }

  if (text.length > 3000) {
    throw new Error(
      "Narration must be between 1 and 3000 characters."
    );
  }

  const engine =
    await loadKokoro();

  const cleanVoice =
    voice?.trim() ||
    "af_heart";

  const splitterModule =
    await import(
      "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm"
    );

  const TextSplitterStream =
    splitterModule.TextSplitterStream;

  if (!TextSplitterStream) {
    throw new Error(
      "TextSplitterStream not found."
    );
  }

  const splitter =
    new TextSplitterStream();

  const stream =
    engine.stream(
      splitter,
      {
        voice: cleanVoice,
        speed:
          Number(speed) || 1
      }
    );

  const tokens =
    text.match(/\s*\S+/g) || [];

  for (const token of tokens) {
    splitter.push(token);
  }

  splitter.close();

  const audioParts = [];
  const subtitleChunks = [];

  let totalSamples = 0;
  let sampleRate = 24000;

  for await (
    const result of stream
  ) {
    if (
      !result ||
      !result.audio
    ) {
      continue;
    }

    const audio =
      result.audio;

    const samples =
      audio.audio;

    if (
      !samples ||
      !samples.length
    ) {
      continue;
    }

    sampleRate =
      audio.sampling_rate ||
      24000;

    const start =
      totalSamples /
      sampleRate;

    const duration =
      samples.length /
      sampleRate;

    const end =
      start + duration;

    audioParts.push(
      new Float32Array(
        samples
      )
    );

    subtitleChunks.push({
      text:
        result.text || "",
      start,
      end
    });

    totalSamples +=
      samples.length;
  }

  if (!audioParts.length) {
    throw new Error(
      "Kokoro did not generate any audio."
    );
  }

  const merged =
    new Float32Array(
      totalSamples
    );

  let offset = 0;

  for (
    const part of audioParts
  ) {
    merged.set(
      part,
      offset
    );

    offset +=
      part.length;
  }

  const wavBlob =
    encodeWAV(
      merged,
      sampleRate
    );

  const url =
    URL.createObjectURL(
      wavBlob
    );

  return {
    blob: wavBlob,
    url,
    chunks: subtitleChunks,
    duration:
      totalSamples /
      sampleRate
  };
}

/* =========================================================
   WAV ENCODER
   ========================================================= */

function encodeWAV(
  samples,
  sampleRate
) {
  const buffer =
    new ArrayBuffer(
      44 +
      samples.length * 2
    );

  const view =
    new DataView(buffer);

  function writeString(
    offset,
    string
  ) {
    for (
      let i = 0;
      i < string.length;
      i++
    ) {
      view.setUint8(
        offset + i,
        string.charCodeAt(i)
      );
    }
  }

  writeString(
    0,
    "RIFF"
  );

  view.setUint32(
    4,
    36 +
      samples.length * 2,
    true
  );

  writeString(
    8,
    "WAVE"
  );

  writeString(
    12,
    "fmt "
  );

  view.setUint32(
    16,
    16,
    true
  );

  view.setUint16(
    20,
    1,
    true
  );

  view.setUint16(
    22,
    1,
    true
  );

  view.setUint32(
    24,
    sampleRate,
    true
  );

  view.setUint32(
    28,
    sampleRate * 2,
    true
  );

  view.setUint16(
    32,
    2,
    true
  );

  view.setUint16(
    34,
    16,
    true
  );

  writeString(
    36,
    "data"
  );

  view.setUint32(
    40,
    samples.length * 2,
    true
  );

  let offset = 44;

  for (
    let i = 0;
    i < samples.length;
    i++
  ) {
    const sample =
      clamp(
        samples[i],
        -1,
        1
      );

    const value =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

    view.setInt16(
      offset,
      value,
      true
    );

    offset += 2;
  }

  return new Blob(
    [buffer],
    {
      type: "audio/wav"
    }
  );
}

/* =========================================================
   AUDIO BUFFER
   ========================================================= */

async function audioToBuffer(
  audioData
) {
  if (!audioContext) {
    audioContext =
      new AudioContext();
  }

  if (
    audioData instanceof Blob
  ) {
    const arrayBuffer =
      await audioData.arrayBuffer();

    return await audioContext.decodeAudioData(
      arrayBuffer
    );
  }

  if (
    audioData &&
    typeof audioData.toBlob ===
      "function"
  ) {
    const blob =
      audioData.toBlob();

    const arrayBuffer =
      await blob.arrayBuffer();

    return await audioContext.decodeAudioData(
      arrayBuffer
    );
  }

  if (
    audioData instanceof
    Float32Array
  ) {
    const sampleRate = 24000;

    const buffer =
      audioContext.createBuffer(
        1,
        audioData.length,
        sampleRate
      );

    buffer.copyToChannel(
      audioData,
      0
    );

    return buffer;
  }

  throw new Error(
    "Unsupported Kokoro audio format."
  );
}

/* =========================================================
   SUBTITLE TIMING
   ========================================================= */

function createSubtitleChunks(
  narration,
  duration
) {
  const words =
    String(narration || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    !words.length ||
    duration <= 0
  ) {
    return [];
  }

  const chunks = [];
  let currentWords = [];

  const pushChunk = () => {
    if (!currentWords.length) {
      return;
    }

    chunks.push({
      text:
        currentWords.join(" "),

      words: [
        ...currentWords
      ]
    });

    currentWords = [];
  };

  for (const word of words) {
    currentWords.push(word);

    const endsSentence =
      /[.!?]["')\]}]*$/.test(
        word
      );

    const endsPause =
      /[,;:]["')\]}]*$/.test(
        word
      );

    if (
      endsSentence &&
      currentWords.length >= 2
    ) {
      pushChunk();
      continue;
    }

    if (
      endsPause &&
      currentWords.length >= 2
    ) {
      pushChunk();
      continue;
    }

    if (
      currentWords.length >= 5
    ) {
      pushChunk();
    }
  }

  pushChunk();

  if (!chunks.length) {
    return [];
  }

  const weights =
    chunks.map(
      (chunk) => {
        let weight = 0;

        for (
          const word of chunk.words
        ) {
          const cleanWord =
            word.replace(
              /[^\p{L}\p{N}]/gu,
              ""
            );

          weight +=
            Math.max(
              1,
              cleanWord.length *
                0.72
            );
        }

        if (
          /[.!?]["')\]}]*$/.test(
            chunk.text
          )
        ) {
          weight += 2.8;
        } else if (
          /[,;:]["')\]}]*$/.test(
            chunk.text
          )
        ) {
          weight += 1.25;
        }

        return Math.max(
          weight,
          1
        );
      }
    );

  const totalWeight =
    weights.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  if (
    totalWeight <= 0
  ) {
    return [];
  }

  const usableDuration =
    Math.max(
      0,
      duration - 0.05
    );

  let currentTime = 0;

  return chunks.map(
    (
      chunk,
      index
    ) => {
      const chunkDuration =
        usableDuration *
        (
          weights[index] /
          totalWeight
        );

      const start =
        currentTime;

      const end =
        index ===
        chunks.length - 1
          ? duration
          : currentTime +
            chunkDuration;

      currentTime =
        end;

      return {
        text:
          chunk.text,
        start,
        end
      };
    }
  );
}

/* =========================================================
   FIND ACTIVE SUBTITLE
   ========================================================= */

function getActiveSubtitle(
  subtitlesData,
  elapsed
) {
  if (
    !subtitlesData ||
    !subtitlesData.length
  ) {
    return "";
  }

  for (
    const subtitle of subtitlesData
  ) {
    if (
      elapsed >= subtitle.start &&
      elapsed < subtitle.end
    ) {
      return subtitle.text;
    }
  }

  const last =
    subtitlesData[
      subtitlesData.length - 1
    ];

  if (
    elapsed >= last.start &&
    elapsed <= last.end + 0.05
  ) {
    return last.text;
  }

  return "";
}

/* =========================================================
   BACKGROUND AUDIO
   ========================================================= */

function setupAudioGraph(
  destination
) {
  if (!audioContext) {
    audioContext =
      new AudioContext();
  }

  if (!bgAudioElement) {
    throw new Error(
      "Background audio is not loaded."
    );
  }

  const bgSource =
    audioContext.createMediaElementSource(
      bgAudioElement
    );

  const bgGain =
    audioContext.createGain();

  bgGain.gain.value = 0.25;

  bgSource.connect(
    bgGain
  );

  bgGain.connect(
    destination
  );

  return {
    bgSource,
    bgGain
  };
}

/* =========================================================
   RECORD VIDEO
   ========================================================= */

async function recordVideo({
  title,
  credit,
  narration,
  voice,
  speed,
  subtitles
}) {
  if (!canvas || !ctx) {
    throw new Error(
      "Canvas is not ready."
    );
  }

  setStatus(
    "Generating Kokoro narration..."
  );

  const speech =
    await generateSpeech(
      narration,
      voice,
      speed
    );

  const narrationBuffer =
    await audioToBuffer(
      speech.blob
    );

  const narrationDuration =
    narrationBuffer.duration;

  if (
    !Number.isFinite(
      narrationDuration
    ) ||
    narrationDuration <= 0
  ) {
    throw new Error(
      "Invalid narration duration."
    );
  }

  const endScreenDuration =
    2.5;

  const totalDuration =
    narrationDuration +
    endScreenDuration;

  const subtitlesData =
    subtitles
      ? createSubtitleChunks(
          narration,
          narrationDuration
        )
      : [];

  console.log(
    "Subtitle timing:",
    subtitlesData
  );

  const videoStream =
    canvas.captureStream(30);

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {}

    audioContext = null;
  }

  audioContext =
    new AudioContext();

  if (
    audioContext.state ===
    "suspended"
  ) {
    await audioContext.resume();
  }

  const destination =
    audioContext.createMediaStreamDestination();

  const narrationSource =
    audioContext.createBufferSource();

  narrationSource.buffer =
    narrationBuffer;

  const narrationGain =
    audioContext.createGain();

  narrationGain.gain.value =
    1.0;

  narrationSource.connect(
    narrationGain
  );

  narrationGain.connect(
    destination
  );

  const audioURL =
    customAudio?.files?.[0]
      ? URL.createObjectURL(
          customAudio.files[0]
        )
      : "bg.mp3";

  bgAudioElement =
    new Audio();

  bgAudioElement.src =
    audioURL;

  bgAudioElement.crossOrigin =
    "anonymous";

  bgAudioElement.loop = true;
  bgAudioElement.preload = "auto";

  const {
    bgSource,
    bgGain
  } =
    setupAudioGraph(
      destination
    );

  const combinedStream =
    new MediaStream();

  videoStream
    .getVideoTracks()
    .forEach(
      (track) => {
        combinedStream.addTrack(
          track
        );
      }
    );

  destination.stream
    .getAudioTracks()
    .forEach(
      (track) => {
        combinedStream.addTrack(
          track
        );
      }
    );

  let mimeType =
    "video/webm;codecs=vp9,opus";

  if (
    !MediaRecorder.isTypeSupported(
      mimeType
    )
  ) {
    mimeType =
      "video/webm;codecs=vp8,opus";
  }

  if (
    !MediaRecorder.isTypeSupported(
      mimeType
    )
  ) {
    mimeType =
      "video/webm";
  }

  mediaRecorder =
    new MediaRecorder(
      combinedStream,
      {
        mimeType,
        videoBitsPerSecond:
          6_000_000,
        audioBitsPerSecond:
          128_000
      }
    );

  recordedChunks = [];

  mediaRecorder.ondataavailable =
    (event) => {
      if (
        event.data &&
        event.data.size > 0
      ) {
        recordedChunks.push(
          event.data
        );
      }
    };

  const recordingFinished =
    new Promise(
      (resolve, reject) => {
        mediaRecorder.onstop =
          resolve;

        mediaRecorder.onerror =
          (event) => {
            reject(
              event.error ||
                new Error(
                  "MediaRecorder error"
                )
            );
          };
      }
    );

  if (!bgVideo) {
    throw new Error(
      "Background video is not loaded."
    );
  }

  try {
    bgVideo.pause();
  } catch {}

  try {
    bgVideo.currentTime = 0;
  } catch {}

  bgVideo.muted = true;
  bgVideo.loop = true;

  if (
    bgVideo.readyState < 2
  ) {
    await new Promise(
      (resolve) => {
        const onReady = () => {
          bgVideo.removeEventListener(
            "canplay",
            onReady
          );

          resolve();
        };

        bgVideo.addEventListener(
          "canplay",
          onReady,
          {
            once: true
          }
        );
      }
    );
  }

  try {
    bgAudioElement.currentTime =
      0;

    await bgAudioElement.play();
  } catch (error) {
    console.warn(
      "Background audio autoplay issue:",
      error
    );
  }

  try {
    await bgVideo.play();
  } catch (error) {
    console.warn(
      "Background video play issue:",
      error
    );
  }

  for (
    let i = 0;
    i < 5;
    i++
  ) {
    drawFrame(
      title,
      narration,
      false,
      credit
    );

    await new Promise(
      (resolve) =>
        requestAnimationFrame(
          resolve
        )
    );
  }

  drawFrame(
    title,
    subtitles &&
    subtitlesData.length
      ? subtitlesData[0].text
      : narration,
    subtitles,
    credit
  );

  const audioStartTime =
    audioContext.currentTime +
    0.05;

  mediaRecorder.start(
    1000
  );

  narrationSource.start(
    audioStartTime
  );

  setStatus(
    "Recording video..."
  );

  await new Promise(
    (resolve) => {
      function renderLoop() {
        const elapsed =
          Math.max(
            0,
            audioContext.currentTime -
              audioStartTime
          );

        if (
          elapsed <
          narrationDuration
        ) {
          let activeSubtitle =
            narration;

          if (
            subtitles &&
            subtitlesData.length
          ) {
            const timedSubtitle =
              getActiveSubtitle(
                subtitlesData,
                elapsed
              );

            if (
              timedSubtitle
            ) {
              activeSubtitle =
                timedSubtitle;
            }
          }

          drawFrame(
            title,
            activeSubtitle,
            subtitles,
            credit
          );
        } else if (
          elapsed <
          totalDuration
        ) {
          drawEndScreen();
        } else {
          resolve();
          return;
        }

        requestAnimationFrame(
          renderLoop
        );
      }

      renderLoop();
    }
  );

  try {
    narrationSource.stop();
  } catch {}

  try {
    bgAudioElement.pause();
  } catch {}

  try {
    bgVideo.pause();
  } catch {}

  await sleep(250);

  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {
    mediaRecorder.stop();
  }

  await recordingFinished;

  try {
    bgSource.disconnect();
  } catch {}

  try {
    bgGain.disconnect();
  } catch {}

  try {
    narrationGain.disconnect();
  } catch {}

  try {
    narrationSource.disconnect();
  } catch {}

  combinedStream
    .getTracks()
    .forEach(
      (track) => {
        try {
          track.stop();
        } catch {}
      }
    );

  if (
    customAudio?.files?.[0] &&
    audioURL.startsWith("blob:")
  ) {
    URL.revokeObjectURL(
      audioURL
    );
  }

  const blob =
    new Blob(
      recordedChunks,
      {
        type: mimeType
      }
    );

  if (!blob.size) {
    throw new Error(
      "Generated video is empty."
    );
  }

  try {
    await audioContext.close();
  } catch {}

  audioContext = null;
  bgAudioElement = null;

  return blob;
}

/* =========================================================
   END SCREEN
   ========================================================= */

function drawEndScreen() {
  if (!ctx || !canvas) return;

  ctx.fillStyle = "#000";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    endImage &&
    endImage.naturalWidth
  ) {
    const ratio =
      endImage.naturalWidth /
      endImage.naturalHeight;

    let width =
      canvas.width;

    let height =
      width / ratio;

    if (
      height <
      canvas.height
    ) {
      height =
        canvas.height;

      width =
        height * ratio;
    }

    const x =
      (
        canvas.width -
        width
      ) / 2;

    const y =
      (
        canvas.height -
        height
      ) / 2;

    ctx.drawImage(
      endImage,
      x,
      y,
      width,
      height
    );
  }

  drawWatermark();
}

/* =========================================================
   WEBM CONVERSION PROMPT
   ========================================================= */

const VIDEO_CONVERTER_URL =
  "../video-converter/index.html";

function showWebMConversionPrompt() {
  if (
    typeof window.showWebMConversionPrompt ===
    "function"
  ) {
    window.showWebMConversionPrompt();
    return;
  }

  console.warn(
    "WebM conversion modal is not available."
  );
}

/* =========================================================
   DOWNLOAD
   ========================================================= */

function downloadBlob(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );

  /*
    The WebM download has now been triggered.
    Ask the user whether they want to continue
    to the MP4 converter.
  */
  setTimeout(
    () => {
      if (
        typeof window.showWebMConversionPrompt ===
        "function"
      ) {
        window.showWebMConversionPrompt();
      }
    },
    500
  );
}

/* =========================================================
   RENDER VIDEO
   ========================================================= */

async function renderVideo(
  data
) {
  const {
    title,
    credit,
    narration,
    voice,
    speed,
    subtitles
  } = data;

  try {
    const blob =
      await recordVideo({
        title,
        credit,
        narration,
        voice,
        speed,
        subtitles
      });

    const safeTitle =
      String(
        title ||
          "reddit-story"
      )
        .replace(
          /[^a-z0-9_\- ]/gi,
          ""
        )
        .trim()
        .replace(
          /\s+/g,
          "-"
        )
        .slice(
          0,
          80
        );

    const filename =
      `${
        safeTitle ||
        "reddit-story"
      }.webm`;

    downloadBlob(
      blob,
      filename
    );

    return blob;
  } catch (error) {
    console.error(
      "Render failed:",
      error
    );

    throw error;
  }
}

/* =========================================================
   FORM DATA
   ========================================================= */

function getFormData() {
  return {
    title:
      titleInput?.value?.trim() ||
      "Reddit Story",

    credit:
      creditInput?.value?.trim() ||
      "",

    narration:
      narrationInput?.value?.trim() ||
      "",

    voice:
      voiceInput?.value?.trim() ||
      "af_heart",

    speed:
      getSpeed(),

    subtitles:
      getSubtitleEnabled()
  };
}

/* =========================================================
   CSV
   ========================================================= */

function parseCSVLine(line) {
  const result = [];

  let current = "";
  let insideQuotes = false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {
    const char = line[i];

    if (
      char === '"'
    ) {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }
    } else if (
      char === "," &&
      !insideQuotes
    ) {
      result.push(
        current
      );

      current = "";
    } else {
      current += char;
    }
  }

  result.push(
    current
  );

  return result.map(
    (value) =>
      value.trim()
  );
}

function parseCSV(text) {
  const lines =
    String(text || "")
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.trim().length > 0
      );

  if (!lines.length) {
    return [];
  }

  const headers =
    parseCSVLine(
      lines[0]
    ).map(
      (header) =>
        header
          .toLowerCase()
          .trim()
    );

  return lines
    .slice(1)
    .map(
      (line) => {
        const values =
          parseCSVLine(
            line
          );

        const item = {};

        headers.forEach(
          (
            header,
            index
          ) => {
            item[header] =
              values[index] ??
              "";
          }
        );

        return item;
      }
    );
}

/* =========================================================
   QUEUE
   ========================================================= */

function updateQueueCount() {
  if (queueCount) {
    queueCount.textContent =
      String(
        queue.length
      );
  }
}

function renderQueue() {
  if (!queueBody) return;

  queueBody.innerHTML =
    "";

  queue.forEach(
    (
      item,
      index
    ) => {
      const tr =
        document.createElement(
          "tr"
        );

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.credit || "")}</td>
        <td>${escapeHtml(item.voice || "")}</td>
        <td>${escapeHtml(item.speed || "1")}</td>
        <td>${
          item.subtitles !== false
            ? "ON"
            : "OFF"
        }</td>
      `;

      tr.addEventListener(
        "click",
        () => {
          selectedIndex =
            index;

          document
            .querySelectorAll(
              "#queueBody tr"
            )
            .forEach(
              (row) =>
                row.classList.remove(
                  "selected"
                )
            );

          tr.classList.add(
            "selected"
          );
        }
      );

      queueBody.appendChild(
        tr
      );
    }
  );

  updateQueueCount();
}

function addQueueItems(
  items
) {
  for (
    const item of items
  ) {
    queue.push({
      title:
        item.title ||
        "Reddit Story",

      credit:
        item.credit ||
        "",

      narration:
        item.narration ||
        "",

      voice:
        item.voice ||
        "af_heart",

      speed:
        Number(item.speed) ||
        1,

      subtitles:
        String(
          item.subtitles ??
            "true"
        ).toLowerCase() !==
        "false"
    });
  }

  renderQueue();
}

/* =========================================================
   BUTTONS
   ========================================================= */

copyHeaderBtn?.addEventListener(
  "click",
  async () => {
    const header =
      "title,credit,narration,voice,speed,subtitles";

    try {
      await navigator.clipboard.writeText(
        header
      );

      setStatus(
        "CSV header copied."
      );
    } catch {
      setStatus(
        "Could not copy CSV header."
      );
    }
  }
);

clearQueueBtn?.addEventListener(
  "click",
  () => {
    queue = [];
    selectedIndex = -1;

    renderQueue();

    setStatus(
      "Queue cleared."
    );
  }
);

csvInput?.addEventListener(
  "change",
  async () => {
    const file =
      csvInput.files?.[0];

    if (!file) return;

    try {
      const text =
        await file.text();

      const parsed =
        parseCSV(text);

      addQueueItems(
        parsed
      );

      setStatus(
        `Loaded ${parsed.length} CSV item(s).`
      );
    } catch (error) {
      console.error(
        error
      );

      setStatus(
        `CSV error: ${error.message}`
      );
    }
  }
);

/* =========================================================
   CUSTOM VIDEO / AUDIO
   ========================================================= */

customVideo?.addEventListener(
  "change",
  () => {
    const file =
      customVideo.files?.[0];

    if (!file) return;

    const url =
      URL.createObjectURL(
        file
      );

    if (bgVideo) {
      try {
        bgVideo.pause();
      } catch {}

      bgVideo.src = url;
      bgVideo.load();
    }

    setStatus(
      "Custom background video loaded."
    );
  }
);

customAudio?.addEventListener(
  "change",
  () => {
    const file =
      customAudio.files?.[0];

    if (!file) return;

    setStatus(
      "Custom background audio loaded."
    );
  }
);

/* =========================================================
   GENERATE MANUAL
   ========================================================= */

generateBtn?.addEventListener(
  "click",
  async () => {
    try {
      generateBtn.disabled =
        true;

      const data =
        getFormData();

      if (!data.narration) {
        throw new Error(
          "Narration is empty."
        );
      }

      setStatus(
        "Starting render..."
      );

      await renderVideo(
        data
      );

      setStatus(
        "Video generated successfully."
      );
    } catch (error) {
      console.error(
        error
      );

      setStatus(
        `Error: ${error.message}`
      );
    } finally {
      generateBtn.disabled =
        false;
    }
  }
);

/* =========================================================
   LOAD SELECTED
   ========================================================= */

loadSelectedBtn?.addEventListener(
  "click",
  () => {
    if (
      selectedIndex < 0 ||
      !queue[selectedIndex]
    ) {
      setStatus(
        "Select a queue item first."
      );

      return;
    }

    const item =
      queue[selectedIndex];

    if (titleInput) {
      titleInput.value =
        item.title || "";
    }

    if (creditInput) {
      creditInput.value =
        item.credit || "";
    }

    if (narrationInput) {
      narrationInput.value =
        item.narration || "";
    }

    if (voiceInput) {
      voiceInput.value =
        item.voice ||
        "af_heart";
    }

    if (speedInput) {
      speedInput.value =
        item.speed || 1;
    }

    if (subtitlesInput) {
      subtitlesInput.value =
        item.subtitles
          ? "true"
          : "false";
    }

    drawIdleFrame();

    setStatus(
      "Selected queue item loaded."
    );
  }
);

/* =========================================================
   GENERATE SELECTED
   ========================================================= */

generateSelectedBtn?.addEventListener(
  "click",
  async () => {
    if (
      selectedIndex < 0 ||
      !queue[selectedIndex]
    ) {
      setStatus(
        "Select a queue item first."
      );

      return;
    }

    try {
      generateSelectedBtn.disabled =
        true;

      const item =
        queue[selectedIndex];

      setStatus(
        `Rendering item ${
          selectedIndex + 1
        }...`
      );

      await renderVideo(
        item
      );

      setStatus(
        "Selected video generated."
      );
    } catch (error) {
      console.error(
        error
      );

      setStatus(
        `Error: ${error.message}`
      );
    } finally {
      generateSelectedBtn.disabled =
        false;
    }
  }
);

/* =========================================================
   GENERATE ALL
   ========================================================= */

generateAllBtn?.addEventListener(
  "click",
  async () => {
    if (!queue.length) {
      setStatus(
        "Queue is empty."
      );

      return;
    }

    try {
      generateAllBtn.disabled =
        true;

      for (
        let i = 0;
        i < queue.length;
        i++
      ) {
        setStatus(
          `Rendering ${
            i + 1
          }/${queue.length}...`
        );

        await renderVideo(
          queue[i]
        );

        await sleep(
          500
        );
      }

      setStatus(
        "All queued videos generated."
      );
    } catch (error) {
      console.error(
        error
      );

      setStatus(
        `Queue render error: ${error.message}`
      );
    } finally {
      generateAllBtn.disabled =
        false;
    }
  }
);

/* =========================================================
   INPUT PREVIEW
   ========================================================= */

[
  titleInput,
  creditInput,
  narrationInput,
  voiceInput,
  speedInput,
  subtitlesInput
].forEach(
  (element) => {
    element?.addEventListener(
      "input",
      drawIdleFrame
    );

    element?.addEventListener(
      "change",
      drawIdleFrame
    );
  }
);

/* =========================================================
   INITIALIZE ASSETS
   ========================================================= */

async function initializeAssets() {
  setupCanvas();

  drawIdleFrame();

  const results =
    await Promise.allSettled([
      loadImage(
        logoLoader,
        logoStatus,
        "Logo"
      ).then(
        (image) => {
          logoImage =
            image;
        }
      ),

      loadImage(
        endLoader,
        endStatus,
        "End screen"
      ).then(
        (image) => {
          endImage =
            image;
        }
      ),

      loadVideoMetadata(
        bgLoader,
        videoStatus
      ).then(
        (video) => {
          bgVideo =
            video;
        }
      )
    ]);

  try {
    const audioLoader =
      document.createElement(
        "audio"
      );

    const customAudioFile =
      customAudio?.files?.[0];

    const audioURL =
      customAudioFile
        ? URL.createObjectURL(
            customAudioFile
          )
        : "bg.mp3";

    audioLoader.src =
      audioURL;

    audioLoader.preload =
      "auto";

    audioLoader.crossOrigin =
      "anonymous";

    await loadAudio(
      audioLoader,
      audioStatus
    );

    bgAudioElement =
      audioLoader;
  } catch (error) {
    console.warn(
      "Background audio unavailable:",
      error
    );
  }

  assetsReady =
    results.some(
      (result) =>
        result.status ===
        "fulfilled"
    );

  if (
    !bgVideo &&
    bgLoader
  ) {
    bgVideo =
      bgLoader;
  }

  drawIdleFrame();

  setStatus(
    "Assets initialized. Ready."
  );
}

/* =========================================================
   GLOBAL ERROR HANDLERS
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "Global error:",
      event.error ||
        event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "Unhandled promise rejection:",
      event.reason
    );
  }
);

/* =========================================================
   START
   ========================================================= */

initializeAssets().catch(
  (error) => {
    console.error(
      "Initialization failed:",
      error
    );

    setStatus(
      `Initialization error: ${error.message}`
    );
  }
);
