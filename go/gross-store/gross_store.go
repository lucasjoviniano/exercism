package gross

// Units stores the Gross Store unit measurements.
func Units() map[string]int {
	return map[string]int {
		"quarter_of_a_dozen": 3,
		"half_of_a_dozen": 6,
		"dozen": 12,
		"small_gross": 120,
		"gross": 144,
		"great_gross": 1728,
	}
}

// NewBill creates a new bill.
func NewBill() map[string]int {
	return map[string]int{}
}

// AddItem adds an item to customer bill.
func AddItem(bill, units map[string]int, item, unit string) bool {
	added := false
	value, exists := units[unit]

	if exists {
		bill[item] += value
		added = true 
	}

	return added 
}

// RemoveItem removes an item from customer bill.
func RemoveItem(bill, units map[string]int, item, unit string) bool {
	removed := false
	value, exists := units[unit]
	billValue, billExists := bill[item]
	if billExists && exists && value <= billValue {
		bill[item] -= value
		if bill[item] == 0 {
			delete(bill, item)
		}
		removed = true
	}
	return removed
}

// GetItem returns the quantity of an item that the customer has in his/her bill.
func GetItem(bill map[string]int, item string) (int, bool) {
	value, exists := bill[item]
	return value, exists
}
