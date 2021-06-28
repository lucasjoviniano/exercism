extern crate rand;
use num_bigint::ToBigUint;
use rand::Rng;

pub fn private_key(p: u64) -> u64 {
    rand::thread_rng().gen_range(2..p)
}

pub fn public_key(p: u64, g: u64, a: u64) -> u64 {
    let bg = g.to_biguint().unwrap();
    bg.modpow(&a.to_biguint().unwrap(), &p.to_biguint().unwrap())
        .to_u64_digits()
        .iter()
        .map(|x| x.to_string())
        .collect::<String>()
        .parse::<u64>()
        .unwrap()
}

pub fn secret(p: u64, b_pub: u64, a: u64) -> u64 {
    public_key(p, b_pub, a)
}
