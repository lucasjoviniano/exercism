fn is_prime(n: u32) -> bool {
    let s = (n as f32).sqrt() as u32;
    !(2..s + 1).any(|i| n % i == 0)
}

pub fn nth(n: u32) -> u32 {
    match n {
        0 => 2,
        n => (1..)
             .filter(|num| is_prime(*num))
             .nth((n + 1) as usize)
             .unwrap()
    }
}
