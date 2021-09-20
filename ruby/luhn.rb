class Luhn
  def self.valid?(input)
    new(input).valid?
  end

  def valid?
    check_format && (double_seconds.sum % 10).zero?
  end

  def check_format
    !(@digits.join.gsub(/[^\d\s]/).to_a.size.positive? || @digits.size <= 1)
  end

  def initialize(input)
    @digits = input.delete(' ').chars
  end

  def double_seconds
    @digits.map(&:to_i)
           .map.with_index { |num, index| index.even? == @digits.length.even? ? num * 2 : num }
           .map { |num| num > 9 ? num - 9 : num }
  end
end
