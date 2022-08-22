package thefarm

import (
	"fmt"
	"errors"
)

// See types.go for the types defined for this exercise.

// TODO: Define the SillyNephewError type here.
type SillyNephewError struct {
	cows int
}

func (e SillyNephewError) Error() string {
	return fmt.Sprintf("silly nephew, there cannot be %d cows", e.cows)
}

var (
	NilCowError = errors.New("division by zero")
	NegativeFodderError = errors.New("negative fodder")
)

// DivideFood computes the fodder amount per cow for the given cows.
func DivideFood(weightFodder WeightFodder, cows int) (float64, error) {
	if cows == 0 {
		return 0, NilCowError
	}

	fodder, err := weightFodder.FodderAmount()
	if err == ErrScaleMalfunction && fodder > 0 {
		return (2 * fodder) / float64(cows), nil
	}

	if fodder < 0 && (err == ErrScaleMalfunction || err == nil) {
		return 0, NegativeFodderError
	}

	if err != nil {
		return 0.0, err
	}

	if cows < 0 {
		return 0.0, SillyNephewError{cows: cows}
	}

	return fodder / float64(cows), nil
}
