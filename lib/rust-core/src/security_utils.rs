//! Security utilities for path validation and sanitization
//!
//! This module provides safe path handling to prevent directory traversal
//! and other file system security issues.

use napi_derive::napi;
use std::path::Path;

/// Path validation result
#[napi(object)]
#[derive(Debug, Clone)]
pub struct PathValidationResult {
    /// Whether the path is valid
    pub is_valid: bool,
    /// Sanitized path (if valid)
    pub sanitized_path: Option<String>,
    /// Error message (if invalid)
    pub error: Option<String>,
}

/// Security utilities
#[napi]
pub struct SecurityUtils;

#[napi]
impl SecurityUtils {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// Validate and sanitize file path
    #[napi]
    pub fn validate_path(
        &self,
        path: String,
        base_path: String,
    ) -> napi::Result<PathValidationResult> {
        let path_obj = Path::new(&path);
        let base = Path::new(&base_path);

        // Check for null bytes
        if path.contains('\0') {
            return Ok(PathValidationResult {
                is_valid: false,
                sanitized_path: None,
                error: Some("Path contains null bytes".to_string()),
            });
        }

        // Normalize the path
        let normalized = match path_obj.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                // If the path doesn't exist, try to normalize it manually
                let mut components = Vec::new();
                for component in path_obj.components() {
                    match component {
                        std::path::Component::ParentDir => {
                            components.pop();
                        }
                        std::path::Component::Normal(c) => {
                            components.push(c.to_string_lossy().to_string());
                        }
                        std::path::Component::RootDir => {
                            components.clear();
                        }
                        _ => {}
                    }
                }
                
                let joined = components.join("/");
                Path::new(&base_path).join(&joined)
            }
        };

        // Ensure the path is within the base path
        if !normalized.starts_with(&base) {
            return Ok(PathValidationResult {
                is_valid: false,
                sanitized_path: None,
                error: Some("Path traversal detected".to_string()),
            });
        }

        // Check for dangerous patterns
        let path_str = normalized.to_string_lossy();
        let dangerous_patterns = [
            "..",
            "~",
            "$",
            "|",
            ";",
            "&",
            ">",
            "<",
            "`",
            "\\",
        ];

        for pattern in &dangerous_patterns {
            if path_str.contains(pattern) {
                return Ok(PathValidationResult {
                    is_valid: false,
                    sanitized_path: None,
                    error: Some(format!("Dangerous pattern '{}' detected", pattern)),
                });
            }
        }

        Ok(PathValidationResult {
            is_valid: true,
            sanitized_path: Some(normalized.to_string_lossy().to_string()),
            error: None,
        })
    }

    /// Sanitize filename by removing dangerous characters
    #[napi]
    pub fn sanitize_filename(&self, filename: String) -> napi::Result<String> {
        let dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        let mut sanitized = filename;

        for ch in &dangerous_chars {
            sanitized = sanitized.replace(*ch, "_");
        }

        // Remove leading/trailing dots and spaces
        sanitized = sanitized.trim_matches('.').trim_matches(' ').to_string();

        // Ensure the filename is not empty
        if sanitized.is_empty() {
            sanitized = "unnamed".to_string();
        }

        Ok(sanitized)
    }
}

/// Quick path validation function
#[napi]
pub fn quick_validate_path(path: String, base_path: String) -> napi::Result<bool> {
    let utils = SecurityUtils::new();
    let result = utils.validate_path(path, base_path)?;
    Ok(result.is_valid)
}