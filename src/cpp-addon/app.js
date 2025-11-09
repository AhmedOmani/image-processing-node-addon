const sharp = require("sharp");
const fs = require("fs");

const addon = require("../../build/Release/addon.node");

async function main() {
    try {
        const {data, info} = await sharp("/home/hp/image-processing/images/test.jpg").ensureAlpha().raw().toBuffer({resolveWithObject: true});
        console.log(`   ✅ Loaded: ${info.width}x${info.height}`);
        console.log(`   Buffer size: ${(data.length / 1024 / 1024).toFixed(2)} MB\n`);

        console.log('⚡ Step 2: Processing with C++ addon...\n');

        const result = addon.processImage(data , info.width, info.height , 5);
        console.log(`\n   ✅ Processing complete!`);
        console.log(`   Duration: ${result.duration / 1000}s`);
        console.log(`   Result buffer size: ${(result.data.length / 1024 / 1024).toFixed(2)} MB\n`);

        console.log('💾 Step 3: Saving output...\n');
    
        await sharp(result.data, {
            raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
        })
        .jpeg({ quality: 90 })
        .toFile('./output-cpp-addon.jpg');
    
        console.log('   ✅ Saved to: output-cpp-addon.jpg\n');
    } catch(error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

main();