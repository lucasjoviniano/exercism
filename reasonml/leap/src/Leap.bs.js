// Generated by BUCKLESCRIPT, PLEASE EDIT WITH CARE
'use strict';


function isLeapYear(year) {
  var four = year % 4 === 0;
  var hundred = year % 100 === 0;
  var fourHundred = year % 400 === 0;
  if (fourHundred) {
    return true;
  } else if (four) {
    return !hundred;
  } else {
    return false;
  }
}

exports.isLeapYear = isLeapYear;
/* No side effect */