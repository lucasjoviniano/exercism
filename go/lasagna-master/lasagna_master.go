package lasagna

func PreparationTime(layers []string, prepTime int) int {
	if prepTime == 0 {
		return len(layers) * 2
	}

	return len(layers) * prepTime
}

func Quantities(layers []string) (int, float64) {
	noodleBase := 50
	sauceBase := 0.2
	var noodles int
	var sauce float64

	for _, v := range layers {
		if v == "noodles" {
			noodles += noodleBase
		} else if v == "sauce" {
			sauce += sauceBase
		}
	}

	return noodles, sauce
}

func AddSecretIngredient(friend, mine []string) {
	mine[len(mine)-1] = friend[len(friend)-1]
}

func ScaleRecipe(quantities []float64, portions int) []float64 {
	var result []float64
	result = append(result, quantities...)

	for i:= 0; i < len(quantities); i++ {
		result[i] *= float64(portions) / 2.0
	}
	
	return result 
}
