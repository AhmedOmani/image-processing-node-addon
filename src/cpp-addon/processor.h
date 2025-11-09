#include <cstdint>

class ImageProcessor {
public:
    static void toGrayscale(const uint8_t* input , uint8_t* output , int width , int height) ;
    static void applyBlur(const uint8_t* input , uint8_t *output , int width , int height , int raduis) ;
    static void process(const uint8_t* input , uint8_t* output , int width , int height , int blurRaduis) ;
};