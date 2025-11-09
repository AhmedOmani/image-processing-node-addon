const sharp = require("sharp");
const ImageProcessor = require("./processor");

const go = async () => {
    //read image.
    const decoded = await sharp("/home/hp/image-processing/images/test.jpg").rotate().toColourspace('srgb')    
    .ensureAlpha()            
    .raw()
    .toBuffer({ resolveWithObject: true });
    const {data: rgba , info: {width , height , channels} } = decoded;

    //process 
    const processor = new ImageProcessor();
    const {data: blurred} = processor.process(Buffer.from(rgba) , width , height , 5);

    // write jpeg / png
    await sharp(blurred , { raw: {width , height , channels : 4}}).png().toFile("output.png");
    await sharp(blurred , { raw: {width , height , channels : 4}}).jpeg({ quality: 90}).toFile("output.jpg");

    console.log("Process completed successfully...");
}

go().catch(console.error);