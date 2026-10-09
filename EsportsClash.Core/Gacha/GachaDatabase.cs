using EsportsClash.Core.Models;

namespace EsportsClash.Core.Gacha;

public static class GachaDatabase
{
    public static List<PlayerCard> GetAllPlayers()
    {
        return new List<PlayerCard>
        {
            // === LEAGUE OF LEGENDS PARODIES ===
            new PlayerCard(
                parodyName: "Flaker",
                realNameRef: "Faker",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Mage,
                tier: CardTier.GOAT,
                attributes: new PlayerAttributes(lan: 99, tf: 98, iq: 98, clu: 99, sta: 94, flx: 96),
                personality: Attitude.StoicMastermind,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.ClutchKing, PlaystyleBadge.UnkillableDemon },
                signatureChampions: new List<string> { "Kyumi", "Solana" },
                chibiAscii: """
                   .---.   
                  ( -.- )  [FLAKER: (b^_^)b]
                  /|   |\  "All roads lead to me."
                   d   b   
                """
            ),
            new PlayerCard(
                parodyName: "Craps",
                realNameRef: "Caps",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Mage,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 93, tf: 94, iq: 90, clu: 91, sta: 88, flx: 95),
                personality: Attitude.TheShowman,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.AggroDiver, PlaystyleBadge.GoldenFlash },
                signatureChampions: new List<string> { "Kyumi", "Valkira" }
            ),
            new PlayerCard(
                parodyName: "Daft",
                realNameRef: "Deft",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Carry,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 92, tf: 95, iq: 91, clu: 96, sta: 92, flx: 89),
                personality: Attitude.ClutchPerformer,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.ClutchKing, PlaystyleBadge.IceInVeins },
                signatureChampions: new List<string> { "Astra", "Buck" }
            ),
            new PlayerCard(
                parodyName: "Ouzi",
                realNameRef: "Uzi",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Carry,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 98, tf: 96, iq: 88, clu: 92, sta: 82, flx: 85),
                personality: Attitude.SoloCarry,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.LaningDemon },
                signatureChampions: new List<string> { "Astra", "Buck" }
            ),
            new PlayerCard(
                parodyName: "Churchy",
                realNameRef: "Chovy",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Mage,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 99, tf: 93, iq: 92, clu: 88, sta: 91, flx: 91),
                personality: Attitude.TiltProneGrinder,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.LaningDemon },
                signatureChampions: new List<string> { "Kyumi", "Astra" }
            ),
            new PlayerCard(
                parodyName: "GrandCanyon",
                realNameRef: "Canyon",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Frontline,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 91, tf: 94, iq: 96, clu: 93, sta: 90, flx: 92),
                personality: Attitude.MastermindShotcaller,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.BaronStealer, PlaystyleBadge.FlankMaster },
                signatureChampions: new List<string> { "Buck", "Valkira" }
            ),
            new PlayerCard(
                parodyName: "TheSpicy",
                realNameRef: "TheShy",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Skirmisher,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 96, tf: 95, iq: 85, clu: 91, sta: 87, flx: 88),
                personality: Attitude.SoloCarry,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.AggroDiver },
                signatureChampions: new List<string> { "Valkira", "Solana" }
            ),
            new PlayerCard(
                parodyName: "Keriah",
                realNameRef: "Keria",
                origin: GameOrigin.LeagueOfLegends,
                role: CombatRole.Utility,
                tier: CardTier.Platinum,
                attributes: new PlayerAttributes(lan: 89, tf: 91, iq: 94, clu: 88, sta: 86, flx: 97),
                personality: Attitude.TheShowman,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.VisionMaster },
                signatureChampions: new List<string> { "Solana", "Astra" }
            ),

            // === COUNTER-STRIKE PARODIES ===
            new PlayerCard(
                parodyName: "p1mple",
                realNameRef: "s1mple",
                origin: GameOrigin.CounterStrike,
                role: CombatRole.Carry,
                tier: CardTier.GOAT,
                attributes: new PlayerAttributes(lan: 99, tf: 97, iq: 95, clu: 99, sta: 90, flx: 93),
                personality: Attitude.SoloCarry,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.OneTapSpecialist, PlaystyleBadge.ClutchKing },
                signatureChampions: new List<string> { "Buck", "Astra" },
                chibiAscii: """
                   .---.   
                  ( >.< )  [p1mple: (ò_ó)]
                  /| # |\  "Drop me AWP / Boomstick!"
                   d   b   
                """
            ),
            new PlayerCard(
                parodyName: "NeKo",
                realNameRef: "NiKo",
                origin: GameOrigin.CounterStrike,
                role: CombatRole.Skirmisher,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 97, tf: 93, iq: 89, clu: 91, sta: 89, flx: 88),
                personality: Attitude.TiltProneGrinder,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.OneTapSpecialist },
                signatureChampions: new List<string> { "Buck", "Valkira" }
            ),
            new PlayerCard(
                parodyName: "WooZy",
                realNameRef: "ZywOo",
                origin: GameOrigin.CounterStrike,
                role: CombatRole.Carry,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 96, tf: 96, iq: 95, clu: 95, sta: 95, flx: 96),
                personality: Attitude.LaidBack,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.IceInVeins, PlaystyleBadge.ClutchKing },
                signatureChampions: new List<string> { "Buck", "Kyumi" }
            ),
            new PlayerCard(
                parodyName: "m0NEY",
                realNameRef: "m0NESY",
                origin: GameOrigin.CounterStrike,
                role: CombatRole.Carry,
                tier: CardTier.Platinum,
                attributes: new PlayerAttributes(lan: 94, tf: 89, iq: 88, clu: 91, sta: 88, flx: 89),
                personality: Attitude.TheShowman,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.GoldenFlash },
                signatureChampions: new List<string> { "Buck", "Astra" }
            ),

            // === DOTA 2 PARODIES ===
            new PlayerCard(
                parodyName: "Mirecle",
                realNameRef: "Miracle-",
                origin: GameOrigin.Dota2,
                role: CombatRole.Skirmisher,
                tier: CardTier.GOAT,
                attributes: new PlayerAttributes(lan: 98, tf: 99, iq: 97, clu: 98, sta: 92, flx: 98),
                personality: Attitude.ClutchPerformer,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.ClutchKing, PlaystyleBadge.UnkillableDemon },
                signatureChampions: new List<string> { "Kyumi", "Valkira" },
                chibiAscii: """
                   .---.   
                  ( ^_- )  [MIRECLE: (*_*)]
                  /| * |\  "1v9 is just another Tuesday."
                   d   b   
                """
            ),
            new PlayerCard(
                parodyName: "Godson",
                realNameRef: "Topson",
                origin: GameOrigin.Dota2,
                role: CombatRole.Mage,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 92, tf: 96, iq: 96, clu: 95, sta: 91, flx: 99),
                personality: Attitude.TheShowman,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.AggroDiver },
                signatureChampions: new List<string> { "Kyumi", "Valkira" }
            ),
            new PlayerCard(
                parodyName: "BigTail",
                realNameRef: "N0tail",
                origin: GameOrigin.Dota2,
                role: CombatRole.Utility,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 88, tf: 94, iq: 97, clu: 95, sta: 95, flx: 95),
                personality: Attitude.VocalLeader,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.VisionMaster },
                signatureChampions: new List<string> { "Solana", "Astra" }
            ),

            // === VALORANT PARODIES ===
            new PlayerCard(
                parodyName: "DNS",
                realNameRef: "FNS",
                origin: GameOrigin.Valorant,
                role: CombatRole.Utility,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 82, tf: 91, iq: 99, clu: 96, sta: 94, flx: 92),
                personality: Attitude.MastermindShotcaller,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.ClutchKing, PlaystyleBadge.VisionMaster },
                signatureChampions: new List<string> { "Solana", "Kyumi" }
            ),
            new PlayerCard(
                parodyName: "PenZ",
                realNameRef: "TenZ",
                origin: GameOrigin.Valorant,
                role: CombatRole.Carry,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 97, tf: 92, iq: 88, clu: 90, sta: 89, flx: 91),
                personality: Attitude.TheShowman,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.OneTapSpecialist, PlaystyleBadge.GoldenFlash },
                signatureChampions: new List<string> { "Astra", "Buck" }
            ),
            new PlayerCard(
                parodyName: "Toaster",
                realNameRef: "Boaster",
                origin: GameOrigin.Valorant,
                role: CombatRole.Utility,
                tier: CardTier.Gold,
                attributes: new PlayerAttributes(lan: 78, tf: 85, iq: 90, clu: 85, sta: 92, flx: 88),
                personality: Attitude.VocalLeader,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.VisionMaster },
                signatureChampions: new List<string> { "Solana", "Kyumi" }
            ),
            new PlayerCard(
                parodyName: "Paspas",
                realNameRef: "Aspas",
                origin: GameOrigin.Valorant,
                role: CombatRole.Carry,
                tier: CardTier.Diamond,
                attributes: new PlayerAttributes(lan: 96, tf: 94, iq: 90, clu: 94, sta: 93, flx: 90),
                personality: Attitude.ClutchPerformer,
                badges: new List<PlaystyleBadge> { PlaystyleBadge.IceInVeins },
                signatureChampions: new List<string> { "Astra", "Buck" }
            ),

            // === ROOKIES / AMATEURS ===
            new PlayerCard("PixelRookie", "Amateur", GameOrigin.LeagueOfLegends, CombatRole.Frontline, CardTier.Bronze, new PlayerAttributes(52, 54, 50, 48, 55, 50), Attitude.LaidBack),
            new PlayerCard("CrosshairKid", "Amateur", GameOrigin.CounterStrike, CombatRole.Carry, CardTier.Bronze, new PlayerAttributes(56, 50, 48, 55, 52, 49), Attitude.SoloCarry),
            new PlayerCard("WardBoy", "Amateur", GameOrigin.Dota2, CombatRole.Utility, CardTier.Bronze, new PlayerAttributes(48, 52, 55, 50, 54, 50), Attitude.VocalLeader),
            new PlayerCard("Smokescreen", "Amateur", GameOrigin.Valorant, CombatRole.Skirmisher, CardTier.Bronze, new PlayerAttributes(50, 50, 54, 50, 51, 52), Attitude.MastermindShotcaller),
            new PlayerCard("TurboGamer", "Amateur", GameOrigin.LeagueOfLegends, CombatRole.Mage, CardTier.Silver, new PlayerAttributes(66, 68, 64, 65, 67, 62), Attitude.TiltProneGrinder),
            new PlayerCard("ClutchNoob", "Amateur", GameOrigin.CounterStrike, CombatRole.Carry, CardTier.Silver, new PlayerAttributes(68, 65, 62, 70, 66, 64), Attitude.ClutchPerformer),
            new PlayerCard("JungleDiff", "Amateur", GameOrigin.LeagueOfLegends, CombatRole.Frontline, CardTier.Gold, new PlayerAttributes(76, 78, 77, 74, 75, 76), Attitude.SoloCarry),
            new PlayerCard("LaneBully", "Amateur", GameOrigin.Dota2, CombatRole.Frontline, CardTier.Gold, new PlayerAttributes(80, 75, 74, 78, 79, 75), Attitude.SoloCarry)
        };
    }

    public static List<CoachCard> GetAllCoaches()
    {
        return new List<CoachCard>
        {
            new CoachCard("KkOpa", "kkOma", CardTier.GOAT, TacticalArchetype.ObjectiveMacro, chemistryBonus: 15, playbookBonus: 12, extraBans: 1, specialQuote: "Listen to the belt, win the Worlds."),
            new CoachCard("MasterMind", "Reeves", CardTier.Diamond, TacticalArchetype.DynamicAdapt, chemistryBonus: 12, playbookBonus: 10, extraBans: 1, specialQuote: "Every outcome has already been calculated."),
            new CoachCard("Bbaegi", "Bengi", CardTier.Diamond, TacticalArchetype.AggressiveDive, chemistryBonus: 10, playbookBonus: 8, extraBans: 0, specialQuote: "The third lane is always ours to gank."),
            new CoachCard("AleksiC", "Aleksib", CardTier.Platinum, TacticalArchetype.PickAndBurst, chemistryBonus: 8, playbookBonus: 6, extraBans: 0, specialQuote: "Execute plan 4-B on my mark."),
            new CoachCard("Coach Rookie", "Generic", CardTier.Bronze, TacticalArchetype.ScalingPoke, chemistryBonus: 3, playbookBonus: 2, extraBans: 0, specialQuote: "Just try your best out there!")
        };
    }
}
