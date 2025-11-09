// worker.js
const { parentPort } = require("worker_threads");

parentPort.on("message", (msg) => {
  const {
    inputSAB,            // SharedArrayBuffer with RGBA input
    outputSAB,           // SharedArrayBuffer for RGBA output
    width,
    height,
    radius,              // e.g., 5
    coreY0,              // inclusive
    coreY1               // exclusive
  } = msg;

  const input = new Uint8ClampedArray(inputSAB);   // read-only by convention
  const output = new Uint8ClampedArray(outputSAB); // each worker writes its own rows
  const bpr = width * 4;

  // Process only our assigned rows [coreY0, coreY1)
  for (let y = coreY0; y < coreY1; y++) {
    for (let x = 0; x < width; x++) {
      let graySum = 0;
      let aSum = 0;
      let count = 0;

      // Box kernel
      for (let ky = -radius; ky <= radius; ky++) {
        const py = y + ky;
        if (py < 0 || py >= height) continue;

        for (let kx = -radius; kx <= radius; kx++) {
          const px = x + kx;
          if (px < 0 || px >= width) continue;

          const o = (py * width + px) * 4;
          const r = input[o + 0];
          const g = input[o + 1];
          const b = input[o + 2];
          const a = input[o + 3];

          // luminance (same weights you used)
          graySum += 0.299 * r + 0.587 * g + 0.114 * b;
          aSum += a;
          count++;
        }
      }

      const gray = Math.floor(graySum / count);
      const aOut = Math.floor(aSum / count);

      const dst = (y * width + x) * 4;
      output[dst + 0] = gray;
      output[dst + 1] = gray;
      output[dst + 2] = gray;
      output[dst + 3] = aOut;
    }
  }

  // Tell the parent we’re done (no buffers to transfer—SABs are shared)
  parentPort.postMessage({ done: true, coreY0, coreY1 });
});
