namespace EsportsClash.Core.Models;

public enum CardTier
{
    Bronze = 1,
    Silver = 2,
    Gold = 3,
    Platinum = 4,
    Diamond = 5,
    GOAT = 6
}

// 1-Lane Tactical Combat Roles (Replaces 3-lane Top/Mid/Jungle/ADC/Support)
public enum CombatRole
{
    Top,        // Solo Offlane Bruisers & Tanks
    Jungle,     // Objective Roamers, Gankers & Ambushers
    Mid,        // Solo Playmakers, Burst Mages & Assassins
    Bot,        // Safe Lane Hard Carries & Marksmen
    Support,    // Peelers, Warders & Utility Protectors
    // Aliases
    Frontline = Top,
    Carry = Bot,
    Mage = Mid,
    Skirmisher = Jungle,
    Utility = Support
}

public enum GameOrigin
{
    LeagueOfLegends,
    CounterStrike,
    Dota2,
    Valorant
}

public enum Attitude
{
    LaidBack,              // Immune to tilt, slow start
    ClutchPerformer,       // Major stat boost in close games & Game 5s
    SoloCarry,             // Aggressive duelist, high resource priority
    MastermindShotcaller,  // Boosts all teammates' IQ & teamfight coordination
    TiltProneGrinder,      // Extreme mechanics, high risk of tilt if failing
    TheShowman,            // Scales with hype and crowd morale, high stream value
    StoicMastermind,       // Rock solid consistency, unshakeable mental
    VocalLeader            // High chemistry and morale recovery
}

public enum PlaystyleBadge
{
    ClutchKing,
    BaronStealer,
    LaningDemon,
    VisionMaster,
    AggroDiver,
    IceInVeins,
    OneTapSpecialist,
    FlankMaster,
    UnkillableDemon,
    GoldenFlash
}
