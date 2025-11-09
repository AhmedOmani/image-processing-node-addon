// processors.js
const { performance } = require("perf_hooks");
const { Worker } = require("worker_threads");
const path = require("node:path");
const os = require("node:os");

class ImageProcessor {
  toGrayScale(imageData, width, height) {
    const pixels = width * height;
    const output = Buffer.alloc(imageData.length);

    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      const r = imageData[o];
      const g = imageData[o + 1];
      const b = imageData[o + 2];
      const a = imageData[o + 3];

      const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
      output[o] = gray;
      output[o + 1] = gray;
      output[o + 2] = gray;
      output[o + 3] = a;
    }
    return output;
  }

  applyBlur(imageData, width, height, radius = 5) {
    const output = Buffer.alloc(imageData.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          const py = y + ky;
          if (py < 0 || py >= height) continue;

          for (let kx = -radius; kx <= radius; kx++) {
            const px = x + kx;
            if (px < 0 || px >= width) continue;

            const o = (py * width + px) * 4;
            r += imageData[o];
            g += imageData[o + 1];
            b += imageData[o + 2];
            a += imageData[o + 3];
            count++;
          }
        }

        const o = (y * width + x) * 4;
        output[o] = Math.floor(r / count);
        output[o + 1] = Math.floor(g / count);
        output[o + 2] = Math.floor(b / count);
        output[o + 3] = Math.floor(a / count);
      }
    }
    return output;
  }

  /**
   * Process image using worker threads (split into stripes and delegate to workers)
   * Returns: { data: Buffer, duration: number (ms) }
   */
  async process(imageData, width, height, radius = 5, threads = Math.max(1, os.cpus().length)) {
    const bpr = width * 4;
    const output = Buffer.alloc(imageData.length);

    function makeStripePlan(height, threads, radius) {
      const rowsPer = Math.ceil(height / threads);
      const plan = [];
      for (let t = 0; t < threads; t++) {
        const y0 = t * rowsPer;
        const y1 = Math.min(height, (t + 1) * rowsPer);
        if (y0 >= y1) break;

        const haloTop = Math.max(0, y0 - radius);
        const haloBot = Math.min(height, y1 + radius);
        plan.push({
          coreY0: y0,
          coreY1: y1,
          haloTop,
          haloBot,
          coreHeight: y1 - y0,
          subHeight: haloBot - haloTop,
          coreYOffset: y0 - haloTop,
        });
      }
      return plan;
    }

    const plan = makeStripePlan(height, threads, radius);

    const jobs = plan.map((p) => {
      return new Promise((resolve, reject) => {
        const subBytes = p.subHeight * bpr;
        const subBuf = Buffer.allocUnsafe(subBytes);
        const srcStart = p.haloTop * bpr;
        Buffer.from(imageData).copy(subBuf, 0, srcStart, srcStart + subBytes);

        const worker = new Worker(path.join(__dirname, "worker.js"));
        worker.once("error", reject);
        worker.once("message", ({ part }) => {
          const core = Buffer.from(part);
          const dstStart = p.coreY0 * bpr;
          core.copy(output, dstStart);
          worker.terminate();
          resolve({ idx: p.coreY0 });
        });

        worker.postMessage({
          buffer: subBuf.buffer,
          width,
          subHeight: p.subHeight,
          coreYOffset: p.coreYOffset,
          coreHeight: p.coreHeight,
          radius,
        }, [subBuf.buffer]);
      });
    });

    const start = performance.now();
    await Promise.all(jobs);
    const duration = performance.now() - start;

    return { data: output, duration };
  }
}

module.exports = ImageProcessor;

