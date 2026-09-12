const logoStatus = document.getElementById("logoStatus");
const videoStatus = document.getElementById("videoStatus");
const audioStatus = document.getElementById("audioStatus");
const endStatus = document.getElementById("endStatus");

const customVideo = document.getElementById("customVideo");
const customAudio = document.getElementById("customAudio");

const csvInput = document.getElementById("csvInput");
const copyHeaderBtn = document.getElementById("copyHeaderBtn");
const clearQueueBtn = document.getElementById("clearQueueBtn");

const storyTemplate = document.getElementById("storyTemplate");
const titleInput = document.getElementById("titleInput");
const creditInput = document.getElementById("creditInput");
const narrationInput = document.getElementById("narrationInput");
const voiceInput = document.getElementById("voiceInput");
const speedInput = document.getElementById("speedInput");
const subtitlesInput = document.getElementById("subtitlesInput");

const generateBtn = document.getElementById("generateBtn");
const loadSelectedBtn = document.getElementById("loadSelectedBtn");
const generateSelectedBtn = document.getElementById("generateSelectedBtn");
const generateAllBtn = document.getElementById("generateAllBtn");

const previewCanvas = document.getElementById("previewCanvas");
const statusText = document.getElementById("statusText");

const queueBody = document.getElementById("queueBody");
const queueCount = document.getElementById("queueCount");

const logoLoader = document.getElementById("logoLoader");
const endLoader = document.getElementById("endLoader");
const bgLoader = document.getElementById("bgLoader");

/* =========================================================
   STATE
========================================================= */

let queue = [];
let selectedIndex = -1;

let assetsReady = false;
let logoReady = false;
let endReady = false;
let videoReady = false;
let audioReady = false;

let customVideoURL = null;
let defaultBgVideo = null;
let defaultBgAudio = null;

/* =========================================================
   BASIC HELPERS
========================================================= */

function setStatus(message) {
  if (statusText) {
    statusText.textContent = message || "";
  }
}

function setAssetStatus(element, message, ok = false) {
  if (!element) return;

  element.textContent = message || "";

  if (ok) {
    element.classList.add("ready");
  } else {
    element.classList.remove("ready");
  }
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

function getSubtitleEnabled() {
  if (!subtitlesInput) return true;

  const value = String(subtitlesInput.value)
    .toLowerCase()
    .trim();

  return (
    value === "true" ||
    value === "1" ||
    value === "yes" ||
    value === "enabled" ||
    value === "on"
  );
}

function getSpeed() {
  if (!speedInput) return 1;

  const value = Number(speedInput.value);

  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return value;
}

function getVideoGenerator() {
  if (
    !window.VideoGenerator ||
    typeof window.VideoGenerator.generateVideo !== "function"
  ) {
    throw new Error(
      "VideoGenerator belum tersedia. Pastikan generator.js sudah dimuat."
    );
  }

  return window.VideoGenerator;
}

/* =========================================================
   IMAGE / VIDEO / AUDIO LOADING
========================================================= */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error(`Gagal memuat gambar: ${src}`));
    };

    image.src = src;
  });
}

function loadVideoMetadata(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      resolve(video);
    };

    video.onerror = () => {
      reject(new Error(`Gagal memuat video: ${src}`));
    };

    video.src = src;
  });
}

function loadAudio(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();

    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      resolve(audio);
    };

    audio.onerror = () => {
      reject(new Error(`Gagal memuat audio: ${src}`));
    };

    audio.src = src;
  });
}

/* =========================================================
   ASSET INITIALIZATION
========================================================= */

async function initializeAssets() {
  assetsReady = false;

  try {
    setStatus("Loading assets...");

    /* Logo */

    if (logoLoader) {
      try {
        await loadImage(
          logoLoader.src || "iaf-logo.png"
        );

        logoReady = true;

        setAssetStatus(
          logoStatus,
          "Logo ready",
          true
        );
      } catch (error) {
        logoReady = false;

        setAssetStatus(
          logoStatus,
          "Logo failed",
          false
        );
      }
    }

    /* End screen */

    if (endLoader) {
      try {
        await loadImage(
          endLoader.src || "end.png"
        );

        endReady = true;

        setAssetStatus(
          endStatus,
          "End screen ready",
          true
        );
      } catch (error) {
        endReady = false;

        setAssetStatus(
          endStatus,
          "End screen failed",
          false
        );
      }
    }

    /* Background video */

    if (bgLoader) {
      try {
        defaultBgVideo = await loadVideoMetadata(
          bgLoader.src || "bg.mp4"
        );

        videoReady = true;

        setAssetStatus(
          videoStatus,
          "Background video ready",
          true
        );
      } catch (error) {
        videoReady = false;

        setAssetStatus(
          videoStatus,
          "Background video failed",
          false
        );
      }
    }

    /* Background audio */

    try {
      defaultBgAudio = await loadAudio("bg.mp3");

      audioReady = true;

      setAssetStatus(
        audioStatus,
        "Background audio ready",
        true
      );
    } catch (error) {
      audioReady = false;

      setAssetStatus(
        audioStatus,
        "Background audio failed",
        false
      );
    }

    assetsReady =
      logoReady &&
      endReady &&
      videoReady &&
      audioReady;

    if (assetsReady) {
      setStatus("All assets ready.");
    } else {
      setStatus(
        "Some assets failed to load. Check the asset status above."
      );
    }
  } catch (error) {
    console.error(error);

    setStatus(
      `Asset initialization error: ${error.message}`
    );
  }
}

/* =========================================================
   STORY TEMPLATES
========================================================= */

const storyTemplates = {
  "little-brother": {
    title:
      "My little brother keeps asking me why I keep leaving my room at night.",

    narration: `My little brother keeps asking me why I keep leaving my room at night.

My little brother asked me something weird yesterday.

"Why do you keep leaving your room at 3 AM?"

I laughed.

"I don't."

He looked confused.

"Yes, you do."

I asked him what he saw.

He said every night, my bedroom door opens.

Then I walk downstairs.

I stand in the kitchen for a few minutes.

Then I come back upstairs.

I thought he was dreaming.

Until last night.

At 3:07 AM, I heard my bedroom door open.

I stayed completely still.

Footsteps walked down the hallway.

Then downstairs.

I grabbed my phone and checked the time.

3:08 AM.

I heard the kitchen cabinet open.

Then silence.

A few minutes later, footsteps came back upstairs.

They stopped outside my door.

Then my door slowly opened.

I expected to see myself.

Instead, I saw my little brother standing there.

He looked terrified.

He whispered:

"Don't look behind you."

I slowly turned around.

My closet door was open.

Something was standing inside.

Wearing my clothes.

My brother grabbed my hand.

Then my phone buzzed.

A message from my own number appeared.

"Don't let him wake up."

I looked at my brother.

He smiled.

Then he whispered:

"You finally noticed."`
  },

  "security-camera": {
    title:
      "My dad installed a camera in my room, but he refuses to tell me why.",

    narration: `My dad installed a camera in my room, but he refuses to tell me why.

My dad gave me a new security camera last week.

He said it was for safety.

I installed it above my desk.

Nothing unusual happened.

Until yesterday.

I was looking through the recordings when I noticed something strange.

At exactly 2:14 AM, the camera showed me sitting on my bed.

But I was asleep.

I watched the video again.

There I was.

Sitting completely still.

Staring directly into the camera.

I called my dad.

"Dad, why is there a recording of me awake last night?"

He went silent.

Then he asked:

"Are you sure that's you?"

I sent him the video.

He immediately called me back.

"Turn the camera off."

I asked why.

He said:

"Because we removed that camera six months ago."

I looked up.

The camera was still above my desk.

Then the recording suddenly updated.

A new video appeared.

It showed my bedroom.

Except this time, I wasn't in it.

Someone was standing behind the camera.

Then they whispered:

"Your dad knows."

My phone buzzed.

Dad had sent me one message.

"Do not come home."

I looked at my bedroom door.

It was slowly opening.`
  },

  "dead-neighbor": {
    title:
      "My neighbor knocks on my door every morning, but he died last month.",

    narration: `My neighbor knocks on my door every morning, but he died last month.

Every morning at 7 AM, someone knocks on my door.

Three knocks.

Always exactly three.

I never answered because I assumed it was my neighbor.

He used to do that every morning.

Yesterday I finally opened the door.

Nobody was there.

I looked across the street.

My neighbor's house was empty.

Then I remembered.

He died last month.

I went back inside and checked my security camera.

The footage showed him standing at my door.

Same clothes.

Same face.

Same three knocks.

I called his daughter.

She started crying when I told her.

Then she asked:

"Did he say anything?"

I said no.

She went quiet.

"That's strange."

I asked why.

She said:

"My dad couldn't knock."

"His hands were missing."

I froze.

That morning, the knocking happened again.

Three knocks.

This time, I heard a voice.

"Open the door."

I looked through the peephole.

My neighbor was standing outside.

Then he smiled.

And pointed behind me.

I turned around.

Someone was standing in my hallway.

Wearing the exact same clothes.`
  },

  "future-texts": {
    title:
      "My phone keeps receiving texts from me 10 minutes in the future.",

    narration: `My phone keeps receiving texts from me 10 minutes in the future.

The first message said:

"Don't leave your room."

I thought it was a glitch.

Then another message arrived.

"Your mom is about to knock."

Ten seconds later, someone knocked.

It was Mom.

I asked her if she had texted me.

She said no.

Another message appeared.

"Don't open the door."

I looked at Mom.

She was still knocking.

"Open up."

I didn't.

Then my phone buzzed again.

"Good. Now hide."

I asked who was texting me.

The reply came instantly.

"Me."

I typed:

"Who is me?"

Three dots appeared.

Then:

"You."

I laughed nervously.

Then another message appeared.

"Whatever happens, don't look through the window."

I heard something outside.

I looked anyway.

There was someone standing in the backyard.

It looked exactly like me.

My phone buzzed one last time.

"Why did you look?"

I stared at the window.

The person outside slowly raised their phone.

Mine buzzed again.

The message said:

"I'm not outside anymore."`
  }
};

/* =========================================================
   STORY TEMPLATE HANDLER
========================================================= */

function loadStoryTemplate() {
  if (!storyTemplate) return;

  const key = storyTemplate.value;

  if (!key) {
    return;
  }

  const template = storyTemplates[key];

  if (!template) {
    console.error(
      "[Story Template] Template not found:",
      key
    );
    return;
  }

  /* Template only changes title + narration */

  if (titleInput) {
    titleInput.value = template.title;

    titleInput.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );
  }

  if (narrationInput) {
    narrationInput.value = template.narration;

    narrationInput.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );
  }

  /* Template stories have no REG-ID */

  if (creditInput) {
    creditInput.value = "";

    creditInput.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );
  }

  drawPreview();

  setStatus(
    `Loaded story template: ${template.title}`
  );

  console.log(
    "[Story Template] Loaded:",
    key
  );
}

if (storyTemplate) {
  storyTemplate.addEventListener(
    "change",
    loadStoryTemplate
  );
}

/* =========================================================
   FORM DATA
========================================================= */

function getFormData() {
  return {
    title: titleInput
      ? titleInput.value.trim()
      : "",

    credit: creditInput
      ? creditInput.value.trim()
      : "",

    narration: narrationInput
      ? narrationInput.value
      : "",

    voice: voiceInput
      ? voiceInput.value
      : "af_heart",

    speed: getSpeed(),

    subtitles: getSubtitleEnabled(),

    backgroundVideo:
      customVideoURL || "bg.mp4",

    backgroundAudio:
      "bg.mp3"
  };
}

/* =========================================================
   PREVIEW
========================================================= */

function drawPreview() {
  try {
    const generator = getVideoGenerator();

    if (
      typeof generator.drawPreview === "function"
    ) {
      generator.drawPreview(
        getFormData(),
        previewCanvas
      );
    }
  } catch (error) {
    console.error(
      "Preview error:",
      error
    );
  }
}

/* =========================================================
   CSV
========================================================= */

function parseCSVLine(line) {
  const result = [];

  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (
      char === "," &&
      !insideQuotes
    ) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);

  return result;
}

function parseCSV(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter(
      line => line.trim() !== ""
    );

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0])
    .map(header =>
      header.trim().toLowerCase()
    );

  return lines
    .slice(1)
    .map(line => {
      const values = parseCSVLine(line);
      const row = {};

      headers.forEach(
        (header, index) => {
          row[header] =
            values[index] ?? "";
        }
      );

      return row;
    });
}

function csvRowToQueueItem(
  row,
  index
) {
  const speed =
    Number(row.speed) > 0
      ? Number(row.speed)
      : 1;

  return {
    id:
      `csv-${Date.now()}-${index}`,

    title:
      row.title?.trim() ||
      `Story ${index + 1}`,

    credit:
      row.credit?.trim() || "",

    narration:
      row.narration || "",

    voice:
      row.voice?.trim() ||
      "af_heart",

    speed,

    subtitles:
      row.subtitles !== undefined
        ? String(row.subtitles)
            .toLowerCase()
            .trim() === "true"
        : true
  };
}

/* =========================================================
   QUEUE RENDERING
========================================================= */

function renderQueue() {
  if (!queueBody) return;

  queueBody.innerHTML = "";

  queue.forEach(
    (item, index) => {
      const tr =
        document.createElement("tr");

      if (index === selectedIndex) {
        tr.classList.add("selected");
      }

      tr.innerHTML = `
        <td>${index + 1}</td>

        <td>
          ${escapeHtml(item.title)}
        </td>

        <td>
          ${escapeHtml(item.credit || "")}
        </td>

        <td>
          ${escapeHtml(item.voice || "af_heart")}
        </td>

        <td>
          ${escapeHtml(item.speed ?? 1)}
        </td>

        <td>
          ${item.subtitles
            ? "Enabled"
            : "Disabled"}
        </td>
      `;

      tr.addEventListener(
        "click",
        () => {
          selectedIndex = index;

          renderQueue();

          setStatus(
            `Selected story ${index + 1}`
          );
        }
      );

      queueBody.appendChild(tr);
    }
  );

  if (queueCount) {
    queueCount.textContent =
      String(queue.length);
  }
}

function addQueueItems(items) {
  if (!Array.isArray(items)) {
    return;
  }

  queue.push(...items);

  renderQueue();

  setStatus(
    `Added ${items.length} story/stories to queue.`
  );
}

/* =========================================================
   LOAD SELECTED QUEUE ITEM
========================================================= */

function loadSelectedIntoForm() {
  if (
    selectedIndex < 0 ||
    selectedIndex >= queue.length
  ) {
    setStatus(
      "No queue item selected."
    );

    return;
  }

  const item =
    queue[selectedIndex];

  /* Queue item is not a template */

  if (storyTemplate) {
    storyTemplate.value = "";
  }

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
      item.voice || "af_heart";
  }

  if (speedInput) {
    speedInput.value =
      String(item.speed || 1);
  }

  if (subtitlesInput) {
    subtitlesInput.value =
      item.subtitles
        ? "true"
        : "false";
  }

  drawPreview();

  setStatus(
    `Loaded queue item: ${item.title}`
  );
}

/* =========================================================
   DOWNLOAD
========================================================= */

function downloadBlob(
  blob,
  filename
) {
  if (!blob) {
    throw new Error(
      "No output blob received."
    );
  }

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function sanitizeFilename(value) {
  return String(
    value || "reddit-story"
  )
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(0, 120) ||
    "reddit-story";
}

/* =========================================================
   VIDEO GENERATION
========================================================= */

async function generateVideo(
  data,
  filenameBase
) {
  if (!data) {
    throw new Error(
      "No story data provided."
    );
  }

  const generator =
    getVideoGenerator();

  setStatus(
    `Generating: ${data.title || "Untitled"}`
  );

  /*
   * Keep original WebM output.
   */

  const filename =
    `${sanitizeFilename(
      filenameBase ||
      data.title
    )}.webm`;

  let result;

  if (
    typeof generator.generateVideo ===
    "function"
  ) {
    result =
      await generator.generateVideo({
        ...data,

        backgroundVideo:
          customVideoURL ||
          data.backgroundVideo ||
          "bg.mp4",

        backgroundAudio:
          data.backgroundAudio ||
          "bg.mp3"
      });
  } else {
    throw new Error(
      "generateVideo() tidak ditemukan di VideoGenerator."
    );
  }

  let blob = result;

  if (
    result &&
    result.blob instanceof Blob
  ) {
    blob = result.blob;
  }

  if (!(blob instanceof Blob)) {
    throw new Error(
      "Generator tidak mengembalikan Blob video."
    );
  }

  downloadBlob(
    blob,
    filename
  );

  setStatus(
    `Finished: ${filename}`
  );

  return blob;
}

/* =========================================================
   MANUAL GENERATION
========================================================= */

async function handleManualGenerate() {
  try {
    const data =
      getFormData();

    if (!data.title) {
      throw new Error(
        "Title masih kosong."
      );
    }

    if (!data.narration.trim()) {
      throw new Error(
        "Narration masih kosong."
      );
    }

    await generateVideo(
      data,
      data.title
    );
  } catch (error) {
    console.error(error);

    setStatus(
      `Generation failed: ${error.message}`
    );
  }
}

/* =========================================================
   QUEUE GENERATION
========================================================= */

async function handleGenerateSelected() {
  if (
    selectedIndex < 0 ||
    selectedIndex >= queue.length
  ) {
    setStatus(
      "Select a queue item first."
    );

    return;
  }

  try {
    const item =
      queue[selectedIndex];

    await generateVideo(
      item,
      item.title
    );
  } catch (error) {
    console.error(error);

    setStatus(
      `Generation failed: ${error.message}`
    );
  }
}

async function handleGenerateAll() {
  if (queue.length === 0) {
    setStatus(
      "Queue is empty."
    );

    return;
  }

  try {
    for (
      let i = 0;
      i < queue.length;
      i++
    ) {
      selectedIndex = i;

      renderQueue();

      const item =
        queue[i];

      setStatus(
        `Generating ${i + 1}/${queue.length}: ${item.title}`
      );

      await generateVideo(
        item,
        item.title
      );

      await sleep(300);
    }

    setStatus(
      `Finished generating all ${queue.length} stories.`
    );
  } catch (error) {
    console.error(error);

    setStatus(
      `Generate all failed: ${error.message}`
    );
  }
}

/* =========================================================
   CSV INPUT
========================================================= */

if (csvInput) {
  csvInput.addEventListener(
    "change",
    async event => {
      try {
        const file =
          event.target.files?.[0];

        if (!file) return;

        const text =
          await file.text();

        const rows =
          parseCSV(text);

        const items =
          rows.map(
            csvRowToQueueItem
          );

        addQueueItems(items);

        setStatus(
          `Imported ${items.length} stories from CSV.`
        );
      } catch (error) {
        console.error(error);

        setStatus(
          `CSV import failed: ${error.message}`
        );
      }
    }
  );
}

/* =========================================================
   CSV HEADER COPY
========================================================= */

if (copyHeaderBtn) {
  copyHeaderBtn.addEventListener(
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
      } catch (error) {
        console.error(error);

        setStatus(
          "Could not copy CSV header."
        );
      }
    }
  );
}

/* =========================================================
   CLEAR QUEUE
========================================================= */

if (clearQueueBtn) {
  clearQueueBtn.addEventListener(
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
}

/* =========================================================
   CUSTOM BACKGROUND VIDEO
========================================================= */

if (customVideo) {
  customVideo.addEventListener(
    "change",
    event => {
      const file =
        event.target.files?.[0];

      if (!file) {
        customVideoURL = null;

        setStatus(
          "Using default background video."
        );

        return;
      }

      if (customVideoURL) {
        URL.revokeObjectURL(
          customVideoURL
        );
      }

      customVideoURL =
        URL.createObjectURL(file);

      setStatus(
        `Custom background video selected: ${file.name}`
      );

      drawPreview();
    }
  );
}

/* =========================================================
   CUSTOM BACKGROUND AUDIO
========================================================= */

if (customAudio) {
  customAudio.addEventListener(
    "change",
    event => {
      const file =
        event.target.files?.[0];

      if (!file) {
        setStatus(
          "Using default background audio."
        );

        return;
      }

      setStatus(
        `Custom background audio selected: ${file.name}`
      );
    }
  );
}

/* =========================================================
   FORM PREVIEW LISTENERS
========================================================= */

[
  titleInput,
  creditInput,
  narrationInput,
  voiceInput,
  speedInput,
  subtitlesInput
].forEach(element => {
  if (!element) return;

  element.addEventListener(
    "input",
    drawPreview
  );

  element.addEventListener(
    "change",
    drawPreview
  );
});

/* =========================================================
   BUTTON LISTENERS
========================================================= */

if (generateBtn) {
  generateBtn.addEventListener(
    "click",
    handleManualGenerate
  );
}

if (loadSelectedBtn) {
  loadSelectedBtn.addEventListener(
    "click",
    loadSelectedIntoForm
  );
}

if (generateSelectedBtn) {
  generateSelectedBtn.addEventListener(
    "click",
    handleGenerateSelected
  );
}

if (generateAllBtn) {
  generateAllBtn.addEventListener(
    "click",
    handleGenerateAll
  );
}

/* =========================================================
   GLOBAL ERROR HANDLING
========================================================= */

window.addEventListener(
  "error",
  event => {
    console.error(
      "Global error:",
      event.error || event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {
    console.error(
      "Unhandled promise rejection:",
      event.reason
    );
  }
);

/* =========================================================
   STARTUP
========================================================= */

(async function startup() {
  try {
    renderQueue();

    drawPreview();

    await initializeAssets();

    drawPreview();
  } catch (error) {
    console.error(
      "Startup error:",
      error
    );

    setStatus(
      `Startup failed: ${error.message}`
    );
  }
})();