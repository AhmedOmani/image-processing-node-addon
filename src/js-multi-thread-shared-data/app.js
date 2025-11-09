// app.js
const sharp = require("sharp");
const { Worker } = require("worker_threads");
const path = require("node:path");
const os = require("node:os");
const { performance } = require("node:perf_hooks");

const THREADS = 8 // pick a sensible cap
const RADIUS = 5;
const WORKER_PATH = path.join(__dirname, "worker.js");

function stripePlan(height, threads) {
  const rowsPer = Math.ceil(height / threads);
  const plan = [];
  for (let t = 0; t < threads; t++) {
    const y0 = t * rowsPer;
    const y1 = Math.min(height, (t + 1) * rowsPer);
    if (y0 < y1) plan.push({ coreY0: y0, coreY1: y1 });
  }
  return plan;
}

async function main() {
  // 1) Decode JPG → raw RGBA
  const decoded = await sharp("/home/hp/image-processing/images/test.jpg")
    .rotate()
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: rgba, info: { width, height, channels } } = decoded;
  if (channels !== 4) throw new Error("Expecting 4 channels (RGBA).");

  const totalBytes = width * height * 4;

  // 2) Create shared input & output
  const inputSAB = new SharedArrayBuffer(totalBytes);
  const outputSAB = new SharedArrayBuffer(totalBytes);

  // Copy decoded RGBA into shared input
  new Uint8Array(inputSAB).set(rgba);

  const plan = stripePlan(height, THREADS);

  // 3) Spawn workers
  const start = performance.now();
  const jobs = plan.map(({ coreY0, coreY1 }, idx) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_PATH);
      worker.once("error", reject);
      worker.once("message", (msg) => {
        // Each worker wrote directly into the shared output buffer
        worker.terminate();
        resolve({ idx, ...msg });
      });

      worker.postMessage({
        inputSAB,
        outputSAB,
        width,
        height,
        radius: RADIUS,
        coreY0,
        coreY1
      });
    });
  });

  await Promise.all(jobs);
  const ms = (performance.now() - start)/1000;
  console.log(`[SAB] Processed ${width}x${height} with radius=${RADIUS} using ${plan.length} threads in ${ms.toFixed(1)} s`);

  // 4) Save from shared output
  const outBytes = Buffer.from(new Uint8Array(outputSAB));
  await sharp(outBytes, { raw: { width, height, channels: 4 } })
    .png()
    .toFile("out-sab.png");

  // Optional JPEG (no alpha)
  await sharp(outBytes, { raw: { width, height, channels: 4 } })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90 })
    .toFile("out-sab.jpg");

  console.log("Wrote out-sab.png and out-sab.jpg");
}

main().catch(console.error);
