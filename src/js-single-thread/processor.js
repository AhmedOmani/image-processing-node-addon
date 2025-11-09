const {performance} = require("perf_hooks");

class ImageProcessor {
    /**
    * @param {Buffer} - raw pixel data
    * @param {number} width - Image width
    * @param {number} height - Image height
    * @returns {Buffer} Grayscale image data
    */
    toGrayScale(imageData , width , height) {
        const pixels = width * height;
        const output = Buffer.alloc(imageData.length);

        for (let i = 0 ; i < pixels ; i++) {
            const offset = i * 4;
            const r = imageData[offset];
            const g = imageData[offset + 1];
            const b = imageData[offset + 2];
            const a = imageData[offset + 3];

            //Luminosity method -most accurate for human perception-
            const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);

            output[offset] = gray;
            output[offset + 1] = gray;
            output[offset + 2] = gray;
            output[offset + 3] = a; 
        }

        return output;
    }
    /*
    * @param {Buffer} imageData - Raw pixel data
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number} radius - Blur radius (default: 5)
   * @returns {Buffer} Blurred image data
   * */
    applyBlur(imageData , width , height , raduis = 5) {
        const output = Buffer.alloc(imageData.length);
        const diameter = raduis * 2 + 1;
        const kernelSize = diameter * diameter;

        for (let y = 0 ; y < height ; y++) {
            for (let x = 0 ; x < width ; x++) {
                let r = 0 , g = 0 , b = 0 , a = 0;
                let count = 0;

                for (let ky = -raduis ; ky <= raduis ; ky++) {
                    for (let kx = -raduis ; kx <= raduis ; kx++) {
                        const px = x + kx;
                        const py = y + ky;

                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            const offset = (py * width + px) * 4;
                            r += imageData[offset];
                            g += imageData[offset + 1];
                            b += imageData[offset + 2];
                            a += imageData[offset + 3];
                            count++;
                        }
                    }
                }

                const offset = (y * width + x) * 4 ;
                output[offset] = Math.floor(r / count);
                output[offset + 1] = Math.floor(g / count);
                output[offset + 2] = Math.floor(b / count);
                output[offset + 3] = Math.floor(a / count); 
            }
        }
        return output;
    }

    process(imageData , width , height , blurRaduis = 5) {
        console.log(`[Single Thread] processing ${width}x${height} image...`);
        const startTime = performance.now();
        
        const grayScale = this.toGrayScale(imageData , width , height);
        const blurred = this.applyBlur(grayScale , height , width , blurRaduis);
        
        const duration = (performance.now() - startTime) / 1000;
        console.log(`[Single Thread] Completed in ${duration}s`);
        return {data: blurred , duration};
    }
}

module.exports = ImageProcessor;