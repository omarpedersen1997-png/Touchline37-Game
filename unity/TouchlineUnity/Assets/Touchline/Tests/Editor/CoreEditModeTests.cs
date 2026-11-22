#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using Touchline.Core;

namespace Touchline.Tests
{
    public sealed class CoreEditModeTests
    {
        private static ClubProfile Club()
        {
            var club=new ClubProfile();var roles=ClubRules.Roles("4-3-3");for(int i=0;i<11;i++)club.Players.Add(new PlayerProfile{Id="p"+i,Name="Spiller "+i,Position=roles[i],Number=i+1});return club;
        }
        [Test] public void StrengthPreservesExistingPositionPenalty(){var c=Club();Assert.That(ClubRules.Strength(c),Is.EqualTo(50));c.Players[9].Position="FOR";Assert.That(ClubRules.Strength(c),Is.EqualTo(49));}
        [Test] public void KickoffIsCentred(){var s=new MatchSimulation(Club()).State;Assert.That(s.Ball.Position.Length,Is.EqualTo(0));Assert.That(s.Phase,Is.EqualTo(MatchPhase.KickOff));}
        [Test] public void FirstPassGoesBackwards(){var sim=new MatchSimulation(Club());for(int i=0;i<75;i++)sim.Step(new MatchInput());Assert.That(sim.State.Phase,Is.EqualTo(MatchPhase.Playing));Assert.That(sim.State.Ball.Velocity.Z,Is.LessThan(0));}
        [Test] public void OldRecordingsAreNeverAcceptedAsUnityRules(){var s=new MatchSimulation(Club()).State;s.Rules="motor11-r3";Assert.Throws<System.ArgumentException>(()=>new MatchSimulation(s));}
        [Test] public void FullTimeRewardCannotBeClaimedTwice(){var c=Club();var s=new MatchSimulation(c).State;s.Phase=MatchPhase.FullTime;Assert.That(ClubRules.Settle(c,s),Is.True);Assert.That(ClubRules.Settle(c,s),Is.False);}
        [Test] public void FourSecondsAtDifferentRenderRatesProduceSameTickCount(){foreach(int hz in new[]{30,60,120}){var step=new MatchStepper(new MatchSimulation(Club()));for(int i=0;i<hz*4;i++)step.Advance(1d/hz,()=>new MatchInput());Assert.That(step.Simulation.State.Tick,Is.EqualTo(240));}}
    }
}
#endif
