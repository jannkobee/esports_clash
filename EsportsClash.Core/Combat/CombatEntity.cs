using EsportsClash.Core.Models;

namespace EsportsClash.Core.Combat;

public class CombatEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..6];
    public PlayerCard ControllingPlayer { get; set; }
    public ChampionKit Champion { get; set; }
    public int TeamIndex { get; set; } // 0 = Blue, 1 = Red

    // Real-time Combat Stats (Scaled by PlayerCard OVR & Attributes)
    public double MaxHp { get; set; }
    public double CurrentHp { get; set; }
    public double ShieldHp { get; set; } = 0;
    public double AttackDamage { get; set; }
    public double Armor { get; set; }
    public double MagicResist { get; set; }
    public double AttackSpeed { get; set; }
    public double AttackRange { get; set; }

    // Position on 1-Lane Bridge (0 to 100)
    public double PositionX { get; set; }

    // Skill Cooldown Timers
    public double Skill1Cooldown { get; set; } = 0;
    public double Skill2Cooldown { get; set; } = 0;
    public double UltimateCooldown { get; set; } = 0;
    public double AttackTimer { get; set; } = 0;

    // Status Effects
    public double StunDuration { get; set; } = 0;
    public double RootDuration { get; set; } = 0;
    public double CharmDuration { get; set; } = 0;
    public double SlowFactor { get; set; } = 0; // 0.0 to 0.5
    public double BleedTimer { get; set; } = 0;
    public double SunlightMarkTimer { get; set; } = 0;

    // Match Performance Stats
    public int Kills { get; set; } = 0;
    public int Deaths { get; set; } = 0;
    public int Assists { get; set; } = 0;
    public double TotalDamageDealt { get; set; } = 0;
    public double TotalDamageTaken { get; set; } = 0;
    public double TotalCrowdControlInflicted { get; set; } = 0;

    public bool IsAlive => CurrentHp > 0;
    public bool IsCrowdControlled => StunDuration > 0 || CharmDuration > 0;

    public CombatEntity(PlayerCard player, ChampionKit champion, int teamIndex, double startX)
    {
        ControllingPlayer = player;
        Champion = champion;
        TeamIndex = teamIndex;
        PositionX = startX;

        // Stat Scaling from Card Attributes (1-99)
        // Mechanics (LAN) scales Attack Damage & Attack Speed
        double lanScale = 1.0 + ((player.CurrentAttributes.LAN - 50) * 0.008);
        // Teamfight (TF) scales Armor & MR & Skill CD
        double tfScale = 1.0 + ((player.CurrentAttributes.TF - 50) * 0.006);
        // Stamina (STA) scales Max HP
        double staScale = 1.0 + ((player.CurrentAttributes.STA - 50) * 0.007);

        MaxHp = champion.BaseHp * staScale;
        CurrentHp = MaxHp;
        AttackDamage = champion.BaseAttackDamage * lanScale;
        Armor = champion.BaseArmor * tfScale;
        MagicResist = champion.BaseMagicResist * tfScale;
        AttackSpeed = champion.AttackSpeed * lanScale;
        AttackRange = champion.AttackRange;
    }

    public void TakeDamage(double rawDamage, DamageType type, CombatEntity? attacker, out double effectiveDamage)
    {
        double reduction = type switch
        {
            DamageType.Physical => 100.0 / (100.0 + Armor),
            DamageType.Magic => 100.0 / (100.0 + MagicResist),
            DamageType.TrueDamage => 1.0,
            _ => 1.0
        };

        if (SunlightMarkTimer > 0 && attacker != null && attacker.Champion.Name != "Solana")
        {
            rawDamage += 45;
            SunlightMarkTimer = 0;
        }

        effectiveDamage = rawDamage * reduction;

        if (ShieldHp > 0)
        {
            if (ShieldHp >= effectiveDamage)
            {
                ShieldHp -= effectiveDamage;
                TotalDamageTaken += effectiveDamage;
                return;
            }
            else
            {
                effectiveDamage -= ShieldHp;
                TotalDamageTaken += ShieldHp;
                ShieldHp = 0;
            }
        }

        CurrentHp = Math.Max(0, CurrentHp - effectiveDamage);
        TotalDamageTaken += effectiveDamage;
        if (attacker != null)
        {
            attacker.TotalDamageDealt += effectiveDamage;
        }
    }
}

