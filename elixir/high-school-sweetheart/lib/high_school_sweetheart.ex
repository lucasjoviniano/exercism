defmodule HighSchoolSweetheart do
  def first_letter(name) do
    name
    |> String.trim()
    |> String.first()
  end

  def initial(name) do
    name
    |> first_letter()
    |> String.upcase()
    |> Kernel.<>(".")
  end

  def initials(full_name) do
    [fst, snd] = String.split(full_name)

    initial(fst) <> " " <> initial(snd)
  end

  def pair(full_name1, full_name2) do
    fs = initials(full_name1)
    sn = initials(full_name2)
"""
     ******       ******
   **      **   **      **
 **         ** **         **
**            *            **
**                         **
**     #{fs}  +  #{sn}     **
 **                       **
   **                   **
     **               **
       **           **
         **       **
           **   **
             ***
              *
"""
  end
end
