namespace EsportsClash.Core.Combat;

public static class ChampionDatabase
{
    public static List<ChampionKit> GetAllChampions()
    {
        return new List<ChampionKit>
        {
            // 1. SOLANA (Basis: Leona)
            new ChampionKit(
                name: "Solana",
                title: "The Sun Vanguard",
                basisRef: "Leona",
                archetype: ChampionArchetype.TankInitiator,
                hp: 1250,
                ad: 55,
                armor: 55,
                mr: 48,
                aspd: 0.65,
                range: 1.5,
                passiveDesc: "Sunlight Mark: Marks struck enemies. Allies triggering the mark deal 45 bonus magic damage.",
                skill1: new ChampionSkill("Solar Shieldbash", "Stuns target for 1.2s and grants Solana a 180 HP solar shield.", 5, 80, DamageType.Magic),
                skill2: new ChampionSkill("Zenith Lance", "Throws solar spear, rooting target and dashing Solana to them.", 8, 110, DamageType.Magic),
                ultimate: new ChampionSkill("Daybreak Flare", "Calls a giant solar flare. Stuns center cluster for 2.0s and slows all by 60%.", 22, 280, DamageType.Magic, isUltimate: true)
            ),

            // 2. ASTRA (Basis: Ashe)
            new ChampionKit(
                name: "Astra",
                title: "The Frost Sovereign",
                basisRef: "Ashe",
                archetype: ChampionArchetype.MarksmanCarry,
                hp: 780,
                ad: 75,
                armor: 28,
                mr: 30,
                aspd: 0.85,
                range: 6.0,
                passiveDesc: "Glacial Bite: Basic attacks slow enemy movement and attack speed by 25%.",
                skill1: new ChampionSkill("Frost Flurry", "Gains 50% Attack Speed and converts shots into a 5-arrow flurry for 4s.", 7, 140, DamageType.Physical),
                skill2: new ChampionSkill("Volley Cone", "Fires 7 frost arrows in a wide forward cone, chilling all struck targets.", 6, 95, DamageType.Physical),
                ultimate: new ChampionSkill("Enchanted Crystal Comet", "Fires a lane-wide crystal arrow that stuns the primary target for 2.5s.", 25, 320, DamageType.Magic, isUltimate: true)
            ),

            // 3. KYUMI (Basis: Ahri)
            new ChampionKit(
                name: "Kyumi",
                title: "The Nine-Tailed Spirit",
                basisRef: "Ahri",
                archetype: ChampionArchetype.MageAssassin,
                hp: 820,
                ad: 60,
                armor: 30,
                mr: 32,
                aspd: 0.70,
                range: 5.5,
                passiveDesc: "Essence Feast: Restores 12% missing HP after landing full combos or scoring takedowns.",
                skill1: new ChampionSkill("Orb of Illusion", "Throws orb forward dealing magic damage, then returning dealing TRUE DAMAGE.", 5, 130, DamageType.TrueDamage),
                skill2: new ChampionSkill("Charm of Longing", "Blows a kiss that charms target for 1.5s, amplifying incoming damage by 20%.", 9, 85, DamageType.Magic),
                ultimate: new ChampionSkill("Spirit Rush", "Triple-dashes through enemies firing homing spirit bolts.", 20, 360, DamageType.Magic, isUltimate: true)
            ),

            // 4. BUCK (Basis: Graves)
            new ChampionKit(
                name: "Buck",
                title: "The Boomstick Outlaw",
                basisRef: "Graves",
                archetype: ChampionArchetype.BruiserBrawler,
                hp: 920,
                ad: 88,
                armor: 42,
                mr: 35,
                aspd: 0.72,
                range: 3.5,
                passiveDesc: "12-Gauge Double Barrel: Attacks fire 4 shotgun pellets. Stacking basic attacks grant +15 bonus Armor.",
                skill1: new ChampionSkill("Powder Keg Blast", "Fires an explosive gunpowder shell that detonates in a T-shape AOE.", 6, 160, DamageType.Physical),
                skill2: new ChampionSkill("Smoke Screen", "Deploys a heavy smoke cloud. Enemies inside are blinded and range reduced to melee.", 10, 60, DamageType.Magic),
                ultimate: new ChampionSkill("Collateral Blast", "Fires a massive explosive shell that recoils Buck backward while blasting the front.", 22, 420, DamageType.Physical, isUltimate: true)
            ),

            // 5. VALKIRA (Basis: Ambessa)
            new ChampionKit(
                name: "Valkira",
                title: "The Warlord Matriarch",
                basisRef: "Ambessa",
                archetype: ChampionArchetype.SkirmisherExecute,
                hp: 980,
                ad: 82,
                armor: 40,
                mr: 36,
                aspd: 0.80,
                range: 2.0,
                passiveDesc: "Drakehound's Step: Dashes after casting any skill and enhances next basic attack range & bleed.",
                skill1: new ChampionSkill("Crescent Cleave", "Sweeps twin chain-blades. Outer blade hit deals double damage and deep bleed.", 5, 150, DamageType.Physical),
                skill2: new ChampionSkill("Iron Will Slam", "Slams blades into the ground for a 200 HP shield and AOE shockwave.", 7, 100, DamageType.Physical),
                ultimate: new ChampionSkill("Executioner's Descent", "Suppresses lowest-HP enemy, teleports behind them and slams for lethal execute.", 24, 450, DamageType.Physical, isUltimate: true)
            )
        };
    }
}

