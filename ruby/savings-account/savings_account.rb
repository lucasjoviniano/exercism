module SavingsAccount

  def self.interest_rate(balance)
    if balance.negative?
      -3.213
    elsif balance < 1000
      0.5
    elsif balance < 5000
      1.621
    else
      2.475
    end
  end

  def self.annual_balance_update(balance)
    rate = balance.abs * (interest_rate(balance) / 100)
    balance + rate
  end

  def self.years_before_desired_balance(current_balance, desired_balance)
    # The producde method doesn't work on Exercism because it uses Ruby 2.6
    Enumerator.produce(current_balance) { |curr| annual_balance_update(curr)} .take_while { |curr| curr < desired_balance} .count
  end
end
