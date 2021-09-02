class AssemblyLine
  CARS_PER_HOUR = 221

  def initialize(speed)
    @speed = speed
  end

  def production_rate_per_hour
    vel = @speed * CARS_PER_HOUR
    case @speed
    when 1..4
      vel
    when 5..8
      (vel * 0.9)
    when 9
      (vel * 0.8)
    when 10
      (vel * 0.77)
    end
  end

  def working_items_per_minute
    production_rate_per_hour.to_i / 60
  end
end
