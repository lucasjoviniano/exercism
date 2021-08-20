module Leap exposing (isLeapYear)


isLeapYear : Int -> Bool
isLeapYear year =
    ((year |> modBy 4 >> (==) 0) && (year |> modBy 100 >> (/=) 0)) || (year |> modBy 400 >> (==) 0)
