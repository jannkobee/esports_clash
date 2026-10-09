using System.Text;
using EsportsClash.Core.Combat;
using EsportsClash.Core.Evolutions;
using EsportsClash.Core.Gacha;
using EsportsClash.Core.GamingHouse;
using EsportsClash.Core.Models;
using EsportsClash.Core.Tournaments;

namespace EsportsClash.ConsoleApp;

public static class Program
{
    private static GachaService _gacha = new();
    private static EvolutionManager _evoManager = new();
    private static GamingHouseState _house = new();
    private static HouseSimulationEngine _houseSim = new();
    private static CombatEngine _combatEngine = new();

    private static List<PlayerCard> _userRoster = new();
    private static List<PlayerCard> _startingFive = new();
    private static CoachCard? _userCoach;
    private static TournamentEngine _tournament = null!;

    public static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        // Initialize Starter Squad
        SeedStarterSquad();

        var userTeam = new TournamentTeam("T-Chibi", _startingFive, _userCoach);
        _tournament = new TournamentEngine(userTeam);

        bool running = true;
        while (running)
        {
            Console.Clear();
            PrintBanner();
            PrintQuickStatus();

            Console.WriteLine("\n[ MAIN MENU ]");
            Console.WriteLine(" 1. 🎴 Pack Store & Gacha (Open Packs / Watch Ads)");
            Console.WriteLine(" 2. 👥 Squad & EA FC Card Inspect");
            Console.WriteLine(" 3. ⚡ Evolutions Hub (Upgrade & Evolve Cards)");
            Console.WriteLine(" 4. 🏠 Gaming House Management (Train, Stream, Rest, Upgrade)");
            Console.WriteLine(" 5. ⚔️ Play Split Tournament Match (1-Lane ARAM Mayhem)");
            Console.WriteLine(" 6. 🏆 League Standings & Split Trophy");
            Console.WriteLine(" 7. 🚪 Exit Game");
            Console.Write("\nSelect an option (1-7): ");

            string? choice = Console.ReadLine();
            switch (choice)
            {
                case "1":
                    RunPackStore();
                    break;
                case "2":
                    RunRosterInspect();
                    break;
                case "3":
                    RunEvolutionsHub();
                    break;
                case "4":
                    RunGamingHouse();
                    break;
                case "5":
                    RunTournamentMatch();
                    break;
                case "6":
                    RunLeagueStandings();
                    break;
                case "7":
                    running = false;
                    Console.WriteLine("\nThanks for playing Esports Clash: GOAT Manager! Good luck in the splits!");
                    break;
                default:
                    Console.WriteLine("Invalid option. Press any key...");
                    Console.ReadKey();
                    break;
            }
        }
    }

    private static void SeedStarterSquad()
    {
        var starterPlayers = GachaDatabase.GetAllPlayers();
        
        // Give player a starter mix: 1 GOAT/Diamond star + solid starters
        var flaker = starterPlayers.First(p => p.ParodyName == "Flaker");
        var daft = starterPlayers.First(p => p.ParodyName == "Daft");
        var p1mple = starterPlayers.First(p => p.ParodyName == "p1mple");
        var toaster = starterPlayers.First(p => p.ParodyName == "Toaster");
        var spicy = starterPlayers.First(p => p.ParodyName == "TheSpicy");

        _userRoster.AddRange(new[] { spicy, p1mple, flaker, daft, toaster });
        _startingFive = new List<PlayerCard>(_userRoster);

        _userCoach = GachaDatabase.GetAllCoaches().First(c => c.ParodyName == "KkOpa");
    }

    private static void PrintBanner()
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("""
        ================================================================================
           ⚡ ESPORTS CLASH: GOAT MANAGER ⚡
           [EA FC Ultimate Team Cards x Teamfight Manager x 1-Lane ARAM Mayhem]
        ================================================================================
        """);
        Console.ResetColor();
    }

    private static void PrintQuickStatus()
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.Write($"💰 Funds: ${_house.TeamFunds}  |  ");
        Console.ForegroundColor = ConsoleColor.Magenta;
        Console.Write($"⭐ Fans: {_house.FansCount:N0}  |  ");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.Write($"📅 Day: {_house.Day}  |  ");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"🏆 League: {_tournament.CurrentLeague} (Round {_tournament.CurrentRound}/{_tournament.MaxRounds})");
        Console.ResetColor();
    }

    private static void RunPackStore()
    {
        bool inStore = true;
        while (inStore)
        {
            Console.Clear();
            PrintBanner();
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[ 🎴 GACHA PACK STORE ] - Your Funds: ${_house.TeamFunds} Coins");
            Console.ResetColor();

            Console.WriteLine($"Pity Counters: Next Plat in {10 - _gacha.PityState.PullsSinceLastPlatinum} | Next Diamond in {40 - _gacha.PityState.PullsSinceLastDiamond} | Next GOAT in {100 - _gacha.PityState.PullsSinceLastGoat} pulls\n");

            Console.WriteLine(" 1. 🥉 Rookie Scout Pack       (Cost: 200 Coins)   - 3 Cards (Bronze-Gold)");
            Console.WriteLine(" 2. 🥇 Gold Pro Pack           (Cost: 1,000 Coins) - 5 Cards (1 Guaranteed Gold+)");
            Console.WriteLine(" 3. 💎 Diamond Elite Pack      (Cost: 4,000 Coins) - 5 Cards (1 Guaranteed Plat+, High Diamond)");
            Console.WriteLine(" 4. 👑 GOAT Legendary Pack     (Cost: 15,000 Coins)- 5 Cards (High GOAT & Diamond)");
            Console.WriteLine(" 5. 📺 Watch Rewarded Ad       (FREE Pack)         - Claim Daily Scout Pack (Max 3/day)");
            Console.WriteLine(" 6. 📺 Watch Ad for Energy     (FREE Refill)       - Recharges Squad Stamina (Max 2/day)");
            Console.WriteLine(" 7. 🔙 Back to Main Menu");
            Console.Write("\nSelect Pack: ");

            string? choice = Console.ReadLine();
            PackType? packToOpen = null;
            int cost = 0;

            switch (choice)
            {
                case "1":
                    packToOpen = PackType.RookieScoutPack;
                    cost = 200;
                    break;
                case "2":
                    packToOpen = PackType.GoldProPack;
                    cost = 1000;
                    break;
                case "3":
                    packToOpen = PackType.DiamondElitePack;
                    cost = 4000;
                    break;
                case "4":
                    packToOpen = PackType.GoatLegendaryPack;
                    cost = 15000;
                    break;
                case "5":
                    if (_gacha.TryWatchAdForFreePack(out var adPack, out string adMsg))
                    {
                        Console.WriteLine($"\n{adMsg}");
                        DisplayPackOpening(adPack!);
                    }
                    else
                    {
                        Console.WriteLine($"\n❌ {adMsg}");
                    }
                    Console.WriteLine("\nPress any key to continue...");
                    Console.ReadKey();
                    continue;
                case "6":
                    _gacha.TryWatchAdForEnergy(out string energyMsg);
                    Console.WriteLine($"\n{energyMsg}");
                    foreach (var p in _userRoster) p.Fatigue = Math.Max(0, p.Fatigue - 40);
                    Console.WriteLine("\nPress any key to continue...");
                    Console.ReadKey();
                    continue;
                case "7":
                    inStore = false;
                    continue;
            }

            if (packToOpen.HasValue)
            {
                if (_house.TeamFunds < cost)
                {
                    Console.WriteLine($"\n❌ Not enough coins! Need {cost}, but you have {_house.TeamFunds}.");
                }
                else
                {
                    _house.TeamFunds -= cost;
                    var pack = _gacha.OpenPack(packToOpen.Value, _userRoster.Select(p => p.ParodyName).ToList());
                    DisplayPackOpening(pack);
                    _userRoster.AddRange(pack.DroppedPlayers);
                    if (pack.DroppedCoach != null) _userCoach = pack.DroppedCoach;
                }
                Console.WriteLine("\nPress any key to continue...");
                Console.ReadKey();
            }
        }
    }

    private static void DisplayPackOpening(PackResult pack)
    {
        Console.WriteLine("\n🎉 --- OPENING PACK --- 🎉");
        Thread.Sleep(500);

        foreach (var player in pack.DroppedPlayers)
        {
            Console.ForegroundColor = GetTierColor(player.Tier);
            Console.WriteLine($"✨ REVEAL: [{player.Tier.ToString().ToUpper()}] {player.ParodyName} (OVR: {player.OverallRating}) - Role: {player.TacticalRole} ({player.Origin})");
            Console.ResetColor();
        }

        if (pack.DroppedCoach != null)
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"👔 COACH UNLOCKED: {pack.DroppedCoach.ParodyName} (Tier: {pack.DroppedCoach.Tier}, Style: {pack.DroppedCoach.TacticalStyle})");
            Console.ResetColor();
        }

        if (pack.ConvertedCoins > 0)
        {
            Console.WriteLine($"♻️ Duplicate Cards converted into +{pack.ConvertedCoins} Coins and +{pack.ConvertedEvoShards} Evo Shards!");
            _house.TeamFunds += pack.ConvertedCoins;
        }
    }

    private static void RunRosterInspect()
    {
        Console.Clear();
        PrintBanner();
        Console.WriteLine("[ 👥 SQUAD ROSTER & EA FC CARD INSPECT ]\n");

        for (int i = 0; i < _userRoster.Count; i++)
        {
            var p = _userRoster[i];
            Console.ForegroundColor = GetTierColor(p.Tier);
            Console.WriteLine($"[{i + 1}] {p.ParodyName,-12} | OVR: {p.OverallRating,2} | Tier: {p.Tier,-8} | Role: {p.TacticalRole,-10} | Origin: {p.Origin,-16} | Morale: {p.Morale}% | Fatigue: {p.Fatigue}%");
            Console.ResetColor();
        }

        Console.Write("\nEnter player number to inspect full EA FC card (or press Enter to return): ");
        string? input = Console.ReadLine();
        if (int.TryParse(input, out int idx) && idx >= 1 && idx <= _userRoster.Count)
        {
            RenderEaFcCard(_userRoster[idx - 1]);
            Console.WriteLine("\nPress any key to return...");
            Console.ReadKey();
        }
    }

    private static void RenderEaFcCard(PlayerCard card)
    {
        Console.ForegroundColor = GetTierColor(card.Tier);
        Console.WriteLine("\n+======================================================+");
        Console.WriteLine($"|  OVR: {card.OverallRating,-2}  | TIER: {card.Tier.ToString().ToUpper(),-8} | ROLE: {card.TacticalRole,-8} | ORIGIN: {card.Origin,-7} |");
        Console.WriteLine("+======================================================+");
        Console.WriteLine($"|  PLAYER: {card.ParodyName,-14} (Based on: {card.RealNameReference,-12})  |");
        Console.WriteLine("|                                                      |");
        Console.WriteLine($"|  {card.ChibiAscii.Replace("\n", "\n|  "),-52}|");
        Console.WriteLine("|                                                      |");
        Console.WriteLine("+------------------ [ FACE STATS ] --------------------+");
        Console.WriteLine($"|  LAN (Laning/Micro): {card.CurrentAttributes.LAN,-2}     |  TF  (Teamfight):   {card.CurrentAttributes.TF,-2}   |");
        Console.WriteLine($"|  IQ  (Game Sense):   {card.CurrentAttributes.IQ,-2}     |  CLU (Clutch):      {card.CurrentAttributes.CLU,-2}   |");
        Console.WriteLine($"|  STA (Stamina):      {card.CurrentAttributes.STA,-2}     |  FLX (Flexibility): {card.CurrentAttributes.FLX,-2}   |");
        Console.WriteLine("+------------------------------------------------------+");
        Console.WriteLine($"|  Attitude: {card.Personality,-42}|");
        Console.WriteLine($"|  Badges:   {string.Join(", ", card.Badges),-42}|");
        Console.WriteLine($"|  Pool:     {string.Join(", ", card.SignatureChampions),-42}|");
        Console.WriteLine("+======================================================+");
        Console.ResetColor();
    }

    private static void RunEvolutionsHub()
    {
        Console.Clear();
        PrintBanner();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("[ ⚡ EA FC-STYLE EVOLUTIONS HUB ]\n");
        Console.ResetColor();

        Console.WriteLine("=== Available Evolution Paths ===");
        var plans = _evoManager.AvailablePlans;
        for (int i = 0; i < plans.Count; i++)
        {
            var plan = plans[i];
            Console.WriteLine($"[{i + 1}] {plan.Name} (Cost: {plan.CoinCost} Coins)");
            Console.WriteLine($"    Description: {plan.Description}");
            Console.WriteLine($"    Requirements: Max Tier {plan.MaxAllowedTier}, Max OVR {plan.MaxAllowedOvr}");
            Console.WriteLine($"    Reward: Evolve to {plan.TargetTier.ToString().ToUpper()} tier (+Stat Boost & Badge: {plan.UnlockedBadge})\n");
        }

        Console.WriteLine("=== Active Evolutions in Progress ===");
        if (!_evoManager.ActiveEvolutions.Any())
        {
            Console.WriteLine("  (No active evolutions. Select a player and plan below to begin!)");
        }
        else
        {
            foreach (var kvp in _evoManager.ActiveEvolutions)
            {
                var card = _userRoster.FirstOrDefault(p => p.Id == kvp.Key);
                var active = kvp.Value;
                string cardName = card?.ParodyName ?? "Unknown";
                Console.WriteLine($"🔥 Player: {cardName} | Plan: {active.Plan.Name}");
                for (int j = 0; j < active.Plan.Objectives.Count; j++)
                {
                    var obj = active.Plan.Objectives[j];
                    int prog = active.ObjectiveProgress[j];
                    Console.WriteLine($"   - {obj.Description}: [{prog}/{obj.TargetAmount}] {(prog >= obj.TargetAmount ? "✅" : "⏳")}");
                }

                if (active.IsComplete)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("   🎉 OBJECTIVES MET! Ready to claim upgrade!");
                    Console.ResetColor();
                }
            }
        }

        Console.WriteLine("\nOptions: [1] Start New Evolution  |  [2] Claim Completed Evolution  |  [3] Return");
        Console.Write("Choice: ");
        string? opt = Console.ReadLine();

        if (opt == "1")
        {
            Console.Write("Select Player # from roster to evolve: ");
            if (int.TryParse(Console.ReadLine(), out int pIdx) && pIdx >= 1 && pIdx <= _userRoster.Count)
            {
                var player = _userRoster[pIdx - 1];
                Console.Write("Select Evolution Plan # (1-3): ");
                if (int.TryParse(Console.ReadLine(), out int planIdx) && planIdx >= 1 && planIdx <= plans.Count)
                {
                    var plan = plans[planIdx - 1];
                    if (_house.TeamFunds < plan.CoinCost)
                    {
                        Console.WriteLine($"\n❌ Insufficient funds. Need {plan.CoinCost} coins.");
                    }
                    else if (_evoManager.StartEvolution(player, plan, out string err))
                    {
                        _house.TeamFunds -= plan.CoinCost;
                        Console.WriteLine($"\n✅ Successfully started '{plan.Name}' for {player.ParodyName}!");
                    }
                    else
                    {
                        Console.WriteLine($"\n❌ Could not start: {err}");
                    }
                }
            }
        }
        else if (opt == "2")
        {
            foreach (var player in _userRoster)
            {
                if (_evoManager.TryClaimEvolution(player, out string claimMsg))
                {
                    Console.WriteLine($"\n{claimMsg}");
                }
            }
        }

        Console.WriteLine("\nPress any key to return...");
        Console.ReadKey();
    }

    private static void RunGamingHouse()
    {
        Console.Clear();
        PrintBanner();
        Console.ForegroundColor = ConsoleColor.Magenta;
        Console.WriteLine("[ 🏠 GAMING HOUSE & LIFE SIMULATION ]\n");
        Console.ResetColor();

        Console.WriteLine($"Mansion: {_house.HouseName} | Funds: ${_house.TeamFunds} | Day: {_house.Day}");
        Console.WriteLine("\n=== Facilities Status ===");
        foreach (var fac in _house.Facilities.Values)
        {
            Console.WriteLine($"  • {fac.Name,-34} | Lv. {fac.Level}/{fac.MaxLevel} (Upgrade Cost: ${fac.UpgradeCost})");
        }

        Console.WriteLine("\n=== Daily Schedule Activities ===");
        Console.WriteLine(" 1. ⚔️ Run Scrims              (+Mechanics & Teamfight XP, increases Fatigue)");
        Console.WriteLine(" 2. 🧠 Strategy & VOD Review   (+Game IQ, tactical playbook bonus)");
        Console.WriteLine(" 3. 🏋️ Gym & Physio Workout    (Heals wrist fatigue, builds stamina)");
        Console.WriteLine(" 4. 📹 Live Stream to Fans     (Earns Cash & Fans, boosts hype)");
        Console.WriteLine(" 5. 💤 Sleep & Recovery        (Major fatigue recovery in sleep pods)");
        Console.WriteLine(" 6. 🍕 Team Building Dinner    (Big Morale & Chemistry boost)");
        Console.WriteLine(" 7. 🔨 Upgrade a Facility");
        Console.WriteLine(" 8. 🔙 Return");
        Console.Write("\nSelect daily action: ");

        string? actChoice = Console.ReadLine();
        DailyActivity? selectedAct = actChoice switch
        {
            "1" => DailyActivity.ScrimSession,
            "2" => DailyActivity.VodReview,
            "3" => DailyActivity.GymWorkout,
            "4" => DailyActivity.StreamLive,
            "5" => DailyActivity.RestAndSleep,
            "6" => DailyActivity.TeamBuildingDinner,
            _ => null
        };

        if (selectedAct.HasValue)
        {
            _houseSim.ProcessDailySchedule(_house, _startingFive, selectedAct.Value, out var logs);
            Console.WriteLine("\n=== Daily Activity Report ===");
            foreach (var log in logs) Console.WriteLine(log);
        }
        else if (actChoice == "7")
        {
            Console.WriteLine("\nSelect facility to upgrade (1-6):");
            int fIdx = 1;
            var list = _house.Facilities.Values.ToList();
            foreach (var f in list)
            {
                Console.WriteLine($" [{fIdx++}] {f.Name} (Cost: ${f.UpgradeCost})");
            }
            if (int.TryParse(Console.ReadLine(), out int choice) && choice >= 1 && choice <= list.Count)
            {
                int funds = _house.TeamFunds;
                if (list[choice - 1].Upgrade(ref funds, out string msg))
                {
                    _house.TeamFunds = funds;
                    Console.WriteLine($"\n{msg}");
                }
                else
                {
                    Console.WriteLine($"\n❌ {msg}");
                }
            }
        }

        Console.WriteLine("\nPress any key to return...");
        Console.ReadKey();
    }

    private static void RunTournamentMatch()
    {
        Console.Clear();
        PrintBanner();

        if (_tournament.IsSeasonComplete)
        {
            var (prize, pack, promoted) = _tournament.ConcludeSeason();
            Console.WriteLine($"🎉 SPLIT CONCLUDED! Standing Rewards: +${prize} Coins & 1x {pack}!");
            _house.TeamFunds += prize;
            var bonusPack = _gacha.OpenPack(pack);
            DisplayPackOpening(bonusPack);
            _userRoster.AddRange(bonusPack.DroppedPlayers);
            if (promoted)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"\n🏆 PROMOTION ACHIEVED! Advanced to {_tournament.CurrentLeague}!");
                Console.ResetColor();
            }
            _tournament.InitializeLeague(_tournament.CurrentLeague);
            Console.WriteLine("\nPress any key to continue...");
            Console.ReadKey();
            return;
        }

        var opponent = _tournament.GetNextOpponent();
        if (opponent == null) return;

        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"[ ⚔️ MATCH PREVIEW - SPLIT ROUND {_tournament.CurrentRound}/{_tournament.MaxRounds} ]");
        Console.ResetColor();
        Console.WriteLine($"\nYour Team: {_tournament.UserTeam.Name} (Avg OVR: {_tournament.UserTeam.AverageOvr})");
        Console.WriteLine($"Opponent:  {opponent.Name} (Avg OVR: {opponent.AverageOvr})");

        Console.WriteLine("\n=== Pick & Ban Champions (1-Lane ARAM Mayhem) ===");
        var allChamps = ChampionDatabase.GetAllChampions();

        // Assign Champions to Starting 5
        var blueLineup = new List<(PlayerCard Player, ChampionKit Champion)>();
        for (int i = 0; i < 5; i++)
        {
            var player = _startingFive[i];
            var champ = allChamps[i % allChamps.Count];
            blueLineup.Add((player, champ));
        }

        var redLineup = new List<(PlayerCard Player, ChampionKit Champion)>();
        for (int i = 0; i < 5; i++)
        {
            var player = opponent.Roster[i];
            var champ = allChamps[(i + 1) % allChamps.Count];
            redLineup.Add((player, champ));
        }

        Console.WriteLine("\nYour Lineup:");
        foreach (var pair in blueLineup)
        {
            Console.WriteLine($"  • {pair.Player.ParodyName,-12} playing -> 🛡️ {pair.Champion.Name} ({pair.Champion.Title})");
        }

        Console.WriteLine("\nPress Enter to commence the match simulation...");
        Console.ReadLine();

        var matchResult = _combatEngine.SimulateMatch(
            _tournament.UserTeam.Name, 
            blueLineup, 
            opponent.Name, 
            redLineup, 
            _userCoach, 
            opponent.Coach
        );

        Console.WriteLine("\n=== COMBAT BROADCAST LOG ===");
        foreach (var log in matchResult.CombatLog)
        {
            Console.WriteLine(log);
            Thread.Sleep(50);
        }

        // Record tournament split result
        int scoreA = matchResult.WinningTeamIndex == 0 ? 2 : 0;
        int scoreB = matchResult.WinningTeamIndex == 1 ? 2 : 0;
        _tournament.RecordMatchResult(_tournament.UserTeam, opponent, scoreA, scoreB);

        // Update active evolution quests
        bool userWon = matchResult.WinningTeamIndex == 0;
        foreach (var entity in matchResult.AllEntities.Where(e => e.TeamIndex == 0))
        {
            _evoManager.OnMatchCompleted(
                entity.ControllingPlayer.Id, 
                userWon, 
                entity.Kills, 
                entity.Assists, 
                entity.Champion.Name, 
                noTilt: entity.ControllingPlayer.Fatigue < 60
            );
        }

        Console.WriteLine("\nPress any key to return...");
        Console.ReadKey();
    }

    private static void RunLeagueStandings()
    {
        Console.Clear();
        PrintBanner();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"[ 🏆 LEAGUE STANDINGS - {_tournament.CurrentLeague.ToString().ToUpper()} ]\n");
        Console.ResetColor();

        var standings = _tournament.GetStandings();
        Console.WriteLine("Pos | Team Name            | Won | Lost | Points | Avg OVR");
        Console.WriteLine("---------------------------------------------------------");
        for (int i = 0; i < standings.Count; i++)
        {
            var t = standings[i];
            bool isUser = t == _tournament.UserTeam;
            if (isUser) Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($" #{i + 1,-2}| {t.Name,-20} | {t.Wins,3} | {t.Losses,4} | {t.Points,6} | {t.AverageOvr,7}");
            if (isUser) Console.ResetColor();
        }

        Console.WriteLine("\nPress any key to return...");
        Console.ReadKey();
    }

    private static ConsoleColor GetTierColor(CardTier tier) => tier switch
    {
        CardTier.Bronze => ConsoleColor.DarkYellow,
        CardTier.Silver => ConsoleColor.Gray,
        CardTier.Gold => ConsoleColor.Yellow,
        CardTier.Platinum => ConsoleColor.Cyan,
        CardTier.Diamond => ConsoleColor.Blue,
        CardTier.GOAT => ConsoleColor.Magenta,
        _ => ConsoleColor.White
    };
}
