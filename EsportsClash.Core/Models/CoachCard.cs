namespace EsportsClash.Core.Models;

public enum TacticalArchetype
{
    AggressiveDive,    // Boosts early lane duels & dive damage
    ObjectiveMacro,    // Boosts dragon/shrine capture speed & macro IQ
    ScalingPoke,       // Increases range, cooldown reduction & late-game damage
    PickAndBurst,      // Boosts vision, bush ambush damage & pick isolation
    DynamicAdapt       // Boosts adaptability, extra ban phase slot
}

public class CoachCard
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N")[..8];
    public string ParodyName { get; set; }
    public string RealNameReference { get; set; }
    public CardTier Tier { get; set; }
    public TacticalArchetype TacticalStyle { get; set; }
    public int ChemistryBonus { get; set; } // +1 to +15 Chemistry bonus to team
    public int PlaybookMacroBonus { get; set; } // +1 to +12 Macro IQ bonus to all players
    public int ExtraBans { get; set; } // 0 or 1
    public string SpecialQuote { get; set; }

    public CoachCard(
        string parodyName, 
        string realNameRef, 
        CardTier tier, 
        TacticalArchetype style, 
        int chemistryBonus, 
        int playbookBonus,
        int extraBans = 0,
        string specialQuote = "")
    {
        ParodyName = parodyName;
        RealNameReference = realNameRef;
        Tier = tier;
        TacticalStyle = style;
        ChemistryBonus = chemistryBonus;
        PlaybookMacroBonus = playbookBonus;
        ExtraBans = extraBans;
        SpecialQuote = specialQuote;
    }
}

