module RolePlayingGame exposing (Player, castSpell, introduce, revive)


type alias Player =
    { name : Maybe String
    , level : Int
    , health : Int
    , mana : Maybe Int
    }


introduce : Player -> String
introduce { name } =
    case name of
        Just n ->
            n

        Nothing ->
            "Mighty Magician"


revive : Player -> Maybe Player
revive player =
    let
        newMana =
            if player.level >= 10 then
                Just 100

            else
                Nothing
    in
    case player.health of
        0 ->
            Just { player | health = 100, mana = newMana }

        _ ->
            Nothing


castSpell : Int -> Player -> ( Player, Int )
castSpell manaCost player =
    let
        manaDiff =
            Maybe.withDefault 0 player.mana - manaCost

        newMana =
            if manaDiff > 0 then
                Just manaDiff

            else
                Nothing

        healthDiff =
            player.health - manaCost

        newHealth =
            if healthDiff > 0 then
                healthDiff

            else
                0
    in
    case player.mana of
        Nothing ->
            ( { player | health = newHealth }, 0 )

        Just mana ->
            if mana < manaCost then
                ( player, 0 )

            else
                ( { player | mana = newMana }, manaCost * 2 )
