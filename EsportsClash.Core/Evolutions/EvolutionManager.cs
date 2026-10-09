using EsportsClash.Core.Models;

namespace EsportsClash.Core.Evolutions;

public class EvolutionManager
{
    private readonly List<EvolutionPlan> _availablePlans = new();
    private readonly Dictionary<string, ActiveEvolution> _activeEvolutions = new(); // cardId -> ActiveEvolution

    public IReadOnlyList<EvolutionPlan> AvailablePlans => _availablePlans.AsReadOnly();
    public IReadOnlyDictionary<string, ActiveEvolution> ActiveEvolutions => _activeEvolutions;

    public EvolutionManager()
    {
        SeedDefaultEvolutionPlans();
    }

    private void SeedDefaultEvolutionPlans()
    {
        _availablePlans.Add(new EvolutionPlan(
            id: "evo_rookie_awakening",
            name: "Rookie Awakening: From Challenger to Pro",
            description: "Hone a raw bronze/silver talent into a certified Gold-tier starter.",
            maxTier: CardTier.Silver,
            maxOvr: 72,
            coinCost: 500,
            objectives: new List<EvolutionObjective>
            {
                new(ObjectiveType.WinMatches, "Win 3 Tournament Matches", 3),
                new(ObjectiveType.ScoreKills, "Score 10 Kills in Matches", 10),
                new(ObjectiveType.ScoreAssists, "Score 15 Assists in Matches", 15)
            },
            targetTier: CardTier.Gold,
            statBoost: new PlayerAttributes(lan: 6, tf: 6, iq: 5, clu: 7, sta: 4, flx: 5),
            unlockedBadge: PlaystyleBadge.LaningDemon
        ));

        _availablePlans.Add(new EvolutionPlan(
            id: "evo_clutch_ascendance",
            name: "Ice in the Veins: Clutch Ascendance",
            description: "Transform a high-potential Gold player into an elite Platinum clutch maestro.",
            maxTier: CardTier.Gold,
            maxOvr: 83,
            coinCost: 2500,
            objectives: new List<EvolutionObjective>
            {
                new(ObjectiveType.WinMatches, "Win 5 Tournament Matches", 5),
                new(ObjectiveType.ScoreKills, "Score 25 Kills in Tournament Matches", 25),
                new(ObjectiveType.WinSeriesWithoutTilt, "Win 2 Bo3 Series without Tilting", 2)
            },
            targetTier: CardTier.Platinum,
            statBoost: new PlayerAttributes(lan: 5, tf: 7, iq: 6, clu: 12, sta: 6, flx: 6),
            unlockedBadge: PlaystyleBadge.ClutchKing
        ));

        _availablePlans.Add(new EvolutionPlan(
            id: "evo_goat_legacy",
            name: "Road to Immortality: The GOAT Path",
            description: "The ultimate ascension path. Elevate a Diamond superstar to legendary GOAT status.",
            maxTier: CardTier.Diamond,
            maxOvr: 94,
            coinCost: 15000,
            objectives: new List<EvolutionObjective>
            {
                new(ObjectiveType.WinMatches, "Win 10 Championship Matches", 10),
                new(ObjectiveType.ScoreKills, "Score 50 Total Takedowns", 50),
                new(ObjectiveType.MaintainHighMoraleSplits, "Maintain 90%+ Morale for a Split", 1)
            },
            targetTier: CardTier.GOAT,
            statBoost: new PlayerAttributes(lan: 6, tf: 6, iq: 7, clu: 8, sta: 7, flx: 7),
            unlockedBadge: PlaystyleBadge.UnkillableDemon
        ));
    }

    public bool StartEvolution(PlayerCard card, EvolutionPlan plan, out string error)
    {
        if (_activeEvolutions.ContainsKey(card.Id))
        {
            error = $"Player '{card.ParodyName}' is already undergoing an evolution!";
            return false;
        }

        if (!plan.CanEvolve(card))
        {
            error = $"Player '{card.ParodyName}' (Tier: {card.Tier}, OVR: {card.OverallRating}) does not meet evolution requirements (Max Tier: {plan.MaxAllowedTier}, Max OVR: {plan.MaxAllowedOvr}).";
            return false;
        }

        _activeEvolutions[card.Id] = new ActiveEvolution(card.Id, plan);
        error = string.Empty;
        return true;
    }

    public void OnMatchCompleted(string cardId, bool wonMatch, int kills, int assists, string championUsed, bool noTilt)
    {
        if (!_activeEvolutions.TryGetValue(cardId, out var active)) return;

        if (wonMatch) active.RecordProgress(ObjectiveType.WinMatches, 1);
        if (kills > 0) active.RecordProgress(ObjectiveType.ScoreKills, kills);
        if (assists > 0) active.RecordProgress(ObjectiveType.ScoreAssists, assists);
        if (!string.IsNullOrEmpty(championUsed)) active.RecordProgress(ObjectiveType.PlayMatchesWithChampion, 1, championUsed);
        if (wonMatch && noTilt) active.RecordProgress(ObjectiveType.WinSeriesWithoutTilt, 1);
    }

    public bool TryClaimEvolution(PlayerCard card, out string resultMessage)
    {
        if (!_activeEvolutions.TryGetValue(card.Id, out var active))
        {
            resultMessage = $"No active evolution for {card.ParodyName}.";
            return false;
        }

        if (!active.IsComplete)
        {
            resultMessage = $"Evolution '{active.Plan.Name}' is not yet complete!";
            return false;
        }

        // Apply Upgrade
        card.UpgradeTier(active.Plan.TargetTier, active.Plan.StatBoost, active.Plan.UnlockedBadge);
        _activeEvolutions.Remove(card.Id);

        resultMessage = $"🎉 SUCCESS! {card.ParodyName} evolved to {card.Tier.ToString().ToUpper()} tier! New OVR: {card.OverallRating} (+Badge: {active.Plan.UnlockedBadge})";
        return true;
    }
}

