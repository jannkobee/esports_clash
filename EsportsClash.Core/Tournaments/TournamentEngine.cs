using EsportsClash.Core.Models;
using EsportsClash.Core.Gacha;

namespace EsportsClash.Core.Tournaments;

public class TournamentEngine
{
    private readonly Random _rng = new();
    public LeagueTier CurrentLeague { get; set; } = LeagueTier.AmateurOpen;
    public SplitSeason CurrentSplit { get; set; } = SplitSeason.SpringSplit;
    public int CurrentRound { get; set; } = 1;
    public int MaxRounds => 6;

    public List<TournamentTeam> Teams { get; private set; } = new();
    public TournamentTeam UserTeam { get; private set; }

    public TournamentEngine(TournamentTeam userTeam)
    {
        UserTeam = userTeam;
        InitializeLeague(CurrentLeague);
    }

    public void InitializeLeague(LeagueTier tier)
    {
        CurrentLeague = tier;
        CurrentRound = 1;
        Teams.Clear();
        Teams.Add(UserTeam);
        UserTeam.Wins = 0;
        UserTeam.Losses = 0;

        // Generate AI Rival Teams appropriate for the tier
        var aiTeams = GenerateRivalTeams(tier);
        Teams.AddRange(aiTeams);
    }

    public List<TournamentTeam> GetStandings()
    {
        return Teams.OrderByDescending(t => t.Points).ThenByDescending(t => t.Wins).ToList();
    }

    public TournamentTeam? GetNextOpponent()
    {
        var rivals = Teams.Where(t => t != UserTeam).ToList();
        if (!rivals.Any()) return null;
        int idx = (CurrentRound - 1) % rivals.Count;
        return rivals[idx];
    }

    public void RecordMatchResult(TournamentTeam teamA, TournamentTeam teamB, int scoreA, int scoreB)
    {
        if (scoreA > scoreB)
        {
            teamA.Wins++;
            teamB.Losses++;
        }
        else
        {
            teamB.Wins++;
            teamA.Losses++;
        }

        // Simulate other AI vs AI matches for this round
        SimulateAiMatches();
        CurrentRound++;
    }

    private void SimulateAiMatches()
    {
        var aiTeams = Teams.Where(t => t != UserTeam).ToList();
        for (int i = 0; i < aiTeams.Count - 1; i += 2)
        {
            var t1 = aiTeams[i];
            var t2 = aiTeams[i + 1];

            // Win chance weighted by average OVR
            double chanceT1 = (double)t1.AverageOvr / (t1.AverageOvr + t2.AverageOvr);
            if (_rng.NextDouble() < chanceT1)
            {
                t1.Wins++;
                t2.Losses++;
            }
            else
            {
                t2.Wins++;
                t1.Losses++;
            }
        }
    }

    public bool IsSeasonComplete => CurrentRound > MaxRounds;

    public (int PrizeMoney, PackType RewardPack, bool Promoted) ConcludeSeason()
    {
        var standings = GetStandings();
        int userRank = standings.IndexOf(UserTeam) + 1;

        int prizeMoney = 0;
        PackType rewardPack = PackType.RookieScoutPack;
        bool promoted = false;

        switch (userRank)
        {
            case 1:
                prizeMoney = (int)CurrentLeague * 5000;
                rewardPack = CurrentLeague >= LeagueTier.ContinentalPremier ? PackType.GoatLegendaryPack : PackType.DiamondElitePack;
                promoted = CurrentLeague < LeagueTier.GoatWorldChampionship;
                break;
            case 2:
                prizeMoney = (int)CurrentLeague * 3000;
                rewardPack = PackType.DiamondElitePack;
                promoted = CurrentLeague < LeagueTier.GoatWorldChampionship;
                break;
            case 3:
            case 4:
                prizeMoney = (int)CurrentLeague * 1500;
                rewardPack = PackType.GoldProPack;
                break;
            default:
                prizeMoney = 500;
                rewardPack = PackType.RookieScoutPack;
                break;
        }

        if (promoted)
        {
            CurrentLeague++;
        }

        return (prizeMoney, rewardPack, promoted);
    }

    private List<TournamentTeam> GenerateRivalTeams(LeagueTier tier)
    {
        int baseOvr = tier switch
        {
            LeagueTier.AmateurOpen => 55,
            LeagueTier.RegionalChallenger => 72,
            LeagueTier.ContinentalPremier => 85,
            LeagueTier.GoatWorldChampionship => 94,
            _ => 60
        };

        var names = tier switch
        {
            LeagueTier.AmateurOpen => new[] { "Pixel Pups", "Basement Scrubs", "Coffee Esports" },
            LeagueTier.RegionalChallenger => new[] { "Chibi Cloud9", "Mini Fnatic", "Baby G2" },
            LeagueTier.ContinentalPremier => new[] { "Paper Rex Smol", "T1 Chibi Clan", "Navi Tiny" },
            LeagueTier.GoatWorldChampionship => new[] { "T-Zero Dynasty", "Gen-Z Giants", "Sentinels Mini" },
            _ => new[] { "Rival A", "Rival B", "Rival C" }
        };

        var list = new List<TournamentTeam>();
        foreach (var name in names)
        {
            var roster = new List<PlayerCard>();
            for (int i = 0; i < 5; i++)
            {
                int ovr = baseOvr + _rng.Next(-3, 4);
                roster.Add(new PlayerCard($"AI_{name}_{i+1}", "AI", GameOrigin.LeagueOfLegends, (CombatRole)i, CardTier.Gold, new PlayerAttributes(ovr, ovr, ovr, ovr, ovr, ovr), Attitude.LaidBack));
            }
            list.Add(new TournamentTeam(name, roster));
        }

        return list;
    }
}

