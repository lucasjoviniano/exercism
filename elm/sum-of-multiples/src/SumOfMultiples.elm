module SumOfMultiples exposing (sumOfMultiples)

import List exposing (range)


sumOfMultiples : List Int -> Int -> Int
sumOfMultiples divisors limit =
    range 1 (limit - 1) |> List.filter (isDivisible divisors) |> List.sum


isDivisible : List Int -> Int -> Bool
isDivisible divisors limit =
    List.filter (\d -> remainderBy d limit == 0) divisors |> List.isEmpty >> not
