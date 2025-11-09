const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

const SingleThreadProcessor = require('../js-single-thread/processor');
const MultiThreadProcessor = require('../js-multi-thread/processor');

async function findImage(provided) {
  const candidates = [];
  if (provided) candidates.push(provided);
  // common variants (try both with and without hyphen)
  candidates.push('/home/hp/imageprocessing/images/test.jpg');
  candidates.push('/home/hp/image-processing/images/test.jpg');
  candidates.push(path.join(__dirname, '../../images/test.jpg'));

  for (const p of candidates) {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) return p;
    } catch (e) {
      // ignore
    }
  }
  throw new Error(`Test image not found. Tried: ${candidates.join(', ')}`);
}

function statsFrom(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  const avg = sum / arr.length;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  return { average: avg, min, max };
}

async function runOne(name, processor, imageData, width, height, iterations = 3, radius = 5) {
  console.log('\n' + '='.repeat(60));
  console.log(`🔬 Running: ${name}`);
  console.log('='.repeat(60));

  const durations = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`\n📊 Iteration ${i + 1}/${iterations}`);
    if (global.gc) global.gc();

    const start = performance.now();
    // processors may be sync or async — normalize with Promise.resolve + await
    await Promise.resolve(processor.process(Buffer.from(imageData), width, height, radius));
    const end = performance.now();

    const elapsed = end - start; // ms
    console.log(`   Completed in ${elapsed.toFixed(2)} ms`);
    durations.push(elapsed);

    // small pause
    await new Promise((r) => setTimeout(r, 250));
  }

  const s = statsFrom(durations);
  const result = {
    name,
    iterations,
    durations,
    average: s.average,
    min: s.min,
    max: s.max,
  };

  console.log(`\n📈 Results for ${name}:`);
  console.log(`   Average: ${result.average.toFixed(2)} ms`);
  console.log(`   Min:     ${result.min.toFixed(2)} ms`);
  console.log(`   Max:     ${result.max.toFixed(2)} ms`);
  console.log(`   All runs: [${result.durations.map(d => d.toFixed(0)).join(', ')}] ms`);

  return result;
}

async function main() {
  try {
    const providedPath = process.argv[2];
    const imagePath = await findImage(providedPath);
    console.log('\n Node.js Image Processing Benchmark');
    console.log(` Using image: ${imagePath}\n`);

    const image = sharp(imagePath);
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    console.log(`   Loaded: ${info.width}x${info.height} (${(data.length / 1024 / 1024).toFixed(2)} MB)`);

    const iterations = parseInt(process.env.BENCH_ITERATIONS || '3', 10) || 3;
    const radius = parseInt(process.env.BENCH_RADIUS || '5', 10) || 5;

    const single = new SingleThreadProcessor();
    const multi = new MultiThreadProcessor();

    const results = [];

    const r1 = await runOne('JavaScript Single-Thread', single, data, info.width, info.height, iterations, radius);
    results.push(r1);

    const r2 = await runOne('JavaScript Multi-Thread', multi, data, info.width, info.height, iterations, radius);
    results.push(r2);

    // Summary table
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL COMPARISON');
    console.log('='.repeat(80));

    const sorted = [...results].sort((a, b) => a.average - b.average);
    const fastest = sorted[0].average;

    for (const res of sorted) {
      const speedup = (res.average / fastest).toFixed(2);
      console.log(`${res.name.padEnd(30)} ${res.average.toFixed(0).padStart(8)} ms  min ${res.min.toFixed(0).padStart(6)} ms  max ${res.max.toFixed(0).padStart(6)} ms   ${speedup}x`);
    }

    // Save results
    const out = {
      timestamp: new Date().toISOString(),
      node: process.version,
      cpus: require('os').cpus().length,
      image: imagePath,
      radius,
      iterations,
      results,
    };

    const outPath = path.join(__dirname, '../../results-benchmark.json');
    await fs.writeFile(outPath, JSON.stringify(out, null, 2));
    console.log(`\n Results saved to: ${outPath}`);
  } catch (err) {
    console.error('Benchmark failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main };
