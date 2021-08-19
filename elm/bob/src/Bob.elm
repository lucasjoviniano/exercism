module Bob exposing (hey, isQuestion, isYelling)

import String exposing (isEmpty)


hey : String -> String
hey remark =
    let
        message =
            String.trim remark
    in
    if isYelling message && isQuestion message then
        "Calm down, I know what I'm doing!"

    else if isYelling message then
        "Whoa, chill out!"

    else if isQuestion message then
        "Sure."

    else if String.isEmpty message then
        "Fine. Be that way!"

    else
        "Whatever."


isQuestion : String -> Bool
isQuestion remark =
    String.endsWith "?" remark


isYelling : String -> Bool
isYelling remark =
    not (String.isEmpty remark) && String.toUpper remark == remark && String.toLower remark /= remark
