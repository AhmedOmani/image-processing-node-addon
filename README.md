# Image Processing: JS → Multi-threaded JS → Native C++ Addon

This repository explores progressively optimizing a CPU-bound image processing task (grayscale + box blur) in Node.js using three approaches:

- Pure JavaScript single-threaded
- JavaScript multi-threaded (Worker Threads) with two IPC strategies (copy & SharedArrayBuffer)
- Native C++ implementation exposed to Node via N-API / node-gyp

The goal is to show how the same algorithm behaves across these layers, and how to move from a simple, easy-to-understand JS implementation to a high-performance native addon.

## Problem being solved

Given an RGBA image buffer (raw pixels), apply a two-step operation:
1. Convert to grayscale (luminosity method)
2. Apply a box blur (radius r)

This operation is CPU-bound and iterates over every pixel multiple times. For large images (for example, 5472×3648, ~8K-ish), a naive single-threaded JS implementation can take many seconds. The project demonstrates how multithreading and native code drastically reduce execution time.

Summary of the practical goals:
- Start simple: single-threaded JS implementation that is easy to reason about
- Scale horizontally: split image into stripes and process with Worker Threads
- Reduce copy overhead: use SharedArrayBuffer so workers can work in-place
- Maximize CPU efficiency: implement the hot loop in native C++ and expose via N-API

## Contract (inputs / outputs / errors)

- Input: Buffer (RGBA raw pixels), width (int), height (int), blurRadius (int, optional)
- Output: Object { data: Buffer (RGBA), duration: number (milliseconds) }
- Errors: thrown if buffer length != width * height * 4, or invalid parameters (negative sizes, huge radius)

## Where the relevant code lives

- JavaScript single-thread implementation: `src/js-single-thread/processor.js` and `src/js-single-thread/app.js`
- JavaScript multi-thread (copy-based): `src/js-multi-thread/processor.js`, `src/js-multi-thread/worker.js`, `src/js-multi-thread/app.js`
- JavaScript multi-thread (SharedArrayBuffer): `src/js-multi-thread-shared-data/*`
- Native C++ addon (N-API): `src/cpp-addon/processor.h`, `src/cpp-addon/processor.cpp`, `src/cpp-addon/binding.cpp`, and example runner `src/cpp-addon/app.js`
- Build config: `binding.gyp`, `package.json`

## How each approach works (high level)

1) Single-threaded JS
- Implements `toGrayScale` and `applyBlur` in plain JavaScript.
- Simple: read the RGBA Buffer, produce a new Buffer, return result.
- Easy to debug and correct, but runs on Node's event loop thread and blocks other JS work.

2) Multi-threaded JS (Worker Threads)
- Split the image vertically/horizontally into stripes. Each worker receives a sub-image that includes "halo" rows (extra rows on top/bottom) so blur across stripe boundaries is correct.
- Worker processes its sub-image (grayscale + blur) and returns the core part (without halos).
- Main thread assembles returned stripes into final output.
- Two IPC strategies implemented:
  - Transferable ArrayBuffer / Buffer copy (fast transfers but still copies when building sub-buffers)
  - SharedArrayBuffer (workers read/write the same memory, eliminating some copies at the cost of careful coordination)

3) Native C++ Addon (N-API)
- Core pixel loops are implemented in C++ (`ImageProcessor::toGrayscale`, `applyBlur`, `process`).
- `binding.cpp` exposes a `processImage` function using N-API which:
  - Accepts a Node `Buffer` and parameters
  - Allocates an output Buffer
  - Calls the native routine and measures duration (ms)
  - Returns `{ data: Buffer, duration: number }` to JS
- Build is via node-gyp with `binding.gyp`. `node-addon-api` is included in `package.json`.

## Why performance improves

- JS single-thread: runs on one OS thread inside V8. For heavy numeric loops, JS is comparatively slow.
- Multi-threaded JS: uses multiple cores — a near-linear speedup (minus thread creation and copy overhead)
- Native C++: C++ loops can use integer math, pointer arithmetic, and compiler optimizations, providing another big leap in per-core performance.

Example (real-ish numbers from experiments):
- Image: 5472 × 3648 (~8K)
- JS single-thread: ~12 s
- JS multi-thread (8 threads): ~2–3 s
- Native C++ (single process call): ~700 ms

These numbers illustrate that combining multithreading and native code can yield 10s to 100s× improvements depending on the task and overheads.

## Build & run (quickstart)

Prereqs:
- Node.js (14+ recommended; Node 16/18 better)
- Python (for node-gyp; Python 3 is usually fine)
- A C/C++ build toolchain (GCC/Clang and make, or MSVC on Windows)

Install deps:

```bash
# from project root
npm install
```

Build the native addon via node-gyp:

```bash
# builds to build/Release/addon.node
npm run build
# or if you want configure + rebuild separately
npm run configure
npm run build
```

Run examples

- Single-thread JS

```bash
node src/js-single-thread/app.js
```

- Multi-thread JS (worker threads - copy-based)

```bash
node src/js-multi-thread/app.js
# Edit THREADS constant in file to change number of workers
```

- Multi-thread JS (SharedArrayBuffer version)

```bash
node src/js-multi-thread-shared-data/app.js
```

- Native C++ addon example

```bash
# Ensure build/Release/addon.node exists (npm run build)
node src/cpp-addon/app.js
```

Each app uses `sharp` to read `/home/hp/image-processing/images/test.jpg` in the examples; change that path or pass your own image to test.

## Tips for benchmarking and tuning

- Choose representative input images: big images show benefits of parallelism better.
- Tune the number of threads: `os.cpus().length` is a good starting point; avoid oversubscription.
- Use a reasonable blur radius (very large radii increase kernel cost quadratically).
- Measure with `perf_hooks.performance.now()` in JS and `chrono` in C++.
- Use `Buffer.allocUnsafe` when you're going to overwrite the buffer completely (faster than zero-filling).
- For worker-based split, ensure halo rows are correctly computed (radius rows above/below) so edges are accurate.
- Use SharedArrayBuffer to eliminate copies; remember that SAB requires careful memory coordination and Node versions that support SAB + worker threads.

## Common pitfalls and troubleshooting

- node-gyp fails: ensure Python and C build toolchain are installed and your Node version and node-gyp version are compatible.
- Buffer size mismatch: the addon expects `buffer.length === width * height * 4` (RGBA). If this doesn't match, the addon throws a JS exception.
- Worker threads & SharedArrayBuffer: older Node versions or some sandboxed environments may not support SAB or may require flags.
- When benchmarking, warm up once to exclude startup/alloc costs.

## Suggestion for next steps / improvements

- SIMD/vectorization in C++ (platform-specific intrinsics) to accelerate pixel loops further.
- Multi-threaded C++ (split image among threads inside the addon) to combine the best of both (C++ speed + parallelism).
- Streaming / tiled processing for very large images that don't fit comfortably in memory.
- GPU offload (OpenCL/CUDA) — large engineering lift but huge potential gains for massively parallel ops.

## Where to look in this repo

- `src/js-single-thread/` — simple JS implementation
- `src/js-multi-thread/` — worker-based multi-threading with transferable buffers
- `src/js-multi-thread-shared-data/` — worker-based multi-threading using SharedArrayBuffer
- `src/cpp-addon/` — native C++ implementation and N-API binding
- `binding.gyp` & `package.json` — build config & dependencies

## Quick notes on the C++ N-API binding

- The C++ binding demonstrates a safe pattern: validate arguments, get Buffer pointers with `napi_get_buffer_info`, allocate an output buffer via `napi_create_buffer`, run the CPU-heavy `ImageProcessor::process(...)`, and return an object containing the resulting Buffer and duration.
- The project depends on `node-addon-api` and uses `NAPI_MODULE` for registration.

---

## Benchmarks (sample results)

I ran the included benchmark script on this machine and saved the raw output to `results-benchmark.json` in the repository root. Summary of the run:

- Node: v18.20.8
- CPUs: 8
- Image: `/home/hp/image-processing/images/test.jpg`
- Radius: 5
- Iterations: 3

Results (wall-clock ms):

- JavaScript Single-Thread: average ~9,883 ms (runs: 9,492 ms, 10,062 ms, 10,094 ms)
- JavaScript Multi-Thread : average ~3,335 ms (runs: 3,199 ms, 3,327 ms, 3,477 ms)

Observed speedup: ~2.96× faster using Worker Threads for this image and blur radius. Your exact numbers will vary by CPU, Node.js version, image size, and chosen thread count.

How to re-run the benchmark

1. Make sure dependencies are installed:

```bash
npm install
```

2. Run the benchmark script (optionally pass an image path):

```bash
# default (uses the repository test image if present)
node src/benchmarks/benchmark.js

# or pass a path to a different test image
node src/benchmarks/benchmark.js /path/to/your/image.jpg
```

Environment variables supported:

- BENCH_ITERATIONS — number of iterations per test (default: 3)
- BENCH_RADIUS — blur radius used for tests (default: 5)

The script saves results to `results-benchmark.json` at the repository root. Use that file to compare runs across machines or after code changes.

Interpreting the numbers

- Single-threaded JS runs the full pixel loops on one core and will be slow for large images.
- Multi-threaded JS splits the image into stripes and processes them in parallel; this reduces wall-clock time roughly in proportion to the number of useful cores minus overhead.
- The native C++ addon (if you build and test it) typically gives an additional per-core speedup because C++ loops are faster than equivalent JS loops.

If you want, I can add a small script to automatically run the benchmark across a matrix of thread counts and radii and plot/save the results as CSV for easier analysis.
