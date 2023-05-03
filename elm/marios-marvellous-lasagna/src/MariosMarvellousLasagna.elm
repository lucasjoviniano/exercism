module MariosMarvellousLasagna exposing (remainingTimeInMinutes)

remainingTimeInMinutes : Int -> Int -> Int
remainingTimeInMinutes layers minutes = 
    let
        expectedMinutesInOven = 40
        preparationTimeInMinutes min = min * 2
    in 
        preparationTimeInMinutes layers + expectedMinutesInOven - minutes
