// ============================================================
// IAF — Reddit Story Generator
// Full Slop Generator
// script.js
// ============================================================

let KokoroTTSClass = null;
let tts = null;

let canvas = null;
let ctx = null;

let bgVideoElement = null;
let bgAudioElement = null;

let mediaRecorder = null;
let recordedChunks = [];

let currentQueue = [];
let selectedQueueIndex = -1;

let isGenerating = false;


// ============================================================
// DOM
// ============================================================

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


// ============================================================
// CANVAS
// ============================================================

canvas = previewCanvas;

if (canvas) {
  canvas.width = 1080;
  canvas.height = 1920;

  ctx = canvas.getContext("2d", {
    alpha: false
  });
}


// ============================================================
// HELPERS
// ============================================================

function setStatus(text) {
  if (statusText) {
    statusText.textContent = text;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ============================================================
// ASSET CHECK
// ============================================================

function checkAssets() {
  if (logoStatus) {
    logoStatus.textContent =
      logoLoader?.complete && logoLoader?.naturalWidth
        ? "✓ Logo loaded"
        : "✕ Logo missing";
  }

  if (endStatus) {
    endStatus.textContent =
      endLoader?.complete && endLoader?.naturalWidth
        ? "✓ End screen loaded"
        : "✕ End screen missing";
  }

  if (videoStatus) {
    videoStatus.textContent =
      bgLoader?.readyState >= 2
        ? "✓ Background video loaded"
        : "✕ Background video missing";
  }
}


// ============================================================
// CUSTOM VIDEO
// ============================================================

if (customVideo) {
  customVideo.addEventListener("change", () => {
    const file = customVideo.files?.[0];

    if (!file) {
      bgVideoElement = bgLoader;
      checkAssets();
      return;
    }

    if (bgVideoElement && bgVideoElement !== bgLoader) {
      try {
        bgVideoElement.pause();
        URL.revokeObjectURL(bgVideoElement.src);
      } catch {}
    }

    bgVideoElement = document.createElement("video");

    bgVideoElement.src = URL.createObjectURL(file);
    bgVideoElement.muted = true;
    bgVideoElement.loop = true;
    bgVideoElement.playsInline = true;
    bgVideoElement.preload = "auto";

    bgVideoElement.addEventListener("loadeddata", () => {
      if (videoStatus) {
        videoStatus.textContent = "✓ Custom video loaded";
      }
    });

    bgVideoElement.load();
  });
}


// ============================================================
// CUSTOM AUDIO
// ============================================================

if (customAudio) {
  customAudio.addEventListener("change", () => {
    const file = customAudio.files?.[0];

    if (!file) {
      bgAudioElement = null;

      if (audioStatus) {
        audioStatus.textContent = "No custom audio";
      }

      return;
    }

    if (bgAudioElement) {
      try {
        bgAudioElement.pause();

        if (bgAudioElement.src.startsWith("blob:")) {
          URL.revokeObjectURL(bgAudioElement.src);
        }
      } catch {}
    }

    bgAudioElement = document.createElement("audio");

    bgAudioElement.src = URL.createObjectURL(file);
    bgAudioElement.preload = "auto";

    bgAudioElement.addEventListener("loadeddata", () => {
      if (audioStatus) {
        audioStatus.textContent = "✓ Custom audio loaded";
      }
    });

    bgAudioElement.load();
  });
}


// ============================================================
// DEFAULT BACKGROUND VIDEO
// ============================================================

function getBackgroundVideo() {
  return bgVideoElement || bgLoader;
}


// ============================================================
// LOGO
// ============================================================

function drawLogo() {
  if (!ctx || !logoLoader) return;

  if (!logoLoader.complete || !logoLoader.naturalWidth) {
    return;
  }

  const maxWidth = 260;
  const maxHeight = 150;

  const scale = Math.min(
    maxWidth / logoLoader.naturalWidth,
    maxHeight / logoLoader.naturalHeight,
    1
  );

  const width = logoLoader.naturalWidth * scale;
  const height = logoLoader.naturalHeight * scale;

  const x = 55;
  const y = 55;

  ctx.drawImage(
    logoLoader,
    x,
    y,
    width,
    height
  );
}


// ============================================================
// REG-ID / CREDIT
// ============================================================

function drawRegId(credit = "") {
  if (!ctx) return;

  const text =
    String(credit || "").trim() ||
    "NO-REG";

  ctx.save();

  ctx.font =
    "600 24px Arial, sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.72)";

  ctx.textAlign = "right";

  ctx.fillText(
    `${text}`,
    canvas.width - 55,
    100
  );

  ctx.restore();
}


// ============================================================
// WATERMARK
// ============================================================

function drawWatermark() {
  if (!ctx) return;

  const text =
    "made with shortvid.indoadvfuture.com";

  ctx.save();

  ctx.font =
    "500 22px Arial, sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.55)";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    text,
    canvas.width / 2,
    canvas.height - 55
  );

  ctx.restore();
}


// ============================================================
// BACKGROUND VIDEO
// ============================================================

function drawBackground() {
  if (!ctx) return;

  const video = getBackgroundVideo();

  ctx.fillStyle = "#000";
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    video &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {
    const videoRatio =
      video.videoWidth / video.videoHeight;

    const canvasRatio =
      canvas.width / canvas.height;

    let drawWidth;
    let drawHeight;

    if (videoRatio > canvasRatio) {
      drawHeight = canvas.height;
      drawWidth = drawHeight * videoRatio;
    } else {
      drawWidth = canvas.width;
      drawHeight = drawWidth / videoRatio;
    }

    const x =
      (canvas.width - drawWidth) / 2;

    const y =
      (canvas.height - drawHeight) / 2;

    ctx.drawImage(
      video,
      x,
      y,
      drawWidth,
      drawHeight
    );
  }

  // Dark overlay
  ctx.fillStyle =
    "rgba(0,0,0,0.25)";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
}


// ============================================================
// TEXT WRAPPING
// ============================================================

function wrapText(
  text,
  maxWidth,
  font
) {
  ctx.save();

  ctx.font = font;

  const words =
    String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const lines = [];

  let line = "";

  for (const word of words) {
    const test =
      line
        ? `${line} ${word}`
        : word;

    const width =
      ctx.measureText(test).width;

    if (
      width <= maxWidth ||
      !line
    ) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  ctx.restore();

  return lines;
}


// ============================================================
// TITLE
// ============================================================

function drawTitle(title = "") {
  if (!ctx) return;

  const text =
    String(title || "").trim();

  if (!text) return;

  ctx.save();

  const font =
    "700 54px Arial, sans-serif";

  const maxWidth = 900;

  const lines =
    wrapText(
      text,
      maxWidth,
      font
    ).slice(0, 4);

  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const lineHeight = 64;

  let y = 250;

  for (const line of lines) {
    ctx.fillText(
      line,
      canvas.width / 2,
      y
    );

    y += lineHeight;
  }

  ctx.restore();
}


// ============================================================
// NARRATION / SUBTITLE BOX
// ============================================================

function drawNarration(text = "") {
  if (!ctx) return;

  const cleanText =
    String(text || "").trim();

  if (!cleanText) return;

  const font =
    "600 42px Arial, sans-serif";

  const maxWidth = 850;

  const lines =
    wrapText(
      cleanText,
      maxWidth,
      font
    ).slice(0, 5);

  if (!lines.length) return;

  ctx.save();

  ctx.font = font;

  const lineHeight = 55;

  const paddingX = 45;
  const paddingY = 35;

  const boxWidth = 900;

  const boxHeight =
    lines.length * lineHeight +
    paddingY * 2;

  const boxX =
    (canvas.width - boxWidth) / 2;

  const boxY =
    920 - boxHeight / 2;

  // Rounded rectangle
  const radius = 32;

  ctx.beginPath();

  ctx.moveTo(
    boxX + radius,
    boxY
  );

  ctx.lineTo(
    boxX + boxWidth - radius,
    boxY
  );

  ctx.quadraticCurveTo(
    boxX + boxWidth,
    boxY,
    boxX + boxWidth,
    boxY + radius
  );

  ctx.lineTo(
    boxX + boxWidth,
    boxY + boxHeight - radius
  );

  ctx.quadraticCurveTo(
    boxX + boxWidth,
    boxY + boxHeight,
    boxX + boxWidth - radius,
    boxY + boxHeight
  );

  ctx.lineTo(
    boxX + radius,
    boxY + boxHeight
  );

  ctx.quadraticCurveTo(
    boxX,
    boxY + boxHeight,
    boxX,
    boxY + boxHeight - radius
  );

  ctx.lineTo(
    boxX,
    boxY + radius
  );

  ctx.quadraticCurveTo(
    boxX,
    boxY,
    boxX + radius,
    boxY
  );

  ctx.closePath();

  ctx.fillStyle =
    "rgba(0,0,0,0.68)";

  ctx.fill();

  // Text
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  let y =
    boxY + paddingY;

  for (const line of lines) {
    ctx.fillText(
      line,
      canvas.width / 2,
      y
    );

    y += lineHeight;
  }

  ctx.restore();
}


// ============================================================
// NORMAL FRAME
// ============================================================

function drawFrame(
  title = "",
  narration = "",
  subtitle = true,
  credit = ""
) {
  if (!ctx) return;

  drawBackground();
  drawLogo();
  drawRegId(credit);
  drawTitle(title);

  if (subtitle) {
    drawNarration(narration);
  }

  drawWatermark();
}


// ============================================================
// IDLE FRAME
// ============================================================

function drawIdleFrame() {
  drawFrame(
    titleInput?.value || "Reddit Story",
    narrationInput?.value ||
      "Your generated story will appear here.",
    true,
    creditInput?.value || "NO-REG"
  );
}


// ============================================================
// KOKORO LOAD
// ============================================================

async function loadKokoro() {
  if (tts) {
    return tts;
  }

  setStatus("Loading Kokoro TTS...");

  try {
    const module =
      await import(
        "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm"
      );

    KokoroTTSClass =
      module.KokoroTTS;

    if (!KokoroTTSClass) {
      throw new Error(
        "KokoroTTS export not found."
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

    setStatus("Kokoro loaded.");

    return tts;

  } catch (error) {
    console.error(
      "Kokoro load error:",
      error
    );

    setStatus(
      "✕ Failed to load Kokoro: " +
      error.message
    );

    throw error;
  }
}


// ============================================================
// TTS
// ============================================================

async function generateSpeech(
  text,
  voice,
  speed
) {
  const engine =
    await loadKokoro();

  const cleanText =
    String(text || "").trim();

  if (!cleanText) {
    throw new Error(
      "Narration is empty."
    );
  }

  const selectedVoice =
    String(
      voice ||
      "af_heart"
    ).trim();

  let selectedSpeed =
    Number(speed);

  if (
    !Number.isFinite(selectedSpeed) ||
    selectedSpeed <= 0
  ) {
    selectedSpeed = 1;
  }

  setStatus(
    `Generating TTS... Voice: ${selectedVoice}`
  );

  const audio =
    await engine.generate(
      cleanText,
      {
        voice: selectedVoice,
        speed: selectedSpeed
      }
    );

  return audio;
}


// ============================================================
// AUDIO BUFFER
// ============================================================

async function audioToBuffer(audio) {
  if (!audio) {
    throw new Error(
      "Kokoro returned empty audio."
    );
  }

  // Kokoro Audio object
  if (
    typeof audio.toBlob === "function"
  ) {
    const blob =
      await audio.toBlob();

    return await blob.arrayBuffer();
  }

  // Blob
  if (
    audio instanceof Blob
  ) {
    return await audio.arrayBuffer();
  }

  // Float32Array / typed array
  if (
    audio instanceof Float32Array
  ) {
    return {
      samples: audio,
      sampleRate: 24000
    };
  }

  // ArrayBuffer
  if (
    audio instanceof ArrayBuffer
  ) {
    return audio;
  }

  // Some Kokoro versions expose .audio
  if (audio.audio) {
    if (
      audio.audio instanceof Float32Array
    ) {
      return {
        samples: audio.audio,
        sampleRate:
          audio.sampling_rate ||
          audio.sampleRate ||
          24000
      };
    }
  }

  throw new Error(
    "Unsupported Kokoro audio format."
  );
}


// ============================================================
// AUDIO BUFFER → WAV
// ============================================================

function encodeWav(
  samples,
  sampleRate = 24000
) {
  const buffer =
    new ArrayBuffer(
      44 + samples.length * 2
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
    36 + samples.length * 2,
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

    view.setInt16(
      offset,
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff,
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


// ============================================================
// CREATE AUDIO ELEMENT FROM KOKORO
// ============================================================

async function createNarrationAudio(
  audio
) {
  let blob;

  if (
    audio &&
    typeof audio.toBlob === "function"
  ) {
    blob =
      await audio.toBlob();
  } else if (
    audio instanceof Blob
  ) {
    blob = audio;
  } else if (
    audio instanceof Float32Array
  ) {
    blob =
      encodeWav(
        audio,
        24000
      );
  } else if (
    audio?.audio instanceof Float32Array
  ) {
    blob =
      encodeWav(
        audio.audio,
        audio.sampling_rate ||
        audio.sampleRate ||
        24000
      );
  } else {
    throw new Error(
      "Could not convert narration audio."
    );
  }

  const url =
    URL.createObjectURL(blob);

  const element =
    new Audio();

  element.src = url;
  element.preload = "auto";

  await new Promise(
    (resolve, reject) => {
      element.addEventListener(
        "loadedmetadata",
        resolve,
        {
          once: true
        }
      );

      element.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "Narration audio failed to load."
            )
          ),
        {
          once: true
        }
      );
    }
  );

  return {
    element,
    url,
    blob
  };
}


// ============================================================
// SUBTITLE CHUNKING
// ============================================================

function cleanWordForWeight(word) {
  return String(word || "")
    .replace(
      /^[^a-zA-Z0-9À-ÿ]+|[^a-zA-Z0-9À-ÿ]+$/g,
      ""
    );
}


function createSubtitleChunks(
  narration
) {
  const words =
    String(narration || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return [];
  }

  const chunks = [];

  let current = [];

  for (const word of words) {
    current.push(word);

    const punctuation =
      /[.!?]["')\]]*$/.test(word);

    const softPunctuation =
      /[,;:]["')\]]*$/.test(word);

    // Normal chunk size:
    // maximum 3 words
    //
    // This keeps the subtitles fast enough
    // for Reddit/TikTok-style videos.
    if (
      current.length >= 3 ||
      (
        punctuation &&
        current.length >= 2
      ) ||
      (
        softPunctuation &&
        current.length >= 2
      )
    ) {
      chunks.push(
        current.join(" ")
      );

      current = [];
    }
  }

  if (current.length) {
    chunks.push(
      current.join(" ")
    );
  }

  return chunks;
}


// ============================================================
// SUBTITLE TIMING
// ============================================================

function buildSubtitleTimeline(
  narration,
  duration
) {
  const chunks =
    createSubtitleChunks(
      narration
    );

  if (
    !chunks.length ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return [];
  }

  const weights =
    chunks.map(
      chunk => {
        const words =
          chunk
            .split(/\s+/)
            .filter(Boolean);

        let weight = 0;

        for (const word of words) {
          const clean =
            cleanWordForWeight(
              word
            );

          // Longer words get slightly
          // more screen time.
          weight += Math.max(
            1,
            clean.length * 0.72
          );

          // Sentence ending gets extra weight.
          if (
            /[.!?]["')\]]*$/.test(
              word
            )
          ) {
            weight += 2.8;
          }

          // Smaller pause for commas etc.
          if (
            /[,;:]["')\]]*$/.test(
              word
            )
          ) {
            weight += 1.25;
          }
        }

        return Math.max(
          1,
          weight
        );
      }
    );

  const totalWeight =
    weights.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  let currentTime = 0;

  return chunks.map(
    (text, index) => {
      const chunkDuration =
        duration *
        (
          weights[index] /
          totalWeight
        );

      const item = {
        text,
        start: currentTime,
        end:
          currentTime +
          chunkDuration
      };

      currentTime +=
        chunkDuration;

      return item;
    }
  );
}


// ============================================================
// ACTIVE SUBTITLE
// ============================================================

function getActiveSubtitle(
  timeline,
  time
) {
  if (
    !timeline ||
    !timeline.length
  ) {
    return "";
  }

  for (const item of timeline) {
    if (
      time >= item.start &&
      time < item.end
    ) {
      return item.text;
    }
  }

  return "";
}


// ============================================================
// AUDIO GRAPH
// ============================================================

function setupAudioGraph(
  audioContext,
  destination
) {
  if (
    !bgAudioElement ||
    !bgAudioElement.src
  ) {
    return null;
  }

  const source =
    audioContext.createMediaElementSource(
      bgAudioElement
    );

  const gain =
    audioContext.createGain();

  // Background music volume.
  // 0.25 = 25%
  gain.gain.value = 0.25;

  source.connect(gain);
  gain.connect(destination);

  return {
    source,
    gain
  };
}


// ============================================================
// PLAY BACKGROUND VIDEO
// ============================================================

async function prepareBackgroundVideo() {
  const video =
    getBackgroundVideo();

  if (!video) return;

  try {
    video.muted = true;
    video.loop = true;

    if (
      video.readyState < 2
    ) {
      await new Promise(
        resolve => {
          const done = () => {
            video.removeEventListener(
              "loadeddata",
              done
            );

            resolve();
          };

          video.addEventListener(
            "loadeddata",
            done
          );

          video.load();
        }
      );
    }

    try {
      await video.play();
    } catch (error) {
      console.warn(
        "Background video autoplay:",
        error
      );
    }

  } catch (error) {
    console.warn(
      "Background video preparation failed:",
      error
    );
  }
}


// ============================================================
// END SCREEN
// ============================================================

function drawEndScreen() {
  if (!ctx) return;

  ctx.fillStyle = "#000";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    endLoader &&
    endLoader.complete &&
    endLoader.naturalWidth
  ) {
    const imageRatio =
      endLoader.naturalWidth /
      endLoader.naturalHeight;

    const canvasRatio =
      canvas.width /
      canvas.height;

    let drawWidth;
    let drawHeight;

    if (
      imageRatio > canvasRatio
    ) {
      drawHeight =
        canvas.height;

      drawWidth =
        drawHeight *
        imageRatio;
    } else {
      drawWidth =
        canvas.width;

      drawHeight =
        drawWidth /
        imageRatio;
    }

    const x =
      (canvas.width -
        drawWidth) /
      2;

    const y =
      (canvas.height -
        drawHeight) /
      2;

    ctx.drawImage(
      endLoader,
      x,
      y,
      drawWidth,
      drawHeight
    );
  }

  drawWatermark();
}


// ============================================================
// RECORD VIDEO
// ============================================================

async function recordVideo({
  title,
  credit,
  narration,
  voice,
  speed,
  subtitles
}) {
  if (isGenerating) {
    throw new Error(
      "A render is already running."
    );
  }

  isGenerating = true;

  let narrationAudio = null;
  let narrationUrl = null;

  let audioContext = null;
  let masterGain = null;

  try {
    setStatus(
      "Preparing render..."
    );

    // --------------------------------------------------------
    // Background
    // --------------------------------------------------------

    await prepareBackgroundVideo();

    const bgVideo =
      getBackgroundVideo();

    if (
      bgVideo &&
      bgVideo.readyState >= 2
    ) {
      try {
        bgVideo.currentTime = 0;
      } catch {}

      try {
        await bgVideo.play();
      } catch {}
    }

    // --------------------------------------------------------
    // TTS
    // --------------------------------------------------------

    const generatedAudio =
      await generateSpeech(
        narration,
        voice,
        speed
      );

    const narrationData =
      await createNarrationAudio(
        generatedAudio
      );

    narrationAudio =
      narrationData.element;

    narrationUrl =
      narrationData.url;

    const narrationDuration =
      Number(
        narrationAudio.duration
      );

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

    // --------------------------------------------------------
    // Subtitles
    // --------------------------------------------------------

    const subtitleTimeline =
      subtitles
        ? buildSubtitleTimeline(
            narration,
            narrationDuration
          )
        : [];

    console.log(
      "Subtitle timeline:",
      subtitleTimeline
    );

    // --------------------------------------------------------
    // Canvas stream
    // --------------------------------------------------------

    const canvasStream =
      canvas.captureStream(30);

    // --------------------------------------------------------
    // Audio context
    // --------------------------------------------------------

    audioContext =
      new AudioContext();

    masterGain =
      audioContext.createGain();

    masterGain.gain.value = 1;

    masterGain.connect(
      audioContext.destination
    );

    const destination =
      audioContext.createMediaStreamDestination();

    masterGain.connect(
      destination
    );

    // Narration source
    const narrationSource =
      audioContext.createMediaElementSource(
        narrationAudio
      );

    narrationSource.connect(
      masterGain
    );

    narrationSource.connect(
      destination
    );

    // Background audio
    let bgGraph = null;

    if (
      bgAudioElement &&
      bgAudioElement.src
    ) {
      bgGraph =
        setupAudioGraph(
          audioContext,
          destination
        );
    }

    // --------------------------------------------------------
    // Merge video + audio
    // --------------------------------------------------------

    const combinedStream =
      new MediaStream();

    canvasStream
      .getVideoTracks()
      .forEach(track => {
        combinedStream.addTrack(track);
      });

    destination.stream
      .getAudioTracks()
      .forEach(track => {
        combinedStream.addTrack(track);
      });

    // --------------------------------------------------------
    // Recorder
    // --------------------------------------------------------

    recordedChunks = [];

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
            8_000_000,
          audioBitsPerSecond:
            192_000
        }
      );

    mediaRecorder.ondataavailable =
      event => {
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
            reject;
        }
      );

    // --------------------------------------------------------
    // START EVERYTHING
    // --------------------------------------------------------

    await audioContext.resume();

    narrationAudio.currentTime = 0;

    if (
      bgAudioElement &&
      bgAudioElement.src
    ) {
      bgAudioElement.currentTime = 0;

      try {
        await bgAudioElement.play();
      } catch (error) {
        console.warn(
          "Background audio playback:",
          error
        );
      }
    }

    if (bgVideo) {
      try {
        bgVideo.currentTime = 0;
      } catch {}

      try {
        await bgVideo.play();
      } catch {}
    }

    // IMPORTANT:
    // Start recorder BEFORE narration.
    // This prevents the beginning of the
    // generated video from being cut off.

    mediaRecorder.start(1000);

    const startTime =
      audioContext.currentTime;

    // --------------------------------------------------------
    // Render loop
    // --------------------------------------------------------

    await new Promise(
      resolve => {
        let finished = false;

        function finishNarration() {
          if (finished) return;

          finished = true;

          resolve();
        }

        function renderLoop() {
          if (finished) return;

          const elapsed =
            audioContext.currentTime -
            startTime;

          let subtitle = "";

          if (subtitles) {
            subtitle =
              getActiveSubtitle(
                subtitleTimeline,
                elapsed
              );
          }

          drawFrame(
            title,
            subtitle,
            subtitles,
            credit
          );

          if (
            elapsed >=
            narrationDuration
          ) {
            finishNarration();
            return;
          }

          requestAnimationFrame(
            renderLoop
          );
        }

        // Draw first frame
        drawFrame(
          title,
          subtitles
            ? (
                subtitleTimeline[0]
                  ?.text || ""
              )
            : "",
          subtitles,
          credit
        );

        // Start narration
        narrationAudio
          .play()
          .catch(error => {
            console.error(
              "Narration playback failed:",
              error
            );

            finishNarration();
          });

        requestAnimationFrame(
          renderLoop
        );
      }
    );

    // --------------------------------------------------------
    // End screen
    // --------------------------------------------------------

    setStatus(
      "Narration finished — rendering end screen..."
    );

    // Keep final frame for 2.5 seconds.
    const endStart =
      performance.now();

    const endDuration =
      2500;

    await new Promise(
      resolve => {
        function endLoop() {
          drawEndScreen();

          if (
            performance.now() -
              endStart >=
            endDuration
          ) {
            resolve();
            return;
          }

          requestAnimationFrame(
            endLoop
          );
        }

        endLoop();
      }
    );

    // --------------------------------------------------------
    // STOP
    // --------------------------------------------------------

    try {
      narrationAudio.pause();
    } catch {}

    try {
      if (bgAudioElement) {
        bgAudioElement.pause();
      }
    } catch {}

    try {
      if (bgVideo) {
        bgVideo.pause();
      }
    } catch {}

    if (
      mediaRecorder &&
      mediaRecorder.state !== "inactive"
    ) {
      mediaRecorder.stop();
    }

    await recordingFinished;

    // --------------------------------------------------------
    // Create final blob
    // --------------------------------------------------------

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

    return blob;

  } finally {
    isGenerating = false;

    if (narrationUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(
            narrationUrl
          );
        } catch {}
      }, 1000);
    }

    if (audioContext) {
      try {
        await audioContext.close();
      } catch {}
    }

    setStatus(
      "Render finished."
    );
  }
}


// ============================================================
// DOWNLOAD
// ============================================================

function downloadBlob(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
}


// ============================================================
// SAFE FILENAME
// ============================================================

function safeFilename(
  value
) {
  return String(value || "reddit-story")
    .trim()
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    )
    .replace(
      /\s+/g,
      "_"
    )
    .slice(0, 120)
    || "reddit-story";
}


// ============================================================
// GET MANUAL FORM
// ============================================================

function getManualData() {
  const title =
    String(
      titleInput?.value || ""
    ).trim();

  const credit =
    String(
      creditInput?.value || ""
    ).trim();

  const narration =
    String(
      narrationInput?.value || ""
    ).trim();

  const voice =
    String(
      voiceInput?.value ||
      "af_heart"
    ).trim();

  const speed =
    Number(
      speedInput?.value || 1
    );

  // IMPORTANT:
  // subtitlesInput is a SELECT,
  // not a checkbox.
  const subtitles =
    subtitlesInput?.value !== "false";

  return {
    title,
    credit,
    narration,
    voice,
    speed,
    subtitles
  };
}


// ============================================================
// LOAD DATA INTO FORM
// ============================================================

function loadDataIntoForm(
  data
) {
  if (!data) return;

  if (titleInput) {
    titleInput.value =
      data.title || "";
  }

  if (creditInput) {
    creditInput.value =
      data.credit || "";
  }

  if (narrationInput) {
    narrationInput.value =
      data.narration || "";
  }

  if (voiceInput) {
    voiceInput.value =
      data.voice || "af_heart";
  }

  if (speedInput) {
    speedInput.value =
      data.speed ?? 1;
  }

  if (subtitlesInput) {
    subtitlesInput.value =
      data.subtitles === false
        ? "false"
        : "true";
  }

  drawIdleFrame();
}


// ============================================================
// GENERATE MANUAL
// ============================================================

async function generateManual() {
  if (isGenerating) {
    setStatus(
      "Already generating..."
    );
    return;
  }

  const data =
    getManualData();

  if (!data.narration) {
    setStatus(
      "✕ Narration is empty."
    );

    return;
  }

  try {
    if (generateBtn) {
      generateBtn.disabled = true;
    }

    setStatus(
      "Starting generation..."
    );

    const blob =
      await recordVideo(
        data
      );

    const filename =
      safeFilename(
        data.title ||
        "reddit-story"
      ) +
      ".webm";

    downloadBlob(
      blob,
      filename
    );

    setStatus(
      "✓ Video generated and downloaded."
    );

  } catch (error) {
    console.error(
      "Generation error:",
      error
    );

    setStatus(
      "✕ " +
      (
        error?.message ||
        "Generation failed."
      )
    );

  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
    }
  }
}


// ============================================================
// CSV PARSER
// ============================================================

function parseCSVLine(
  line
) {
  const result = [];

  let current = "";
  let insideQuotes = false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {
    const char =
      line[i];

    if (char === '"') {
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

      continue;
    }

    if (
      char === "," &&
      !insideQuotes
    ) {
      result.push(
        current
      );

      current = "";

      continue;
    }

    current += char;
  }

  result.push(
    current
  );

  return result;
}


function parseCSV(text) {
  const lines = [];

  let current = "";
  let insideQuotes = false;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char =
      text[i];

    if (char === '"') {
      if (
        insideQuotes &&
        text[i + 1] === '"'
      ) {
        current += '""';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;

        current += char;
      }

      continue;
    }

    if (
      (char === "\n" ||
        char === "\r") &&
      !insideQuotes
    ) {
      if (
        char === "\r" &&
        text[i + 1] === "\n"
      ) {
        i++;
      }

      if (
        current.trim()
      ) {
        lines.push(
          current
        );
      }

      current = "";

      continue;
    }

    current += char;
  }

  if (current.trim()) {
    lines.push(current);
  }

  if (!lines.length) {
    return [];
  }

  const headers =
    parseCSVLine(
      lines[0]
    ).map(
      header =>
        header
          .trim()
          .replace(
            /^"|"$/g,
            ""
          )
          .toLowerCase()
    );

  const rows = [];

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {
    const values =
      parseCSVLine(
        lines[i]
      );

    const row = {};

    headers.forEach(
      (header, index) => {
        let value =
          values[index] ??
          "";

        value =
          value
            .trim()
            .replace(
              /^"|"$/g,
              ""
            );

        row[header] =
          value;
      }
    );

    rows.push(row);
  }

  return rows;
}


// ============================================================
// NORMALIZE CSV ROW
// ============================================================

function normalizeQueueRow(
  row,
  index
) {
  const speed =
    Number(
      row.speed || 1
    );

  const subtitles =
    String(
      row.subtitles ??
      "true"
    )
      .trim()
      .toLowerCase() !==
    "false";

  return {
    id:
      `${Date.now()}-${index}-${Math.random()
        .toString(36)
        .slice(2)}`,

    title:
      String(
        row.title || ""
      ).trim(),

    credit:
      String(
        row.credit || ""
      ).trim(),

    narration:
      String(
        row.narration || ""
      ).trim(),

    voice:
      String(
        row.voice ||
        "af_heart"
      ).trim(),

    speed:
      Number.isFinite(speed) &&
      speed > 0
        ? speed
        : 1,

    subtitles,

    status: "Queued"
  };
}


// ============================================================
// QUEUE RENDER
// ============================================================

function renderQueue() {
  if (!queueBody) return;

  queueBody.innerHTML = "";

  currentQueue.forEach(
    (item, index) => {
      const tr =
        document.createElement("tr");

      if (
        index === selectedQueueIndex
      ) {
        tr.classList.add(
          "selected"
        );
      }

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.credit)}</td>
        <td>${escapeHtml(item.voice)}</td>
        <td>${item.speed}</td>
        <td>${item.subtitles ? "Yes" : "No"}</td>
        <td>${escapeHtml(item.status || "Queued")}</td>
      `;

      tr.addEventListener(
        "click",
        () => {
          selectedQueueIndex =
            index;

          renderQueue();
        }
      );

      queueBody.appendChild(tr);
    }
  );

  if (queueCount) {
    queueCount.textContent =
      String(
        currentQueue.length
      );
  }
}


// ============================================================
// CSV LOAD
// ============================================================

async function loadCSV() {
  const file =
    csvInput?.files?.[0];

  if (!file) {
    setStatus(
      "✕ Select a CSV file first."
    );

    return;
  }

  try {
    const text =
      await file.text();

    const rows =
      parseCSV(text);

    currentQueue =
      rows
        .map(
          normalizeQueueRow
        )
        .filter(
          row =>
            row.narration
        );

    selectedQueueIndex =
      currentQueue.length
        ? 0
        : -1;

    renderQueue();

    if (
      currentQueue.length
    ) {
      loadDataIntoForm(
        currentQueue[0]
      );
    }

    setStatus(
      `✓ Loaded ${currentQueue.length} queue item(s).`
    );

  } catch (error) {
    console.error(
      "CSV error:",
      error
    );

    setStatus(
      "✕ Failed to read CSV: " +
      error.message
    );
  }
}


// ============================================================
// LOAD SELECTED
// ============================================================

function loadSelected() {
  if (
    selectedQueueIndex < 0 ||
    selectedQueueIndex >=
      currentQueue.length
  ) {
    setStatus(
      "✕ No queue item selected."
    );

    return;
  }

  loadDataIntoForm(
    currentQueue[
      selectedQueueIndex
    ]
  );

  setStatus(
    `Loaded queue item #${selectedQueueIndex + 1}.`
  );
}


// ============================================================
// GENERATE SELECTED
// ============================================================

async function generateSelected() {
  if (
    selectedQueueIndex < 0 ||
    selectedQueueIndex >=
      currentQueue.length
  ) {
    setStatus(
      "✕ Select a queue item first."
    );

    return;
  }

  if (isGenerating) {
    setStatus(
      "Already generating..."
    );

    return;
  }

  const item =
    currentQueue[
      selectedQueueIndex
    ];

  try {
    item.status =
      "Generating...";

    renderQueue();

    setStatus(
      `Generating #${selectedQueueIndex + 1}...`
    );

    const blob =
      await recordVideo(
        item
      );

    const filename =
      safeFilename(
        item.title ||
        `reddit-story-${selectedQueueIndex + 1}`
      ) +
      ".webm";

    downloadBlob(
      blob,
      filename
    );

    item.status =
      "Done";

    setStatus(
      `✓ Finished #${selectedQueueIndex + 1}.`
    );

  } catch (error) {
    console.error(
      "Selected generation error:",
      error
    );

    item.status =
      "Error";

    setStatus(
      "✕ " +
      (
        error?.message ||
        "Generation failed."
      )
    );

  } finally {
    renderQueue();
  }
}


// ============================================================
// GENERATE ALL
// ============================================================

async function generateAll() {
  if (isGenerating) {
    setStatus(
      "Already generating..."
    );

    return;
  }

  if (!currentQueue.length) {
    setStatus(
      "✕ Queue is empty."
    );

    return;
  }

  try {
    for (
      let i = 0;
      i < currentQueue.length;
      i++
    ) {
      const item =
        currentQueue[i];

      selectedQueueIndex =
        i;

      item.status =
        "Generating...";

      renderQueue();

      setStatus(
        `Generating ${i + 1}/${currentQueue.length}...`
      );

      try {
        const blob =
          await recordVideo(
            item
          );

        const filename =
          safeFilename(
            item.title ||
            `reddit-story-${i + 1}`
          ) +
          ".webm";

        downloadBlob(
          blob,
          filename
        );

        item.status =
          "Done";

      } catch (error) {
        console.error(
          `Queue item ${i + 1} failed:`,
          error
        );

        item.status =
          "Error";
      }

      renderQueue();

      // Small gap between renders
      await sleep(300);
    }

    setStatus(
      "✓ Finished generating all queue items."
    );

  } catch (error) {
    console.error(
      "Generate all error:",
      error
    );

    setStatus(
      "✕ Generate all failed: " +
      error.message
    );

  } finally {
    renderQueue();
  }
}


// ============================================================
// CLEAR QUEUE
// ============================================================

function clearQueue() {
  currentQueue = [];

  selectedQueueIndex =
    -1;

  renderQueue();

  setStatus(
    "Queue cleared."
  );
}


// ============================================================
// COPY CSV HEADER
// ============================================================

async function copyCSVHeader() {
  const header =
    "title,credit,narration,voice,speed,subtitles";

  try {
    await navigator.clipboard.writeText(
      header
    );

    setStatus(
      "✓ CSV header copied."
    );

  } catch (error) {
    console.error(
      error
    );

    setStatus(
      "✕ Could not copy CSV header."
    );
  }
}


// ============================================================
// BUTTON EVENTS
// ============================================================

generateBtn?.addEventListener(
  "click",
  generateManual
);

loadSelectedBtn?.addEventListener(
  "click",
  loadSelected
);

generateSelectedBtn?.addEventListener(
  "click",
  generateSelected
);

generateAllBtn?.addEventListener(
  "click",
  generateAll
);

clearQueueBtn?.addEventListener(
  "click",
  clearQueue
);

copyHeaderBtn?.addEventListener(
  "click",
  copyCSVHeader
);

csvInput?.addEventListener(
  "change",
  loadCSV
);


// ============================================================
// FORM PREVIEW
// ============================================================

[
  titleInput,
  creditInput,
  narrationInput,
  voiceInput,
  speedInput,
  subtitlesInput
]
  .filter(Boolean)
  .forEach(
    element => {
      element.addEventListener(
        "input",
        drawIdleFrame
      );

      element.addEventListener(
        "change",
        drawIdleFrame
      );
    }
  );


// ============================================================
// ASSET EVENTS
// ============================================================

logoLoader?.addEventListener(
  "load",
  () => {
    checkAssets();
    drawIdleFrame();
  }
);

endLoader?.addEventListener(
  "load",
  () => {
    checkAssets();
  }
);

bgLoader?.addEventListener(
  "loadeddata",
  () => {
    if (!bgVideoElement) {
      bgVideoElement =
        bgLoader;
    }

    checkAssets();
    drawIdleFrame();
  }
);

bgLoader?.addEventListener(
  "error",
  () => {
    checkAssets();
  }
);


// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

window.addEventListener(
  "error",
  event => {
    console.error(
      "Global error:",
      event.error || event.message
    );

    if (
      event.error?.message
    ) {
      setStatus(
        "✕ " +
        event.error.message
      );
    }
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {
    console.error(
      "Unhandled promise rejection:",
      event.reason
    );

    const message =
      event.reason?.message ||
      String(event.reason || "");

    if (message) {
      setStatus(
        "✕ " +
        message
      );
    }
  }
);


// ============================================================
// INITIALIZATION
// ============================================================

function initialize() {
  bgVideoElement =
    bgLoader;

  drawIdleFrame();
  checkAssets();
  renderQueue();

  setStatus(
    "Ready."
  );
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once: true
    }
  );
} else {
  initialize();
}