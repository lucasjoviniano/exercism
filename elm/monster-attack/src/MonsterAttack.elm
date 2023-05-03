module MonsterAttack exposing (..)


type alias MonsterDamage =
    String


attackWithSword1 : MonsterDamage -> Int -> MonsterDamage
attackWithSword1 monsterDamage strength =
    monsterDamage ++ "Attacked with sword of strength " ++ String.fromInt strength ++ "."


attackWithClaw1 : MonsterDamage -> Int -> MonsterDamage
attackWithClaw1 monsterDamage strength =
    monsterDamage ++ "Attacked with claw of strength " ++ String.fromInt strength ++ "."


attack1 : MonsterDamage -> MonsterDamage
attack1 monsterDamage =
    let
        swordDamage =
            5

        clawDamage =
            1
    in
    String.concat
        [ attackWithSword1 monsterDamage swordDamage
        , attackWithClaw1 monsterDamage clawDamage
        , attackWithClaw1 monsterDamage clawDamage
        , attackWithSword1 monsterDamage swordDamage
        ]


attackWithSword2 : Int -> MonsterDamage -> MonsterDamage
attackWithSword2 strength monsterDamage =
    attackWithSword1 monsterDamage strength


attackWithClaw2 : Int -> MonsterDamage -> MonsterDamage
attackWithClaw2 strength monsterDamage =
    attackWithClaw1 monsterDamage strength


attack2 : MonsterDamage -> MonsterDamage
attack2 monsterDamage =
    let
        swordDamage =
            5

        clawDamage =
            1
    in
    monsterDamage
        |> attackWithSword2 swordDamage
        |> attackWithClaw2 clawDamage
        |> attackWithClaw2 clawDamage
        |> attackWithSword2 swordDamage


attack3 : MonsterDamage -> MonsterDamage
attack3 =
    let
        swordAttack =
            attackWithSword2 5

        clawAttack =
            attackWithClaw2 1
    in
    swordAttack >> clawAttack >> clawAttack >> swordAttack
