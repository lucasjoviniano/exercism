class Luhn
  def self.valid?(id_number)
    new(id_number).valid?
  end

  private

  attr_reader :number

  def initialize(id_number)
    @number = prepare(id_number)
  end

  def prepare(id_number)
    id_number.delete(' ').chars.map do |char|
      Integer(char)
    end
  rescue ArgumentError
    []
  end

  def long_enough?
    number.size > 1
  end

  def double_second_digits
    number.map(&:to_i)
          .reverse
          .each_slice(2)
          .sum { |a, b = 0| a + double_and_cap(b) }
  end

  def double_and_cap(digit)
    doubled = digit * 2
    doubled <= 9 && doubled || doubled - 9
  end

  public

  def valid?
    long_enough? && (double_second_digits % 10).zero?
  end
end
