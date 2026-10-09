namespace EsportsClash.Core.Combat;

public enum ChampionArchetype
{
    TankInitiator,
    MarksmanCarry,
    MageAssassin,
    BruiserBrawler,
    SkirmisherExecute
}

public enum DamageType
{
    Physical,
    Magic,
    TrueDamage
}

public class ChampionSkill
{
    public string Name { get; set; }
    public string Description { get; set; }
    public int CooldownSeconds { get; set; }
    public double BaseDamage { get; set; }
    public DamageType DamageType { get; set; }
    public bool IsUltimate { get; set; }

    public ChampionSkill(string name, string description, int cooldownSeconds, double baseDamage, DamageType damageType, bool isUltimate = false)
    {
        Name = name;
        Description = description;
        CooldownSeconds = cooldownSeconds;
        BaseDamage = baseDamage;
        DamageType = damageType;
        IsUltimate = isUltimate;
    }
}

public class ChampionKit
{
    public string Name { get; set; }
    public string Title { get; set; }
    public string BasisReference { get; set; }
    public ChampionArchetype Archetype { get; set; }
    public double BaseHp { get; set; }
    public double BaseAttackDamage { get; set; }
    public double BaseArmor { get; set; }
    public double BaseMagicResist { get; set; }
    public double AttackSpeed { get; set; }
    public double AttackRange { get; set; }

    public string PassiveDescription { get; set; }
    public ChampionSkill Skill1 { get; set; }
    public ChampionSkill Skill2 { get; set; }
    public ChampionSkill Ultimate { get; set; }

    public ChampionKit(
        string name, 
        string title, 
        string basisRef, 
        ChampionArchetype archetype, 
        double hp, 
        double ad, 
        double armor, 
        double mr, 
        double aspd, 
        double range,
        string passiveDesc,
        ChampionSkill skill1,
        ChampionSkill skill2,
        ChampionSkill ultimate)
    {
        Name = name;
        Title = title;
        BasisReference = basisRef;
        Archetype = archetype;
        BaseHp = hp;
        BaseAttackDamage = ad;
        BaseArmor = armor;
        BaseMagicResist = mr;
        AttackSpeed = aspd;
        AttackRange = range;
        PassiveDescription = passiveDesc;
        Skill1 = skill1;
        Skill2 = skill2;
        Ultimate = ultimate;
    }
}

