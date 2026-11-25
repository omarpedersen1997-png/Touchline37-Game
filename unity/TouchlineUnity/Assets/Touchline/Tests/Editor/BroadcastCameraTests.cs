#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using Touchline.Core;
using Touchline.Runtime;
using UnityEngine;

namespace Touchline.Tests
{
    public sealed class BroadcastCameraTests
    {
        private Camera camera;
        private BroadcastCamera rig;
        private MatchState match;

        [SetUp]
        public void SetUp()
        {
            camera = new GameObject("Testkamera").AddComponent<Camera>();
            camera.aspect = 16f / 9f;
            rig = new BroadcastCamera(camera);
            match = new MatchState
            {
                Phase = MatchPhase.Playing,
                Controlled = 0,
                Players = new[] { new PlayerState(), new PlayerState() }
            };
        }

        [TearDown]
        public void TearDown() => Object.DestroyImmediate(camera.gameObject);

        [Test]
        public void ClosePlayMagnifiesPlayersAndPreservesInputDirection()
        {
            rig.Present(match, new Vector3(0, .11f, 0), 1, false, 0);
            Vector3 focus = new Vector3(0, .95f, 0);
            var originalOffset = new Vector3(18.5f, 12f, -7f);
            Assert.That(Vector3.Distance(camera.transform.position, focus), Is.LessThan(originalOffset.magnitude * .8f));
            Assert.That(Vector3.Dot(camera.transform.forward, -originalOffset.normalized), Is.EqualTo(1f).Within(.0001f));
        }

        [TestCase(16f / 9f)]
        [TestCase(9f / 16f)]
        public void LoftedPassFitsTheBallAndReceivingPlayer(float aspect)
        {
            camera.aspect = aspect;
            match.Ball.IntendedReceiver = 1;
            match.Ball.Velocity = new V2(0, 23f);
            match.Players[1].Position = new V2(-3f, 19f);
            var ball = new Vector3(2f, 4.5f, 0f);

            rig.Present(match, ball, 1, false, 0);

            IsVisible(ball);
            IsVisible(new Vector3(-3f, .95f, 19f));
        }

        [Test]
        public void FocusUsesTheVisibleInterpolatedPlayer()
        {
            match.Players[0].Position = new V2(0f, 22f);
            var ball = new Vector3(0, .11f, 0);
            rig.Present(match, ball, 0, false, 0);
            Vector3 atPreviousTick = camera.transform.position;
            rig.Reset();
            rig.Present(match, ball, 1, false, 0);

            Assert.That(Vector3.Distance(atPreviousTick, camera.transform.position), Is.GreaterThan(2f));
            IsVisible(new Vector3(0, .95f, 22f));
        }

        [Test]
        public void CameraRecentersAtKickoffWithoutCarryingPreviousTracking()
        {
            rig.Present(match, new Vector3(14f, 1f, 46f), 1, false, .016f);
            match.Phase = MatchPhase.KickOff;
            Vector3 centre = new Vector3(0, .11f, 0);
            rig.Present(match, centre, 1, false, .016f);

            Vector3 viewport = camera.WorldToViewportPoint(centre);
            Assert.That(viewport.x, Is.EqualTo(.5f).Within(.001f));
            IsVisible(centre);
        }

        [Test]
        public void FramingSettlesToTheSamePoseAt60And120Hz()
        {
            Vector3 Simulate(int hz)
            {
                rig.Reset();
                rig.Present(match, new Vector3(0, .11f, 0), 1, false, 0);
                for (int i = 1; i <= hz * 2; i++)
                {
                    float time = (float)i / hz;
                    var ball = new Vector3(0, .11f, Mathf.Min(time * 18f, 18f));
                    match.Ball.Velocity = new V2(0, time < 1f ? 18f : 0f);
                    rig.Present(match, ball, 1, false, 1f / hz);
                    IsVisible(ball);
                }
                return camera.transform.position;
            }

            Vector3 at60Hz = Simulate(60);
            Vector3 at120Hz = Simulate(120);
            Assert.That(Vector3.Distance(at60Hz, at120Hz), Is.LessThan(.1f));
        }

        [Test]
        public void ReducedMotionRemovesVelocityLookAhead()
        {
            var ball = new Vector3(0, .11f, 0);
            rig.Present(match, ball, 1, true, 0);
            Vector3 withoutVelocity = camera.transform.position;
            match.Ball.Velocity = new V2(8f, 28f);
            rig.Reset();
            rig.Present(match, ball, 1, true, 0);

            Assert.That(Vector3.Distance(withoutVelocity, camera.transform.position), Is.LessThan(.0001f));
        }

        private void IsVisible(Vector3 point)
        {
            Vector3 viewport = camera.WorldToViewportPoint(point);
            Assert.That(viewport.z, Is.GreaterThan(camera.nearClipPlane));
            Assert.That(viewport.x, Is.InRange(.06f, .94f));
            Assert.That(viewport.y, Is.InRange(.06f, .94f));
        }
    }
}
#endif
