class BirdCount
  def self.last_week
    @week or [0, 2, 5, 3, 7, 8, 4]
  end

  def initialize(birds_per_day)
    @week = birds_per_day
  end

  def yesterday
    @week[-2]
  end

  def total
    @week.sum
  end

  def busy_days
    @week.count {|el| el >= 5}
  end

  def day_without_birds?
    @week.any? {|el| el == 0}
  end
end
