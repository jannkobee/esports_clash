using EsportsClash.Core.Models;

namespace EsportsClash.Core.Gacha;

public class GachaService
{
    private readonly Random _rng = new();
    private readonly List<PlayerCard> _playerPool;
    private readonly List<CoachCard> _coachPool;
    public GachaPityState PityState { get; } = new();

    public GachaService(int? seed = null)
    {
        if (seed.HasValue) _rng = new Random(seed.Value);
        _playerPool = GachaDatabase.GetAllPlayers();
        _coachPool = GachaDatabase.GetAllCoaches();
    }

    public PackResult OpenPack(PackType type, List<string>? existingPlayerCardNames = null)
    {
        existingPlayerCardNames ??= new List<string>();
        var result = new PackResult { PackType = type };
        int cardCount = type == PackType.RookieScoutPack ? 3 : 5;

        for (int i = 0; i < cardCount; i++)
        {
            PityState.TotalPulls++;
            PityState.PullsSinceLastPlatinum++;
            PityState.PullsSinceLastDiamond++;
            PityState.PullsSinceLastGoat++;

            // Evaluate Card Tier based on Pack Type and Pity Counters
            CardTier selectedTier = DetermineTier(type);

            // Fetch a random player of this tier
            var eligiblePlayers = _playerPool.Where(p => p.Tier == selectedTier).ToList();
            if (!eligiblePlayers.Any())
            {
                eligiblePlayers = _playerPool.Where(p => p.Tier <= selectedTier).ToList();
            }

            var baseCard = eligiblePlayers[_rng.Next(eligiblePlayers.Count)];
            // Clone fresh instance
            var cardInstance = new PlayerCard(
                baseCard.ParodyName,
                baseCard.RealNameReference,
                baseCard.Origin,
                baseCard.TacticalRole,
                baseCard.Tier,
                baseCard.BaseAttributes,
                baseCard.Personality,
                new List<PlaystyleBadge>(baseCard.Badges),
                new List<string>(baseCard.SignatureChampions),
                baseCard.ChibiAscii
            );

            // Duplicate Handling (EA FC style conversion)
            if (existingPlayerCardNames.Contains(cardInstance.ParodyName))
            {
                int coins = (int)cardInstance.Tier * 200;
                int shards = (int)cardInstance.Tier * 10;
                result.ConvertedCoins += coins;
                result.ConvertedEvoShards += shards;
            }

            result.DroppedPlayers.Add(cardInstance);
        }

        // 20% chance to drop a Coach Card in Gold/Diamond/GOAT packs
        if (type != PackType.RookieScoutPack && _rng.NextDouble() < 0.25)
        {
            result.DroppedCoach = _coachPool[_rng.Next(_coachPool.Count)];
        }

        result.Summary = $"Opened {type}: {result.DroppedPlayers.Count} players received." + 
            (result.DroppedCoach != null ? $" (Bonus Coach: {result.DroppedCoach.ParodyName})" : "");

        return result;
    }

    public bool TryWatchAdForFreePack(out PackResult? packResult, out string message)
    {
        if (PityState.DailyFreePacksClaimed >= 3)
        {
            packResult = null;
            message = "Daily Ad Free Pack limit reached (3/3). Resets tomorrow!";
            return false;
        }

        PityState.DailyAdsWatchedToday++;
        PityState.DailyFreePacksClaimed++;
        packResult = OpenPack(PackType.RookieScoutPack);
        message = $"📺 Ad watched! Free Rookie Scout Pack granted! ({PityState.DailyFreePacksClaimed}/3 today)";
        return true;
    }

    public bool TryWatchAdForEnergy(out string message)
    {
        if (PityState.DailyEnergyRefillsClaimed >= 2)
        {
            message = "Daily Energy Refill ad limit reached (2/2).";
            return false;
        }

        PityState.DailyAdsWatchedToday++;
        PityState.DailyEnergyRefillsClaimed++;
        message = $"📺 Energy Drink sponsorship ad watched! Gaming house stamina recharged! ({PityState.DailyEnergyRefillsClaimed}/2 today)";
        return true;
    }

    private CardTier DetermineTier(PackType packType)
    {
        // 1. Check Hard Pity Thresholds
        if (PityState.PullsSinceLastGoat >= 100)
        {
            ResetPity(CardTier.GOAT);
            return CardTier.GOAT;
        }
        if (PityState.PullsSinceLastDiamond >= 40)
        {
            ResetPity(CardTier.Diamond);
            return CardTier.Diamond;
        }
        if (PityState.PullsSinceLastPlatinum >= 10)
        {
            ResetPity(CardTier.Platinum);
            return CardTier.Platinum;
        }

        // 2. Base Drop Probabilities by Pack
        double roll = _rng.NextDouble();

        CardTier resultTier = packType switch
        {
            PackType.RookieScoutPack => roll switch
            {
                < 0.05 => CardTier.Gold,
                < 0.35 => CardTier.Silver,
                _ => CardTier.Bronze
            },
            PackType.GoldProPack => roll switch
            {
                < 0.005 => CardTier.GOAT,
                < 0.03 => CardTier.Diamond,
                < 0.15 => CardTier.Platinum,
                < 0.70 => CardTier.Gold,
                _ => CardTier.Silver
            },
            PackType.DiamondElitePack => roll switch
            {
                < 0.03 => CardTier.GOAT,
                < 0.25 => CardTier.Diamond,
                < 0.75 => CardTier.Platinum,
                _ => CardTier.Gold
            },
            PackType.GoatLegendaryPack => roll switch
            {
                < 0.25 => CardTier.GOAT,
                _ => CardTier.Diamond
            },
            _ => CardTier.Bronze
        };

        ResetPity(resultTier);
        return resultTier;
    }

    private void ResetPity(CardTier tier)
    {
        if (tier >= CardTier.Platinum) PityState.PullsSinceLastPlatinum = 0;
        if (tier >= CardTier.Diamond) PityState.PullsSinceLastDiamond = 0;
        if (tier >= CardTier.GOAT) PityState.PullsSinceLastGoat = 0;
    }
}

