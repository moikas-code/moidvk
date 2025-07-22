//! MOIDVK Core - High-performance Rust modules for development tools
//!
//! This crate provides performance-critical operations for the MOIDVK project:
//! - Vector operations and similarity calculations
//! - Fast file system operations and search
//! - Text processing and pattern matching
//! - Security utilities and path validation

#![deny(clippy::all)]
#![warn(missing_docs)]

use napi_derive::napi;

// Re-export all modules for Node.js
pub mod vector_ops;
pub mod file_search;
pub mod text_processing;
pub mod security_utils;
pub mod benchmarks;

/// Initialize the MOIDVK Rust core module
/// 
/// Returns a success message indicating the core has been initialized
#[napi]
pub fn initialize_rust_core() -> napi::Result<String> {
    Ok("MOIDVK Rust core initialized successfully".to_string())
}

/// Get the version of the MOIDVK core crate
/// 
/// Returns the version string from Cargo.toml
#[napi]
pub fn get_version() -> napi::Result<String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// Get performance information about the Rust runtime
/// 
/// Returns JSON string with SIMD support, thread count, allocator info, etc.
#[napi]
pub fn get_performance_info() -> napi::Result<String> {
    let simd_support = {
        #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
        {
            is_x86_feature_detected!("avx2")
        }
        #[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
        {
            false
        }
    };
    
    let info = serde_json::json!({
        "simd_support": simd_support,
        "parallel_threads": rayon::current_num_threads(),
        "allocator": "mimalloc",
        "optimization_level": if cfg!(debug_assertions) { "debug" } else { "release" }
    });
    Ok(info.to_string())
}