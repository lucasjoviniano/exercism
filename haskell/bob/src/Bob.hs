module Bob (responseFor) where

import Data.Char (isAlpha, toUpper)
import Data.List ()

isYelling :: String -> Bool
isYelling message = [toUpper m | m <- message, isAlpha m] == message

responseFor :: String -> String
responseFor x
  | isYelling = "Whoa, chill out!"
  | otherwise = "Whatever."