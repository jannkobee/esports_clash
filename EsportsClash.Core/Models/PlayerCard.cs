namespace EsportsClash.Core.Models;

public class PlayerCard
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N")[..8];
    public string ParodyName { get; set; } = string.Empty;
    public string RealNameReference { get; set; } = string.Empty;
    public GameOrigin Origin { get; set; }
    public CombatRole TacticalRole { get; set; }
    public CardTier Tier { get; set; }
    
    public int Level { get; set; } = 1;
    public int MaxLevel => Tier switch
    {
        CardTier.Bronze => 20,
        CardTier.Silver => 30,
        CardTier.Gold => 40,
        CardTier.Platinum => 50,
        CardTier.Diamond => 60,
        CardTier.GOAT => 70,
        _ => 50
    };

    public int CurrentXp { get; set; } = 0;
    public int XpToNextLevel => Level * 100;

    public PlayerAttributes BaseAttributes { get; set; }
    public PlayerAttributes CurrentAttributes { get; set; }
    public int OverallRating => CurrentAttributes.CalculateOvr(TacticalRole);

    public Attitude Personality { get; set; }
    public List<PlaystyleBadge> Badges { get; set; } = new();
    public List<string> SignatureChampions { get; set; } = new();

    // Lifestyle & Condition stats (1 - 100)
    public int Morale { get; set; } = 80;
    public int Fatigue { get; set; } = 0;     // 0 = fresh, 100 = exhausted
    public int ChemistryBond { get; set; } = 50;

    // Visual ASCII Chibi
    public string ChibiAscii { get; set; } = string.Empty;

    public PlayerCard(
        string parodyName, 
        string realNameRef, 
        GameOrigin origin, 
        CombatRole role, 
        CardTier tier, 
        PlayerAttributes attributes, 
        Attitude personality, 
        List<PlaystyleBadge>? badges = null,
        List<string>? signatureChampions = null,
        string? chibiAscii = null)
    {
        ParodyName = parodyName;
        RealNameReference = realNameRef;
        Origin = origin;
        TacticalRole = role;
        Tier = tier;
        BaseAttributes = attributes;
        CurrentAttributes = attributes;
        Personality = personality;
        Badges = badges ?? new List<PlaystyleBadge>();
        SignatureChampions = signatureChampions ?? new List<string>();
        ChibiAscii = chibiAscii ?? GenerateDefaultChibi(parodyName);
    }

    public void AddXp(int xp)
    {
        if (Level >= MaxLevel) return;

        CurrentXp += xp;
        while (CurrentXp >= XpToNextLevel && Level < MaxLevel)
        {
            CurrentXp -= XpToNextLevel;
            Level++;
            CurrentAttributes = CurrentAttributes.AddBonus(1, 1, 1, 1, 1, 1);
        }
    }

    public void UpgradeTier(CardTier newTier, PlayerAttributes statBoost, PlaystyleBadge? newBadge = null)
    {
        Tier = newTier;
        CurrentAttributes = CurrentAttributes.AddBonus(
            statBoost.LAN, 
            statBoost.TF, 
            statBoost.IQ, 
            statBoost.CLU, 
            statBoost.STA, 
            statBoost.FLX
        );
        if (newBadge.HasValue && !Badges.Contains(newBadge.Value))
        {
            Badges.Add(newBadge.Value);
        }
    }

    private static string GenerateDefaultChibi(string name)
    {
        return $"""
           .---.  
          ( O.O )  [{name}]
          /|   |\ 
           d   b  
        """;
    }
}
