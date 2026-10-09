namespace EsportsClash.Core.Models;

public record PlayerAttributes
{
    public int LAN { get; init; }  // Mechanics & Micro Skillshots (1-99)
    public int TF { get; init; }   // 5v5 Teamfighting & Positioning (1-99)
    public int IQ { get; init; }   // Game Sense & Objective Timing (1-99)
    public int CLU { get; init; }  // Clutch Factor under pressure (1-99)
    public int STA { get; init; }  // Stamina & Tilt Resistance (1-99)
    public int FLX { get; init; }  // Champion Pool Flexibility (1-99)

    public PlayerAttributes(int lan, int tf, int iq, int clu, int sta, int flx)
    {
        LAN = Math.Clamp(lan, 1, 99);
        TF = Math.Clamp(tf, 1, 99);
        IQ = Math.Clamp(iq, 1, 99);
        CLU = Math.Clamp(clu, 1, 99);
        STA = Math.Clamp(sta, 1, 99);
        FLX = Math.Clamp(flx, 1, 99);
    }

    public int CalculateOvr(CombatRole role)
    {
        // 1-Lane ARAM combat weighted EA FC style Overall Rating
        double weighted = role switch
        {
            CombatRole.Carry => (LAN * 0.35) + (TF * 0.30) + (CLU * 0.15) + (STA * 0.10) + (IQ * 0.05) + (FLX * 0.05),
            CombatRole.Mage => (LAN * 0.30) + (TF * 0.30) + (IQ * 0.20) + (CLU * 0.10) + (FLX * 0.05) + (STA * 0.05),
            CombatRole.Frontline => (TF * 0.35) + (STA * 0.25) + (IQ * 0.20) + (LAN * 0.10) + (CLU * 0.05) + (FLX * 0.05),
            CombatRole.Skirmisher => (LAN * 0.35) + (CLU * 0.25) + (TF * 0.20) + (STA * 0.10) + (IQ * 0.05) + (FLX * 0.05),
            CombatRole.Utility => (IQ * 0.35) + (TF * 0.30) + (CLU * 0.15) + (STA * 0.10) + (FLX * 0.05) + (LAN * 0.05),
            _ => (LAN + TF + IQ + CLU + STA + FLX) / 6.0
        };

        return (int)Math.Round(Math.Clamp(weighted, 1, 99));
    }

    public PlayerAttributes AddBonus(int lanBonus = 0, int tfBonus = 0, int iqBonus = 0, int cluBonus = 0, int staBonus = 0, int flxBonus = 0)
    {
        return new PlayerAttributes(
            LAN + lanBonus,
            TF + tfBonus,
            IQ + iqBonus,
            CLU + cluBonus,
            STA + staBonus,
            FLX + flxBonus
        );
    }
}
