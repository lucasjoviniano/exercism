defmodule Bob do
  def hey(input) do
    input = String.trim(input)

    cond do
      yelling?(input) and question?(input) -> "Calm down, I know what I'm doing!"
      yelling?(input) -> "Whoa, chill out!"
      question?(input) -> "Sure."
      silent?(input) -> "Fine. Be that way!"
      true -> "Whatever."
    end
  end

  def yelling?(input) do
    not silent?(input) and input == String.upcase(input) and input != String.downcase (input)
  end

  def question?(input) do
    String.last(input) == "?"
  end

  def silent?(input) do
    input == ""
  end
end
