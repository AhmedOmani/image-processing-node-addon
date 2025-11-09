// app.js
const sharp = require("sharp");
const { Worker } = require("worker_threads");
const path = require("node:path");
const os = require("node:os");
const { performance } = require("perf_hooks");

const THREADS = 8 // choose your #threads
const RADIUS = 5;
const WORKER_PATH = path.join(__dirname, "worker.js");

function makeStripePlan(height, threads, radius) {
    const rowsPer = Math.ceil(height / threads);
    const plan = [];
    for (let t = 0; t < threads; t++) {
        const y0 = t * rowsPer;                 // core start (inclusive)
        const y1 = Math.min(height, (t + 1) * rowsPer); // core end (exclusive)
        if (y0 >= y1) break; // no empty stripes

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

async function main() {
    // 1) Decode JPEG → raw RGBA
    const decoded = await sharp("/home/hp/image-processing/images/test.jpg")
        .rotate()
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data: rgba, info: { width, height, channels } } = decoded;
    if (channels !== 4) throw new Error("Expecting RGBA (4 channels).");

    const bpr = width * 4;
    const output = Buffer.alloc(rgba.length);

    // 2) Split image into horizontal stripes with halos
    const plan = makeStripePlan(height, THREADS, RADIUS);

    // 3) Dispatch to workers
    const jobs = plan.map((p, idx) => {
        return new Promise((resolve, reject) => {
        // Build subimage buffer (rows haloTop..haloBot-1)
        const subBytes = p.subHeight * bpr;
        const subBuf = Buffer.allocUnsafe(subBytes);
        const srcStart = p.haloTop * bpr;
        Buffer.from(rgba).copy(subBuf, 0, srcStart, srcStart + subBytes);

        const worker = new Worker(WORKER_PATH);
        worker.once("error", reject);
        worker.once("message", ({ part }) => {
            const core = Buffer.from(part); 
            const dstStart = p.coreY0 * bpr;
            core.copy(output, dstStart);
            worker.terminate();
            resolve({ idx });
        });

        worker.postMessage({
            buffer: subBuf.buffer,   
            width,
            subHeight: p.subHeight,
            coreYOffset: p.coreYOffset,
            coreHeight: p.coreHeight,
            radius: RADIUS,
        }, [subBuf.buffer]);
        });
    });


    const start = performance.now();
    await Promise.all(jobs);
    console.log(`[Multi-Threading] Completed in ${(performance.now() - start) / 1000}s`)

    // 4) Save results
    await sharp(output, { raw: { width, height, channels: 4 } })
        .png()
        .toFile("out.png");

    // Optional: JPEG (no alpha)
    await sharp(output, { raw: { width, height, channels: 4 } })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90 })
        .toFile("out.jpg");

    console.log("Done: out.png, out.jpg");
}

main().catch(console.error);
