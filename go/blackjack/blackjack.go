package blackjack

// ParseCard returns the integer value of a card following blackjack ruleset.
func ParseCard(card string) int {
	switch card {
		case "ace":
			return 11
		case "two":
			return 2
		case "three":
			return 3
		case "four":
			return 4
		case "five":
			return 5
		case "six":
			return 6
		case "seven":
			return 7
		case "eight":
			return 8
		case "nine": 
			return 9
		case "ten":
			return 10
		case "jack":
			return 10
		case "queen":
			return 10
		case "king":
			return 10
		default:
			return 0
	}
}

// FirstTurn returns the decision for the first turn, given two cards of the
// player and one card of the dealer.
func FirstTurn(card1, card2, dealerCard string) string {
	cardsSum := ParseCard(card1) + ParseCard(card2)
	dealerValue := ParseCard(dealerCard)
	var action string

	switch {
		case cardsSum > 21:
			action = "P"
		case cardsSum == 21 &&dealerValue != 11 && dealerValue != 10:
			action = "W"
		case cardsSum == 21 && (dealerValue == 11 || dealerValue == 10):
			action = "S"
		case cardsSum >= 17 && cardsSum <= 20:
			action = "S"
		case cardsSum >= 12 && cardsSum <= 16 && dealerValue < 7:
			action = "S"
		case cardsSum >= 12 && cardsSum<= 16 && dealerValue >= 7:
			action = "H"
		case cardsSum <= 11:
			action = "H"
	}

	return action
}
