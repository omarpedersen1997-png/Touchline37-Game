using System;

namespace Touchline.Core
{
    public enum MatchPhase { KickOff, Playing, GoalScored, HalfTime, FullTime, ThrowIn, Corner, GoalKick }
    public enum FlightKind { Pass, Through, Loft, Shot, Loose }
    public enum PlayerAction { Idle, Run, Sprint, Pass, Shoot, Tackle, Dive, Cheer, Skill }
    public enum MatchCue { KickOff, Pass, Shot, Receive, Save, Woodwork, Goal, HalfTime, FullTime, Restart, Skill }

    [Serializable]
    public sealed class PlayerState
    {
        public string Id = "", Name = "";
        public int Team, Number, Skill = 50;
        public bool Keeper;
        public V2 Position, PreviousPosition, Velocity, Acceleration, Facing, PreviousFacing;
        public float Energy = 100, ActionRemaining, Touch, DecisionRemaining, CaptureCooldown;
        public PlayerAction Action;
    }
    [Serializable]
    public sealed class BallState
    {
        public V2 Position, PreviousPosition, Velocity;
        public float Height = MatchRules.BallGround, PreviousHeight = MatchRules.BallGround, UpVelocity, Spin, FlightAge;
        public int Owner = -1, LastKicker = -1, LastTouchTeam = -1, IntendedReceiver = -1;
        public FlightKind Kind = FlightKind.Loose;
    }
    [Serializable]
    public sealed class MatchState
    {
        public string Id = "", Rules = MatchRules.Version, Opponent = "Havneby IF", Formation = "4-3-3", Tactic = "balanced";
        public MatchPhase Phase = MatchPhase.KickOff;
        public int Tick, HalfTicks, Half = 1, HomeScore, AwayScore, Controlled = 9, KickTeam, HomeShots, AwayShots, HomePasses, AwayPasses;
        public float HalfSeconds, PhaseRemaining, HomePossession, AwayPossession;
        public uint Random = 1;
        public V2 RestartPoint;
        public PlayerState[] Players = Array.Empty<PlayerState>();
        public BallState Ball = new BallState();
        public int HomeDirection => Half == 1 ? 1 : -1;
    }
    public struct MatchInput
    {
        public V2 Move;
        public bool Sprint, Pass, Through, Loft, Shoot, Tackle, Skill, Switch;
        public float ShotPower;
    }
    public struct MatchEvent
    {
        public MatchCue Cue; public int Team, Player; public float Strength; public string Text;
        public MatchEvent(MatchCue cue, int team, int player, string text, float strength = .5f)
        { Cue = cue; Team = team; Player = player; Text = text; Strength = strength; }
    }
    public static class MatchRules
    {
        public const string Version = "touchline-unity-sandbox-v1";
        public const float Step = 1f / 60, HalfDuration = 120, Width = 68, Length = 105, GoalWidth = 7.32f, GoalHeight = 2.44f;
        public const float BallGround = .11f;
    }
}
