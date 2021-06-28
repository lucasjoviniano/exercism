fn collatz_helper(n: u64) -> u64 {
    if n == 1 {
        0u64
    } else {
        1u64 + match n % 2 {
            0 => collatz_helper(n / 2),
            _ => collatz_helper(3 * n + 1),
        }
    }
}

pub fn collatz(n: u64) -> Option<u64> {
    if n < 1 {
        None
    } else {
        Some(collatz_helper(n))
    }
}
