defmodule HighScore do

  @default_score 0

  def new() do
    Map.new()
  end

  def add_player(scores, name, score \\ @default_score) do
    Map.put(scores, name, score)
  end

  def remove_player(scores, name) do
    Map.delete(scores, name)
  end

  def reset_score(scores, name) do
    Map.update(scores, name, @default_score, fn _ -> 0 end)
  end

  def update_score(scores, name, score) do
    Map.update(scores, name, score, fn old -> old + score end)
  end

  def get_players(scores) do
    Map.keys(scores)
  end
end