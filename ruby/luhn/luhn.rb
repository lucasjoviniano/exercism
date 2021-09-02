class Luhn
  def self.valid?(input)
    digits = input.scan(/\d/).map(&:to_i)
    return false if input.gsub(/[^\d\s]/).to_a.size.positive? || digits.size <= 1

    soma = digits.map.with_index { |num, index| index.even? == digits.length.even? ? num * 2 : num }
                 .map { |num| num > 9 ? num - 9 : num }
                 .sum
    (soma % 10).zero?
  end
end
