pub fn is_armstrong_number(num: u32) -> bool {
    let p = num.to_string().len() as u32;
    num.to_string()
        .chars()
        .into_iter()
        .map(|c| c.to_digit(10).unwrap())
        .map(|c| c.pow(p))
        .fold(0, |acc, n| acc + n)
        == num
}
