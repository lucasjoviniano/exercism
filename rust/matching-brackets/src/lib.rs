pub fn brackets_are_balanced(string: &str) -> bool {
    let mut brackets: Vec<String> = Vec::new();

    for i in string.chars() {
        match i {
            '(' | '[' | '{' => {
                brackets.push(i.to_string());
            }
            '}' => {
                if brackets.pop() != Some("{".to_string()) {
                    return false;
                }
            }
            ']' => {
                if brackets.pop() != Some("[".to_string()) {
                    return false;
                }
            }

            ')' => {
                if brackets.pop() != Some("(".to_string()) {
                    return false;
                }
            }

            _ => {}
        }
    }

    brackets.is_empty()
}
