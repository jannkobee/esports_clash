using Xunit;
using EsportsClash.Core.Models;
using EsportsClash.Core.Gacha;
using EsportsClash.Core.Evolutions;
using EsportsClash.Core.GamingHouse;
using EsportsClash.Core.Tournaments;
using EsportsClash.Core.Combat;

namespace EsportsClash.Tests;

public class EsportsClashTests
{
    [Fact]
    public void GachaService_PitySystem_GuaranteesPlatAndDiamondAndGoat()
    {
        var gacha = new GachaService(seed: 42);

        // Simulate pulls to verify pity increments
        for (int i = 0; i < 20; i++)
        {
            var pack = gacha.OpenPack(PackType.RookieScoutPack);
            Assert.NotEmpty(pack.DroppedPlayers);
        }

        Assert.True(gacha.PityState.TotalPulls > 0);
    }

    [Fact]
    public void RewardedAd_EnforcesDailyLimit()
    {
        var gacha = new GachaService();

        // Claim 3 free packs
        Assert.True(gacha.TryWatchAdForFreePack(out var p1, out _));
        Assert.True(gacha.TryWatchAdForFreePack(out var p2, out _));
        Assert.True(gacha.TryWatchAdForFreePack(out var p3, out _));

        // 4th should fail
        Assert.False(gacha.TryWatchAdForFreePack(out var p4, out string msg));
        Assert.Contains("limit reached", msg);
    }

    [Fact]
    public void EvolutionManager_StartsAndCompletesEvolution()
    {
        var evoManager = new EvolutionManager();
        var rookie = new PlayerCard("PixelRookie", "Amateur", GameOrigin.LeagueOfLegends, CombatRole.Frontline, CardTier.Bronze, new PlayerAttributes(52, 54, 50, 48, 55, 50), Attitude.LaidBack);

        var plan = evoManager.AvailablePlans.First(p => p.Id == "evo_rookie_awakening");

        // Start evolution
        bool started = evoManager.StartEvolution(rookie, plan, out string error);
        Assert.True(started, error);

        // Record progress
        evoManager.OnMatchCompleted(rookie.Id, wonMatch: true, kills: 5, assists: 8, championUsed: "Solana", noTilt: true);
        evoManager.OnMatchCompleted(rookie.Id, wonMatch: true, kills: 5, assists: 8, championUsed: "Solana", noTilt: true);
        evoManager.OnMatchCompleted(rookie.Id, wonMatch: true, kills: 2, assists: 2, championUsed: "Solana", noTilt: true);

        // Claim evolution
        bool claimed = evoManager.TryClaimEvolution(rookie, out string resultMsg);
        Assert.True(claimed, resultMsg);
        Assert.Equal(CardTier.Gold, rookie.Tier);
        Assert.Contains(PlaystyleBadge.LaningDemon, rookie.Badges);
    }

    [Fact]
    public void GamingHouse_SimulatesDailyActivityAndRecoversFatigue()
    {
        var house = new GamingHouseState();
        var sim = new HouseSimulationEngine();
        var player = new PlayerCard("Flaker", "Faker", GameOrigin.LeagueOfLegends, CombatRole.Mage, CardTier.GOAT, new PlayerAttributes(99, 98, 98, 99, 94, 96), Attitude.StoicMastermind);
        player.Fatigue = 80;

        var roster = new List<PlayerCard> { player };

        sim.ProcessDailySchedule(house, roster, DailyActivity.RestAndSleep, out var logs);

        Assert.True(player.Fatigue < 80);
        Assert.NotEmpty(logs);
        Assert.Equal(2, house.Day);
    }

    [Fact]
    public void CombatEngine_Simulates5v5AramMatchSuccessfully()
    {
        var engine = new CombatEngine();
        var champs = ChampionDatabase.GetAllChampions();
        Assert.Equal(5, champs.Count);

        var players = GachaDatabase.GetAllPlayers();
        var bluePlayers = players.Take(5).ToList();
        var redPlayers = players.Skip(5).Take(5).ToList();

        var blueLineup = bluePlayers.Select((p, idx) => (p, champs[idx % champs.Count])).ToList();
        var redLineup = redPlayers.Select((p, idx) => (p, champs[(idx + 1) % champs.Count])).ToList();

        var matchResult = engine.SimulateMatch("T-Zero", blueLineup, "Baby-G2", redLineup);

        Assert.NotEmpty(matchResult.WinnerTeamName);
        Assert.NotEmpty(matchResult.CombatLog);
        Assert.NotNull(matchResult.MvpPlayer);
        Assert.True(matchResult.MatchDurationSeconds > 0);
    }

    [Fact]
    public void CombatDecision_UsesCardIqForTargetAndAbilityTiming()
    {
        var champion = ChampionDatabase.GetAllChampions().First();
        CombatEntity Create(string name, int iq, double x) => new(
            new PlayerCard(name, name, GameOrigin.LeagueOfLegends, CombatRole.Mage, CardTier.Gold,
                new PlayerAttributes(70, 70, iq, 70, 70, 70), Attitude.LaidBack), champion, 0, x);

        var lowIq = Create("Low", 20, 0);
        var highIq = Create("High", 95, 0);
        var near = Create("Near", 50, 50);
        var vulnerable = Create("Vulnerable", 50, 51);
        vulnerable.CurrentHp = vulnerable.MaxHp * 0.2;

        Assert.Same(near, CombatDecision.ChooseTarget(lowIq, new[] { near, vulnerable }));
        Assert.Same(vulnerable, CombatDecision.ChooseTarget(highIq, new[] { near, vulnerable }));
        Assert.Equal(CombatAction.Skill1, CombatDecision.ChooseAction(lowIq, near, 1));
        Assert.Equal(CombatAction.Skill2, CombatDecision.ChooseAction(highIq, near, 1));
        Assert.Equal(CombatAction.Ultimate, CombatDecision.ChooseAction(highIq, near, 2));
        vulnerable.CurrentHp = highIq.AttackDamage * 0.5;
        Assert.Equal(CombatAction.Attack, CombatDecision.ChooseAction(highIq, vulnerable, 1));
    }

    [Fact]
    public void TournamentEngine_GeneratesStandingsAndProgression()
    {
        var players = GachaDatabase.GetAllPlayers().Take(5).ToList();
        var userTeam = new TournamentTeam("MyChibiSquad", players);
        var tourney = new TournamentEngine(userTeam);

        Assert.Equal(4, tourney.Teams.Count);

        var opponent = tourney.GetNextOpponent();
        Assert.NotNull(opponent);

        tourney.RecordMatchResult(userTeam, opponent, 2, 1);
        Assert.Equal(1, userTeam.Wins);
        Assert.Equal(3, userTeam.Points);

        var standings = tourney.GetStandings();
        Assert.Equal(userTeam, standings.First());
    }
}

