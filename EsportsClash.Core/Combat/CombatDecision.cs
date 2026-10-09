namespace EsportsClash.Core.Combat;

public enum CombatAction { Attack, Skill1, Skill2, Ultimate }

public static class CombatDecision
{
    public static CombatEntity ChooseTarget(CombatEntity actor, IReadOnlyList<CombatEntity> enemies)
    {
        int iq = actor.ControllingPlayer.CurrentAttributes.IQ;
        if (iq < 45)
            return enemies.OrderBy(enemy => Math.Abs(enemy.PositionX - actor.PositionX)).First();

        double awareness = iq / 99.0;
        return enemies.OrderByDescending(enemy =>
            (1 - (enemy.CurrentHp + enemy.ShieldHp) / (enemy.MaxHp + enemy.ShieldHp)) * 70 * awareness
            + enemy.AttackDamage * 0.12 * awareness
            - Math.Abs(enemy.PositionX - actor.PositionX) * (1.1 - awareness)
            - enemy.Armor * 0.04 * awareness).First();
    }

    public static CombatAction ChooseAction(CombatEntity actor, CombatEntity target, int nearbyEnemyCount)
    {
        int iq = actor.ControllingPlayer.CurrentAttributes.IQ;
        bool basicCanFinish = target.CurrentHp + target.ShieldHp <= actor.AttackDamage * 0.8;
        bool ultReady = actor.UltimateCooldown <= 0;
        bool ultMoment = nearbyEnemyCount >= 2 || target.CurrentHp < target.MaxHp * 0.4
            || actor.CurrentHp < actor.MaxHp * 0.35;

        if (iq >= 70 && basicCanFinish && nearbyEnemyCount < 2)
            return CombatAction.Attack;
        if (ultReady && (iq >= 70 ? ultMoment : target.CurrentHp < target.MaxHp * 0.7))
            return CombatAction.Ultimate;

        bool skill1Ready = actor.Skill1Cooldown <= 0;
        bool skill2Ready = actor.Skill2Cooldown <= 0;
        if (iq >= 70 && skill2Ready && (!skill1Ready || actor.Champion.Skill2.BaseDamage > actor.Champion.Skill1.BaseDamage))
            return CombatAction.Skill2;
        if (skill1Ready) return CombatAction.Skill1;
        if (skill2Ready) return CombatAction.Skill2;
        return CombatAction.Attack;
    }
}
