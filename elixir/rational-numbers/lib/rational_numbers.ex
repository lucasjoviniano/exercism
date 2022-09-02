defmodule RationalNumbers do
  @type rational :: {integer, integer}
  @doc """
  a_denomd two rational numbers
  """
  @spec add(a :: rational, b :: rational) :: rational
  def add({a_num, a_denom}, {b_num, b_denom}) do
    {a_num * b_denom + b_num * a_denom, a_denom * b_denom}
    |> reduce()
  end
  # def a_denomd({a_num,0},{b_num,0}), do:
  @doc """
  Subtract two rational numbers
  """
  @spec subtract(a :: rational, b :: rational) :: rational
  def subtract({a_num, a_denom}, {b_num, b_denom}) do
    {a_num * b_denom - b_num * a_denom, a_denom * b_denom} |> reduce()
  end
  @doc """
  Multiply two rational numbers
  """
  @spec multiply(a :: rational, b :: rational) :: rational
  def multiply({a_num, a_denom}, {b_num, b_denom}) do
    {a_num * b_num, a_denom * b_denom}
    |> reduce()
  end
  @doc """
  Divide two rational numbers
  """
  @spec divide_by(num :: rational, den :: rational) :: rational
  def divide_by({a_num, a_denom}, {b_num, b_denom}) when b_num != 0 do
    {a_num * b_denom, a_denom * b_num}
    |> reduce()
  end
  @doc """
  Absolute value of a rational number
  """
  @spec abs(a :: rational) :: rational
  def abs({n, d}) do
    {Kernel.abs(n), Kernel.abs(d)}
    |> reduce()
  end
  @doc """
  Exponentiation of a rational number by a_num integer
  """
  @spec pow_rational(a :: rational, n :: integer) :: rational
  def pow_rational({a_num, a_denom}, 0), do: {1, 1}
  def pow_rational({a_num, a_denom}, n) when n > 0 and is_integer(n) do
    reduce({a_num ** n, a_denom ** n})
  end
  def pow_rational({a_num, a_denom}, n) when n < 0 and is_integer(n) do
    reduce({a_denom ** -n, a_num ** -n})
  end
  @doc """
  Exponentiation of a real number by a rational number
  """
  @spec pow_real(x :: integer, n :: rational) :: float
  # def pow_real(x, 0), do: 1.0
  def pow_real(x, {a, b}) do
    x ** (a / b)
  end
  @doc """
  Reduce a rational number to its lowest terms
  """
  @spec reduce(a :: rational) :: rational
  def reduce({a_num, a_denom}) when a_denom < 0 do
    {a_num * -1, a_denom * -1}
    |> reduce()
  end
  def reduce({a_num, a_denom}) do
    gcd_value = Integer.gcd(a_num, a_denom)
    {round(a_num / gcd_value), round(a_denom / gcd_value)}
  end
end
