pub fn square(s: u32) -> u64 {
    if s < 1 || s > 64 {
        panic!("Square must be between 1 and 64")
    }
    u64::pow(2, s - 1)
}

pub fn total() -> u64 {
    (1..=64).collect::<Vec<u32>>().into_iter().map(|s| square(s)).fold(0, |acc, s| acc + s)
}
