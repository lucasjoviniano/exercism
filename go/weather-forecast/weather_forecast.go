// Package weather provides a way to get the weather of a certain location.
package weather

// CurrentCondition: The current weather condition.
var CurrentCondition string

// CurrentLocation: the current location to forecast.
var CurrentLocation string

// Forecast the weather for a given location and condition.
func Forecast(city, condition string) string {
	CurrentLocation, CurrentCondition = city, condition
	return CurrentLocation + " - current weather condition: " + CurrentCondition
}
