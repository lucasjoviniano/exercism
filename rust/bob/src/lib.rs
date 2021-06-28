pub fn reply(message: &str) -> &str {
    if is_yelling(&message) && is_question(&message) {
        return "Calm down, I know what I'm doing!";
    } else if is_question(&message) {
        return "Sure.";
    } else if is_yelling(&message) {
        return "Whoa, chill out!";
    } else if is_silent(&message) {
        return "Fine. Be that way!";
    }

    "Whatever."
}

fn is_yelling(message: &str) -> bool {
    let chars = message.trim_matches(|c: char| !c.is_alphabetic());
    !chars.is_empty() && chars.to_uppercase() == chars
}

fn is_question(message: &str) -> bool {
    message.trim_end().ends_with("?")
}

fn is_silent(message: &str) -> bool {
    message.trim().is_empty()
}
