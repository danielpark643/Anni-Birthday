// Always request the newest scrapbook and footer photos instead of cached copies.
const photoRefreshVersion = Date.now();
document
  .querySelectorAll(
    ".album-slide img, .footer-photo, .handwritten-letter, .envelope-cover-photo",
  )
  .forEach((image) => {
    const sourceWithoutVersion = image.getAttribute("src").split("?")[0];
    image.src = `${sourceWithoutVersion}?fresh=${photoRefreshVersion}`;
  });

// Photo lightbox.
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector("p");

document.querySelectorAll(".scrap-photo").forEach((photo) => {
  photo.addEventListener("click", () => {
    const image = photo.querySelector("img");
    const slide = photo.closest(".album-slide");
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = slide.dataset.caption;
    lightbox.showModal();
  });
});

lightbox
  .querySelector(".lightbox-close")
  .addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

// Clickable envelope and letter.
const envelopeScene = document.querySelector(".envelope-scene");
const envelopeButton = document.querySelector(".envelope-button");
const envelopeHint = document.querySelector(".envelope-hint");
const letterClose = document.querySelector(".letter-close");

envelopeButton.addEventListener("click", () => {
  const isOpen = envelopeScene.classList.toggle("open");
  envelopeButton.setAttribute("aria-expanded", String(isOpen));
  envelopeHint.textContent = isOpen ? "click to close" : "click to open";
});

letterClose.addEventListener("click", () => {
  envelopeScene.classList.remove("open");
  envelopeButton.setAttribute("aria-expanded", "false");
  envelopeHint.textContent = "click to open";
  envelopeButton.focus();
});

// Simple scrapbook page switching.
const slides = [...document.querySelectorAll(".album-slide")];
const previousPage = document.querySelector(".previous-page");
const nextPage = document.querySelector(".next-page");
const pageCount = document.querySelector(".page-count");
const currentPageLabel = document.querySelector(".current-page");
const scrapbook = document.querySelector(".album");
let currentPage = 0;

function updateBookControls() {
  slides.forEach((slide, index) => {
    slide.hidden = index !== currentPage;
  });
  currentPageLabel.textContent = currentPage + 1;
  pageCount.textContent = `${currentPage + 1} / ${slides.length}`;
  previousPage.disabled = currentPage === 0;
  nextPage.disabled = currentPage === slides.length - 1;
}

function turnPage(direction) {
  const nextIndex = currentPage + direction;
  if (nextIndex < 0 || nextIndex >= slides.length) return;
  currentPage = nextIndex;
  updateBookControls();
}

previousPage.addEventListener("click", () => turnPage(-1));
nextPage.addEventListener("click", () => turnPage(1));
scrapbook.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") turnPage(-1);
  if (event.key === "ArrowRight") turnPage(1);
});
document.addEventListener("keydown", (event) => {
  if (lightbox.open) return;
  const bookIsVisible =
    scrapbook.getBoundingClientRect().top < innerHeight &&
    scrapbook.getBoundingClientRect().bottom > 0;
  if (!bookIsVisible) return;
  if (event.key === "ArrowLeft") turnPage(-1);
  if (event.key === "ArrowRight") turnPage(1);
});
updateBookControls();

// Four-picture photo booth.
const cameraVideo = document.querySelector(".camera-video");
const cameraPlaceholder = document.querySelector(".camera-placeholder");
const startCameraButton = document.querySelector(".start-camera");
const takePhotosButton = document.querySelector(".take-photos");
const cameraStatus = document.querySelector(".camera-status");
const countdown = document.querySelector(".countdown");
const cameraFlash = document.querySelector(".camera-flash");
const droppedStrip = document.querySelector(".dropped-strip");
const droppedStripImage = droppedStrip.querySelector("img");
const stripList = document.querySelector(".strip-list");
const stripViewer = document.querySelector(".strip-viewer");
const stripViewerImage = stripViewer.querySelector("img");
const stripViewerClose = document.querySelector(".strip-viewer-close");
const downloadStrip = document.querySelector(".download-strip");
const deleteAllStrips = document.querySelector(".delete-all-strips");
let cameraStream;
let isTakingPhotos = false;
let stripNumber = 0;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function turnOffCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  cameraVideo.srcObject = null;
  cameraVideo.classList.remove("on");
  cameraPlaceholder.hidden = false;
  startCameraButton.textContent = "turn on camera";
  takePhotosButton.disabled = true;
  cameraStatus.textContent = "Camera is off. Your finished strips are still here.";
}

startCameraButton.addEventListener("click", async () => {
  if (cameraStream) {
    turnOffCamera();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent =
      "The camera needs localhost or a published HTTPS website.";
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 1280, height: 960 },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    cameraVideo.classList.add("on");
    cameraPlaceholder.hidden = true;
    startCameraButton.textContent = "turn off camera";
    takePhotosButton.disabled = false;
    cameraStatus.textContent = "Ready. The booth will take four pictures.";
  } catch (error) {
    cameraStatus.textContent =
      "Camera access was blocked. Allow camera permission and try again.";
  }
});

function captureCameraFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 450;
  const context = canvas.getContext("2d");
  const videoWidth = cameraVideo.videoWidth;
  const videoHeight = cameraVideo.videoHeight;
  const targetRatio = canvas.width / canvas.height;
  const videoRatio = videoWidth / videoHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;

  if (videoRatio > targetRatio) {
    sourceWidth = videoHeight * targetRatio;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = videoWidth / targetRatio;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(
    cameraVideo,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

async function countDownAndCapture(photoNumber) {
  cameraStatus.textContent = `Photo ${photoNumber} of 4`;
  for (const number of [3, 2, 1]) {
    countdown.textContent = number;
    await wait(650);
  }
  countdown.textContent = "smile";
  await wait(450);
  cameraFlash.classList.remove("fire");
  void cameraFlash.offsetWidth;
  cameraFlash.classList.add("fire");
  const frame = captureCameraFrame();
  countdown.textContent = "";
  await wait(650);
  return frame;
}

function makePhotoStrip(frames) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const margin = 20;
  const photoWidth = 400;
  const photoHeight = 300;
  const gap = 16;
  canvas.width = photoWidth + margin * 2;
  canvas.height = 85 + frames.length * (photoHeight + gap) + 55;

  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#10243e";
  context.textAlign = "center";
  context.font = "bold 24px sans-serif";
  context.fillText("TEN MONTHS OF US", canvas.width / 2, 38);
  context.fillStyle = "#ef8f86";
  context.font = "18px sans-serif";
  context.fillText("♡  PHOTO BOOTH  ♡", canvas.width / 2, 65);

  frames.forEach((frame, index) => {
    const y = 85 + index * (photoHeight + gap);
    context.drawImage(frame, margin, y, photoWidth, photoHeight);
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(42, y + 24, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#10243e";
    context.font = "bold 13px sans-serif";
    context.fillText(String(index + 1), 42, y + 29);
  });

  context.fillStyle = "#10243e";
  context.font = "16px sans-serif";
  context.fillText(new Date().toLocaleDateString(), canvas.width / 2, canvas.height - 22);
  return canvas.toDataURL("image/png");
}

function openStrip(dataUrl, filename) {
  stripViewerImage.src = dataUrl;
  downloadStrip.href = dataUrl;
  downloadStrip.download = filename;
  stripViewer.showModal();
}

function addSavedStrip(dataUrl, filename) {
  const item = document.createElement("div");
  const button = document.createElement("button");
  const image = document.createElement("img");
  const deleteButton = document.createElement("button");
  item.className = "saved-strip-item";
  item.dataset.filename = filename;
  button.className = "saved-strip-button";
  button.type = "button";
  button.setAttribute("aria-label", `Open photo strip ${stripNumber}`);
  image.src = dataUrl;
  image.alt = `Saved photo strip ${stripNumber}`;
  deleteButton.className = "delete-strip";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", `Delete photo strip ${stripNumber}`);
  button.append(image);
  button.addEventListener("click", () => openStrip(dataUrl, filename));
  deleteButton.addEventListener("click", () => {
    item.remove();
    if (droppedStrip.dataset.filename === filename) {
      droppedStrip.hidden = true;
      droppedStrip.classList.remove("ready");
      droppedStripImage.src = "";
    }
  });
  item.append(button, deleteButton);
  stripList.prepend(item);
}

takePhotosButton.addEventListener("click", async () => {
  if (isTakingPhotos || !cameraStream) return;
  isTakingPhotos = true;
  startCameraButton.disabled = true;
  takePhotosButton.disabled = true;
  const frames = [];

  for (let photoNumber = 1; photoNumber <= 4; photoNumber += 1) {
    frames.push(await countDownAndCapture(photoNumber));
  }

  const stripData = makePhotoStrip(frames);
  stripNumber += 1;
  const filename = `photobooth-strip-${stripNumber}.png`;
  droppedStripImage.src = stripData;
  droppedStrip.dataset.filename = filename;
  droppedStrip.hidden = false;
  droppedStrip.classList.remove("ready");
  void droppedStrip.offsetWidth;
  droppedStrip.classList.add("ready");
  addSavedStrip(stripData, filename);
  cameraStatus.textContent = "Your strip is ready. Click it to open or download.";
  takePhotosButton.disabled = false;
  startCameraButton.disabled = false;
  isTakingPhotos = false;
});

droppedStrip.addEventListener("click", () => {
  openStrip(droppedStripImage.src, droppedStrip.dataset.filename);
});
stripViewerClose.addEventListener("click", () => stripViewer.close());
stripViewer.addEventListener("click", (event) => {
  if (event.target === stripViewer) stripViewer.close();
});
deleteAllStrips.addEventListener("click", () => {
  stripList.replaceChildren();
  droppedStrip.hidden = true;
  droppedStrip.classList.remove("ready");
  droppedStripImage.src = "";
  if (stripViewer.open) stripViewer.close();
  cameraStatus.textContent = "All saved strips were deleted.";
});
window.addEventListener("pagehide", () => {
  turnOffCamera();
});

// Small record player that keeps playing while you move around the page.
const musicPlayer = document.querySelector(".music-player");
const siteAudio = document.querySelector(".site-audio");
const musicToggle = document.querySelector(".music-toggle");
const musicPrevious = document.querySelector(".music-previous");
const musicNext = document.querySelector(".music-next");
const songTitle = document.querySelector(".song-title");
const songArtist = document.querySelector(".song-artist");
const jazzTracks = [
  {
    title: "Rainy Mood and Jazz",
    artist: "Tripacer",
    source: "music/rainy-mood-jazz.mp3",
  },
  {
    title: "Jazz at the Park",
    artist: "Manwithmetalpig",
    source: "music/jazz-at-the-park.mp3",
  },
  {
    title: "After You've Gone",
    artist: "U.S. Coast Guard Band",
    source: "music/after-youve-gone.mp3",
  },
];
let currentTrack = 0;

function loadTrack(index, startPlaying = false) {
  currentTrack = (index + jazzTracks.length) % jazzTracks.length;
  const track = jazzTracks[currentTrack];
  siteAudio.src = track.source;
  songTitle.textContent = track.title;
  songArtist.textContent = track.artist;
  siteAudio.load();
  if (startPlaying) siteAudio.play();
}

musicToggle.addEventListener("click", () => {
  if (siteAudio.paused) siteAudio.play();
  else siteAudio.pause();
});
musicPrevious.addEventListener("click", () => {
  loadTrack(currentTrack - 1, !siteAudio.paused);
});
musicNext.addEventListener("click", () => {
  loadTrack(currentTrack + 1, !siteAudio.paused);
});
siteAudio.addEventListener("play", () => {
  musicPlayer.classList.add("playing");
  musicToggle.textContent = "pause";
  musicToggle.setAttribute("aria-label", "Pause music");
});
siteAudio.addEventListener("pause", () => {
  musicPlayer.classList.remove("playing");
  musicToggle.textContent = "play";
  musicToggle.setAttribute("aria-label", "Play music");
});
siteAudio.addEventListener("ended", () => loadTrack(currentTrack + 1, true));
siteAudio.volume = 0.45;
loadTrack(0);

const wishButton = document.querySelector(".wish-button");
const wishOverlay = document.querySelector(".wish-overlay");
let tomatoRain;

function startTomatoRain() {
  tomatoRain?.remove();
  tomatoRain = document.createElement("div");
  tomatoRain.className = "tomato-rain";

  for (let index = 0; index < 34; index += 1) {
    const tomato = document.createElement("span");
    tomato.className = "falling-tomato";
    tomato.textContent = index % 3 === 0 ? "🧀" : "🍅";
    tomato.style.setProperty("--tomato-left", `${Math.random() * 100}%`);
    tomato.style.setProperty("--tomato-size", `${24 + Math.random() * 34}px`);
    tomato.style.setProperty("--tomato-speed", `${2 + Math.random() * 1.5}s`);
    tomato.style.setProperty("--tomato-delay", `${Math.random() * 1.2}s`);
    tomatoRain.append(tomato);
  }

  wishOverlay.prepend(tomatoRain);
}

wishButton.addEventListener("click", () => {
  startTomatoRain();
  wishOverlay.classList.add("show");
  wishOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    wishOverlay.classList.remove("show");
    wishOverlay.setAttribute("aria-hidden", "true");
    tomatoRain?.remove();
  }, 3000);
});

wishOverlay.addEventListener("click", () => {
  wishOverlay.classList.remove("show");
  wishOverlay.setAttribute("aria-hidden", "true");
  tomatoRain?.remove();
});
