let isLeapYear = year => {
    let four = year mod 4 == 0
    let hundred = year mod 100 == 0
    let fourHundred = year mod 400 == 0

    fourHundred || four && !hundred
}