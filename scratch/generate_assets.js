const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SVG_PATH = path.join(__dirname, "../public/rk-global-logo.svg");
const ANDROID_RES_DIR = path.join(__dirname, "../android/app/src/main/res");

const iconSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const splashScreens = [
  { path: "drawable/splash.png", width: 512, height: 512 },
  { path: "drawable-port-mdpi/splash.png", width: 320, height: 480 },
  { path: "drawable-port-hdpi/splash.png", width: 480, height: 800 },
  { path: "drawable-port-xhdpi/splash.png", width: 720, height: 1280 },
  { path: "drawable-port-xxhdpi/splash.png", width: 960, height: 1600 },
  { path: "drawable-port-xxxhdpi/splash.png", width: 1280, height: 1920 },
  { path: "drawable-land-mdpi/splash.png", width: 480, height: 320 },
  { path: "drawable-land-hdpi/splash.png", width: 800, height: 480 },
  { path: "drawable-land-xhdpi/splash.png", width: 1280, height: 720 },
  { path: "drawable-land-xxhdpi/splash.png", width: 1600, height: 960 },
  { path: "drawable-land-xxxhdpi/splash.png", width: 1920, height: 1280 },
];

async function generateIcons() {
  console.log("Generating Launcher Icons...");
  for (const [folder, size] of Object.entries(iconSizes)) {
    const dir = path.join(ANDROID_RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Standard Icon
    await sharp(SVG_PATH)
      .resize(size, size)
      .toFile(path.join(dir, "ic_launcher.png"));

    // Round Icon (circular mask)
    const radius = size / 2;
    const circleSvg = Buffer.from(
      `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" fill="black"/></svg>`
    );
    await sharp(SVG_PATH)
      .resize(size, size)
      .composite([{ input: circleSvg, blend: "dest-in" }])
      .toFile(path.join(dir, "ic_launcher_round.png"));
  }

  console.log("Generating Adaptive Foreground Icons...");
  for (const [folder, size] of Object.entries(foregroundSizes)) {
    const dir = path.join(ANDROID_RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Adaptive Foreground (should fit in safe zone, 66% of total size)
    const logoSize = Math.round(size * 0.65);
    const logoResized = await sharp(SVG_PATH).resize(logoSize, logoSize).toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: logoResized, gravity: "center" }])
      .toFile(path.join(dir, "ic_launcher_foreground.png"));
  }
}

async function generateSplashes() {
  console.log("Generating Splash Screens...");
  for (const splash of splashScreens) {
    const fullPath = path.join(ANDROID_RES_DIR, splash.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Logo size on splash screen should be about 35% of the minimum dimension
    const minDim = Math.min(splash.width, splash.height);
    const logoSize = Math.round(minDim * 0.45);
    const logoResized = await sharp(SVG_PATH).resize(logoSize, logoSize).toBuffer();

    await sharp({
      create: {
        width: splash.width,
        height: splash.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // Clean white background to match the logo
      },
    })
      .composite([{ input: logoResized, gravity: "center" }])
      .toFile(fullPath);
  }
}

async function main() {
  try {
    await generateIcons();
    await generateSplashes();
    console.log("Assets generation complete!");
  } catch (err) {
    console.error("Error generating assets:", err);
  }
}

main();
