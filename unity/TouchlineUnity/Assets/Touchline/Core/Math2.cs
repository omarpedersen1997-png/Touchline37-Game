using System;

namespace Touchline.Core
{
    // Ground coordinates: X/right, Z/length. Height is separate and maps to Unity Y.
    [Serializable]
    public struct V2
    {
        public float X, Z;
        public V2(float x, float z) { X = x; Z = z; }
        public float LengthSquared => X * X + Z * Z;
        public float Length => MathF.Sqrt(LengthSquared);
        public V2 Normalized => Length > 0.00001f ? this / Length : new V2();
        public bool Finite => Math2.Finite(X) && Math2.Finite(Z);
        public static V2 operator +(V2 a, V2 b) => new V2(a.X + b.X, a.Z + b.Z);
        public static V2 operator -(V2 a, V2 b) => new V2(a.X - b.X, a.Z - b.Z);
        public static V2 operator -(V2 a) => new V2(-a.X, -a.Z);
        public static V2 operator *(V2 a, float s) => new V2(a.X * s, a.Z * s);
        public static V2 operator /(V2 a, float s) => new V2(a.X / s, a.Z / s);
        public static float Dot(V2 a, V2 b) => a.X * b.X + a.Z * b.Z;
        public static float Distance(V2 a, V2 b) => (a - b).Length;
        public static V2 Lerp(V2 a, V2 b, float t) => a + (b - a) * t;
        public static V2 Limited(V2 a, float length) => a.Length > length ? a.Normalized * length : a;
        public override string ToString() => $"({X:0.000},{Z:0.000})";
    }

    public static class Math2
    {
        public static bool Finite(float n) => !float.IsNaN(n) && !float.IsInfinity(n);
        public static float Clamp(float n, float lo, float hi) => MathF.Max(lo, MathF.Min(hi, n));
        public static float Approach(float value, float target, float delta) => value + Clamp(target - value, -delta, delta);
        public static int JsRound(float value) => (int)MathF.Floor(value + .5f);
        public static V2 Turn(V2 facing, V2 direction, float radians)
        {
            if (direction.Length < .001f) return facing;
            float from = MathF.Atan2(facing.X, facing.Z), to = MathF.Atan2(direction.X, direction.Z);
            float difference = MathF.Atan2(MathF.Sin(to - from), MathF.Cos(to - from));
            float angle = from + Clamp(difference, -radians, radians);
            return new V2(MathF.Sin(angle), MathF.Cos(angle));
        }
    }
}
