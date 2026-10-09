using EsportsClash.Core.Models;

namespace EsportsClash.Core.GamingHouse;

public class HouseSimulationEngine
{
    private readonly Random _rng = new();

    public void ProcessDailySchedule(
        GamingHouseState house, 
        List<PlayerCard> activeRoster, 
        DailyActivity activity, 
        out List<string> dailyLogs)
    {
        dailyLogs = new List<string>();
        dailyLogs.Add($"📅 --- Day {house.Day} Schedule: {activity} ---");

        int scrimLevel = house.Facilities[FacilityType.PCScrimRoom].Level;
        int gymLevel = house.Facilities[FacilityType.GymWellness].Level;
        int kitchenLevel = house.Facilities[FacilityType.KitchenCafeteria].Level;
        int streamLevel = house.Facilities[FacilityType.StreamingStudio].Level;
        int bedroomLevel = house.Facilities[FacilityType.Bedrooms].Level;

        foreach (var player in activeRoster)
        {
            switch (activity)
            {
                case DailyActivity.ScrimSession:
                    int xpGained = 40 + (scrimLevel * 15);
                    player.AddXp(xpGained);
                    player.Fatigue = Math.Clamp(player.Fatigue + Math.Max(5, 20 - (gymLevel * 3)), 0, 100);
                    player.ChemistryBond = Math.Clamp(player.ChemistryBond + 2, 0, 100);
                    dailyLogs.Add($"⚔️ {player.ParodyName} completed intense scrims (+{xpGained} XP, Fatigue: {player.Fatigue}%).");
                    break;

                case DailyActivity.VodReview:
                    player.CurrentAttributes = player.CurrentAttributes.AddBonus(iqBonus: 1);
                    player.Fatigue = Math.Clamp(player.Fatigue + 5, 0, 100);
                    dailyLogs.Add($"🧠 {player.ParodyName} analyzed meta replays (+1 Macro IQ).");
                    break;

                case DailyActivity.GymWorkout:
                    player.Fatigue = Math.Clamp(player.Fatigue - (10 + gymLevel * 4), 0, 100);
                    player.Morale = Math.Clamp(player.Morale + 5, 0, 100);
                    dailyLogs.Add($"🏋️ {player.ParodyName} hit the gym & stretched wrists (Fatigue reduced to {player.Fatigue}%).");
                    break;

                case DailyActivity.StreamLive:
                    int moneyEarned = 150 + (streamLevel * 100) + (player.Personality == Attitude.TheShowman ? 150 : 0);
                    int fansGained = 50 + (streamLevel * 30);
                    house.TeamFunds += moneyEarned;
                    house.FansCount += fansGained;
                    player.Morale = Math.Clamp(player.Morale + 8, 0, 100);
                    dailyLogs.Add($"📹 {player.ParodyName} streamed to fans (+${moneyEarned}, +{fansGained} Fans).");
                    break;

                case DailyActivity.RestAndSleep:
                    int recovery = 25 + (bedroomLevel * 8) + (kitchenLevel * 5);
                    if (player.Personality == Attitude.LaidBack) recovery += 10;
                    player.Fatigue = Math.Clamp(player.Fatigue - recovery, 0, 100);
                    player.Morale = Math.Clamp(player.Morale + 10, 0, 100);
                    dailyLogs.Add($"💤 {player.ParodyName} recharged in luxury pods (Fatigue: {player.Fatigue}%, Morale: {player.Morale}%).");
                    break;

                case DailyActivity.TeamBuildingDinner:
                    player.ChemistryBond = Math.Clamp(player.ChemistryBond + 10, 0, 100);
                    player.Morale = Math.Clamp(player.Morale + 15, 0, 100);
                    dailyLogs.Add($"🍕 {player.ParodyName} enjoyed team dinner (+10 Team Chemistry, +15 Morale).");
                    break;
            }
        }

        // Random Lifestyle Events
        TriggerRandomEvent(house, activeRoster, dailyLogs);

        house.Day++;
    }

    private void TriggerRandomEvent(GamingHouseState house, List<PlayerCard> roster, List<string> logs)
    {
        if (!roster.Any() || _rng.NextDouble() > 0.35) return;

        var luckyPlayer = roster[_rng.Next(roster.Count)];
        int eventId = _rng.Next(4);

        switch (eventId)
        {
            case 0:
                logs.Add($"🌟 [EVENT] {luckyPlayer.ParodyName}'s 1v5 outplay clip went viral on TikTok! (+500 Fans, +$300 Cash).");
                house.FansCount += 500;
                house.TeamFunds += 300;
                luckyPlayer.Morale = Math.Clamp(luckyPlayer.Morale + 15, 0, 100);
                break;

            case 1:
                if (luckyPlayer.Personality == Attitude.TiltProneGrinder)
                {
                    logs.Add($"⚠️ [EVENT] {luckyPlayer.ParodyName} tilted in late-night solo queue! (-15 Morale, +10 Fatigue).");
                    luckyPlayer.Morale = Math.Clamp(luckyPlayer.Morale - 15, 0, 100);
                    luckyPlayer.Fatigue = Math.Clamp(luckyPlayer.Fatigue + 10, 0, 100);
                }
                else
                {
                    logs.Add($"💡 [EVENT] {luckyPlayer.ParodyName} discovered a secret off-meta build during scrims! (+2 LAN stat).");
                    luckyPlayer.CurrentAttributes = luckyPlayer.CurrentAttributes.AddBonus(lanBonus: 2);
                }
                break;

            case 2:
                logs.Add($"🤝 [EVENT] Midnight gaming house chat bonded the team! (+8 Synergy for all).");
                foreach (var p in roster) p.ChemistryBond = Math.Clamp(p.ChemistryBond + 8, 0, 100);
                break;

            case 3:
                logs.Add($"🥤 [EVENT] Energy drink sponsor sent a care package to the mansion! (+$500 Sponsorship bonus).");
                house.TeamFunds += 500;
                break;
        }
    }
}

