module ValentinesDay exposing (..)

type Approval = Yes | No | Maybe

type Cuisine = Korean | Turkish

type Genre = Crime | Horror | Romance | Thriller

type Activity = BoardGame | Chill | Movie Genre | Restaurant Cuisine

rateActivity : Activity -> Approval
rateActivity activity =
    case activity of
        BoardGame ->
            No
        Chill ->
            No
        Movie genre ->
            if genre == Romance then Yes else No
        Restaurant cuisine ->
            if cuisine == Korean then Yes else Maybe
