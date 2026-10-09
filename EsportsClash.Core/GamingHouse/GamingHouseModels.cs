using EsportsClash.Core.Models;

namespace EsportsClash.Core.GamingHouse;

public enum FacilityType
{
    PCScrimRoom,
    StrategyVodRoom,
    GymWellness,
    StreamingStudio,
    KitchenCafeteria,
    Bedrooms
}

public enum DailyActivity
{
    ScrimSession,         // +Mechanics XP, +Synergy, +Fatigue
    VodReview,            // +Macro IQ XP, slight fatigue
    GymWorkout,           // -Fatigue accumulation rate, +Stamina, +Morale
    StreamLive,           // +Cash & Hype, +Morale (or tilt if failed)
    RestAndSleep,         // -Fatigue, +Energy recovery
    TeamBuildingDinner    // +Chemistry Bond, +Morale
}

public class Facility
{
    public FacilityType Type { get; set; }
    public string Name { get; set; }
    public int Level { get; set; } = 1;
    public int MaxLevel { get; set; } = 5;
    public int UpgradeCost => Level * 1000;

    public Facility(FacilityType type, string name)
    {
        Type = type;
        Name = name;
    }

    public bool Upgrade(ref int teamFunds, out string message)
    {
        if (Level >= MaxLevel)
        {
            message = $"{Name} is already at Max Level ({MaxLevel})!";
            return false;
        }

        if (teamFunds < UpgradeCost)
        {
            message = $"Insufficient funds! Need {UpgradeCost} coins (Have: {teamFunds}).";
            return false;
        }

        teamFunds -= UpgradeCost;
        Level++;
        message = $"🔨 Upgraded {Name} to Level {Level}!";
        return true;
    }
}

public class GamingHouseState
{
    public string HouseName { get; set; } = "GOAT Gaming Mansion";
    public int TeamFunds { get; set; } = 2500;
    public int FansCount { get; set; } = 1000;
    public int Day { get; set; } = 1;
    public Dictionary<FacilityType, Facility> Facilities { get; set; } = new();

    public GamingHouseState()
    {
        Facilities[FacilityType.PCScrimRoom] = new Facility(FacilityType.PCScrimRoom, "High-End Scrim Battle-Station");
        Facilities[FacilityType.StrategyVodRoom] = new Facility(FacilityType.StrategyVodRoom, "Tactical VOD & Playbook Room");
        Facilities[FacilityType.GymWellness] = new Facility(FacilityType.GymWellness, "Ergonomic Gym & Physio Studio");
        Facilities[FacilityType.StreamingStudio] = new Facility(FacilityType.StreamingStudio, "RGB Creator Studio");
        Facilities[FacilityType.KitchenCafeteria] = new Facility(FacilityType.KitchenCafeteria, "Chef-Catered Gourmet Kitchen");
        Facilities[FacilityType.Bedrooms] = new Facility(FacilityType.Bedrooms, "Luxury Soundproof Sleep Pods");
    }
}

