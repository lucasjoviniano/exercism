pub fn factors(n: u64) -> Vec<u64> {
    let mut v: Vec<u64> = vec![];
    let mut c = 2;
    let mut m = n;

    while m > 1 {
        while m % c == 0 {
            v.push(c);
            m /= c;
        }

        c += 1;
    }

    v
}
