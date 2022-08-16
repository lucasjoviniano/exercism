class Lasagna
{
    public int ExpectedMinutesInOven()
    {
        return 40;
    }

    public int RemainingMinutesInOven(int passed)
    {
        return ExpectedMinutesInOven() - passed;
    }

    public int PreparationTimeInMinutes(int layers)
    {
        return layers * 2;
    }

    public int ElapsedTimeInMinutes(int layers, int passed)
    {
        return PreparationTimeInMinutes(layers) + passed;
    }
}
