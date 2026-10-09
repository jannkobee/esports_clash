using EsportsClash.Core.Models;

namespace EsportsClash.Core.Gacha;

public enum PackType
{
    RookieScoutPack,
    GoldProPack,
    DiamondElitePack,
    GoatLegendaryPack
}

public class PackResult
{
    public PackType PackType { get; set; }
    public List<PlayerCard> DroppedPlayers { get; set; } = new();
    public CoachCard? DroppedCoach { get; set; }
    public int ConvertedCoins { get; set; }
    public int ConvertedEvoShards { get; set; }
    public bool TriggeredPity { get; set; }
    public string Summary { get; set; } = string.Empty;
}

public class GachaPityState
{
    public int PullsSinceLastPlatinum { get; set; } = 0;
    public int PullsSinceLastDiamond { get; set; } = 0;
    public int PullsSinceLastGoat { get; set; } = 0;
    public int TotalPulls { get; set; } = 0;

    // Daily Rewarded Ads
    public int DailyAdsWatchedToday { get; set; } = 0;
    public int DailyFreePacksClaimed { get; set; } = 0;
    public int DailyEnergyRefillsClaimed { get; set; } = 0;
}

