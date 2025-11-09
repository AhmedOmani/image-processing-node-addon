// worker.js
const { parentPort } = require("worker_threads");
const ImageProcessor = require("./processor");

const proc = new ImageProcessor();

parentPort.on("message", (msg) => {
  const {
    buffer,           
    width,            
    subHeight,        
    coreYOffset,      
    coreHeight,       
    radius,           
  } = msg;

  const subImage = Buffer.from(buffer); 

  const gray = proc.toGrayScale(subImage, width, subHeight);

  const blurred = proc.applyBlur(gray, width, subHeight, radius);

  const bpr = width * 4;
  const coreBuf = Buffer.alloc(coreHeight * bpr);
  const srcStart = coreYOffset * bpr;
  blurred.copy(coreBuf, 0, srcStart, srcStart + coreBuf.length);

  parentPort.postMessage({ part: coreBuf.buffer }, [coreBuf.buffer]);
});
