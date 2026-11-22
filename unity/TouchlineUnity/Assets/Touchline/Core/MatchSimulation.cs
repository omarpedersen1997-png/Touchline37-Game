using System;
using System.Collections.Generic;

namespace Touchline.Core
{
    // New offline Unity rules. No HTTP, UnityEngine/PhysX, old replay decoder or
    // production state is involved. All presentation observes this state.
    public sealed class MatchSimulation
    {
        public MatchState State { get; }
        public readonly List<MatchEvent> Events = new List<MatchEvent>(8);
        private const float Dt = MatchRules.Step;
        private V2[] anchors;
        private void CacheFormation() { anchors = new V2[11]; for (int i = 0; i < 11; i++) anchors[i] = FormationPoint(State.Formation, i); }
        public MatchSimulation(ClubProfile club, uint seed = 37, string id = null)
        {
            if (club.Players.Count < 11) throw new ArgumentException("Der kræves 11 spillere.");
            State = new MatchState { Id = id ?? Guid.NewGuid().ToString("N"), Random = seed == 0 ? 37u : seed, Formation = club.Formation, Tactic = club.Tactic, Players = new PlayerState[22] };
            for (int i = 0; i < 22; i++)
            {
                var source = club.Players[i % 11]; bool away = i >= 11;
                State.Players[i] = new PlayerState { Id = away ? "away-" + i : source.Id, Name = away ? "Havneby " + (i - 10) : source.Name, Team = away ? 1 : 0, Number = away ? i - 10 : source.Number, Keeper = i % 11 == 0, Skill = away ? 51 : ClubRules.EffectiveRating(source, club.Training), Energy = away ? 100 : source.Energy, Facing = new V2(0, away ? -1 : 1) };
            }
            CacheFormation(); ArrangeKickoff(0);
        }
        public MatchSimulation(MatchState saved)
        {
            if (!Valid(saved)) throw new ArgumentException("Denne kamp kan ikke åbnes som en Unity-testkamp.");
            State = saved; CacheFormation();
        }
        public static bool Valid(MatchState s)
        {
            if (s == null || string.IsNullOrEmpty(s.Id) || s.Tick < 0 || s.HomeScore < 0 || s.AwayScore < 0 || s.Rules != MatchRules.Version || s.Players == null || s.Players.Length != 22 || s.Ball == null || s.Controlled < 0 || s.Controlled > 10 || s.Half < 1 || s.Half > 2 || !Enum.IsDefined(typeof(MatchPhase), s.Phase)) return false;
            if (!s.Ball.Position.Finite || !s.Ball.Velocity.Finite || !Math2.Finite(s.Ball.Height) || !Math2.Finite(s.Ball.UpVelocity) || !Math2.Finite(s.Ball.Spin) || !Math2.Finite(s.HalfSeconds) || !Math2.Finite(s.PhaseRemaining) || !Math2.Finite(s.HomePossession) || !Math2.Finite(s.AwayPossession) || s.HalfTicks < 0 || s.HalfTicks > 7200 || s.Ball.Owner < -1 || s.Ball.Owner >= 22 || !Enum.IsDefined(typeof(FlightKind), s.Ball.Kind)) return false;
            for (int i = 0; i < s.Players.Length; i++)
            {
                var p = s.Players[i];
                if (p == null || p.Team != i / 11 || string.IsNullOrEmpty(p.Name) || p.Skill < 1 || p.Skill > 99 || !p.Position.Finite || !p.Velocity.Finite || !p.Facing.Finite || !p.Acceleration.Finite || !Math2.Finite(p.Energy) || p.Energy < 0 || p.Energy > 100 || !Math2.Finite(p.ActionRemaining) || !Math2.Finite(p.Touch)) return false;
            }
            return true;
        }
        private float Random01()
        {
            uint x = State.Random; x ^= x << 13; x ^= x >> 17; x ^= x << 5; State.Random = x; return (x & 0xffffff) / 16777216f;
        }
        public int Direction(int team) => team == 0 ? State.HomeDirection : -State.HomeDirection;
        public static V2 FormationPoint(string formation, int index)
        {
            if (index == 0) return new V2(0, -49);
            var roles = ClubRules.Roles(formation); string role = roles[index]; int before = 0, count = 0;
            for (int i = 1; i < 11; i++) if (roles[i] == role) { if (i < index) before++; count++; }
            float width = role == "FOR" ? 46 : role == "MID" ? 43 : 45;
            float x = count == 1 ? 0 : -width / 2 + before * width / (count - 1);
            return new V2(x, role == "FOR" ? -31 : role == "MID" ? -12 : 15);
        }
        private void ArrangeKickoff(int team)
        {
            var s = State; s.KickTeam = team; s.Phase = MatchPhase.KickOff; s.PhaseRemaining = 1.25f;
            for (int i = 0; i < 22; i++)
            {
                var p = s.Players[i]; V2 anchor = anchors[i % 11]; int dir = Direction(p.Team);
                anchor.Z = MathF.Min(-10, anchor.Z); p.Position = new V2(anchor.X, anchor.Z * dir); p.PreviousPosition = p.Position;
                p.Velocity = p.Acceleration = new V2(); p.Facing = new V2(0, dir); p.PreviousFacing = p.Facing; p.Action = PlayerAction.Idle; p.ActionRemaining = 0;
            }
            int taker = team * 11 + 9, support = team * 11 + 6;
            s.Players[taker].Position = new V2(0, -Direction(team) * .45f);
            s.Players[support].Position = new V2(-3.5f, -Direction(team) * 5);
            s.Players[taker].PreviousPosition = s.Players[taker].Position;
            s.Players[support].PreviousPosition = s.Players[support].Position;
            s.Ball = new BallState { Owner = taker, LastTouchTeam = team, Height = MatchRules.BallGround, PreviousHeight = MatchRules.BallGround };
            if (team == 0) s.Controlled = 9;
        }
        public void Step(MatchInput input)
        {
            Events.Clear(); var s = State; if (s.Phase == MatchPhase.FullTime) return;
            s.Tick++;
            foreach (var p in s.Players) { p.PreviousPosition = p.Position; p.PreviousFacing = p.Facing; p.ActionRemaining = MathF.Max(0, p.ActionRemaining - Dt); p.CaptureCooldown = MathF.Max(0, p.CaptureCooldown - Dt); p.DecisionRemaining = MathF.Max(0, p.DecisionRemaining - Dt); p.Touch = MathF.Max(0, p.Touch - Dt * 1.5f); }
            s.Ball.PreviousPosition = s.Ball.Position; s.Ball.PreviousHeight = s.Ball.Height;
            if (s.Phase != MatchPhase.Playing) { AdvanceStoppage(); return; }
            s.HalfTicks++; s.HalfSeconds = s.HalfTicks / 60f;
            if (s.HalfTicks >= (int)(MatchRules.HalfDuration * 60)) { StopHalf(); return; }
            if (input.Switch || input.Pass && s.Ball.Owner != s.Controlled) s.Controlled = NearestPlayer(0, s.Ball.Position, false);
            if (input.Tackle) Tackle(s.Controlled, true);
            if (input.Skill && s.Ball.Owner == s.Controlled) { var p = s.Players[s.Controlled]; p.Action = PlayerAction.Skill; p.ActionRemaining = .45f; p.Facing = Math2.Turn(p.Facing, new V2(p.Facing.Z, -p.Facing.X), .55f); Events.Add(new MatchEvent(MatchCue.Skill, 0, s.Controlled, p.Name + " finder plads.")); }
            if (s.Ball.Owner == s.Controlled)
            {
                if (input.Shoot) Shoot(s.Controlled, input.ShotPower, input.Move);
                else if (input.Pass || input.Through || input.Loft) Pass(s.Controlled, input.Through ? FlightKind.Through : input.Loft ? FlightKind.Loft : FlightKind.Pass);
            }
            int pressHome = NearestPlayer(0, s.Ball.Position, false), pressAway = NearestPlayer(1, s.Ball.Position, false);
            for (int i = 0; i < 22; i++)
            {
                var p = s.Players[i]; bool manual = i == s.Controlled;
                V2 move = manual ? (input.Move.Finite ? V2.Limited(input.Move, 1) : new V2()) : AITarget(i, p.Team == 0 ? pressHome : pressAway) - p.Position;
                float speed = (4.7f + p.Skill * .027f) * (.72f + .28f * p.Energy / 100);
                bool sprint = manual && input.Sprint && p.Energy > 5 || !manual && move.Length > 12 && !p.Keeper;
                if (sprint) speed *= 1.28f;
                float demand = manual ? move.Length : MathF.Min(1, move.Length / 2);
                Move(p, move.Normalized * speed * demand);
                p.Energy = Math2.Clamp(p.Energy + (sprint ? -6 : p.Velocity.Length > 3 ? -.35f : 1.6f) * Dt, 0, 100);
                if (p.ActionRemaining <= 0) p.Action = p.Velocity.Length < .2f ? PlayerAction.Idle : sprint ? PlayerAction.Sprint : PlayerAction.Run;
                if (!manual) AIAction(i);
            }
            SeparatePlayers();
            if (s.Ball.Owner >= 0)
            {
                var holder = s.Players[s.Ball.Owner]; BallPhysics.Carry(s.Ball, holder, Dt);
                if (holder.Team == 0) s.HomePossession += Dt; else s.AwayPossession += Dt;
            }
            else
            {
                s.Ball.FlightAge += Dt; BallPhysics.Integrate(s.Ball, Dt);
                if (!GoalOrWoodwork()) { TryReceive(); if (s.Ball.Owner < 0) CheckOut(); }
            }
        }
        private V2 AITarget(int index, int presser)
        {
            var s = State; var p = s.Players[index]; int dir = Direction(p.Team);
            bool own = s.Ball.Owner >= 0 ? s.Players[s.Ball.Owner].Team == p.Team : s.Ball.LastTouchTeam == p.Team;
            if (p.Keeper)
            {
                V2 goal = new V2(0, -dir * 50);
                V2 toBall = s.Ball.Position - goal;
                return goal + toBall.Normalized * Math2.Clamp(toBall.Length * .13f, .7f, 4.5f);
            }
            if (s.Ball.Owner < 0 && s.Ball.IntendedReceiver == index && s.Ball.LastTouchTeam == p.Team)
            {
                // Receive the actual flight instead of continuing an unrelated
                // formation run while a through ball passes the teammate.
                float eta = Math2.Clamp(V2.Distance(p.Position,s.Ball.Position)/MathF.Max(6,s.Ball.Velocity.Length),.05f,.65f);
                if(s.Ball.Height>.5f)eta=Math2.Clamp((s.Ball.UpVelocity+MathF.Sqrt(s.Ball.UpVelocity*s.Ball.UpVelocity+19.62f*MathF.Max(0,s.Ball.Height-MatchRules.BallGround)))/9.81f,.05f,1.5f);
                return s.Ball.Position+s.Ball.Velocity*eta;
            }
            if (s.Ball.Owner == index) return p.Position + new V2(Math2.Clamp(-p.Position.X * .18f, -3, 3), dir * 12);
            if (!own && presser == index) return s.Ball.Position + s.Ball.Velocity * .12f;
            V2 anchor = anchors[index % 11]; float mentality = s.Tactic == "attacking" ? 5 : s.Tactic == "defensive" ? -5 : 0;
            anchor.Z = (anchor.Z + (own ? 10 : -3) + mentality) * dir + s.Ball.Position.Z * .24f;
            anchor.X = anchor.X * (own ? 1.08f : .92f) + s.Ball.Position.X * .2f;
            if (own && index % 11 > 7) anchor.Z += dir * 3 * MathF.Sin(s.Tick * .006f + index);
            return new V2(Math2.Clamp(anchor.X, -30, 30), Math2.Clamp(anchor.Z, -46, 46));
        }
        private void Move(PlayerState p, V2 desired)
        {
            V2 acceleration = V2.Limited((desired - p.Velocity) * 7, desired.Length > .1f ? 13 : 20);
            p.Acceleration += V2.Limited(acceleration - p.Acceleration, 70 * Dt);
            V2 prior = p.Velocity; p.Velocity += p.Acceleration * Dt;
            if (desired.Length < .1f && V2.Dot(prior, p.Velocity) <= 0) p.Velocity = p.Acceleration = new V2();
            p.Velocity = V2.Limited(p.Velocity, MathF.Max(desired.Length, prior.Length));
            p.Facing = Math2.Turn(p.Facing, p.Velocity, (p.Velocity.Length > 4 ? 4.5f : 7) * Dt);
            p.Position += p.Velocity * Dt;
            p.Position = new V2(Math2.Clamp(p.Position.X, -33.2f, 33.2f), Math2.Clamp(p.Position.Z, -51.7f, 51.7f));
        }
        private void SeparatePlayers()
        {
            var players = State.Players;
            for (int a = 0; a < players.Length; a++) for (int b = a + 1; b < players.Length; b++)
            {
                V2 difference = players[b].Position - players[a].Position; float distance = difference.Length;
                if (distance >= .65f) continue;
                V2 axis = distance > .001f ? difference / distance : new V2(1, 0);
                V2 push = axis * ((.65f - distance) * .5f); players[a].Position -= push; players[b].Position += push;
            }
        }
        private int NearestPlayer(int team, V2 point, bool keepers)
        {
            int best = team * 11 + 1; float distance = float.MaxValue;
            for (int i = team * 11; i < team * 11 + 11; i++)
            {
                var p = State.Players[i]; if (!keepers && p.Keeper) continue;
                float d = (p.Position - point).LengthSquared;
                if (d < distance) { distance = d; best = i; }
            }
            return best;
        }
        private int PassTarget(int index, bool through)
        {
            var s = State; var p = s.Players[index]; int best = -1; float score = float.MinValue;
            for (int i = p.Team * 11; i < p.Team * 11 + 11; i++)
            {
                if (i == index) continue; var mate = s.Players[i]; V2 delta = mate.Position - p.Position; float length = delta.Length;
                if (length < 2 || length > 43) continue;
                float openness = 10;
                foreach (var opponent in s.Players) if (opponent.Team != p.Team) openness = MathF.Min(openness, V2.Distance(opponent.Position, mate.Position));
                float candidate = openness * 2 + V2.Dot(delta.Normalized, p.Facing) * 9 + delta.Z * Direction(p.Team) * (through ? .45f : .13f) - MathF.Abs(length - (through ? 23 : 13)) * .35f;
                if (candidate > score) { score = candidate; best = i; }
            }
            return best;
        }
        private void AIAction(int index)
        {
            var s = State; var p = s.Players[index]; if (p.DecisionRemaining > 0) return;
            if (s.Ball.Owner == index)
            {
                p.DecisionRemaining = .8f;
                if (V2.Distance(p.Position, new V2(0, Direction(p.Team) * 52.5f)) < 23) Shoot(index, .65f + p.Skill / 300f, new V2());
                else if (Random01() < .75f) Pass(index, Random01() > .72f ? FlightKind.Through : FlightKind.Pass);
            }
            else if (s.Ball.Owner >= 0 && s.Players[s.Ball.Owner].Team != p.Team && V2.Distance(p.Position, s.Players[s.Ball.Owner].Position) < 1.1f) Tackle(index, false);
        }
        private void Tackle(int index, bool manual)
        {
            var s = State; var p = s.Players[index]; if (p.CaptureCooldown > 0 || s.Ball.Owner < 0 || s.Players[s.Ball.Owner].Team == p.Team) return;
            var owner = s.Players[s.Ball.Owner]; p.CaptureCooldown = .65f; p.DecisionRemaining = 1;
            if (V2.Distance(p.Position, owner.Position) > 1.4f) return;
            p.Action = PlayerAction.Tackle; p.ActionRemaining = .5f;
            V2 approach = (owner.Position - p.Position).Normalized;
            float angle = V2.Dot(p.Facing, approach), closing = V2.Dot(p.Velocity - owner.Velocity, approach);
            if (angle > -.1f && (manual || p.Skill + closing * 2 >= owner.Skill - 6))
            {
                s.Ball.Owner = -1; s.Ball.LastTouchTeam = p.Team; s.Ball.Velocity = approach * 3 + p.Velocity * .5f;
                s.Ball.Kind = FlightKind.Loose; s.Ball.LastKicker = index; s.Ball.FlightAge = 0;
                Events.Add(new MatchEvent(MatchCue.Receive, p.Team, index, p.Name + " bryder spillet."));
            }
        }
        private void Pass(int index, FlightKind kind)
        {
            int receiver = PassTarget(index, kind == FlightKind.Through); if (receiver < 0) return;
            var mate = State.Players[receiver];
            V2 target = mate.Position + mate.Velocity * (kind == FlightKind.Through ? 1.0f : .25f);
            if (kind == FlightKind.Through) target.Z += Direction(mate.Team) * 4;
            float distance = V2.Distance(State.Ball.Position, target);
            float speed = kind == FlightKind.Through ? 24 : Math2.Clamp(distance * .7f + 7, 11, 25);
            float lift = kind == FlightKind.Loft ? Math2.Clamp(4.905f * distance / speed, 3, 9.5f) : .1f;
            Release(index, target, kind, speed, lift, receiver);
            if (State.Players[index].Team == 0) State.HomePasses++; else State.AwayPasses++;
        }
        private void Shoot(int index, float power, V2 aim)
        {
            var p = State.Players[index]; power = Math2.Finite(power) ? Math2.Clamp(power, .2f, 1) : .5f;
            V2 goal = new V2((Random01() - .5f) * (5.5f - p.Skill * .045f), Direction(p.Team) * 55);
            if (aim.Finite && aim.Length > .3f && aim.Z * Direction(p.Team) > 0) goal = State.Ball.Position + aim.Normalized * 50;
            Release(index, goal, FlightKind.Shot, 18 + power * 17, 1.1f + power * 3.2f, -1);
            if (p.Team == 0) State.HomeShots++; else State.AwayShots++;
        }
        private void Release(int index, V2 target, FlightKind kind, float speed, float lift, int receiver)
        {
            var s = State; var p = s.Players[index]; V2 direction = (target - s.Ball.Position).Normalized;
            s.Ball.Owner = -1; s.Ball.Velocity = direction * speed + p.Velocity * .15f; s.Ball.UpVelocity = lift;
            s.Ball.Kind = kind; s.Ball.LastKicker = index; s.Ball.LastTouchTeam = p.Team; s.Ball.FlightAge = 0; s.Ball.IntendedReceiver = receiver;
            s.Ball.Spin = kind == FlightKind.Loft ? (Random01() - .5f) * 7 : 0;
            p.Action = kind == FlightKind.Shot ? PlayerAction.Shoot : PlayerAction.Pass; p.ActionRemaining = kind == FlightKind.Shot ? .5f : .35f; p.CaptureCooldown = .25f;
            Events.Add(new MatchEvent(kind == FlightKind.Shot ? MatchCue.Shot : MatchCue.Pass, p.Team, index, p.Name + (kind == FlightKind.Shot ? " afslutter." : kind == FlightKind.Through ? " spiller en stikning." : " afleverer."), speed / 35));
        }
        private bool GoalOrWoodwork()
        {
            var s = State; var b = s.Ball; float edge = MatchRules.Length / 2;
            if (MathF.Abs(b.Position.Z) < edge) return false;
            int sign = b.Position.Z > 0 ? 1 : -1;
            float distance = b.Position.Z - b.PreviousPosition.Z;
            float t = MathF.Abs(distance) > .0001f ? Math2.Clamp((sign * edge - b.PreviousPosition.Z) / distance, 0, 1) : 1;
            float x = b.PreviousPosition.X + (b.Position.X - b.PreviousPosition.X) * t;
            float height = b.PreviousHeight + (b.Height - b.PreviousHeight) * t;
            bool post = MathF.Abs(MathF.Abs(x) - MatchRules.GoalWidth / 2) < .15f && height < MatchRules.GoalHeight + .1f;
            bool bar = MathF.Abs(height - MatchRules.GoalHeight) < .15f && MathF.Abs(x) < MatchRules.GoalWidth / 2 + .1f;
            if (post || bar)
            {
                b.Position.Z = sign * (edge - .2f); b.Velocity.Z *= -.72f; if (bar) b.UpVelocity *= -.55f;
                Events.Add(new MatchEvent(MatchCue.Woodwork, b.LastTouchTeam, b.LastKicker, "Træværket redder!")); return true;
            }
            if (MathF.Abs(x) >= MatchRules.GoalWidth / 2 - .11f || height >= MatchRules.GoalHeight - .11f) return false;
            int scorer = sign == s.HomeDirection ? 0 : 1;
            if (scorer == 0) s.HomeScore++; else s.AwayScore++;
            s.KickTeam = 1 - scorer; s.Phase = MatchPhase.GoalScored; s.PhaseRemaining = 2.2f;
            foreach (var p in s.Players) { p.Velocity = p.Acceleration = new V2(); p.Action = p.Team == scorer ? PlayerAction.Cheer : PlayerAction.Idle; p.ActionRemaining = 2.2f; }
            Events.Add(new MatchEvent(MatchCue.Goal, scorer, b.LastKicker, scorer == 0 ? "MÅL! Din klub scorer." : "Mål til Havneby IF.", 1)); return true;
        }
        private void TryReceive()
        {
            var s = State; var b = s.Ball; int best = -1; float nearest = 2.2f;
            for (int i = 0; i < 22; i++)
            {
                var p = s.Players[i]; if (p.CaptureCooldown > 0 || i == b.LastKicker && b.FlightAge < .25f) continue;
                float range = p.Keeper && b.Kind == FlightKind.Shot ? 1.8f : .82f;
                float distance = V2.Distance(p.Position, b.Position);
                if (distance < range && distance < nearest && b.Height < (p.Keeper ? 2.35f : 1.35f)) { best = i; nearest = distance; }
            }
            if (best < 0) return;
            var receiver = s.Players[best]; bool save = receiver.Keeper && b.Kind == FlightKind.Shot;
            if (save) { receiver.Action = PlayerAction.Dive; receiver.ActionRemaining = .7f; }
            float pressure = V2.Distance(s.Players[NearestPlayer(1 - receiver.Team, receiver.Position, false)].Position, receiver.Position);
            float speed = b.Velocity.Length; receiver.Touch = BallPhysics.Receive(b, receiver, pressure);
            if (save && speed > 26 && receiver.Skill < 68)
            {
                b.Velocity = new V2((b.Position.X - receiver.Position.X) * 6, Direction(receiver.Team) * 7);
                b.UpVelocity = 1.8f; b.Kind = FlightKind.Loose; receiver.CaptureCooldown = .6f; b.LastKicker = best; b.LastTouchTeam = receiver.Team; b.FlightAge = 0;
            }
            else { b.Owner = best; b.LastTouchTeam = receiver.Team; if (receiver.Team == 0 && (b.IntendedReceiver == best || s.Players[s.Controlled].Keeper)) s.Controlled = best; }
            Events.Add(new MatchEvent(save ? MatchCue.Save : MatchCue.Receive, receiver.Team, best, receiver.Name + (save ? " redder!" : " tager imod."), speed / 35));
        }
        private void CheckOut()
        {
            var s = State; var b = s.Ball;
            if (MathF.Abs(b.Position.X) > MatchRules.Width / 2)
            {
                Restart(MatchPhase.ThrowIn, 1 - Math.Max(0, b.LastTouchTeam), new V2(MathF.Sign(b.Position.X) * 33.5f, Math2.Clamp(b.Position.Z, -48, 48))); return;
            }
            if (MathF.Abs(b.Position.Z) <= MatchRules.Length / 2) return;
            int sign = b.Position.Z > 0 ? 1 : -1, defending = sign == s.HomeDirection ? 1 : 0;
            bool corner = b.LastTouchTeam == defending;
            Restart(corner ? MatchPhase.Corner : MatchPhase.GoalKick, corner ? 1 - defending : defending,
                new V2(corner ? (b.Position.X < 0 ? -33 : 33) : 0, sign * (corner ? 51.8f : 47)));
        }
        private void Restart(MatchPhase phase, int team, V2 point)
        {
            var s = State; s.Phase = phase; s.PhaseRemaining = 1; s.KickTeam = team; s.RestartPoint = point;
            s.Ball.Owner = -1; s.Ball.Velocity = new V2(); s.Ball.UpVelocity = 0; s.Ball.Position = point; s.Ball.Height = MatchRules.BallGround;
            foreach (var p in s.Players) { p.Velocity = p.Acceleration = new V2(); p.Action = PlayerAction.Idle; }
            Events.Add(new MatchEvent(MatchCue.Restart, team, -1, phase == MatchPhase.ThrowIn ? "Indkast." : phase == MatchPhase.Corner ? "Hjørnespark." : "Målspark."));
        }
        private void AdvanceStoppage()
        {
            var s = State; s.PhaseRemaining = MathF.Max(0, s.PhaseRemaining - Dt);
            if (s.Phase == MatchPhase.GoalScored)
            {
                BallPhysics.Integrate(s.Ball, Dt);
                if (MathF.Abs(s.Ball.Position.Z) > 54.1f) { s.Ball.Position.Z = MathF.Sign(s.Ball.Position.Z) * 54.1f; s.Ball.Velocity.Z *= -.28f; }
            }
            if (s.PhaseRemaining > .00001f) return;
            s.PhaseRemaining = 0;
            if (s.Phase == MatchPhase.GoalScored) { ArrangeKickoff(s.KickTeam); return; }
            if (s.Phase == MatchPhase.HalfTime) { s.Half = 2; s.HalfTicks = 0; s.HalfSeconds = 0; ArrangeKickoff(1); return; }
            if (s.Phase == MatchPhase.KickOff)
            {
                int taker = s.KickTeam * 11 + 9, support = s.KickTeam * 11 + 6; s.Phase = MatchPhase.Playing;
                Release(taker, s.Players[support].Position, FlightKind.Pass, 9, .05f, support);
                Events.Add(new MatchEvent(MatchCue.KickOff, s.KickTeam, taker, s.Half == 1 ? "Kampen er i gang." : "Anden halvleg er i gang.")); return;
            }
            int owner = s.Phase == MatchPhase.GoalKick ? s.KickTeam * 11 : NearestPlayer(s.KickTeam, s.RestartPoint, false);
            s.Players[owner].Position = s.RestartPoint; s.Players[owner].PreviousPosition = s.RestartPoint; s.Ball.Owner = owner; s.Ball.LastTouchTeam = s.KickTeam;
            s.Phase = MatchPhase.Playing; Pass(owner, FlightKind.Pass);
        }
        private void StopHalf()
        {
            var s = State; foreach (var p in s.Players) { p.Velocity = p.Acceleration = new V2(); p.Action = PlayerAction.Idle; }
            s.HalfSeconds = MatchRules.HalfDuration; s.Phase = s.Half == 1 ? MatchPhase.HalfTime : MatchPhase.FullTime; s.PhaseRemaining = s.Half == 1 ? 5 : 0;
            Events.Add(new MatchEvent(s.Half == 1 ? MatchCue.HalfTime : MatchCue.FullTime, -1, -1, s.Half == 1 ? "Pause. Gør klar til anden halvleg." : "Slutfløjt."));
        }
    }

    public sealed class MatchStepper
    {
        public MatchSimulation Simulation { get; }
        private double accumulator;
        private const double FixedSeconds = 1d / 60;
        public float Alpha => (float)Math.Min(1, Math.Max(0, accumulator / FixedSeconds));
        public int PendingTicks => (int)Math.Floor(Math.Max(0, accumulator) / FixedSeconds);
        public MatchStepper(MatchSimulation simulation) { Simulation = simulation; }
        public int Advance(double seconds, Func<MatchInput> readInput, Action<MatchSimulation> afterStep = null)
        {
            if (double.IsNaN(seconds) || double.IsInfinity(seconds) || seconds < 0) return 0;
            accumulator += seconds; int work = 0;
            while (accumulator + .00000001 >= FixedSeconds && work < 8)
            {
                Simulation.Step(readInput()); accumulator -= FixedSeconds; work++; afterStep?.Invoke(Simulation);
            }
            return work;
        }
        public void ResetClock() { accumulator = 0; }
    }
}
