{
  # binding.gyp - Build configuration for node-gyp
  # This file tells node-gyp how to compile your C++ addon
  
  "targets": [
    {
      # Name of the output file (will be addon.node)
      "target_name": "addon",
      
      # List of C++ source files to compile
      "sources": [
        "src/cpp-addon/binding.cpp",
        "src/cpp-addon/processor.cpp"
      ],
      
      # Include directories (where to find .h header files)
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      
      # Compiler settings
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      
      # Platform-specific settings
      "conditions": [
        # macOS settings
        ['OS=="mac"', {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.7",
            # Optimization flags
            "OTHER_CFLAGS": [
              "-O3",           # Maximum optimization
              "-march=native", # Use CPU-specific optimizations
              "-ffast-math"    # Fast math operations
            ]
          }
        }],
        
        # Windows settings
        ['OS=="win"', {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              # Optimization flags
              "Optimization": 2,              # /O2 - Maximum optimization
              "InlineFunctionExpansion": 2,   # Aggressive inlining
              "EnableIntrinsicFunctions": "true",
              "FavorSizeOrSpeed": 1           # Favor speed
            }
          }
        }],
        
        # Linux settings
        ['OS=="linux"', {
          "cflags_cc": [
            "-std=c++17",     # C++17 standard
            "-O3",            # Maximum optimization
            "-march=native",  # CPU-specific optimizations
            "-ffast-math",    # Fast math
            "-funroll-loops"  # Loop unrolling
          ]
        }]
      ],
      
      # Dependencies
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      
      # Defines
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ]
    }
  ]
}