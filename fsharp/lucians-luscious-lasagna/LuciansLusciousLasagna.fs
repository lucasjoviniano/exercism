module LuciansLusciousLasagna

// TODO: define the 'expectedMinutesInOven' binding
let expectedMinutesInOven: int = 40

// TODO: define the 'remainingMinutesInOven' function
let remainingMinutesInOven (minutes: int): int = expectedMinutesInOven - minutes

// TODO: define the 'preparationTimeInMinutes' function
let preparationTimeInMinutes (layers: int): int = layers * 2

// TODO: define the 'elapsedTimeInMinutes' function
let elapsedTimeInMinutes (layers: int) (minutes: int): int = preparationTimeInMinutes layers + minutes