class SimpleCalculator
  ALLOWED_OPERATIONS = ['+', '/', '*'].freeze

  def self.calculate(first_operand, second_operand, operation)
    raise UnsupportedOperation unless ALLOWED_OPERATIONS.include?(operation)

    "#{first_operand} #{operation} #{second_operand} = #{first_operand.send(operation, second)}"
  rescue TypeError then raise ArgumentError
  rescue ZeroDivisionError then 'Division by zero is not allowed.'
  end

  class UnsupportedOperation < StandardError
  end
end
