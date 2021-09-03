import java.util.stream.IntStream;

public class CarsAssemble {

    private static final int CARS_PER_HOUR = 221;

    private double getProduction(int speed, double rate) {
        return CARS_PER_HOUR * speed * rate;
    }

    public double productionRatePerHour(int speed) {
        if (IntStream.rangeClosed(1, 4).anyMatch(n -> n == speed)) {
            return getProduction(speed, 1);
        }

        if (IntStream.rangeClosed(5, 8).anyMatch(n -> n == speed)) {
            return getProduction(speed, 0.9);
        }

        if (speed == 9) {
            return getProduction(speed, 0.8);
        }

        return getProduction(speed, 0.77);

    }

    public int workingItemsPerMinute(int speed) {
        return ((int) productionRatePerHour(speed)) / 60;
    }
}
