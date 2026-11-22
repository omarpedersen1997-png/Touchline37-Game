using System;
using System.Collections.Generic;

namespace Touchline.Core
{
    [Serializable]
    public sealed class PlayerProfile
    {
        public string Id = "", Name = "", Position = "MID";
        public int Rating = 50, Potential = 99, Development, Number = 1;
        public float Form = 70, Energy = 100;
    }

    [Serializable]
    public sealed class ClubProfile
    {
        public string Name = "Prøvelund BK", Formation = "4-3-3", Tactic = "balanced";
        public int Training = 1, Coach, ClubBonus, Played, Wins, Draws, GoalsFor, GoalsAgainst, Experience;
        public long Money = 1500, LastAccrualUtcTicks;
        public double IncomeRemainder;
        public List<PlayerProfile> Players = new List<PlayerProfile>();
        public List<string> SettledMatches = new List<string>();
    }

    public static class ClubRules
    {
        public static readonly string[] Formations = { "4-3-3", "4-4-2", "3-5-2", "4-5-1" };
        public static string[] Roles(string formation)
        {
            int backs = formation == "3-5-2" ? 3 : 4;
            int mids = formation == "4-4-2" ? 4 : formation == "3-5-2" || formation == "4-5-1" ? 5 : 3;
            var result = new string[11]; result[0] = "MÅL";
            for (int i = 1; i < 11; i++) result[i] = i <= backs ? "FOR" : i <= backs + mids ? "MID" : "ANG";
            return result;
        }
        // Exact port of shared/team-strength.js, including JS's .5 rounding.
        public static int EffectiveRating(PlayerProfile p, int training) => Math.Min(99, Math.Min(p.Potential, p.Rating + (training - 1) * 2 + p.Development));
        public static int Strength(ClubProfile club)
        {
            var roles = Roles(club.Formation); float total = 0;
            for (int i = 0; i < Math.Min(11, club.Players.Count); i++)
                total += Math.Max(1, EffectiveRating(club.Players[i], club.Training) - (club.Players[i].Position == roles[i] ? 0 : 6));
            return Math.Min(99, Math2.JsRound(total / 11 + club.Coach + club.ClubBonus));
        }
        public static bool Train(ClubProfile club, int index, out string message)
        {
            if (index < 0 || index >= club.Players.Count) { message = "Vælg en spiller."; return false; }
            var player = club.Players[index];
            if (EffectiveRating(player, club.Training) >= Math.Min(99, player.Potential)) { message = "Spilleren har nået sit potentiale."; return false; }
            if (club.Money < 100) { message = "Du mangler 100 kr. til træningen."; return false; }
            club.Money -= 100; player.Development++; message = player.Name + " er blevet bedre."; return true;
        }
        public static long AccrueIdle(ClubProfile club, long utcTicks)
        {
            if (club.LastAccrualUtcTicks <= 0) { club.LastAccrualUtcTicks = utcTicks; return 0; }
            double seconds = Math.Max(0, Math.Min(8 * 3600, (utcTicks - club.LastAccrualUtcTicks) / (double)TimeSpan.TicksPerSecond));
            double amount = seconds * 3 + club.IncomeRemainder;
            long earned = (long)Math.Floor(amount); club.IncomeRemainder = amount - earned;
            club.Money += earned; club.LastAccrualUtcTicks = Math.Max(club.LastAccrualUtcTicks, utcTicks); return earned;
        }
        // This is a NEW local sandbox economy, never a production settlement.
        public static long Reward(MatchState match) => 200 + (match.HomeScore > match.AwayScore ? 150 : match.HomeScore == match.AwayScore ? 50 : 0);
        public static bool Settle(ClubProfile club, MatchState match)
        {
            if (match.Phase != MatchPhase.FullTime || club.SettledMatches.Contains(match.Id)) return false;
            club.SettledMatches.Add(match.Id); club.Money += Reward(match); club.Played++;
            if (match.HomeScore > match.AwayScore) club.Wins++; else if (match.HomeScore == match.AwayScore) club.Draws++;
            club.GoalsFor += match.HomeScore; club.GoalsAgainst += match.AwayScore; club.Experience += 25 + match.HomeScore * 5;
            for (int i = 0; i < Math.Min(11, club.Players.Count); i++) club.Players[i].Energy = Math2.Clamp(match.Players[i].Energy + 12, 20, 100);
            return true;
        }
    }
}
