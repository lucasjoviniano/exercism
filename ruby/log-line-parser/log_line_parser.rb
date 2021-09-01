class LogLineParser
  def initialize(line)
    @line = line
    @parts = line.split(':').map(&:strip)
  end

  def message
    @parts[1]
  end

  def log_level
    @parts[0].tr('[]', '').downcase!
  end

  def reformat
    @parts[1] + " (#{log_level})"
  end
end
