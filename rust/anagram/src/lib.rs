use std::collections::HashSet;

fn sort(word: &str) -> String {
    let mut letters = word.chars().collect::<Vec<char>>();

    letters.sort_unstable();

    letters.into_iter().collect()
}

pub fn anagrams_for<'a>(word: &str, possible_anagrams: &[&'a str]) -> HashSet<&'a str> {
    let lower = word.to_lowercase();
    let sorted = sort(&lower);

    possible_anagrams
        .iter()
        .filter(|input| {
            let i_lower = input.to_lowercase();
            lower != i_lower && sorted == sort(&i_lower)
        })
        .cloned()
        .collect()
}
