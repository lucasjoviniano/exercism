defmodule Lasagna do
  @spec expected_minutes_in_oven :: 40
  def expected_minutes_in_oven, do: 40

  @spec remaining_minutes_in_oven(number) :: number
  def remaining_minutes_in_oven(input), do: expected_minutes_in_oven() - input

  @spec preparation_time_in_minutes(number) :: number
  def preparation_time_in_minutes(layers), do:  2 * layers

  @spec total_time_in_minutes(number, number) :: number
  def total_time_in_minutes(layers, minutes), do: minutes + preparation_time_in_minutes(layers)

  @spec alarm() :: String
  def alarm, do: "Ding!"
end
