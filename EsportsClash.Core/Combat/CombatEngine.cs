using EsportsClash.Core.Models;

namespace EsportsClash.Core.Combat;

public class MatchSimulationResult
{
    public string WinnerTeamName { get; set; } = string.Empty;
    public int WinningTeamIndex { get; set; }
    public int BlueKills { get; set; }
    public int RedKills { get; set; }
    public double MatchDurationSeconds { get; set; }
    public List<CombatEntity> AllEntities { get; set; } = new();
    public List<string> CombatLog { get; set; } = new();
    public CombatEntity? MvpPlayer { get; set; }
}

public class CombatEngine
{
    private readonly Random _rng = new();

    public MatchSimulationResult SimulateMatch(
        string blueTeamName, 
        List<(PlayerCard Player, ChampionKit Champion)> blueLineup,
        string redTeamName,
        List<(PlayerCard Player, ChampionKit Champion)> redLineup,
        CoachCard? blueCoach = null,
        CoachCard? redCoach = null)
    {
        var result = new MatchSimulationResult();
        var logs = result.CombatLog;

        logs.Add($"⚔️ --- MATCH COMMENCING: {blueTeamName} (Blue) VS {redTeamName} (Red) ---");
        logs.Add($"📍 MAP: The Bridge of Mayhem (1-Lane ARAM Rotation)");

        // Initialize Combat Entities
        var blueEntities = blueLineup.Select(p => new CombatEntity(p.Player, p.Champion, 0, startX: 10 + _rng.NextDouble() * 5)).ToList();
        var redEntities = redLineup.Select(p => new CombatEntity(p.Player, p.Champion, 1, startX: 90 - _rng.NextDouble() * 5)).ToList();
        var allEntities = blueEntities.Concat(redEntities).ToList();
        result.AllEntities = allEntities;

        // Structures HP
        double blueTowerHp = 2500, blueNexusHp = 5000;
        double redTowerHp = 2500, redNexusHp = 5000;

        double matchTime = 0;
        double dt = 0.5; // Tick step 0.5 seconds
        bool mayhemShrineCaptured = false;

        while (blueNexusHp > 0 && redNexusHp > 0 && matchTime < 180) // Max 3 minutes match simulation
        {
            matchTime += dt;

            // 1. Mayhem Shrine Event at 60s
            if (matchTime >= 60 && !mayhemShrineCaptured)
            {
                mayhemShrineCaptured = true;
                int shrineWinner = _rng.Next(2);
                var buffTeam = shrineWinner == 0 ? blueEntities : redEntities;
                string buffTeamName = shrineWinner == 0 ? blueTeamName : redTeamName;
                logs.Add($"⚡ [{FormatTime(matchTime)}] MAYHEM SHRINE SPAWNED! {buffTeamName} captured the shrine and gained Lightning Overcharge!");
                foreach (var ent in buffTeam.Where(e => e.IsAlive))
                {
                    ent.ShieldHp += 250;
                    ent.AttackDamage += 20;
                }
            }

            // 2. Process Status Effects on all entities
            foreach (var ent in allEntities.Where(e => e.IsAlive))
            {
                if (ent.StunDuration > 0) ent.StunDuration = Math.Max(0, ent.StunDuration - dt);
                if (ent.RootDuration > 0) ent.RootDuration = Math.Max(0, ent.RootDuration - dt);
                if (ent.CharmDuration > 0) ent.CharmDuration = Math.Max(0, ent.CharmDuration - dt);
                if (ent.SunlightMarkTimer > 0) ent.SunlightMarkTimer = Math.Max(0, ent.SunlightMarkTimer - dt);

                if (ent.BleedTimer > 0)
                {
                    ent.TakeDamage(15 * dt, DamageType.TrueDamage, null, out _);
                    ent.BleedTimer = Math.Max(0, ent.BleedTimer - dt);
                }

                // Skill Cooldowns
                if (ent.Skill1Cooldown > 0) ent.Skill1Cooldown = Math.Max(0, ent.Skill1Cooldown - dt);
                if (ent.Skill2Cooldown > 0) ent.Skill2Cooldown = Math.Max(0, ent.Skill2Cooldown - dt);
                if (ent.UltimateCooldown > 0) ent.UltimateCooldown = Math.Max(0, ent.UltimateCooldown - dt);
                if (ent.AttackTimer > 0) ent.AttackTimer = Math.Max(0, ent.AttackTimer - dt);
            }

            // 3. Process Actions for each Living Champion
            foreach (var ent in allEntities.Where(e => e.IsAlive))
            {
                if (ent.IsCrowdControlled) continue;

                var enemyTeam = ent.TeamIndex == 0 ? redEntities : blueEntities;
                var livingEnemies = enemyTeam.Where(e => e.IsAlive).ToList();

                if (!livingEnemies.Any())
                {
                    // Siege Enemy Structure
                    if (ent.TeamIndex == 0)
                    {
                        if (redTowerHp > 0) redTowerHp -= ent.AttackDamage * 0.4;
                        else redNexusHp -= ent.AttackDamage * 0.4;
                    }
                    else
                    {
                        if (blueTowerHp > 0) blueTowerHp -= ent.AttackDamage * 0.4;
                        else blueNexusHp -= ent.AttackDamage * 0.4;
                    }
                    continue;
                }

                var target = CombatDecision.ChooseTarget(ent, livingEnemies);
                var nearbyEnemies = livingEnemies.Count(e => Math.Abs(e.PositionX - target.PositionX) <= 12);
                var action = CombatDecision.ChooseAction(ent, target, nearbyEnemies);

                if (action == CombatAction.Ultimate)
                {
                    ExecuteUltimate(ent, target, enemyTeam, logs, matchTime);
                    ent.UltimateCooldown = ent.Champion.Ultimate.CooldownSeconds;
                }
                else if (action == CombatAction.Skill1)
                {
                    ExecuteSkill1(ent, target, logs, matchTime);
                    ent.Skill1Cooldown = ent.Champion.Skill1.CooldownSeconds;
                }
                else if (action == CombatAction.Skill2)
                {
                    ExecuteSkill2(ent, target, logs, matchTime);
                    ent.Skill2Cooldown = ent.Champion.Skill2.CooldownSeconds;
                }
                else if (ent.AttackTimer <= 0)
                {
                    ent.AttackTimer = 1.0 / Math.Max(0.5, ent.AttackSpeed);
                    target.TakeDamage(ent.AttackDamage, DamageType.Physical, ent, out double dealt);

                    // Passive on-hit application
                    if (ent.Champion.Name == "Astra")
                    {
                        target.SlowFactor = 0.35;
                    }
                    else if (ent.Champion.Name == "Solana")
                    {
                        target.SunlightMarkTimer = 4.0;
                    }

                    if (!target.IsAlive)
                    {
                        HandleTakedown(ent, target, ent.TeamIndex == 0 ? blueEntities : redEntities, logs, matchTime);
                    }
                }
            }

            // Respawn mechanics (Fast ARAM Mayhem respawns: 8s + level)
            foreach (var dead in allEntities.Where(e => !e.IsAlive))
            {
                // In ARAM Mayhem, revive after 12 seconds
                // For sim brevity, match finishes on team wipe + structure push
            }
        }

        // Determine Winner
        if (blueNexusHp <= 0 || (redNexusHp > blueNexusHp))
        {
            result.WinningTeamIndex = 1;
            result.WinnerTeamName = redTeamName;
        }
        else
        {
            result.WinningTeamIndex = 0;
            result.WinnerTeamName = blueTeamName;
        }

        result.BlueKills = blueEntities.Sum(e => e.Kills);
        result.RedKills = redEntities.Sum(e => e.Kills);
        result.MatchDurationSeconds = matchTime;
        result.MvpPlayer = allEntities.OrderByDescending(e => e.Kills * 3 + e.Assists * 2 + (e.TotalDamageDealt / 500)).FirstOrDefault();

        logs.Add($"🏆 ==========================================");
        logs.Add($"🎉 VICTORY FOR {result.WinnerTeamName.ToUpper()}! ({result.BlueKills} - {result.RedKills}) in {FormatTime(matchTime)}");
        if (result.MvpPlayer != null)
        {
            logs.Add($"⭐ MATCH MVP: {result.MvpPlayer.ControllingPlayer.ParodyName} ({result.MvpPlayer.Champion.Name}) - KDA: {result.MvpPlayer.Kills}/{result.MvpPlayer.Deaths}/{result.MvpPlayer.Assists}, Dmg: {result.MvpPlayer.TotalDamageDealt:F0}");
        }
        logs.Add($"🏆 ==========================================");

        return result;
    }

    private void ExecuteSkill1(CombatEntity caster, CombatEntity target, List<string> logs, double time)
    {
        var skill = caster.Champion.Skill1;
        target.TakeDamage(skill.BaseDamage + (caster.AttackDamage * 0.5), skill.DamageType, caster, out double dmg);

        if (caster.Champion.Name == "Solana")
        {
            target.StunDuration = 1.2;
            caster.ShieldHp += 180;
            caster.TotalCrowdControlInflicted += 1.2;
            logs.Add($"☀️ [{FormatTime(time)}] {caster.ControllingPlayer.ParodyName} (Solana) casts {skill.Name}! Stunned {target.ControllingPlayer.ParodyName} for 1.2s!");
        }
        else if (caster.Champion.Name == "Kyumi")
        {
            logs.Add($"🔮 [{FormatTime(time)}] {caster.ControllingPlayer.ParodyName} (Kyumi) throws {skill.Name}, piercing {target.ControllingPlayer.ParodyName} for {dmg:F0} TRUE damage!");
        }

        if (!target.IsAlive) HandleTakedown(caster, target, null, logs, time);
    }

    private void ExecuteSkill2(CombatEntity caster, CombatEntity target, List<string> logs, double time)
    {
        var skill = caster.Champion.Skill2;
        target.TakeDamage(skill.BaseDamage + (caster.AttackDamage * 0.4), skill.DamageType, caster, out double dmg);

        if (caster.Champion.Name == "Kyumi")
        {
            target.CharmDuration = 1.5;
            caster.TotalCrowdControlInflicted += 1.5;
            logs.Add($"💖 [{FormatTime(time)}] {caster.ControllingPlayer.ParodyName} (Kyumi) charms {target.ControllingPlayer.ParodyName}! Target is helpless!");
        }
        else if (caster.Champion.Name == "Buck")
        {
            logs.Add($"💨 [{FormatTime(time)}] {caster.ControllingPlayer.ParodyName} (Buck) drops Smoke Screen! Enemy team loses vision!");
        }

        if (!target.IsAlive) HandleTakedown(caster, target, null, logs, time);
    }

    private void ExecuteUltimate(CombatEntity caster, CombatEntity target, List<CombatEntity> enemyTeam, List<string> logs, double time)
    {
        var ult = caster.Champion.Ultimate;
        double dmg = ult.BaseDamage + (caster.AttackDamage * 0.8);

        if (caster.Champion.Name == "Solana")
        {
            logs.Add($"💥 [{FormatTime(time)}] ☀️ SOLAR FLARE! {caster.ControllingPlayer.ParodyName} stuns the enemy formation!");
            foreach (var e in enemyTeam.Where(x => x.IsAlive))
            {
                e.TakeDamage(dmg * 0.7, DamageType.Magic, caster, out _);
                e.StunDuration = 2.0;
                caster.TotalCrowdControlInflicted += 2.0;
            }
        }
        else if (caster.Champion.Name == "Astra")
        {
            logs.Add($"🏹 [{FormatTime(time)}] ❄️ CRYSTAL ARROW! {caster.ControllingPlayer.ParodyName} snipes {target.ControllingPlayer.ParodyName} with a 2.5s stun!");
            target.TakeDamage(dmg, DamageType.Magic, caster, out _);
            target.StunDuration = 2.5;
            caster.TotalCrowdControlInflicted += 2.5;
        }
        else if (caster.Champion.Name == "Valkira")
        {
            logs.Add($"⚔️ [{FormatTime(time)}] 🩸 EXECUTION! {caster.ControllingPlayer.ParodyName} descends upon {target.ControllingPlayer.ParodyName} for lethal execution!");
            target.TakeDamage(dmg * 1.5, DamageType.Physical, caster, out _);
        }
        else
        {
            target.TakeDamage(dmg, ult.DamageType, caster, out _);
            logs.Add($"💥 [{FormatTime(time)}] {caster.ControllingPlayer.ParodyName} unleashes {ult.Name} on {target.ControllingPlayer.ParodyName}!");
        }

        if (!target.IsAlive) HandleTakedown(caster, target, null, logs, time);
    }

    private void HandleTakedown(CombatEntity killer, CombatEntity victim, List<CombatEntity>? allies, List<string> logs, double time)
    {
        killer.Kills++;
        victim.Deaths++;
        logs.Add($"☠️ [{FormatTime(time)}] [KILL] {killer.ControllingPlayer.ParodyName} ({killer.Champion.Name}) SLAIN {victim.ControllingPlayer.ParodyName} ({victim.Champion.Name})!");

        if (allies != null)
        {
            foreach (var ally in allies.Where(a => a != killer && a.IsAlive))
            {
                ally.Assists++;
            }
        }
    }

    private static string FormatTime(double seconds)
    {
        int min = (int)(seconds / 60);
        int sec = (int)(seconds % 60);
        return $"{min:00}:{sec:00}";
    }
}

