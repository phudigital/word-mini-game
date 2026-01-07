// === CẤU HÌNH GAME (Dễ dàng chỉnh sửa tại đây) ===
const CONFIG = {
  USE_IMAGES: true, // Chế độ hình ảnh: true = dùng ảnh, false = dùng chữ
  START_SPEED: 1.6, // Tốc độ rơi ban đầu
  SPEED_INCREMENT: 0.01, // Tốc độ tăng thêm sau mỗi điểm
  CORRECT_PAUSE: 3500, // Dừng lại 3.5s khi đúng (để đọc TTS)
  WRONG_PAUSE: 3000, // Dừng lại 3s khi sai
  TIMEOUT_PAUSE: 2000, // Dừng lại 2s khi hết giờ
  SPEED_VARIATION: 0.5, // Sự khác biệt tốc độ
  TOTAL_LIVES: 5, // Số mạng
  FIREWORKS_COUNT: 100, // Số lượng pháo hoa
  BOX_WIDTH: 200, // Độ rộng ô (sẽ tự chỉnh theo màn hình)
  BOX_HEIGHT: 150, // Độ cao ô (tăng lên để chứa ảnh)
};
// ===============================================

let wordsData = [];
let defaultWords = [
  { word: "Apple", meaning: "Quả táo 🍎" },
  { word: "Banana", meaning: "Quả chuối 🍌" },
  { word: "Cat", meaning: "Con mèo 🐱" },
];

let gameState = "HOME"; // HOME, PLAYING, GAMEOVER
let currentWord = null;
let options = [];
let score = 0;
let highScore = 0;
let lives = 3;
let timer = 0;
let shakeAmount = 0;

let font;
let startBtn;
let boxes = [];

let particles = [];
let correctSound, wrongSound;
let wordImages = {}; // Cache for loaded images

function preload() {
  wordsData = loadJSON(
    "words.json",
    () => console.log("JSON Loaded"),
    () => {
      console.error("JSON Failed, using default");
      wordsData = defaultWords;
    }
  );
  // Sound placeholders - if files exist
  correctSound = loadSound("assets/ting.mp3");
  wrongSound = loadSound("assets/wrong.mp3");
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("game-container");

  highScore = getItem("highScore") || 0;

  textAlign(CENTER, CENTER);
  textFont("Fredoka");

  // Mobile/Responsive Adjustment
  if (width < 600) {
    CONFIG.BOX_WIDTH = width * 0.28; // Fits 3 columns with padding
    CONFIG.BOX_HEIGHT = CONFIG.BOX_WIDTH; // Square boxes for images
  }

  // Preload images if in Image Mode
  if (CONFIG.USE_IMAGES && wordsData) {
    let data = Array.isArray(wordsData) ? wordsData : Object.values(wordsData);
    for (let item of data) {
      // Try loading png (user can modify to jpg if needed)
      // Note: filenames are case-sensitive on some servers
      let imgPath = `assets/img/${item.word}.png`;
      loadImage(
        imgPath,
        (img) => {
          wordImages[item.word] = img;
        },
        () => {
          // Fallback to jpg if png fails
          loadImage(
            `assets/img/${item.word}.jpg`,
            (img) => {
              wordImages[item.word] = img;
            },
            () => console.log(`Failed to load image for: ${item.word}`)
          );
        }
      );
    }
  }

  initHome();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (width < 600) {
    CONFIG.BOX_WIDTH = width * 0.28;
    CONFIG.BOX_HEIGHT = CONFIG.BOX_WIDTH;
  }
}

function draw() {
  background("#FFEBEE"); // Light pink background

  // Screen shake implementation
  if (shakeAmount > 0) {
    translate(
      random(-shakeAmount, shakeAmount),
      random(-shakeAmount, shakeAmount)
    );
    shakeAmount *= 0.9;
  }

  if (gameState === "HOME") {
    drawHome();
  } else if (gameState === "PLAYING") {
    drawGame();
  } else if (gameState === "GAMEOVER") {
    drawGameOver();
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].done()) {
      particles.splice(i, 1);
    }
  }
}

function initHome() {
  gameState = "HOME";
}

function drawHome() {
  fill("#FF5252"); // Bright red/pink
  textSize(width * 0.08);
  text("Bé Học Tiếng Anh!", width / 2, height * 0.3);

  fill("#757575");
  textSize(width * 0.04);
  text("Kỷ lục: " + highScore, width / 2, height * 0.45);

  // Draw Start Button
  let btnW = 200;
  let btnH = 80;
  let btnX = width / 2 - btnW / 2;
  let btnY = height * 0.6;

  let hovering =
    mouseX > btnX &&
    mouseX < btnX + btnW &&
    mouseY > btnY &&
    mouseY < btnY + btnH;

  fill(hovering ? "#4CAF50" : "#8BC34A");
  noStroke();
  rect(btnX, btnY, btnW, btnH, 20);

  fill(255);
  textSize(32);
  text("BẮT ĐẦU", width / 2, btnY + btnH / 2);
}

let isTransitioning = false;
let feedbackText = "";
let feedbackColor = "#4CAF50";
let audioUnlocked = false;

function startGame() {
  // Unlock audio on first user interaction (critical for mobile/Zalo)
  if (!audioUnlocked) {
    unlockAudio();
    audioUnlocked = true;
  }

  score = 0;
  lives = CONFIG.TOTAL_LIVES;
  gameState = "PLAYING";
  // Setup image loading if simple object array (failsafe)
  if (Array.isArray(wordsData)) {
    // already good
  } else {
    wordsData = Object.values(wordsData);
  }
  isTransitioning = false;
  nextWord();
}

function nextWord() {
  isTransitioning = false;
  let data = wordsData; // Assume array
  if (!data || data.length === 0) data = defaultWords;

  currentWord = random(data);

  // Generate options (find other words, not just meanings)
  let otherWords = data.filter((w) => w.word !== currentWord.word);
  let shuffledOthers = shuffle(otherWords);

  // Options now hold the full word object, not just meaning
  let selection = [currentWord, shuffledOthers[0], shuffledOthers[1]];
  selection = shuffle(selection);

  // Create boxes
  boxes = [];
  let spacing = width / 4; // Default spacing
  // Mobile portrait adjustment
  if (width < 600) spacing = width / 3;

  let boxColors = [
    "#FFCDD2",
    "#C8E6C9",
    "#BBDEFB",
    "#FFF9C4",
    "#F3E5F5",
    "#E1F5FE",
  ];

  let baseSpeed = CONFIG.START_SPEED + score * CONFIG.SPEED_INCREMENT;

  for (let i = 0; i < 3; i++) {
    // Mobile positioning
    let xPos = width < 600 ? spacing * i + spacing / 2 : spacing * (i + 1);

    boxes.push({
      x: xPos,
      y: -150 - random(0, 300),
      wordObj: selection[i], // Store full object
      text: selection[i].meaning, // Fallback text
      color: color(random(boxColors)),
      speed:
        baseSpeed + random(-CONFIG.SPEED_VARIATION, CONFIG.SPEED_VARIATION),
      w: CONFIG.BOX_WIDTH,
      h: CONFIG.BOX_HEIGHT,
      isCorrect: selection[i].word === currentWord.word,
      jumpY: 0,
    });
  }
}

function drawGame() {
  // UI
  fill("#333");
  textSize(24);
  textAlign(LEFT);
  text("Điểm: " + score, 20, 40);
  textAlign(RIGHT);
  text("Lượt chơi: " + "❤️".repeat(lives), width - 20, 40);
  textAlign(CENTER);

  // Current Word Display
  fill("#3F51B5");
  textSize(width * 0.1);
  text(currentWord.word, width / 2, height * 0.25);

  // Falling boxes
  let allOffScreen = true;
  for (let b of boxes) {
    if (!isTransitioning) b.y += b.speed;

    if (b.jumpY > 0) b.jumpY -= 2;

    push();
    translate(b.x, b.y - b.jumpY);

    // Shadow
    fill(0, 0, 0, 30);
    if (CONFIG.USE_IMAGES && wordImages[b.wordObj.word]) {
      ellipse(5, 5, b.w, b.h); // Shadow for circle
    } else {
      rect(-b.w / 2 + 5, -b.h / 2 + 5, b.w, b.h, 20); // Shadow for rect
    }

    // Box Background
    fill(b.color);
    stroke(255);
    strokeWeight(3);

    if (CONFIG.USE_IMAGES && wordImages[b.wordObj.word]) {
      // Draw Circular Image Container
      circle(0, 0, Math.min(b.w, b.h));

      // Clip Image to Circle
      let img = wordImages[b.wordObj.word];
      let d = Math.min(b.w, b.h) - 10; // Slightly smaller than container for border effect

      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.arc(0, 0, d / 2, 0, TWO_PI);
      drawingContext.clip();

      // "Contain" style
      let scale = Math.min(d / img.width, d / img.height);
      imageMode(CENTER);
      image(img, 0, 0, img.width * scale, img.height * scale);

      drawingContext.restore();

      // Inner Border
      noFill();
      stroke(255, 255, 255, 150);
      strokeWeight(2);
      circle(0, 0, d);
    } else {
      // Text Fallback (Rectangle)
      rect(-b.w / 2, -b.h / 2, b.w, b.h, 20);
      noStroke();
      fill("#333");
      textSize(width < 600 ? 18 : 22);
      text(b.text, 0, 0);
    }

    pop();

    if (b.y < height + b.h) allOffScreen = false;
  }

  if (isTransitioning) {
    // Large Overlay
    push();
    fill(0, 0, 0, 200); // Darker dim for better contrast
    rect(0, 0, width, height);

    // Draw English Word (White, Big)
    fill(255);
    textStyle(BOLD);
    textSize(width * 0.12);
    text(currentWord.word, width / 2, height * 0.4);

    // Draw Meaning/Feedback (Colored, slightly smaller)
    fill(feedbackColor);
    textStyle(NORMAL);
    textSize(width * 0.06);
    textWrap(WORD);
    text(feedbackText, width / 2, height * 0.55);
    pop();
  }

  if (allOffScreen && !isTransitioning) {
    lives--;
    shakeAmount = 15;
    if (lives <= 0) {
      endGame();
    } else {
      feedbackText = "Hết thời gian! ⏰";
      feedbackColor = "#FF9800";
      isTransitioning = true;
      playTTS("Hết thời gian chọn rồi!", "vi");
      setTimeout(nextWord, CONFIG.TIMEOUT_PAUSE);
    }
  }
}

function drawGameOver() {
  fill("#F44336");
  textSize(width * 0.1);
  text("HẾT GIỜ!", width / 2, height * 0.3);

  fill("#333");
  textSize(width * 0.05);
  text("Điểm của bé: " + score, width / 2, height * 0.45);

  if (score >= highScore && score > 0) {
    fill("#FFD700");
    textSize(width * 0.06);
    text("KỶ LỤC MỚI! 🏆", width / 2, height * 0.55);

    // Auto-spawn fireworks
    if (frameCount % 20 === 0) {
      spawnFireworks(random(width), random(height / 2), 40);
    }
  }

  // Play again button
  let btnW = 200;
  let btnH = 80;
  let btnX = width / 2 - btnW / 2;
  let btnY = height * 0.7;

  let hovering =
    mouseX > btnX &&
    mouseX < btnX + btnW &&
    mouseY > btnY &&
    mouseY < btnY + btnH;
  fill(hovering ? "#2196F3" : "#03A9F4");
  noStroke();
  rect(btnX, btnY, btnW, btnH, 20);

  fill(255);
  textSize(32);
  text("LẠI NÈ", width / 2, btnY + btnH / 2);
}

function spawnFireworks(x, y, count = 20) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y));
  }
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(2, 9)); // Faster particles
    this.acc = createVector(0, 0.2); // Stronger gravity
    this.alpha = 255;
    this.color = color(random(100, 255), random(100, 255), random(100, 255));
    this.size = random(5, 12);
  }
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.alpha -= 3; // Longer lasting particles
  }
  show() {
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), this.alpha);
    ellipse(this.pos.x, this.pos.y, this.size);
  }
  done() {
    return this.alpha <= 0;
  }
}

function endGame() {
  if (score > highScore) {
    highScore = score;
    storeItem("highScore", highScore);
    spawnFireworks(width / 2, height / 2, 150); // Massive celebration
    spawnFireworks(width / 4, height / 2, 80);
    spawnFireworks((3 * width) / 4, height / 2, 80);
  }
  gameState = "GAMEOVER";
}

function unlockAudio() {
  // Unlock audio context for mobile browsers (iOS, Android, Zalo)
  if ("speechSynthesis" in window) {
    // Try to speak empty text to unlock
    const utterance = new SpeechSynthesisUtterance("");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
    console.log("Audio unlocked for mobile");
  }
}

function playTTS(text, lang) {
  if ("speechSynthesis" in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "en" ? "en-US" : "vi-VN";
    utterance.rate = 0.9;
    utterance.volume = 1.0;

    // Add small delay for better compatibility with Zalo browser
    setTimeout(() => {
      utterance.onstart = () => {
        console.log(`Playing TTS: "${text}" in ${lang}`);
      };

      utterance.onerror = (e) => {
        console.error("TTS Playback failed:", e);
      };

      window.speechSynthesis.speak(utterance);
    }, 50);

    return utterance;
  } else {
    console.error("Speech Synthesis not supported in this browser");
  }
}

function mousePressed() {
  if (gameState === "HOME") {
    let btnW = 200;
    let btnH = 80;
    let btnX = width / 2 - btnW / 2;
    let btnY = height * 0.6;
    if (
      mouseX > btnX &&
      mouseX < btnX + btnW &&
      mouseY > btnY &&
      mouseY < btnY + btnH
    ) {
      startGame();
    }
  } else if (gameState === "PLAYING" && !isTransitioning) {
    for (let b of boxes) {
      if (
        mouseX > b.x - b.w / 2 &&
        mouseX < b.x + b.w / 2 &&
        mouseY > b.y - b.h / 2 &&
        mouseY < b.y + b.h / 2
      ) {
        if (b.isCorrect) {
          score += 10;
          if (correctSound) correctSound.play();
          b.jumpY = 30;
          spawnFireworks(mouseX, mouseY, CONFIG.FIREWORKS_COUNT);

          // Feedback Text
          feedbackText = b.wordObj.meaning;
          feedbackColor = "#4CAF50";

          // 1. Read English Immediately
          playTTS(b.wordObj.word, "en");

          // 2. Read Vietnamese after 1 second
          setTimeout(() => {
            // Strip all emojis and special characters, keep only Vietnamese text
            let vnText = b.wordObj.meaning
              .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Emoji
              .replace(/[\u{2600}-\u{26FF}]/gu, "") // Misc symbols
              .replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
              .replace(/[\u{1F000}-\u{1F02F}]/gu, "") // Mahjong tiles
              .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, "") // Playing cards
              .replace(/[\u{1F100}-\u{1F64F}]/gu, "") // Enclosed characters
              .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport symbols
              .replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // Supplemental symbols
              .replace(/[\u{2300}-\u{23FF}]/gu, "") // Misc technical
              .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // Variation selectors
              .trim();

            if (vnText) {
              playTTS(vnText, "vi");
            }
          }, 1000);

          isTransitioning = true;
          setTimeout(nextWord, CONFIG.CORRECT_PAUSE);
        } else {
          lives--;
          shakeAmount = 15;
          if (wrongSound) wrongSound.play();
          if (lives <= 0) {
            endGame();
          } else {
            feedbackText = "SAI RỒI  😢";
            feedbackColor = "#F44336";
            playTTS("Sai rồi ", "vi");
            isTransitioning = true;
            setTimeout(nextWord, CONFIG.WRONG_PAUSE);
          }
        }
        break;
      }
    }
  } else if (gameState === "GAMEOVER") {
    let btnW = 200;
    let btnH = 80;
    let btnX = width / 2 - btnW / 2;
    let btnY = height * 0.7;
    if (
      mouseX > btnX &&
      mouseX < btnX + btnW &&
      mouseY > btnY &&
      mouseY < btnY + btnH
    ) {
      startGame();
    }
  }
}
