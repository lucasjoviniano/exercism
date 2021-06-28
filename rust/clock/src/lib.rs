use core::fmt;

#[derive(Eq, PartialEq, Debug)]
pub struct Clock {
    minutes: i32,
}

impl fmt::Display for Clock {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let hour = self.minutes / 60;
        let mins = self.minutes % 60;
        write!(f, "{:02}:{:02}", hour, mins)
    }
}

impl Clock {
    pub fn new(hours: i32, minutes: i32) -> Self {
        Clock::create(hours * 60 + minutes)
    }

    fn create(minutes: i32) -> Self {
        let mut mins = minutes;
        while mins < 0 {
            mins += 1440;
        }

        Clock {
            minutes: mins % 1440,
        }
    }

    pub fn add_minutes(&self, minutes: i32) -> Self {
        Clock::create(self.minutes + minutes)
    }
}
