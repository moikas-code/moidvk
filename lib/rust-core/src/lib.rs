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

// Export the main initialization function
#[napi]
pub fn initialize_rust_core() -> napi::Result<String> {
    Ok("MOIDVK Rust core initialized successfully".to_string())
}

#[napi]
pub fn get_version() -> napi::Result<String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[napi]
pub fn get_performance_info() -> napi::Result<String> {
    let info = serde_json::json!({
        "simd_support": is_x86_feature_detected!("avx2"),
        "parallel_threads": rayon::current_num_threads(),
        "allocator": "mimalloc",
        "optimization_level": if cfg!(debug_assertions) { "debug" } else { "release" }
    });
    Ok(info.to_string())
}