// Example Rust code to test MOIDVK Rust tools

use std::fs::File;
use std::io::Read;

// Example with potential issues for testing
fn main() {
    // Unwrap that could panic
    let file = File::open("test.txt").unwrap();
    
    // Missing error handling
    let result = divide(10, 0);
    println!("Result: {}", result);
    
    // Unsafe code block
    unsafe {
        let x = 5;
        let raw_ptr = &x as *const i32;
        println!("Value: {}", *raw_ptr);
    }
    
    // TODO: Implement proper error handling
    process_data();
}

fn divide(a: i32, b: i32) -> i32 {
    a / b  // No check for division by zero
}

fn process_data() {
    let data = vec![1, 2, 3, 4, 5];
    
    // Potential panic with expect
    let first = data.get(0).expect("No data!");
    
    // Using panic! macro
    if data.len() < 10 {
        panic!("Not enough data!");
    }
}

// Function with multiple references without explicit lifetimes
fn compare_strings(s1: &str, s2: &str) -> &str {
    if s1.len() > s2.len() {
        s1
    } else {
        s2
    }
}

// Static mutable variable (unsafe)
static mut COUNTER: i32 = 0;

fn increment_counter() {
    unsafe {
        COUNTER += 1;
    }
}

// Recursive function without clear termination
fn factorial(n: u64) -> u64 {
    if n == 0 {
        1
    } else {
        n * factorial(n - 1)
    }
}

// Integer overflow example
fn calculate_sum() -> u8 {
    let a: u8 = 200;
    let b: u8 = 100;
    a + b  // This will overflow!
}