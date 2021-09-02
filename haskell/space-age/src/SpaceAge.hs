module SpaceAge (Planet(..), ageOn) where

data Planet = Mercury
            | Venus
            | Earth
            | Mars
            | Jupiter
            | Saturn
            | Uranus
            | Neptune

ageOn :: Planet -> Float -> Float
ageOn planet seconds = case planet of
  Mercury -> earthYears / 0.2408467
  Venus -> earthYears / 0.61519726
  Earth -> earthYears
  Mars -> earthYears / 1.8808158
  Jupiter -> earthYears / 11.86215
  Saturn -> earthYears / 29.447498
  Uranus -> earthYears / 84.016846
  Neptune -> earthYears / 164.79132
  where earthYears = seconds / 31557600
