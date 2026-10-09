using EsportsClash.Core.Models;

namespace EsportsClash.Core.Evolutions;

public enum ObjectiveType
{
    WinMatches,
    ScoreKills,
    ScoreAssists,
    PlayMatchesWithChampion,
    MaintainHighMoraleSplits,
    WinSeriesWithoutTilt
}

public class EvolutionObjective
{
    public ObjectiveType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public int TargetAmount { get; set; }
    public string? Parameter { get; set; } // e.g. Champion name "Kyumi"

    public EvolutionObjective(ObjectiveType type, string description, int targetAmount, string? parameter = null)
    {
        Type = type;
        Description = description;
        TargetAmount = targetAmount;
        Parameter = parameter;
    }
}

public class EvolutionPlan
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public CardTier MaxAllowedTier { get; set; }
    public int MaxAllowedOvr { get; set; }
    public int CoinCost { get; set; }
    public List<EvolutionObjective> Objectives { get; set; } = new();

    // Reward on completion
    public CardTier TargetTier { get; set; }
    public PlayerAttributes StatBoost { get; set; }
    public PlaystyleBadge? UnlockedBadge { get; set; }

    public EvolutionPlan(
        string id,
        string name,
        string description,
        CardTier maxTier,
        int maxOvr,
        int coinCost,
        List<EvolutionObjective> objectives,
        CardTier targetTier,
        PlayerAttributes statBoost,
        PlaystyleBadge? unlockedBadge = null)
    {
        Id = id;
        Name = name;
        Description = description;
        MaxAllowedTier = maxTier;
        MaxAllowedOvr = maxOvr;
        CoinCost = coinCost;
        Objectives = objectives;
        TargetTier = targetTier;
        StatBoost = statBoost;
        UnlockedBadge = unlockedBadge;
    }

    public bool CanEvolve(PlayerCard card)
    {
        return card.Tier <= MaxAllowedTier && card.OverallRating <= MaxAllowedOvr;
    }
}

public class ActiveEvolution
{
    public string PlayerCardId { get; set; }
    public EvolutionPlan Plan { get; set; }
    public Dictionary<int, int> ObjectiveProgress { get; set; } = new();

    public ActiveEvolution(string cardId, EvolutionPlan plan)
    {
        PlayerCardId = cardId;
        Plan = plan;
        for (int i = 0; i < plan.Objectives.Count; i++)
        {
            ObjectiveProgress[i] = 0;
        }
    }

    public bool IsComplete => Plan.Objectives.Select((obj, idx) => ObjectiveProgress[idx] >= obj.TargetAmount).All(x => x);

    public void RecordProgress(ObjectiveType type, int amount, string? param = null)
    {
        for (int i = 0; i < Plan.Objectives.Count; i++)
        {
            var obj = Plan.Objectives[i];
            if (obj.Type == type)
            {
                if (string.IsNullOrEmpty(obj.Parameter) || string.Equals(obj.Parameter, param, StringComparison.OrdinalIgnoreCase))
                {
                    ObjectiveProgress[i] = Math.Min(obj.TargetAmount, ObjectiveProgress[i] + amount);
                }
            }
        }
    }
}

