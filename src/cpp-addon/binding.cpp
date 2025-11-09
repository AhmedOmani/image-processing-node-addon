
#include <node_api.h>
#include "processor.h"
#include <chrono>
#include <iostream>

#define NAPI_CALL(env, call)                                      \
  do {                                                            \
    napi_status status = (call);                                   \
    if (status != napi_ok) {                                       \
        const napi_extended_error_info* info;                        \
        napi_get_last_error_info((env), &info);                      \
        const char* msg = info && info->error_message ? info->error_message : "N-API call failed"; \
        napi_throw_error((env), nullptr, msg);                       \
        return nullptr;                                              \
    }                                                                          \
  } while(0)

napi_value ProcessImage(napi_env env , napi_callback_info info) {
    // ================================================================
    // STEP 1: Extract arguments from JavaScript
    // ================================================================
        size_t argc = 4 ;
        napi_value args[4];
        NAPI_CALL(env , napi_get_cb_info(env , info , &argc , args , nullptr , nullptr));
        if (argc < 3) {
            napi_throw_error(env , nullptr , "Expected at least 3 arguments: processImage(buffer, width, height, [blurRadius])");
            return nullptr;
        }
    // ================================================================
    // STEP 2: Extract Buffer (image data)
    // ================================================================
        uint8_t* inputData;
        size_t inputLength;
        NAPI_CALL(env, napi_get_buffer_info(env , args[0] , reinterpret_cast<void**>(&inputData) , &inputLength));
    // ================================================================
    // STEP 3: Extract width (number)
    // ================================================================
        int32_t width ;
        NAPI_CALL(env , napi_get_value_int32(env , args[1] , &width));
    // ================================================================
    // STEP 4: Extract height (number)
    // ================================================================
        int32_t height ;
        NAPI_CALL(env, napi_get_value_int32(env, args[2] , &height));
    // ================================================================
    // STEP 5: Extract blur radius (optional, default = 5)
    // ================================================================
        int32_t blurRadius = 5;
        if (argc >= 4) {
            NAPI_CALL(env, napi_get_value_int32(env , args[3] , &blurRadius));
        }
    // ================================================================
    // STEP 6: Validate inputs
    // ================================================================
        size_t expectedSize = width * height * 4 ;
        if (inputLength != expectedSize) {
            napi_throw_error(env , nullptr, "Buffer size mismatch: expected width * height * 4 bytes");
            return nullptr;
        }
        if (width <= 0 || height <= 0) {
            napi_throw_error(env, nullptr, "Width and height must be positive");
            return nullptr;
        }
        if (blurRadius < 1 || blurRadius > 50) {
            napi_throw_error(env, nullptr, "Blur radius must be between 1 and 50");
            return nullptr;
        }
        // ================================================================
        // STEP 7: Allocate output buffer
        // ================================================================
        napi_value outputBuffer ;
        uint8_t* outputData;
        NAPI_CALL(env , napi_create_buffer(env , inputLength , reinterpret_cast<void**>(&outputData) , &outputBuffer));

    // ================================================================
    // STEP 8: Process image (THE ACTUAL C++ WORK!)
    // ================================================================
        std::cout << "[C++ Addon] Processing " << width << "x" << height << " image (blur radius: " << blurRadius << ")..." << std::endl;

        auto start = std::chrono::high_resolution_clock::now();
        ImageProcessor::process(inputData , outputData , width , height , blurRadius);
        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
        
        std::cout << "[C++ Addon] Completed in " << duration.count() << "ms" << std::endl;

    // ================================================================
    // STEP 9: Create return object { data: Buffer, duration: number }
    // ================================================================
        napi_value result;
        NAPI_CALL(env , napi_create_object(env , &result));
        NAPI_CALL(env , napi_set_named_property(env, result, "data" , outputBuffer));
        
        napi_value durationValue ;
        NAPI_CALL(env, napi_create_int64(env, duration.count(), &durationValue));
        NAPI_CALL(env, napi_set_named_property(env, result, "duration", durationValue));
        
    // ================================================================
    // STEP 10: Return result to JavaScript
    // ================================================================
        return result;
}


napi_value Init(napi_env env , napi_value exports) {
    std::cout << "[C++ Addon] Initializing..." << std::endl;
    napi_value processImagFn;
    NAPI_CALL(env , napi_create_function(env , "processImage" , NAPI_AUTO_LENGTH, ProcessImage, nullptr , &processImagFn));
    NAPI_CALL(env , napi_set_named_property(env , exports , "processImage" , processImagFn));   
    std::cout << "[C++ Addon] Ready! Export: processImage(buffer, width, height, blurRadius)" << std::endl;
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME , Init);
