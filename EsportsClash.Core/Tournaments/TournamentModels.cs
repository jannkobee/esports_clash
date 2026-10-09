using EsportsClash.Core.Models;
using EsportsClash.Core.Gacha;

namespace EsportsClash.Core.Tournaments;

public enum LeagueTier
{
    AmateurOpen = 1,
    RegionalChallenger = 2,
    ContinentalPremier = 3,
    GoatWorldChampionship = 4
}

public enum SplitSeason
{
    SpringSplit,
    MidSeasonCup,
    SummerSplit,
    RegionalGauntlet,
    GoatWorldInvitational
}

public class TournamentTeam
{
    public string Name { get; set; }
    public List<PlayerCard> Roster { get; set; } = new();
    public CoachCard? Coach { get; set; }
    public int Wins { get; set; } = 0;
    public int Losses { get; set; } = 0;
    public int Points => (Wins * 3);
    public int AverageOvr => Roster.Any() ? (int)Roster.Average(p => p.OverallRating) : 50;

    public TournamentTeam(string name, List<PlayerCard> roster, CoachCard? coach = null)
    {
        Name = name;
        Roster = roster;
        Coach = coach;
    }
}

public class TournamentMatchResult
{
    public TournamentTeam TeamA { get; set; } = null!;
    public TournamentTeam TeamB { get; set; } = null!;
    public int ScoreA { get; set; }
    public int ScoreB { get; set; }
    public TournamentTeam Winner => ScoreA > ScoreB ? TeamA : TeamB;
    public string MatchSummary { get; set; } = string.Empty;
}
