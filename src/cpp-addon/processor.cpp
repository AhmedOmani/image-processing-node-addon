// src/cpp-addon/processor.cpp
/**
 * C++ Image Processing Implementation
 * Same algorithms as JavaScript version, but in C++ for speed
 */

#include "processor.h"
#include <cmath>
#include <algorithm>
#include <cstring>
#include <stddef.h>

/**
 * Convert RGB image to grayscale using luminosity method
 * Formula: 0.299*R + 0.587*G + 0.114*B
 * 
 * @param input  - Input image buffer (RGBA format)
 * @param output - Output image buffer (RGBA format)
 * @param width  - Image width in pixels
 * @param height - Image height in pixels
 */
void ImageProcessor::toGrayscale(
    const uint8_t* input,
    uint8_t* output,
    int width,
    int height
) {
    // Total number of pixels
    int pixels = width * height;
    
    // Process each pixel
    // Note: We use a pointer approach for speed
    for (int i = 0; i < pixels; i++) {
        // Calculate offset in buffer (each pixel = 4 bytes: RGBA)
        int offset = i * 4;
        
        // Extract RGB values
        uint8_t r = input[offset];
        uint8_t g = input[offset + 1];
        uint8_t b = input[offset + 2];
        uint8_t a = input[offset + 3];
        
        // Calculate grayscale using luminosity method
        // This is optimized: using integer arithmetic instead of float
        // 0.299 ≈ 77/256, 0.587 ≈ 150/256, 0.114 ≈ 29/256
        uint8_t gray = static_cast<uint8_t>(
            (77 * r + 150 * g + 29 * b) >> 8  // Bit shift instead of division!
        );
        
        // Set output pixel (grayscale for RGB, keep alpha)
        output[offset]     = gray;
        output[offset + 1] = gray;
        output[offset + 2] = gray;
        output[offset + 3] = a;
    }
}


/**
 * Apply box blur filter
 * 
 * @param input  - Input image buffer (RGBA format)
 * @param output - Output image buffer (RGBA format)
 * @param width  - Image width in pixels
 * @param height - Image height in pixels
 * @param radius - Blur radius (higher = more blur)
 */
void ImageProcessor::applyBlur(
    const uint8_t* input,
    uint8_t* output,
    int width,
    int height,
    int radius
) {
    // For each pixel in the image
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            
            // Accumulators for each channel
            int r = 0, g = 0, b = 0, a = 0;
            int count = 0;
            
            // Iterate over blur kernel (box around current pixel)
            for (int ky = -radius; ky <= radius; ky++) {
                for (int kx = -radius; kx <= radius; kx++) {
                    
                    // Calculate neighbor pixel coordinates
                    int px = x + kx;
                    int py = y + ky;
                    
                    // Check if neighbor is within image bounds
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        // Calculate offset in buffer
                        int offset = (py * width + px) * 4;
                        
                        // Accumulate channel values
                        r += input[offset];
                        g += input[offset + 1];
                        b += input[offset + 2];
                        a += input[offset + 3];
                        count++;
                    }
                }
            }
            
            // Calculate output pixel offset
            int offset = (y * width + x) * 4;
            
            // Average the accumulated values
            output[offset]     = static_cast<uint8_t>(r / count);
            output[offset + 1] = static_cast<uint8_t>(g / count);
            output[offset + 2] = static_cast<uint8_t>(b / count);
            output[offset + 3] = static_cast<uint8_t>(a / count);
        }
    }
}

void ImageProcessor::process(const uint8_t* input,uint8_t* output,int width,int height,int blurRadius) {
    size_t bufferSize = width * height * 4;
    uint8_t* temp = new uint8_t[bufferSize];
    toGrayscale(input, temp, width, height);
    applyBlur(temp, output, width, height, blurRadius);
    delete[] temp;
}
