defmodule RnaTranscription do

  @rna %{?A => ?U, ?C => ?G, ?G => ?C, ?T => ?A}
  @doc """
  Transcribes a character list representing DNA nucleotides to RNA

  ## Examples

  iex> RnaTranscription.to_rna('ACTG')
  'UGAC'
  """
  @spec to_rna([char]) :: [char]
  def to_rna(dna) do
    Enum.map(dna, &(@rna[&1]))
  end
end
