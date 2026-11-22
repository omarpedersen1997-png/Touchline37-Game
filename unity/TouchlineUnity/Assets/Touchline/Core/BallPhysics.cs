using System;

namespace Touchline.Core
{
    public static class BallPhysics
    {
        private readonly struct Profile
        {
            public readonly float Air, Roll, Friction, Bounce, Skid;
            public Profile(float a, float r, float f, float b, float s) { Air = a; Roll = r; Friction = f; Bounce = b; Skid = s; }
        }
        private static readonly Profile[] Profiles = {
            new Profile(.006f,.32f,1.15f,.36f,.9f), new Profile(.0055f,.22f,1.05f,.32f,.94f),
            new Profile(.008f,.36f,1.2f,.48f,.83f), new Profile(.0048f,.24f,1.1f,.44f,.9f),
            new Profile(.007f,.34f,1.2f,.43f,.87f)
        };
        // Ported coefficients and integration from football-motion-r3.js. At
        // 60 Hz this is a separately versioned simulation, NOT a legacy replay.
        public static void Integrate(BallState b, float seconds)
        {
            float dt = Math2.Finite(seconds) ? Math2.Clamp(seconds, 0, .05f) : 0;
            if (dt == 0) return;
            var profile = Profiles[(int)b.Kind]; bool air = b.Height > MatchRules.BallGround + .005f || b.UpVelocity > .08f;
            float angle = b.Spin * .035f * dt * (air ? 1 : .2f), cos = MathF.Cos(angle), sin = MathF.Sin(angle);
            float vx = b.Velocity.X;
            b.Velocity = new V2(vx * cos - b.Velocity.Z * sin, vx * sin + b.Velocity.Z * cos);
            b.Spin *= MathF.Exp(-(air ? 1.1f : 4) * dt);
            if (air)
            {
                float speed = MathF.Sqrt(b.Velocity.LengthSquared + b.UpVelocity * b.UpVelocity), drag = 1 / (1 + profile.Air * speed * dt);
                b.Position += b.Velocity * dt; b.Height += b.UpVelocity * dt - 4.905f * dt * dt;
                b.Velocity *= drag; b.UpVelocity = (b.UpVelocity - 9.81f * dt) * drag;
                if (b.Height < MatchRules.BallGround) { b.Height = MatchRules.BallGround; b.UpVelocity = MathF.Abs(b.UpVelocity) > .9f ? -b.UpVelocity * profile.Bounce : 0; b.Velocity *= profile.Skid; }
            }
            else
            {
                float speed = b.Velocity.Length, next = MathF.Max(0, speed * MathF.Exp(-profile.Roll * dt) - profile.Friction * dt), ratio = speed > 0 ? next / speed : 0;
                b.Position += b.Velocity * ((1 + ratio) * .5f * dt); b.Velocity *= ratio; b.Height = MatchRules.BallGround; b.UpVelocity = 0;
            }
        }
        public static float Receive(BallState ball, PlayerState p, float pressure)
        {
            float relative = (ball.Velocity - p.Velocity).Length, incoming = ball.Velocity.Length;
            float angle = incoming > 0 ? Math2.Clamp((1 + V2.Dot(ball.Velocity, p.Facing) / incoming) * .5f, 0, 1) : 0;
            float retained = p.Keeper ? 0 : Math2.Clamp(.23f - p.Skill * .0012f + MathF.Max(0, 2.4f - pressure) * .045f + angle * .06f, .06f, .32f);
            ball.Velocity = p.Velocity + (ball.Velocity - p.Velocity) * retained;
            ball.UpVelocity = p.Keeper ? 0 : MathF.Max(0, MathF.Min(.8f, -ball.UpVelocity * .1f));
            ball.Height = Math2.Clamp(ball.Height, MatchRules.BallGround, p.Keeper ? MatchRules.BallGround : MatchRules.BallGround + .63f);
            return Math2.Clamp(relative / (20 + p.Skill * .22f), .2f, .95f);
        }
        public static void Carry(BallState b, PlayerState p, float dt)
        {
            V2 target = p.Position + p.Facing * (.57f + p.Velocity.Length * .022f);
            float omega = 16 - p.Touch * 5, decay = MathF.Exp(-omega * dt);
            V2 delta = b.Position - (target - p.Velocity * dt), relative = b.Velocity - p.Velocity, temp = (relative + delta * omega) * dt;
            b.Position = target + (delta + temp) * decay; b.Velocity = p.Velocity + (relative - temp * omega) * decay;
            b.Height = MathF.Max(MatchRules.BallGround, b.Height + (MatchRules.BallGround - b.Height) * (1 - MathF.Exp(-16 * dt))); b.UpVelocity = 0;
        }
    }
}
