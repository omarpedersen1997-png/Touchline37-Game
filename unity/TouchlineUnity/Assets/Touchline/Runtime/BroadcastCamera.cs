using Touchline.Core;
using UnityEngine;

namespace Touchline.Runtime
{
    public sealed class BroadcastCamera
    {
        private const float FieldOfView = 43f;
        private const float PlayerFramingRange = 23f;
        // Keep the projection of the movement axes used by the touch and keyboard controls.
        private static readonly Vector3 OffsetDirection = new Vector3(18.5f, 12f, -7f).normalized;
        private static readonly Vector3 ViewForward = -OffsetDirection;
        private static readonly Vector3 ViewRight = Vector3.Cross(Vector3.up, ViewForward).normalized;
        private static readonly Vector3 ViewUp = Vector3.Cross(ViewForward, ViewRight);
        private static readonly Quaternion ViewRotation = Quaternion.LookRotation(ViewForward, Vector3.up);
        private static readonly float HalfVerticalTangent = Mathf.Tan(FieldOfView * .5f * Mathf.Deg2Rad);

        private readonly Camera camera;
        private Vector3 look, lookVelocity;
        private float distance;
        private bool initialized, wasKickoff;

        public BroadcastCamera(Camera camera)
        {
            this.camera = camera;
            camera.fieldOfView = FieldOfView;
        }

        public void Reset()
        {
            initialized = false;
            wasKickoff = false;
            lookVelocity = Vector3.zero;
        }

        public void Present(MatchState state, Vector3 shownBall, float interpolation, bool reducedMotion, float deltaTime)
        {
            bool kickoff = state.Phase == MatchPhase.KickOff;
            bool recenter = !initialized || kickoff && !wasKickoff;
            float dt = Mathf.Clamp(deltaTime, 0f, .05f);
            float aspect = Mathf.Max(.25f, camera.aspect);
            Vector3 player = ShownPlayer(state.Players[state.Controlled], interpolation);
            bool includePlayer = !kickoff && IsNearBall(player, shownBall);
            int receiverIndex = state.Ball.IntendedReceiver;
            Vector3 receiver = shownBall;
            bool includeReceiver = !kickoff && state.Ball.Owner < 0 && state.Phase == MatchPhase.Playing
                && receiverIndex >= 0 && receiverIndex < state.Players.Length && receiverIndex != state.Controlled;
            if (includeReceiver)
            {
                receiver = ShownPlayer(state.Players[receiverIndex], interpolation);
                includeReceiver = IsNearBall(receiver, shownBall);
            }

            Vector3 target = kickoff ? new Vector3(0, .95f, 0) : new Vector3(shownBall.x, .95f, shownBall.z);
            if (!kickoff)
            {
                if (includePlayer) target += Vector3.ClampMagnitude(OnGrass(player - shownBall), 11f) * .24f;
                if (includeReceiver) target += Vector3.ClampMagnitude(OnGrass(receiver - shownBall), 15f) * .23f;
                if (!reducedMotion && state.Phase == MatchPhase.Playing)
                {
                    var velocity = new Vector3(state.Ball.Velocity.X, 0, state.Ball.Velocity.Z);
                    target += Vector3.ClampMagnitude(velocity * .14f, 3.6f);
                    target.y += Mathf.Clamp((shownBall.y - .95f) * .25f, 0f, 1.1f);
                }
            }

            if (recenter)
            {
                look = target;
                lookVelocity = Vector3.zero;
            }
            else if (dt > 0f)
            {
                look = Vector3.SmoothDamp(look, target, ref lookVelocity, reducedMotion ? .23f : .14f, 130f, dt);
            }

            float minimumDistance = kickoff || reducedMotion ? 20f : 17f;
            minimumDistance *= Mathf.Sqrt(Mathf.Max(1f, 1.35f / aspect));
            float framingDistance = Mathf.Max(minimumDistance, Fit(shownBall, look, aspect, .69f, .62f));
            if (includePlayer) framingDistance = Mathf.Max(framingDistance, Fit(player, look, aspect, .78f, .64f));
            if (includeReceiver) framingDistance = Mathf.Max(framingDistance, Fit(receiver, look, aspect, .78f, .64f));

            // Leave a wider margin for the ball even when a pass outruns the zoom.
            float neededForBall = Fit(shownBall, look, aspect, .87f, .76f);
            float zoomRate = framingDistance > distance ? 12f : 4f;
            distance = recenter ? framingDistance : Mathf.Max(neededForBall,
                Mathf.Lerp(distance, framingDistance, 1f - Mathf.Exp(-zoomRate * dt)));

            camera.transform.position = look + OffsetDirection * distance;
            camera.transform.rotation = ViewRotation;
            initialized = true;
            wasKickoff = kickoff;
        }

        private static Vector3 ShownPlayer(PlayerState player, float interpolation)
        {
            V2 position = V2.Lerp(player.PreviousPosition, player.Position, interpolation);
            return new Vector3(position.X, .95f, position.Z);
        }

        private static Vector3 OnGrass(Vector3 delta) => new Vector3(delta.x, 0f, delta.z);

        private static bool IsNearBall(Vector3 player, Vector3 ball) =>
            OnGrass(player - ball).sqrMagnitude <= PlayerFramingRange * PlayerFramingRange;

        private static float Fit(Vector3 point, Vector3 focus, float aspect, float horizontal, float vertical)
        {
            Vector3 relative = point - focus;
            float horizontalDepth = Mathf.Abs(Vector3.Dot(relative, ViewRight)) / (HalfVerticalTangent * aspect * horizontal);
            float verticalDepth = Mathf.Abs(Vector3.Dot(relative, ViewUp)) / (HalfVerticalTangent * vertical);
            return Mathf.Max(.5f, Mathf.Max(horizontalDepth, verticalDepth)) - Vector3.Dot(relative, ViewForward);
        }
    }
}
