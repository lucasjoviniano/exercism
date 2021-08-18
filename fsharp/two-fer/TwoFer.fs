module TwoFer

let rec twoFer (input: string option) : string =
    "One for "
    + (input |> Option.defaultValue "you")
    + ", one for me."
